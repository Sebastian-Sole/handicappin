import type { Hole, Score, Tee } from "./types";
import {
  calculateCourseHandicap,
  calculateAdjustedPlayedScore,
  calculateAdjustedGrossScore,
  calculateScoreDifferential,
  calculateExpected9HoleDifferential,
  calculate9HoleScoreDifferential,
  calculateHandicapIndex,
  calculateLowHandicapIndex,
  applyHandicapCaps,
  addHcpStrokesToScores,
  type ProcessedRound,
} from "./calculations";
import {
  EXCEPTIONAL_ROUND_THRESHOLD,
  ESR_WINDOW_SIZE,
  MAX_SCORE_DIFFERENTIAL,
} from "./constants";

/**
 * Inputs to {@link computeHandicapTimeline}.
 *
 * `processedRounds` must be pre-sorted chronologically (ascending `teeTime`)
 * with `id`, `teeId`, `teeTime`, and `approvalStatus` populated for every
 * entry — every other field is overwritten by this function, so callers do
 * not need to pre-seed them.
 */
export type TimelineInputs = {
  processedRounds: ProcessedRound[];
  teeMap: Map<number, Tee>;
  roundScoresMap: Map<number, Score[]>;
  /** Holes for the tee played, keyed by teeId. */
  holesMap: Map<number, Hole[]>;
  /**
   * Which 9-hole section ("front" | "back") was played, keyed by round id.
   * Only consulted for rounds with exactly 9 scores. An absent entry
   * defaults to "front" — this matches the `nineHoleSection ?? "front"`
   * fallback used by the original inline orchestrator code.
   */
  nineHoleSections: Map<number, "front" | "back">;
  initialHandicapIndex: number;
};

/**
 * Computes the full rolling handicap timeline for a chronologically ordered
 * set of approved rounds: course handicap / adjusted gross score / adjusted
 * played score per round, raw score differentials (18-hole and 9-hole per
 * USGA Rule 5.1b), Exceptional Score Reduction (ESR) detection and offset
 * application, and the capped rolling handicap index per USGA Rule 5.7.
 *
 * This is a verbatim extraction of the two-pass computation that used to
 * live inline in `supabase/functions/process-handicap-queue/index.ts`
 * (see that file's git history prior to Plan 008 for the pre-extraction
 * version). No arithmetic was changed during the extraction. This function
 * must remain the ONLY implementation of this logic — it is mirrored
 * (never reimplemented) into `supabase/functions/handicap-shared/timeline.ts`
 * for the Deno edge runtime, and `scripts/check-handicap-sync.mjs` enforces
 * that the mirror stays byte-for-byte in sync.
 *
 * Known smell (CORRECTNESS-02, tracked separately, NOT fixed here): the ESR
 * detection in the first pass compares against an uncapped rolling index
 * (`rollingIndex`), not the capped index that Pass 2 ultimately produces.
 * This can make ESR detection disagree with what a capped player's "true"
 * index implies. See `apps/web/tests/unit/handicap/timeline.test.ts` for
 * characterization cases that measure (but do not fix) this behavior.
 */
