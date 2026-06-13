/**
 * Golf statistics utilities — mirror of apps/web/utils/golf-stats.ts (pure
 * functions; keep in lockstep). Covered by native unit tests.
 */

const AVERAGE_SCORE_SLIGHT_THRESHOLD = 5;
const HANDICAP_SLIGHT_THRESHOLD = 0.07;

/** Max rounds loaded for the homepage activity feed (truncation detection). */
export const HOMEPAGE_ROUNDS_LIMIT = 20;

export function calculatePlusMinusScore(
  adjustedGrossScore: number | null | undefined,
  totalPar: number | null | undefined,
): string {
  if (
    adjustedGrossScore === null ||
    adjustedGrossScore === undefined ||
    totalPar === null ||
    totalPar === undefined
  ) {
    return "—";
  }
  const difference = adjustedGrossScore - totalPar;
  if (difference === 0) return "E";
  return difference > 0 ? `+${difference}` : difference.toString();
}

export function calculateAverageScore(scores: number[]): string {
  if (!scores || scores.length === 0) return "—";
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return (sum / scores.length).toFixed(1);
}

export function calculateAverageScoreChange(scores: number[]): number {
  if (!scores || scores.length < 2) return 0;
  const halfLength = Math.floor(scores.length / 2);
  const firstHalfScores = scores.slice(0, halfLength);
  const secondHalfScores = scores.slice(halfLength);
  if (firstHalfScores.length === 0 || secondHalfScores.length === 0) return 0;
  const firstHalfAverage =
    firstHalfScores.reduce((acc, score) => acc + score, 0) /
    firstHalfScores.length;
  const secondHalfAverage =
    secondHalfScores.reduce((acc, score) => acc + score, 0) /
    secondHalfScores.length;
  return secondHalfAverage - firstHalfAverage;
}

export function getChangeType(
  change: number,
): "improvement" | "increase" | "neutral" {
  if (change < 0) return "improvement";
  if (change > 0) return "increase";
  return "neutral";
}

export function getAverageScoreChangeDescription(change: number): string {
  if (change === 0) return "No change in average score";
  const isImproving = change < 0;
  const isSlight = Math.abs(change) < AVERAGE_SCORE_SLIGHT_THRESHOLD;
  if (isImproving) {
    return isSlight
      ? "Your average score is slightly improving!"
      : "Your average score is improving!";
  }
  return isSlight
    ? "Your average score is slightly increasing"
    : "Your average score is increasing";
}

export function getHandicapChangeDescription(percentageChange: number): string {
  if (percentageChange === 0) return "No change in handicap";
  const isImproving = percentageChange < 0;
  const isSlight = Math.abs(percentageChange) < HANDICAP_SLIGHT_THRESHOLD;
  if (isImproving) {
    return isSlight
      ? "Your handicap is slightly improving!"
      : "Your handicap is improving!";
  }
  return isSlight
    ? "Your handicap is slightly increasing"
    : "Your handicap is increasing";
}
