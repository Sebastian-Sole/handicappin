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
  numberOfHolesPlayed: number,
): number {
  if (numberOfHolesPlayed === 9) {
    const adjustedHandicapIndex = Math.round(handicapIndex / 2 * 10) / 10;

    return Math.round(
      adjustedHandicapIndex * (teePlayed.slopeRatingFront9 / 113) +
        (teePlayed.courseRatingFront9 - teePlayed.totalPar),
    );
  } else {
    return Math.round(
      handicapIndex * (teePlayed.slopeRating18 / 113) +
        (teePlayed.courseRating18 - teePlayed.totalPar),
    );
  }
}

/**
 * Calculates the score differential based on the adjusted gross score, course rating, and slope rating.
 */
export function calculateScoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number,
): number {
  return (adjustedGrossScore - courseRating) * (113 / slopeRating);
}

/**
 * Gets the relevant number of differentials based on the total number of rounds.
 */
export function getRelevantDifferentials(
  scoreDifferentials: number[],
): number[] {
  if (scoreDifferentials.length <= 5) {
    return scoreDifferentials.slice(0, 1);
  } else if (scoreDifferentials.length >= 6 && scoreDifferentials.length <= 8) {
    return scoreDifferentials.slice(0, 2);
  } else if (
    scoreDifferentials.length >= 9 && scoreDifferentials.length <= 11
  ) {
    return scoreDifferentials.slice(0, 3);
  } else if (
    scoreDifferentials.length >= 12 && scoreDifferentials.length <= 14
  ) {
    return scoreDifferentials.slice(0, 4);
  } else if (
    scoreDifferentials.length >= 15 && scoreDifferentials.length <= 16
  ) {
    return scoreDifferentials.slice(0, 5);
  } else if (
    scoreDifferentials.length >= 17 && scoreDifferentials.length <= 18
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
  const handicapCalculation = Math.round(
    (relevantDiffs.reduce((acc, cur) => acc + cur) / relevantDiffs.length) * 10,
  ) / 10;

  // Apply handicap adjustment based on number of differentials
  if (scoreDifferentials.length <= 3) {
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
  currentRoundIndex: number,
): number {
  const currentRound = rounds[currentRoundIndex];
  const oneYearAgo = new Date(currentRound.teeTime);
  oneYearAgo.setDate(oneYearAgo.getDate() - LOW_HANDICAP_WINDOW_DAYS);

  const relevantRounds = rounds
    .slice(0, currentRoundIndex + 1)
    .filter((r) => r.teeTime >= oneYearAgo);

  const handicapIndices = relevantRounds.map((r) => r.updatedHandicapIndex);
  return Math.min(...handicapIndices);
}

/**
 * Applies soft and hard caps to a newly calculated handicap index.
 */
export function applyHandicapCaps(
  newIndex: number,
  lowHandicapIndex: number,
): number {
  const difference = newIndex - lowHandicapIndex;

  if (difference <= 0) {
    return newIndex;
  }

  let cappedIndex = lowHandicapIndex;
  if (difference > SOFT_CAP_THRESHOLD) {
    const softCapIncrease = SOFT_CAP_THRESHOLD +
      (difference - SOFT_CAP_THRESHOLD) * 0.5;
    cappedIndex = lowHandicapIndex + softCapIncrease;
  } else {
    cappedIndex = newIndex;
  }

  return Math.min(cappedIndex, lowHandicapIndex + HARD_CAP_THRESHOLD);
}

export const calculateAdjustedPlayedScore = (
  holes: Hole[],
  scores: Score[],
): number => {
  const adjustedScores = holes.map((hole) => {
    const score = scores.find((score) => score.holeId === hole.id);
    if (!score) {
      throw new Error("Score not found for hole");
    }
    return calculateHoleAdjustedScore(hole, score);
  });
  return adjustedScores.reduce((acc, cur) => acc + cur);
};

export const calculateHoleAdjustedScore = (
  hole: Hole,
  score: Score,
): number => {
  const maxScore = Math.min(hole.par + 5, hole.par + 2 + score.hcpStrokes);
  return Math.min(score.strokes, maxScore);
};

export function calculateAdjustedGrossScore(
  adjustedPlayedScore: number,
  courseHandicap: number,
  numberOfHolesPlayed: number,
  teePlayed: Tee,
): number {
  let adjustedGrossScore;
  if (numberOfHolesPlayed === 18) {
    adjustedGrossScore = adjustedPlayedScore;
  } else {
    const holesLeft = 18 - numberOfHolesPlayed;
    const predictedStrokes = Math.round((courseHandicap / 18) * holesLeft);
    const parForRemainingHoles = holesLeft * (teePlayed.totalPar / 18);
    adjustedGrossScore = adjustedPlayedScore + predictedStrokes +
      parForRemainingHoles;
  }

  return adjustedGrossScore;
}

export function addHcpStrokesToScores(
  holes: Hole[],
  roundScores: Score[],
  courseHandicap: number,
  numberOfHolesPlayed: number,
): Score[] {
  const fullDivision = Math.floor(courseHandicap / numberOfHolesPlayed);
  const remainder = courseHandicap % numberOfHolesPlayed;

  const scoresWithHcpStrokes = holes.map((hole, index) => {
    const score = roundScores.find((s) => s.holeId === hole.id);
    if (!score) {
      throw new Error(`Score not found for hole ${hole.holeNumber}`);
    }

    score.hcpStrokes = fullDivision;
    if (index < remainder) {
      score.hcpStrokes += 1;
    }

    return score;
  });

  return scoresWithHcpStrokes;
}
