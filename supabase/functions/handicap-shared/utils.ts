import { Hole, Score, Tee } from "./scorecard.ts";

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

const SOFT_CAP_THRESHOLD = 3.0;
const HARD_CAP_THRESHOLD = 5.0;
const LOW_HANDICAP_WINDOW_DAYS = 365;
/**
 * Calculates the course handicap based on the handicap index, slope rating, course rating, and par.
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  teePlayed: Tee,
  numberOfHolesPlayed: number
): number {
  if (numberOfHolesPlayed === 9) {
    const adjustedHandicapIndex = Math.round((handicapIndex / 2) * 10) / 10;
    return Math.round(
      adjustedHandicapIndex * (teePlayed.slopeRatingFront9 / 113) +
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
  const sortedDifferentials = scoreDifferentials.sort((a, b) => a - b);
  const relevantDiffs = getRelevantDifferentials(sortedDifferentials);
  const handicapCalculation =
    Math.round(
      (relevantDiffs.reduce((acc, cur) => acc + cur) / relevantDiffs.length) *
        10
    ) / 10;

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
 */
export function calculateLowHandicapIndex(
  rounds: ProcessedRound[],
  currentRoundIndex: number
): number {
  // Exclude the current round
  const previousRounds = rounds.slice(0, currentRoundIndex);
  // Find the most recent approved round before the current round
  const mostRecentApprovedRound = [...previousRounds]
    .reverse()
    .find((r) => (r as ProcessedRound).approvalStatus === "approved");

  // If no approved round is found, fallback to current round's date
  const referenceDate = mostRecentApprovedRound
    ? new Date(mostRecentApprovedRound.teeTime)
    : new Date(rounds[currentRoundIndex].teeTime);

  const oneYearAgo = new Date(referenceDate);
  oneYearAgo.setDate(oneYearAgo.getDate() - LOW_HANDICAP_WINDOW_DAYS);

  // Filter rounds within the 1-year window from the reference date
  const relevantRounds = rounds
    .slice(0, currentRoundIndex + 1)
    .filter(
      (r) =>
        r.teeTime >= oneYearAgo &&
        r.teeTime <= referenceDate &&
        r.approvalStatus === "approved"
    );

  const handicapIndices = relevantRounds.map((r) => r.updatedHandicapIndex);
  return Math.min(...handicapIndices);
}

/**
 * Applies soft and hard caps to a newly calculated handicap index.
 */
export function applyHandicapCaps(
  newIndex: number,
  lowHandicapIndex: number
): number {
  const difference = newIndex - lowHandicapIndex;

  if (difference <= 0) {
    return newIndex;
  }

  let cappedIndex = lowHandicapIndex;
  if (difference > SOFT_CAP_THRESHOLD) {
    const softCapIncrease =
      SOFT_CAP_THRESHOLD + (difference - SOFT_CAP_THRESHOLD) * 0.5;
    cappedIndex = lowHandicapIndex + softCapIncrease;
  } else {
    cappedIndex = newIndex;
  }

  return Math.min(cappedIndex, lowHandicapIndex + HARD_CAP_THRESHOLD);
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

// Todo: Update so that we filter out specific holes that have been played already, like if they played 1-9, and then 11 and 13.
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
