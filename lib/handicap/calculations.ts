import { Hole, Score, Tee } from "@/types/scorecard-input";
import {
  SOFT_CAP_THRESHOLD,
  HARD_CAP_THRESHOLD,
  LOW_HANDICAP_WINDOW_DAYS,
} from "./constants";
import { Tables } from "@/types/supabase";

export type ProcessedRound = {
  id: number;
  teeTime: Date;
  adjustedGrossScore: number;
  adjustedPlayedScore: number;
  existingHandicapIndex: number;
  rawDifferential: number;
  esrOffset: number;
  finalDifferential: number;
  updatedHandicapIndex: number;
  teeId: number;
  courseHandicap: number;
  approvalStatus: string;
};

/**
 * Rounds a value to 1 decimal place per USGA handicap precision requirements.
 * Handicap indices and score differentials are always displayed to one decimal place.
 */
export function roundToHandicapPrecision(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Calculates the course handicap based on the handicap index, slope rating, course rating, and par.
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  teePlayed: Tee,
  numberOfHolesPlayed: number
): number {
  if (numberOfHolesPlayed === 9) {
    // Use half the handicap index for 9-hole rounds (no pre-rounding per USGA)
    // Only the final course handicap result is rounded to nearest integer
    return Math.round(
      (handicapIndex / 2) * (teePlayed.slopeRatingFront9 / 113) +
        (teePlayed.courseRatingFront9 - teePlayed.outPar)
    );
  } else {
    return Math.round(
      handicapIndex * (teePlayed.slopeRating18 / 113) +
        (teePlayed.courseRating18 - teePlayed.totalPar)
    );
  }
}

/**
 * Calculates the score differential based on the adjusted gross score, course rating, and slope rating.
 * Used for 18-hole rounds.
 */
export function calculateScoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
): number {
  const scoreDiff = (adjustedGrossScore - courseRating) * (113 / slopeRating);
  // If scoreDiff is negative, round upwards towards 0 (to 1 decimal)
  if (scoreDiff < 0) {
    return Math.ceil(scoreDiff * 10) / 10;
  }
  // Otherwise, round to 1 decimal as usual
  return Math.round(scoreDiff * 10) / 10;
}

/**
 * Calculates the expected 9-hole differential for the unplayed 9 holes.
 * This is used per USGA Rule 5.1b to create an 18-hole equivalent from a 9-hole round.
 *
 * Formula: Expected Score = Par + 9-hole Course Handicap
 * Then: Expected Differential = (Expected Score - 9-hole Course Rating) × (113 / 9-hole Slope)
 *
 * @param handicapIndex - The player's current handicap index
 * @param nineHoleCourseRating - The course rating for the 9 holes (front9 or back9)
 * @param nineHoleSlopeRating - The slope rating for the 9 holes (front9 or back9)
 * @param nineHolePar - The par for the 9 holes
 */
export function calculateExpected9HoleDifferential(
  handicapIndex: number,
  nineHoleCourseRating: number,
  nineHoleSlopeRating: number,
  nineHolePar: number
): number {
  // Calculate 9-hole course handicap (half the handicap index, adjusted for slope)
  const nineHoleCourseHandicap = Math.round(
    (handicapIndex / 2) * (nineHoleSlopeRating / 113) +
      (nineHoleCourseRating - nineHolePar)
  );

  // Expected score = par + course handicap for the 9 holes
  const expectedScore = nineHolePar + nineHoleCourseHandicap;

  // Calculate and return the expected differential (unrounded for combination)
  return (expectedScore - nineHoleCourseRating) * (113 / nineHoleSlopeRating);
}

