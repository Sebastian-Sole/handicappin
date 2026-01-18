import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { env } from "@/env";
import { logger } from "@/lib/logging";
import { captureSentryError } from "@/lib/sentry-utils";
import {
  calculateHandicapIndex,
  calculateLowHandicapIndex,
  applyHandicapCaps,
  type ProcessedRound,
  roundResponseSchema,
  EXCEPTIONAL_ROUND_THRESHOLD,
  MAX_SCORE_DIFFERENTIAL,
  ESR_WINDOW_SIZE,
} from "@/lib/handicap";

const BATCH_SIZE = env.HANDICAP_QUEUE_BATCH_SIZE;
const MAX_RETRIES = env.HANDICAP_MAX_RETRIES;

interface QueueJob {
  id: number;
  user_id: string;
  event_type: string;
  attempts: number;
}

/**
 * Handicap Queue Processor
 * Run via external cron service (every minute)
 *
 * Authenticated via HANDICAP_CRON_SECRET environment variable.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${env.HANDICAP_CRON_SECRET}`) {
      logger.warn("Unauthorized access attempt to process-handicap-queue", {
        ip:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    logger.info("Queue processor invoked");

    const supabase = createAdminClient();

    // Fetch pending jobs from queue (up to BATCH_SIZE users)
    const { data: pendingJobs, error: fetchError } = await supabase
      .from("handicap_calculation_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      logger.info("No pending jobs in queue");
      return NextResponse.json({
        message: "No pending jobs",
        processed: 0,
      });
    }

    logger.info("Processing users from queue", { count: pendingJobs.length });

    // Process all jobs in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      pendingJobs.map((job: QueueJob) => processUserHandicap(supabase, job))
    );

    // Count successes and failures
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    logger.info("Queue processing complete", {
      total: pendingJobs.length,
      succeeded,
      failed,
    });

    return NextResponse.json({
      message: "Queue processing complete",
      processed: pendingJobs.length,
      succeeded,
      failed,
    });
  } catch (error: unknown) {
    const errorInstance =
      error instanceof Error ? error : new Error("Unknown error");

    logger.error("Queue processor error", {
      error: errorInstance.message,
      stack: errorInstance.stack,
    });

    captureSentryError(errorInstance, {
      level: "error",
      eventType: "handicap_queue_processor",
      tags: { endpoint: "process-handicap-queue" },
    });

    return NextResponse.json({ error: errorInstance.message }, { status: 500 });
  }
}

/**
 * Process handicap calculation for a single user
 * Uses shared utilities from lib/handicap
 */