export function computeHandicapTimeline(
  inputs: TimelineInputs
): ProcessedRound[] {
  const { teeMap, roundScoresMap, holesMap, nineHoleSections, initialHandicapIndex } =
    inputs;

  // Work on fresh copies so the caller's input objects are never mutated,
  // and so every computed field starts from the same baseline the
  // orchestrator used to seed `processedRounds` before running the passes.
  const processedRounds: ProcessedRound[] = inputs.processedRounds.map(
    (pr) => ({
      id: pr.id,
      teeTime: pr.teeTime,
      existingHandicapIndex: MAX_SCORE_DIFFERENTIAL,
      rawDifferential: 0,
      esrOffset: 0,
      finalDifferential: 0,
      updatedHandicapIndex: 0,
      adjustedGrossScore: 0,
      adjustedPlayedScore: 0,
      teeId: pr.teeId,
      courseHandicap: 0,
      approvalStatus: pr.approvalStatus,
    })
  );

  // Pass 1+2 (merged): Compute AGS/APS/courseHandicap using a rolling
  // handicap index (USGA correctness), then derive raw differentials and
  // detect ESR. Previously Pass 1 used a fixed `MAX_SCORE_DIFFERENTIAL`
  // (54) for every round which inflated AGS for established players
  // because the per-hole NDB caps (`addHcpStrokesToScores` ->
  // `calculateAdjustedPlayedScore`) were computed against far too many
  // strokes. Each round's data only depends on its own rolling index
  // and prior rounds' rawDifferentials (for ESR window), so merging the
  // two passes is functionally equivalent to the old order plus the
  // rolling-index correction.
  let rollingIndex = initialHandicapIndex;
  for (let i = 0; i < processedRounds.length; i++) {
    const pr = processedRounds[i];
    // IMPORTANT: assign rolling index BEFORE any AGS/APS/courseHandicap
    // computation so they use the correct index for this round.
    pr.existingHandicapIndex = rollingIndex;

    const teePlayed = teeMap.get(pr.teeId);
    if (!teePlayed) throw new Error(`Tee not found for round ${pr.id}`);

    const roundScores = roundScoresMap.get(pr.id);
    if (!roundScores) throw new Error(`Scores not found for round ${pr.id}`);

    const holesForRound = holesMap.get(pr.teeId);
    if (!holesForRound)
      throw new Error(`Holes not found for tee ${pr.teeId}`);

    const numberOfHolesPlayed = roundScores.length;
    // Use the round's recorded section (front/back) so back-9 rounds
    // pick the right ratings/par. Missing entries fall back to "front".
    const sectionForCourseHandicap: "front" | "back" =
      nineHoleSections.get(pr.id) ?? "front";

    const courseHandicap = calculateCourseHandicap(
      pr.existingHandicapIndex,
      teePlayed,
      numberOfHolesPlayed,
      sectionForCourseHandicap
    );

    const scoresWithHcpStrokes = addHcpStrokesToScores(
      holesForRound,
      roundScores,
      courseHandicap,
      numberOfHolesPlayed
    );

    // Determine if player has an established handicap (USGA requires 3+ rounds)
    // For rounds 0, 1, 2 (first 3 rounds): player does not have established handicap
    // For rounds 3+ : player has established handicap
    const hasEstablishedHandicap = i >= 3;

    const adjustedPlayedScore = calculateAdjustedPlayedScore(
      holesForRound,
      scoresWithHcpStrokes,
      hasEstablishedHandicap
    );

    const adjustedGrossScore = calculateAdjustedGrossScore(
      adjustedPlayedScore,
      courseHandicap,
      numberOfHolesPlayed,
      holesForRound,
      roundScores
    );

    pr.adjustedGrossScore = adjustedGrossScore;
    pr.adjustedPlayedScore = adjustedPlayedScore;
    pr.courseHandicap = courseHandicap;

    // Calculate differential based on holes played (USGA Rule 5.1b for 9-hole)
    if (numberOfHolesPlayed === 9) {
      // Pick front-9 or back-9 ratings/par per USGA Rule 5.1b based on section.
      const section: "front" | "back" =
        nineHoleSections.get(pr.id) ?? "front";
      const isBack = section === "back";
      const nineHoleCourseRating = isBack
        ? teePlayed.courseRatingBack9
        : teePlayed.courseRatingFront9;
      const nineHoleSlopeRating = isBack
        ? teePlayed.slopeRatingBack9
        : teePlayed.slopeRatingFront9;
      const nineHolePar = isBack ? teePlayed.inPar : teePlayed.outPar;

      const expectedDifferential = calculateExpected9HoleDifferential(
        pr.existingHandicapIndex,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        nineHolePar
      );

      // Calculate 18-hole equivalent differential
      pr.rawDifferential = calculate9HoleScoreDifferential(
        pr.adjustedPlayedScore, // Use adjustedPlayedScore for 9-hole, not adjustedGrossScore
        nineHoleCourseRating,
        nineHoleSlopeRating,
        expectedDifferential
      );
    } else {
      // 18-hole calculation uses 18-hole ratings
      pr.rawDifferential = calculateScoreDifferential(
        pr.adjustedGrossScore,
        teePlayed.courseRating18,
        teePlayed.slopeRating18
      );
    }

    const startIdx = Math.max(0, i - (ESR_WINDOW_SIZE - 1));
    const relevantDifferentials = processedRounds
      .slice(startIdx, i + 1)
      .map((round) => round.rawDifferential);
    pr.updatedHandicapIndex = calculateHandicapIndex(relevantDifferentials);

    const difference = rollingIndex - pr.rawDifferential;
    if (difference >= EXCEPTIONAL_ROUND_THRESHOLD) {
      const offset = difference >= 10 ? 2 : 1;
      const esrStartIdx = Math.max(
        0,
        i - (Math.min(ESR_WINDOW_SIZE, i + 1) - 1)
      );
      for (let j = esrStartIdx; j <= i; j++) {
        processedRounds[j].esrOffset += offset;
      }
    }

    rollingIndex = pr.updatedHandicapIndex;
  }

  // Pass 2: Apply ESR offsets and calculate final differentials
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

    // Apply soft/hard caps per USGA Rule 5.7.
    // calculateLowHandicapIndex returns null when no rounds exist in the
    // 365-day window, and applyHandicapCaps short-circuits on null — so the
    // null-check inside applyHandicapCaps is the correct gate (not a 20-round
    // threshold, which Rule 5.7 does not require).
    pr.updatedHandicapIndex = applyHandicapCaps(
      calculatedIndex,
      calculateLowHandicapIndex(processedRounds, i)
    );

    pr.updatedHandicapIndex = Math.min(
      pr.updatedHandicapIndex,
      MAX_SCORE_DIFFERENTIAL
    );
  }

  return processedRounds;
}