/**
 * Calculates the 18-hole equivalent score differential for a 9-hole round.
 * Per USGA Rule 5.1b:
 *   9-hole Score Differential = (113 ÷ 9-hole Slope) × (9-hole adjusted score – 9-hole Course Rating)
 *   18-hole Equivalent = 9-hole played differential + expected 9-hole differential
 *
 * @param adjustedPlayedScore - The adjusted gross score for the 9 holes actually played
 * @param nineHoleCourseRating - The course rating for the played 9 holes
 * @param nineHoleSlopeRating - The slope rating for the played 9 holes
 * @param expectedNineHoleDifferential - The expected differential for the unplayed 9 holes
 */
export function calculate9HoleScoreDifferential(
  adjustedPlayedScore: number,
  nineHoleCourseRating: number,
  nineHoleSlopeRating: number,
  expectedNineHoleDifferential: number
): number {
  // Calculate the differential for the played 9 holes
  const playedDifferential =
    (adjustedPlayedScore - nineHoleCourseRating) * (113 / nineHoleSlopeRating);

  // Combine with expected differential to get 18-hole equivalent
  const combinedDifferential = playedDifferential + expectedNineHoleDifferential;

  // Round per USGA rules (negative differentials round towards zero)
  if (combinedDifferential < 0) {
    return Math.ceil(combinedDifferential * 10) / 10;
  }
  return Math.round(combinedDifferential * 10) / 10;
}

/**
 * Gets the relevant number of differentials based on the total number of rounds.
 */
export function getRelevantDifferentials(
  scoreDifferentials: number[]
): number[] {
  if (scoreDifferentials.length <= 5) {
    return scoreDifferentials.slice(0, 1);
  } else if (scoreDifferentials.length >= 6 && scoreDifferentials.length <= 8) {
    return scoreDifferentials.slice(0, 2);
  } else if (
    scoreDifferentials.length >= 9 &&
    scoreDifferentials.length <= 11
  ) {
    return scoreDifferentials.slice(0, 3);
  } else if (
    scoreDifferentials.length >= 12 &&
    scoreDifferentials.length <= 14
  ) {
    return scoreDifferentials.slice(0, 4);
  } else if (
    scoreDifferentials.length >= 15 &&
    scoreDifferentials.length <= 16
  ) {
    return scoreDifferentials.slice(0, 5);
  } else if (
    scoreDifferentials.length >= 17 &&
    scoreDifferentials.length <= 18
  ) {
    return scoreDifferentials.slice(0, 6);
  } else if (scoreDifferentials.length === 19) {
    return scoreDifferentials.slice(0, 7);
  } else {
    return scoreDifferentials.slice(0, 8);
  }
}

/**
 * Calculates the handicap index based on the given score differentials.
 */
export function calculateHandicapIndex(scoreDifferentials: number[]): number {
  const sortedDifferentials = [...scoreDifferentials].sort((a, b) => a - b);
  const relevantDiffs = getRelevantDifferentials(sortedDifferentials);
  const averageDifferential =
    relevantDiffs.reduce((acc, cur) => acc + cur) / relevantDiffs.length;
  const handicapCalculation = roundToHandicapPrecision(averageDifferential);

  if (scoreDifferentials.length < 3) {
    return 54;
  }

  // Apply handicap adjustment based on number of differentials
  if (scoreDifferentials.length === 3) {
    return handicapCalculation - 2;
  }
  if (scoreDifferentials.length === 4 || scoreDifferentials.length === 6) {
    return handicapCalculation - 1;
  }
  return handicapCalculation;
}

/**
 * Calculates the Low Handicap Index for a given round based on the 365-day window.
 * Per USGA Rule 5.7: The Low Handicap Index is the lowest Handicap Index from
 * the player's scoring record in the 365-day period preceding the day the
 * most recent score was played.
 *
 * @returns The lowest handicap index in the window, or null if no approved rounds
 *          exist in the 365-day window (meaning caps should not be applied).
 */
