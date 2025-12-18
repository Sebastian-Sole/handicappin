import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { env } from "@/env";
import { logger } from "@/lib/logging";
import { captureSentryError } from "@/lib/sentry-utils";
import {
  calculateHandicapIndex,
  calculateScoreDifferential,
  calculateCourseHandicap,
  calculateAdjustedGrossScore,
  calculateAdjustedPlayedScore,
  calculateLowHandicapIndex,
  applyHandicapCaps,
  addHcpStrokesToScores,
  type ProcessedRound,
  holeResponseSchema,
  roundResponseSchema,
  scoreResponseSchema,
  teeResponseSchema,
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

    // Environment check: only run in production
    const vercelEnv = process.env.VERCEL_ENV || "development";
    if (vercelEnv !== "production") {
      logger.info("Cron skipped - not production environment", {
        environment: vercelEnv,
      });
      return NextResponse.json({
        message: `Cron only runs in production (current: ${vercelEnv})`,
      });
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

    // 3. Fetch tee info
    const teeIds = new Set(userRounds.map((r) => r.teeId));
    const { data: teesRaw, error: teesError } = await supabase
      .from("teeInfo")
      .select("*")
      .in("id", Array.from(teeIds));

    if (teesError) throw teesError;

    const parsedTees = teeResponseSchema.safeParse(teesRaw);
    if (!parsedTees.success) {
      throw new Error("Invalid tees data: " + parsedTees.error.message);
    }
    const tees = parsedTees.data;

    // 4. Fetch holes
    const { data: holesRaw, error: holesError } = await supabase
      .from("hole")
      .select("*")
      .in("teeId", Array.from(teeIds));

    if (holesError) throw holesError;

    const parsedHoles = holeResponseSchema.safeParse(holesRaw);
    if (!parsedHoles.success) {
      throw new Error("Invalid holes data: " + parsedHoles.error.message);
    }
    const holes = parsedHoles.data;

    // 5. Fetch scores
    const roundIds = userRounds.map((r) => r.id);
    const { data: scoresRaw, error: scoresError } = await supabase
      .from("score")
      .select("*")
      .in("roundId", roundIds);

    if (scoresError) throw scoresError;

    const parsedScores = scoreResponseSchema.safeParse(scoresRaw);
    if (!parsedScores.success) {
      throw new Error("Invalid scores data: " + parsedScores.error.message);
    }
    const scores = parsedScores.data;

    // Build in-memory maps
    const teeMap = new Map(tees.map((tee) => [tee.id, tee]));
    const roundScoresMap = new Map(
      roundIds.map((roundId) => [
        roundId,
        scores.filter((s) => s.roundId === roundId),
      ])
    );
    const holesMap = new Map(
      Array.from(teeIds).map((teeId) => [
        teeId,
        holes.filter((h) => h.teeId === teeId),
      ])
    );

    // Initialize processed rounds array
    const processedRounds: ProcessedRound[] = userRounds.map((r) => ({
      id: r.id,
      teeTime: new Date(r.teeTime),
      existingHandicapIndex: MAX_SCORE_DIFFERENTIAL,
      rawDifferential: 0,
      esrOffset: 0,
      finalDifferential: 0,
      updatedHandicapIndex: 0,
      adjustedGrossScore: 0,
      adjustedPlayedScore: 0,
      teeId: r.teeId,
      courseHandicap: 0,
      approvalStatus: r.approvalStatus,
    }));

    // Pass 1: Calculate adjusted gross scores
    for (const pr of processedRounds) {
      const teePlayed = teeMap.get(pr.teeId);
      if (!teePlayed) throw new Error(`Tee not found for round ${pr.id}`);

      const roundScores = roundScoresMap.get(pr.id);
      if (!roundScores) throw new Error(`Scores not found for round ${pr.id}`);

      const holes = holesMap.get(pr.teeId);
      if (!holes) throw new Error(`Holes not found for tee ${pr.teeId}`);

      const numberOfHolesPlayed = roundScores.length;

      const courseHandicap = calculateCourseHandicap(
        pr.existingHandicapIndex,
        teePlayed,
        numberOfHolesPlayed
      );

      const scoresWithHcpStrokes = addHcpStrokesToScores(
        holes,
        roundScores,
        courseHandicap,
        numberOfHolesPlayed
      );

      const adjustedPlayedScore = calculateAdjustedPlayedScore(
        holes,
        scoresWithHcpStrokes
      );

      const adjustedGrossScore = calculateAdjustedGrossScore(
        adjustedPlayedScore,
        courseHandicap,
        numberOfHolesPlayed,
        holes,
        roundScores
      );

      pr.adjustedGrossScore = adjustedGrossScore;
      pr.adjustedPlayedScore = adjustedPlayedScore;
      pr.courseHandicap = courseHandicap;
    }

    // Pass 2: Calculate raw differentials and detect ESR
    let rollingIndex = initialHandicapIndex;
    for (let i = 0; i < processedRounds.length; i++) {
      const pr = processedRounds[i];
      pr.existingHandicapIndex = rollingIndex;

      const teePlayed = teeMap.get(pr.teeId);
      if (!teePlayed) throw new Error(`Tee not found for round ${pr.id}`);

      pr.rawDifferential = calculateScoreDifferential(
        pr.adjustedGrossScore,
        teePlayed.courseRating18,
        teePlayed.slopeRating18
      );

      const startIdx = Math.max(0, i - (ESR_WINDOW_SIZE - 1));
      const relevantDifferentials = processedRounds
        .slice(startIdx, i + 1)
        .map((round) => round.rawDifferential);
      pr.updatedHandicapIndex = calculateHandicapIndex(relevantDifferentials);

      const difference = rollingIndex - pr.rawDifferential;
      if (difference >= EXCEPTIONAL_ROUND_THRESHOLD) {
        const offset = difference >= 10 ? 2 : 1;
        const startIdx = Math.max(
          0,
          i - (Math.min(ESR_WINDOW_SIZE, i + 1) - 1)
        );
        for (let j = startIdx; j <= i; j++) {
          processedRounds[j].esrOffset += offset;
        }
      }

      rollingIndex = pr.updatedHandicapIndex;
    }

    // Pass 3: Apply ESR offsets and calculate final differentials
    for (let i = 0; i < processedRounds.length; i++) {
      const pr = processedRounds[i];
      pr.existingHandicapIndex =
        i === 0
          ? initialHandicapIndex
          : processedRounds[i - 1].updatedHandicapIndex;

      pr.finalDifferential = pr.rawDifferential - pr.esrOffset;
      const startIdx = Math.max(0, i - (ESR_WINDOW_SIZE - 1));
      const relevantDifferentials = processedRounds
        .slice(startIdx, i + 1)
        .map((r) => r.finalDifferential);
      const calculatedIndex = calculateHandicapIndex(relevantDifferentials);

      if (processedRounds.length >= 20) {
        const lowHandicapIndex = calculateLowHandicapIndex(processedRounds, i);
        pr.updatedHandicapIndex = applyHandicapCaps(
          calculatedIndex,
          lowHandicapIndex
        );
      } else {
        pr.updatedHandicapIndex = calculatedIndex;
      }

      pr.updatedHandicapIndex = Math.min(
        pr.updatedHandicapIndex,
        MAX_SCORE_DIFFERENTIAL
      );
    }

    // Perform all DB updates atomically in a single transaction via stored procedure
    const roundUpdates = processedRounds.map((pr) => ({
      id: pr.id,
      existingHandicapIndex: pr.existingHandicapIndex,
      scoreDifferential: pr.finalDifferential,
      updatedHandicapIndex: pr.updatedHandicapIndex,
      exceptionalScoreAdjustment: pr.esrOffset,
      adjustedGrossScore: pr.adjustedGrossScore,
      courseHandicap: pr.courseHandicap,
      adjustedPlayedScore: pr.adjustedPlayedScore,
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
