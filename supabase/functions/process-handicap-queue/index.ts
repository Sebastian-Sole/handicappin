import { createClient } from "jsr:@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import existing handicap calculation logic
import { ProcessedRound } from "../handicap-shared/utils.ts";
import { computeHandicapTimeline } from "../handicap-shared/timeline.ts";

import {
  holeResponseSchema,
  scoreResponseSchema,
  teeResponseSchema,
} from "../handicap-shared/shared-schemas.ts";
import { roundResponseSchema } from "../handicap-shared/round-schemas.ts";
import { MAX_SCORE_DIFFERENTIAL } from "../handicap-shared/constants.ts";

// Configuration from environment variables
const BATCH_SIZE = parseInt(Deno.env.get("HANDICAP_QUEUE_BATCH_SIZE") || "25");
const MAX_RETRIES = parseInt(Deno.env.get("HANDICAP_MAX_RETRIES") || "3");

type SupabaseClient = ReturnType<typeof createClient>;

interface QueueJob {
  id: number;
  user_id: string;
  event_type: string;
  attempts: number;
}

/**
 * Constant-time string comparison to mitigate timing attacks against the
 * shared cron secret. Deno's runtime has no `node:crypto.timingSafeEqual`,
 * so we hand-roll it: compare lengths first (length leakage is acceptable
 * for fixed-length secrets), then XOR every byte and OR the results.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i];
  return result === 0;
}

Deno.serve(async (req) => {
  console.log("Queue processor invoked");

  try {
    // Cheap method check first — fails fast on malformed probes without
    // trying to parse a body.
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Security: Shared-secret header check.
    // `config.toml` sets `verify_jwt = false` for this function so the cron job
    // can call it, which means anyone with the public Functions URL could hit
    // it. The body-level `{ scheduled: true }` check is forgeable, so we
    // require a shared secret in the `x-cron-secret` header. The cron SQL
    // (see supabase/migrations/*_secure_queue_cron_with_secret.sql) injects
    // this header from Supabase Vault via
    // `(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'handicap_cron_secret' LIMIT 1)`.
    //
    // Deployment note (manual, not automatable from local code):
    //   1. Set `HANDICAP_CRON_SECRET` in Supabase Edge Function secrets
    //      (Dashboard -> Edge Functions -> Secrets) so this runtime can read
    //      it via `Deno.env.get(...)`.
    //   2. Create the matching secret in Supabase Vault as the `postgres` role:
    //        SELECT vault.create_secret('<same secret>', 'handicap_cron_secret');
    //      (Or Dashboard -> Settings -> Vault -> New secret.) Both values MUST
    //      match. Vault is used because Supabase Cloud's `postgres` role
    //      cannot run `ALTER DATABASE ... SET` for arbitrary GUCs.
    const expectedCronSecret = Deno.env.get("HANDICAP_CRON_SECRET");
    const providedCronSecret = req.headers.get("x-cron-secret");
    if (
      !expectedCronSecret ||
      !providedCronSecret ||
      !timingSafeStringEqual(providedCronSecret, expectedCronSecret)
    ) {
      console.warn(
        "Unauthorized access attempt to process-handicap-queue (missing/mismatched x-cron-secret)"
      );
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
      console.log("No pending jobs in queue");
      return new Response(
        JSON.stringify({ message: "No pending jobs", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${pendingJobs.length} users from queue`);

    // Process all jobs in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      pendingJobs.map((job: QueueJob) => processUserHandicap(supabase, job))
    );

    // Count successes and failures
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `Queue processing complete: ${succeeded} succeeded, ${failed} failed`
    );

    return new Response(
      JSON.stringify({
        message: "Queue processing complete",
        processed: pendingJobs.length,
        succeeded,
        failed,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Queue processor error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * Process handicap calculation for a single user
 * Uses shared utilities from handicap-shared/utils.ts
 */
async function processUserHandicap(
  supabase: SupabaseClient,
  job: QueueJob
): Promise<void> {
  try {
    console.log(
      `Processing job ${job.id}, attempt ${job.attempts + 1}`
    );

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

      console.log(
        `No approved rounds for job ${job.id}, handicap set to max`
      );
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

    // Build the chronologically-sorted processed-round stubs. Every other
    // field is computed by computeHandicapTimeline below.
    const processedRoundStubs: ProcessedRound[] = userRounds.map((r) => ({
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

    // Which 9-hole section (front/back) was played, keyed by round id —
    // consulted only for rounds with exactly 9 scores.
    const nineHoleSections = new Map<number, "front" | "back">();
    userRounds.forEach((r) => {
      if (r.nineHoleSection) nineHoleSections.set(r.id, r.nineHoleSection);
    });

    // Compute the rolling handicap timeline (course handicap / AGS / APS,
    // Exceptional Score Reduction detection and offset application, and the
    // soft/hard-capped rolling handicap index) in one call. This is the
    // ONLY implementation of the merged Pass 1 + Pass 2 logic — see
    // packages/handicap-core/src/timeline.ts (mirrored here as
    // handicap-shared/timeline.ts, kept in sync via
    // scripts/check-handicap-sync.mjs). Do not reintroduce the two-pass
    // loop inline here.
    const processedRounds = computeHandicapTimeline({
      processedRounds: processedRoundStubs,
      teeMap,
      roundScoresMap,
      holesMap,
      nineHoleSections,
      initialHandicapIndex,
    });

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

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "process_handicap_updates",
      {
        round_updates: roundUpdates,
        user_id: userId,
        new_handicap_index:
          processedRounds[processedRounds.length - 1].updatedHandicapIndex,
        queue_job_id: job.id,
      }
    );

    if (rpcError) {
      throw rpcError;
    }

    console.log(`Successfully processed handicap for job ${job.id}`);
  } catch (error: unknown) {
    // Handle failure: update queue entry with error
    console.error(`Failed to process user ${job.user_id}:`, error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
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
      console.error(
        `Failed to update error status for job ${job.id} in handicap_calculation_queue:`,
        updateError
      );
    }

    // Re-throw so Promise.allSettled marks as rejected
    throw error;
  }
}