export function calculateLowHandicapIndex(
  rounds: ProcessedRound[],
  currentRoundIndex: number
): number | null {
  // Per USGA: "365 days preceding the day the most recent score was played"
  // The "most recent score" is the current round we're calculating for
  const currentRoundDate = new Date(rounds[currentRoundIndex].teeTime);
  const oneYearAgo = new Date(currentRoundDate);
  oneYearAgo.setDate(oneYearAgo.getDate() - LOW_HANDICAP_WINDOW_DAYS);

  // Get all PREVIOUS rounds (exclude the current round being processed)
  const previousRounds = rounds.slice(0, currentRoundIndex);

  // Filter to approved rounds within the 365-day window preceding the current round
  const relevantRounds = previousRounds.filter(
    (r) =>
      r.teeTime >= oneYearAgo &&
      r.teeTime <= currentRoundDate &&
      r.approvalStatus === "approved"
  );

  // Per USGA Rule 5.7: If no rounds exist in the 365-day window,
  // no Low Handicap Index is established and caps should not apply
  if (relevantRounds.length === 0) {
    return null;
  }

  const handicapIndices = relevantRounds.map((r) => r.updatedHandicapIndex);
  return Math.min(...handicapIndices);
}

/**
 * Applies soft and hard caps to a newly calculated handicap index.
 * Per USGA Rule 5.7:
 * - Soft Cap: If new index is more than 3.0 strokes above Low Handicap Index,
 *   the increase above 3.0 is reduced by 50%
 * - Hard Cap: Handicap Index cannot increase more than 5.0 strokes above
 *   Low Handicap Index
 *
 * @param newIndex - The newly calculated handicap index
 * @param lowHandicapIndex - The lowest handicap index in the 365-day window,
 *                           or null if no Low Handicap Index is established
 * @returns The capped handicap index, or the original index if no caps apply
 */
export function applyHandicapCaps(
  newIndex: number,
  lowHandicapIndex: number | null
): number {
  // Per USGA Rule 5.7: If no Low Handicap Index is established
  // (no rounds in the 365-day window), caps do not apply
  if (lowHandicapIndex === null) {
    return newIndex;
  }

  const difference = newIndex - lowHandicapIndex;

  if (difference <= 0) {
    return newIndex;
  }

  let cappedIndex = newIndex;
  if (difference > SOFT_CAP_THRESHOLD) {
    const softCapIncrease =
      SOFT_CAP_THRESHOLD + (difference - SOFT_CAP_THRESHOLD) * 0.5;
    cappedIndex = lowHandicapIndex + softCapIncrease;
  }

  return roundToHandicapPrecision(
    Math.min(cappedIndex, lowHandicapIndex + HARD_CAP_THRESHOLD)
  );
}

export const calculateAdjustedPlayedScore = (
  holes: Hole[],
  scores: Score[],
  hasEstablishedHandicap: boolean = true
): number => {
  const adjustedScores = holes.map((hole, index) => {
    const score = scores[index];
    // If no score exists for this hole, return 0 (hole not played)
    if (!score) {
      return 0;
    }
    return calculateHoleAdjustedScore(hole, score, hasEstablishedHandicap);
  });
  return adjustedScores.reduce((acc, cur) => acc + cur);
};

/**
 * Calculates the adjusted score for a single hole per USGA Rule 3.1.
 *
 * Rule 3.1a (No established handicap): Max = Par + 5
 * Rule 3.1b (With established handicap): Max = Par + 2 + handicap strokes on hole
 *   - Exception: If player receives 4+ strokes on a hole, max is Par + 5
 *
 * @param hole - The hole being played
 * @param score - The player's score on the hole
 * @param hasEstablishedHandicap - Whether the player has an established handicap index
 */
export const calculateHoleAdjustedScore = (
  hole: Hole,
  score: Score,
  hasEstablishedHandicap: boolean = true
): number => {
  // Rule 3.1a: For players without established handicap, max is Par + 5
  if (!hasEstablishedHandicap) {
    return Math.min(score.strokes, hole.par + 5);
  }

  // Rule 3.1b: For players with established handicap, max is Net Double Bogey
  // Net Double Bogey = Par + 2 + handicap strokes received on that hole
  // Exception: If receiving 4+ strokes, max is Par + 5 (handled by Math.min)
  const netDoubleBogey = hole.par + 2 + score.hcpStrokes;
  const maxScore = Math.min(hole.par + 5, netDoubleBogey);
  return Math.min(score.strokes, maxScore);
};

