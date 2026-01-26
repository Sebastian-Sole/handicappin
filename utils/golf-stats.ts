/**
 * Golf statistics calculation utilities
 * Extracted from hero.tsx for testability and reuse
 */

// Threshold constants for determining "slight" vs "significant" changes
// These define the boundary between subtle and notable improvements/regressions

/** Average score change below this value (in strokes) is considered "slight" */
const AVERAGE_SCORE_SLIGHT_THRESHOLD = 5;

/** Handicap percentage change below this value (7%) is considered "slight" */
const HANDICAP_SLIGHT_THRESHOLD = 0.07;

/**
 * Calculates plus/minus score relative to par
 * @param adjustedGrossScore - The player's adjusted gross score
 * @param totalPar - The total par for the course/tees played
 * @returns Formatted string like "+5", "-2", or "E" for even, "—" for invalid input
 */
export function calculatePlusMinusScore(
  adjustedGrossScore: number | null | undefined,
  totalPar: number | null | undefined
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

  if (difference === 0) {
    return "E";
  }

  return difference > 0 ? `+${difference}` : difference.toString();
}

/**
 * Calculates average score from an array of scores
 * @param scores - Array of golf scores
 * @returns Formatted average as string with one decimal, or "—" for empty array
 */
export function calculateAverageScore(scores: number[]): string {
  if (!scores || scores.length === 0) {
    return "—";
  }

  const sum = scores.reduce((acc, score) => acc + score, 0);
  const average = sum / scores.length;

  return average.toFixed(1);
}

/**
 * Calculates the change in average score between first and second half of rounds
 * Used to determine if player is improving (negative change) or getting worse (positive change)
 *
 * @param scores - Array of scores in chronological order (oldest first)
 * @returns The difference between second half average and first half average
 *          Negative = improvement, Positive = regression, 0 = no change or insufficient data
 */
export function calculateAverageScoreChange(scores: number[]): number {
  if (!scores || scores.length < 2) {
    return 0;
  }

  const halfLength = Math.floor(scores.length / 2);
  const firstHalfScores = scores.slice(0, halfLength);
  const secondHalfScores = scores.slice(halfLength);

  // Guard against empty halves (shouldn't happen with length >= 2, but defensive)
  if (firstHalfScores.length === 0 || secondHalfScores.length === 0) {
    return 0;
  }

  const firstHalfAverage =
    firstHalfScores.reduce((acc, score) => acc + score, 0) /
    firstHalfScores.length;
  const secondHalfAverage =
    secondHalfScores.reduce((acc, score) => acc + score, 0) /
    secondHalfScores.length;

  return secondHalfAverage - firstHalfAverage;
}

/**
 * Determines the change type based on a numeric change value
 * Used for UI display (improvement vs increase indicators)
 *
 * @param change - The numeric change value (negative = better in golf)
 * @returns "improvement" for negative changes, "increase" for positive, "neutral" for zero
 */
export function getChangeType(
  change: number
): "improvement" | "increase" | "neutral" {
  if (change < 0) return "improvement";
  if (change > 0) return "increase";
  return "neutral";
}

/**
 * Generates a description for average score change
 * @param change - The average score change value
 * @returns Human-readable description of the trend
 */
export function getAverageScoreChangeDescription(change: number): string {
  if (change === 0) return "No change in average score";

  const isImproving = change < 0;
  const magnitude = Math.abs(change);
  const isSlight = magnitude < AVERAGE_SCORE_SLIGHT_THRESHOLD;

  if (isImproving) {
    return isSlight
      ? "Your average score is slightly improving!"
      : "Your average score is improving!";
  }

  return isSlight
    ? "Your average score is slightly increasing"
    : "Your average score is increasing";
}

/**
 * Generates a description for handicap change
 * @param percentageChange - The handicap percentage change (decimal form, e.g., 0.05 = 5%)
 * @returns Human-readable description of the trend
 */
export function getHandicapChangeDescription(percentageChange: number): string {
  if (percentageChange === 0) return "No change in handicap";

  const isImproving = percentageChange < 0;
  const magnitude = Math.abs(percentageChange);
  const isSlight = magnitude < HANDICAP_SLIGHT_THRESHOLD;

  if (isImproving) {
    return isSlight
      ? "Your handicap is slightly improving!"
      : "Your handicap is improving!";
  }

  return isSlight
    ? "Your handicap is slightly increasing"
    : "Your handicap is increasing";
}
