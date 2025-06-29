// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from "jsr:@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  addHcpStrokesToScores,
  applyHandicapCaps,
  calculateAdjustedGrossScore,
  calculateAdjustedPlayedScore,
  calculateCourseHandicap,
  calculateHandicapIndex,
  calculateLowHandicapIndex,
  calculateScoreDifferential,
  ProcessedRound,
} from "./utils.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXCEPTIONAL_ROUND_THRESHOLD = 7;
const MAX_SCORE_DIFFERENTIAL = 54;
const ESR_WINDOW_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profile")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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

    if (!userRoundsRaw.length) {
      // No approved rounds, set user index to maximum
      await supabase
        .from("profile")
        .update({ handicapIndex: MAX_SCORE_DIFFERENTIAL })
        .eq("id", userId);
      return new Response(
        JSON.stringify({
          message: "No approved rounds found, handicap set to maximum",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Fetch all teeInfo needed
    const teeIds = new Set(userRoundsRaw.map((r) => r.teeId));
    const { data: teesRaw, error: teesError } = await supabase
      .from("tee_info")
      .select("*")
      .in("id", Array.from(teeIds));

    if (teesError) {
      throw teesError;
    }

    // 4. Fetch all holes for those teeIds
    const { data: holesRaw, error: holesError } = await supabase
      .from("hole")
      .select("*")
      .in("teeId", Array.from(teeIds));

    if (holesError) {
      throw holesError;
    }

    // 5. Fetch all scores for these rounds
    const roundIds = userRoundsRaw.map((r) => r.id);
    const { data: scoresRaw, error: scoresError } = await supabase
      .from("score")
      .select("*")
      .in("roundId", roundIds);

    if (scoresError) {
      throw scoresError;
    }

    // Build in-memory maps
    const teeMap = new Map(
      teesRaw.map((tee) => [
        tee.id,
        tee,
      ]),
    );

    const roundScoresMap = new Map(
      roundIds.map((roundId) => [
        roundId,
        scoresRaw.filter((s) => s.roundId === roundId),
      ]),
    );

    const holesMap = new Map(
      Array.from(teeIds).map((teeId) => [
        teeId,
        holesRaw.filter((h) => h.teeId === teeId),
      ]),
    );

    // Initialize processed rounds array
    const processedRounds: ProcessedRound[] = userRoundsRaw.map((r) => ({
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
        numberOfHolesPlayed,
      );

      const scoresWithHcpStrokes = addHcpStrokesToScores(
        holes,
        roundScores,
        courseHandicap,
        numberOfHolesPlayed,
      );

      const adjustedPlayedScore = calculateAdjustedPlayedScore(
        holes,
        scoresWithHcpStrokes,
      );

      const adjustedGrossScore = calculateAdjustedGrossScore(
        adjustedPlayedScore,
        courseHandicap,
        numberOfHolesPlayed,
        teePlayed,
      );

      pr.adjustedGrossScore = adjustedGrossScore;
      pr.adjustedPlayedScore = adjustedPlayedScore;
      pr.courseHandicap = courseHandicap;
    }

    // Pass 2: Calculate raw differentials and detect ESR
    let rollingIndex = MAX_SCORE_DIFFERENTIAL;
    for (let i = 0; i < processedRounds.length; i++) {
      const pr = processedRounds[i];
      pr.existingHandicapIndex = rollingIndex;

      const teePlayed = teeMap.get(pr.teeId);
      if (!teePlayed) throw new Error(`Tee not found for round ${pr.id}`);

      pr.rawDifferential = calculateScoreDifferential(
        pr.adjustedGrossScore,
        teePlayed.courseRating18,
        teePlayed.slopeRating18,
      );

      const startIdx = Math.max(0, i - (ESR_WINDOW_SIZE - 1));
      const relevantDifferentials = processedRounds
        .slice(startIdx, i + 1)
        .map((r) => r.rawDifferential);
      pr.updatedHandicapIndex = calculateHandicapIndex(relevantDifferentials);

      const difference = rollingIndex - pr.rawDifferential;
      if (difference >= EXCEPTIONAL_ROUND_THRESHOLD) {
        const offset = difference >= 10 ? 2 : 1;
        const startIdx = Math.max(
          0,
          i - (Math.min(ESR_WINDOW_SIZE, i + 1) - 1),
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
      pr.existingHandicapIndex = processedRounds[i - 1].updatedHandicapIndex;

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
          lowHandicapIndex,
        );
      } else {
        pr.updatedHandicapIndex = calculatedIndex;
      }

      pr.updatedHandicapIndex = Math.min(
        pr.updatedHandicapIndex,
        MAX_SCORE_DIFFERENTIAL,
      );
    }

    // Update all rounds in a single pass
    for (const pr of processedRounds) {
      await supabase
        .from("round")
        .update({
          existingHandicapIndex: pr.existingHandicapIndex,
          scoreDifferential: pr.finalDifferential,
          updatedHandicapIndex: pr.updatedHandicapIndex,
          exceptionalScoreAdjustment: pr.esrOffset,
          adjustedGrossScore: pr.adjustedGrossScore,
          courseHandicap: pr.courseHandicap,
          adjustedPlayedScore: pr.adjustedPlayedScore,
        })
        .eq("id", pr.id);
    }

    // Update user's final handicap index
    await supabase
      .from("profile")
      .update({
        handicapIndex:
          processedRounds[processedRounds.length - 1].updatedHandicapIndex,
      })
      .eq("id", userId);

    return new Response(
      JSON.stringify({
        message: "Handicap calculation completed successfully",
        finalHandicapIndex:
          processedRounds[processedRounds.length - 1].updatedHandicapIndex,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/handicap-engine' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
