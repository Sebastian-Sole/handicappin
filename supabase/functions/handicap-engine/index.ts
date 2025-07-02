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

import { holeResponseSchema, roundResponseSchema, scoreResponseSchema, teeResponseSchema } from "./scorecard.ts";

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

  console.log("Handicap engine called");

  try {
    const payload = await req.json();

    const userId = payload.userId ?? payload.record?.userId;

    console.log("userId", userId);

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

    console.log("supabase", supabase);

    // 1. Fetch user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profile")
      .select("*")
      .eq("id", userId)
      .single();

    console.log("userProfile", userProfile);

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get initial handicap index from profile, fallback to MAX_SCORE_DIFFERENTIAL
    const initialHandicapIndex = userProfile.initialHandicapIndex !== undefined && userProfile.initialHandicapIndex !== null
      ? Number(userProfile.initialHandicapIndex)
      : MAX_SCORE_DIFFERENTIAL;

    // 2. Fetch all approved rounds for user
    const { data: userRoundsRaw, error: roundsError } = await supabase
      .from("round")
      .select("*")
      .eq("userId", userId)
      .eq("approvalStatus", "approved")
      .order("teeTime", { ascending: true });

    console.log("userRoundsRaw", userRoundsRaw);

    if (roundsError) {
      throw roundsError;
    }

    const parsedRounds = roundResponseSchema.safeParse(userRoundsRaw);

    if (!parsedRounds.success) {
      throw new Error("Invalid rounds data: " + parsedRounds.error.message);
    }

    const userRounds = parsedRounds.data;

    console.log("userRounds", userRounds);

    if (!userRounds.length) {
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

    console.log("userRounds", userRounds);

    // 3. Fetch all teeInfo needed
    const teeIds = new Set(userRounds.map((r) => r.teeId));
    const { data: teesRaw, error: teesError } = await supabase
      .from("teeInfo")
      .select("*")
      .in("id", Array.from(teeIds));

    console.log("teesRaw", teesRaw);

    if (teesError) {
      throw teesError;
    }

    const parsedTees = teeResponseSchema.safeParse(teesRaw);

    if (!parsedTees.success) {
      throw new Error("Invalid tees data: " + parsedTees.error.message);
    }

    const tees = parsedTees.data;

    // 4. Fetch all holes for those teeIds
    const { data: holesRaw, error: holesError } = await supabase
      .from("hole")
      .select("*")
      .in("teeId", Array.from(teeIds));

    console.log("holesRaw", holesRaw);

    if (holesError) {
      throw holesError;
    }

    const parsedHoles = holeResponseSchema.safeParse(holesRaw);

    if (!parsedHoles.success) {
      throw new Error("Invalid holes data: " + parsedHoles.error.message);
    }

    const holes = parsedHoles.data;

    // 5. Fetch all scores for these rounds
    const roundIds = userRounds.map((r) => r.id);
    const { data: scoresRaw, error: scoresError } = await supabase
      .from("score")
      .select("*")
      .in("roundId", roundIds);

    console.log("scoresRaw", scoresRaw);

    if (scoresError) {
      throw scoresError;
    }

    const parsedScores = scoreResponseSchema.safeParse(scoresRaw);

    if (!parsedScores.success) {
      throw new Error("Invalid scores data: " + parsedScores.error.message);
    }

    const scores = parsedScores.data;

    // Build in-memory maps
    const teeMap = new Map(
      tees.map((tee) => [
        tee.id,
        tee,
      ]),
    );

    console.log("teeMap", teeMap);

    const roundScoresMap = new Map(
      roundIds.map((roundId) => [
        roundId,
        scores.filter((s) => s.roundId === roundId),
      ]),
    );

    console.log("roundScoresMap", roundScoresMap);

    const holesMap = new Map(
      Array.from(teeIds).map((teeId) => [
        teeId,
        holes.filter((h) => h.teeId === teeId),
      ]),
    );

    console.log("holesMap", holesMap);

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
    }));

    console.log("processedRounds", processedRounds);

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

      console.log("courseHandicap", courseHandicap);

      const scoresWithHcpStrokes = addHcpStrokesToScores(
        holes,
        roundScores,
        courseHandicap,
        numberOfHolesPlayed,
      );

      console.log("scoresWithHcpStrokes", scoresWithHcpStrokes);

      const adjustedPlayedScore = calculateAdjustedPlayedScore(
        holes,
        scoresWithHcpStrokes,
      );

      console.log("adjustedPlayedScore", adjustedPlayedScore);

      const adjustedGrossScore = calculateAdjustedGrossScore(
        adjustedPlayedScore,
        courseHandicap,
        numberOfHolesPlayed,
        teePlayed,
      );

      console.log("adjustedGrossScore", adjustedGrossScore);

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
        teePlayed.slopeRating18,
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
      pr.existingHandicapIndex = i === 0
        ? initialHandicapIndex
        : processedRounds[i - 1].updatedHandicapIndex;

      pr.finalDifferential = pr.rawDifferential - pr.esrOffset;
      const startIdx = Math.max(0, i - (ESR_WINDOW_SIZE - 1));
      const relevantDifferentials = processedRounds
        .slice(startIdx, i + 1)
        .map((r) => r.finalDifferential);
      const calculatedIndex = calculateHandicapIndex(relevantDifferentials);

      console.log("calculatedIndex", calculatedIndex);

      if (processedRounds.length >= 20) {
        const lowHandicapIndex = calculateLowHandicapIndex(processedRounds, i);
        pr.updatedHandicapIndex = applyHandicapCaps(
          calculatedIndex,
          lowHandicapIndex,
        );
      } else {
        pr.updatedHandicapIndex = calculatedIndex;
      }

      console.log("pr.updatedHandicapIndex", pr.updatedHandicapIndex);

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

    console.log("Handicap calculation completed successfully");

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
    console.error(error);
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