/**
 * Calculates the adjusted gross score for a round.
 * For partial rounds (less than 18 holes), estimates the score for unplayed holes
 * using par plus predicted handicap strokes.
 *
 * Note: Supports non-sequential hole play (e.g., holes 1-9, 11, and 13) via holeId matching.
 */
export function calculateAdjustedGrossScore(
  adjustedPlayedScore: number,
  courseHandicap: number,
  numberOfHolesPlayed: number,
  holes: Hole[],
  roundScores: Score[]
): number {
  let adjustedGrossScore;
  if (numberOfHolesPlayed === 18) {
    adjustedGrossScore = adjustedPlayedScore;
  } else {
    const holesLeft = 18 - numberOfHolesPlayed;
    const predictedStrokes = Math.round((courseHandicap / 18) * holesLeft);
    // Get the holes for which there isn't a registered score, and sum the par of these holes
    const parForRemainingHoles = holes
      .filter((hole) => !roundScores.some((score) => score.holeId === hole.id))
      .reduce((acc, cur) => acc + cur.par, 0);
    adjustedGrossScore =
      adjustedPlayedScore + predictedStrokes + parForRemainingHoles;
  }

  return adjustedGrossScore;
}

export function addHcpStrokesToScores(
  holes: Hole[],
  roundScores: Score[],
  courseHandicap: number,
  numberOfHolesPlayed: number
): Score[] {
  // Ensure courseHandicap is never negative
  const safeCourseHandicap = Math.max(0, courseHandicap);
  const fullDivision = Math.floor(safeCourseHandicap / numberOfHolesPlayed);
  const remainder = safeCourseHandicap % numberOfHolesPlayed;

  // Get only the holes that were played, in the order of roundScores
  return roundScores.map((score, index) => {
    const hole = holes.find((hole) => hole.id === score.holeId);
    if (!hole) {
      throw new Error(`Hole not found for score with holeId ${score.holeId}`);
    }
    score.hcpStrokes = fullDivision;
    if (index < remainder) {
      score.hcpStrokes += 1;
    }
    return score;
  });
}

/**
 * Retrieves the rounds which contribute to the handicap index calculation based on the number of rounds provided.
 * Note: This function creates a sorted copy and does not mutate the input array.
 */
export function getRelevantRounds(rounds: Tables<"round">[]) {
  // Create a copy to avoid mutating the input array
  // Use round.id as secondary sort for stable ordering when scoreDifferentials are identical
  const sortedRounds = [...rounds].sort((a, b) => {
    const diffComparison = a.scoreDifferential - b.scoreDifferential;
    if (diffComparison !== 0) return diffComparison;
    // If scoreDifferentials are equal, sort by round ID (chronological)
    return a.id - b.id;
  });

  if (rounds.length <= 5) {
    return sortedRounds.slice(0, 1);
  } else if (rounds.length >= 6 && rounds.length <= 8) {
    return sortedRounds.slice(0, 2);
  } else if (rounds.length >= 9 && rounds.length <= 11) {
    return sortedRounds.slice(0, 3);
  } else if (rounds.length >= 12 && rounds.length <= 14) {
    return sortedRounds.slice(0, 4);
  } else if (rounds.length >= 15 && rounds.length <= 16) {
    return sortedRounds.slice(0, 5);
  } else if (rounds.length >= 17 && rounds.length <= 18) {
    return sortedRounds.slice(0, 6);
  } else if (rounds.length === 19) {
    return sortedRounds.slice(0, 7);
  } else {
    return sortedRounds.slice(0, 8);
  }
}