async function processUserHandicap(
  supabase: ReturnType<typeof createAdminClient>,
  job: QueueJob
): Promise<void> {
  try {
    logger.info("Processing user handicap", {
      userId: job.user_id,
      attempt: job.attempts + 1,
      eventType: job.event_type,
    });

    const userId = job.user_id;

    // 1. Fetch user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profile")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      throw new Error(`User profile not found for ${userId}`);
    }

    const initialHandicapIndex =
      userProfile.initialHandicapIndex !== undefined &&
      userProfile.initialHandicapIndex !== null
        ? Number(userProfile.initialHandicapIndex)
        : MAX_SCORE_DIFFERENTIAL;

    // 2. Fetch all approved rounds for user
    const { data: userRoundsRaw, error: roundsError } = await supabase
      .from("round")
      .select("*")
      .eq("userId", userId)
      .eq("approvalStatus", "approved")
      .order("teeTime", { ascending: true });

    if (roundsError) {
      throw roundsError;
    }

    const parsedRounds = roundResponseSchema.safeParse(userRoundsRaw);
    if (!parsedRounds.success) {
      throw new Error("Invalid rounds data: " + parsedRounds.error.message);
    }

    const userRounds = parsedRounds.data;

    // If no approved rounds, set handicap to maximum using stored procedure
    if (!userRounds.length) {
      const { error: rpcError } = await supabase.rpc(
        "process_handicap_no_rounds",
        {
          user_id: userId,
          max_handicap: MAX_SCORE_DIFFERENTIAL,
          queue_job_id: job.id,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      logger.info("No approved rounds for user, handicap set to max", {
        userId,
        maxHandicap: MAX_SCORE_DIFFERENTIAL,
      });
      return;
    }

    // Initialize processed rounds with STORED values (locked at submission time)
    // Per USGA practical rules: AGS, scoreDifferential, existingHandicapIndex are locked
    const processedRounds: ProcessedRound[] = userRounds.map((r) => ({
      id: r.id,
      teeTime: new Date(r.teeTime),
      // Use stored values - these are locked at submission time
      existingHandicapIndex: r.existingHandicapIndex,
      rawDifferential: r.scoreDifferential, // Raw differential from submission
      esrOffset: 0, // Will be calculated
      finalDifferential: 0, // Will be calculated
      updatedHandicapIndex: 0, // Will be calculated
      adjustedGrossScore: r.adjustedGrossScore, // Locked at submission
      adjustedPlayedScore: r.adjustedPlayedScore, // Locked at submission
      teeId: r.teeId,
      courseHandicap: r.courseHandicap, // Locked at submission
      approvalStatus: r.approvalStatus,
    }));

    // Pass 1: Detect ESR using STORED values
    // ESR is detected by comparing stored existingHandicapIndex to stored scoreDifferential
    for (let i = 0; i < processedRounds.length; i++) {
      const pr = processedRounds[i];

      // ESR detection: compare handicap at time of play to the differential
      const difference = pr.existingHandicapIndex - pr.rawDifferential;
      if (difference >= EXCEPTIONAL_ROUND_THRESHOLD) {
        const offset = difference >= 10 ? 2 : 1;
        // Apply ESR offset to rounds in the window (most recent 20 at the time)
        const startIdx = Math.max(
          0,
          i - (Math.min(ESR_WINDOW_SIZE, i + 1) - 1)
        );
        for (let j = startIdx; j <= i; j++) {
          processedRounds[j].esrOffset += offset;
        }
      }
    }

    // Pass 2: Apply ESR offsets and calculate final handicap indices
    for (let i = 0; i < processedRounds.length; i++) {
      const pr = processedRounds[i];

      // Final differential = raw differential - ESR offset
      pr.finalDifferential = pr.rawDifferential - pr.esrOffset;

      // Calculate handicap index from final differentials
      const startIdx = Math.max(0, i - (ESR_WINDOW_SIZE - 1));
      const relevantDifferentials = processedRounds
        .slice(startIdx, i + 1)
        .map((r) => r.finalDifferential);
      const calculatedIndex = calculateHandicapIndex(relevantDifferentials);

      // Apply soft/hard caps if 20+ rounds
      if (processedRounds.length >= 20) {
        const lowHandicapIndex = calculateLowHandicapIndex(processedRounds, i);
        pr.updatedHandicapIndex = applyHandicapCaps(
          calculatedIndex,
          lowHandicapIndex
        );
      } else {
        pr.updatedHandicapIndex = calculatedIndex;
      }

      // Cap at maximum
      pr.updatedHandicapIndex = Math.min(
        pr.updatedHandicapIndex,
        MAX_SCORE_DIFFERENTIAL
      );
    }

    // Perform DB updates via stored procedure
    // Only update: updatedHandicapIndex, exceptionalScoreAdjustment
    // Do NOT update: adjustedGrossScore, courseHandicap, adjustedPlayedScore, scoreDifferential, existingHandicapIndex (locked)
    const roundUpdates = processedRounds.map((pr) => ({
      id: pr.id,
      existingHandicapIndex: pr.existingHandicapIndex, // Keep original (locked)
      scoreDifferential: pr.rawDifferential, // Keep original raw differential (locked)
      updatedHandicapIndex: pr.updatedHandicapIndex, // Recalculated with ESR
      exceptionalScoreAdjustment: pr.esrOffset, // ESR offset
      adjustedGrossScore: pr.adjustedGrossScore, // Keep original (locked)
      courseHandicap: pr.courseHandicap, // Keep original (locked)
      adjustedPlayedScore: pr.adjustedPlayedScore, // Keep original (locked)
    }));

    const { error: rpcError } = await supabase.rpc("process_handicap_updates", {
      round_updates: roundUpdates,
      user_id: userId,
      new_handicap_index:
        processedRounds[processedRounds.length - 1].updatedHandicapIndex,
      queue_job_id: job.id,
    });

    if (rpcError) {
      throw rpcError;
    }

    logger.info("Successfully processed handicap for user", {
      userId,
      roundsProcessed: processedRounds.length,
      finalHandicapIndex:
        processedRounds[processedRounds.length - 1].updatedHandicapIndex,
    });
  } catch (error: unknown) {
    const errorInstance =
      error instanceof Error ? error : new Error("Unknown error");

    // Handle failure: update queue entry with error
    logger.error("Failed to process user handicap", {
      userId: job.user_id,
      attempt: job.attempts + 1,
      error: errorInstance.message,
    });

    // Capture to Sentry for monitoring
    captureSentryError(errorInstance, {
      level: "error",
      userId: job.user_id,
      eventType: "handicap_calculation_failed",
      tags: {
        job_id: job.id.toString(),
        attempt: (job.attempts + 1).toString(),
      },
      extra: {
        event_type: job.event_type,
      },
    });

    const errorMessage = errorInstance.message;
    const newAttempts = job.attempts + 1;
    const newStatus = newAttempts >= MAX_RETRIES ? "failed" : "pending";

    try {
      await supabase
        .from("handicap_calculation_queue")
        .update({
          attempts: newAttempts,
          error_message: errorMessage,
          status: newStatus,
          last_updated: new Date().toISOString(),
        })
        .eq("id", job.id);
    } catch (updateError) {
      const updateErrorInstance =
        updateError instanceof Error
          ? updateError
          : new Error("Unknown update error");

      logger.error("Failed to update error status in queue", {
        jobId: job.id,
        error: updateErrorInstance.message,
      });

      captureSentryError(updateErrorInstance, {
        level: "error",
        eventType: "queue_update_failed",
        tags: { job_id: job.id.toString() },
      });
    }

    // Re-throw so Promise.allSettled marks as rejected
    throw error;
  }
}
