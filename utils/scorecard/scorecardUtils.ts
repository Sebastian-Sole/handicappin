import { Hole } from "@/types/scorecard";

/**
 * Calculates the total score for a range of holes
 * @param scores - The scores to calculate the total for
 * @param start - The start hole index
 * @param end - The end hole index
 * @returns The total score
 */
export const calculateTotal = (
  scores: number[],
  start: number,
  end: number
): number => scores.slice(start, end).reduce((sum, score) => sum + score, 0);

/**
 * Normalizes handicap values for nine holes
 * When playing 9 holes, we need to adjust the handicaps to be 1-9 instead of potentially using values from 1-18
 * @param holes - The holes to normalize
 * @param holeCount - The number of holes to display
 * @returns The normalized holes
 */
export const normalizeHcpForNineHoles = (
  holes: Hole[] | undefined,
  holeCount: number
): Hole[] => {
  if (!holes) return [];

  // Only normalize if we're playing 9 holes
  if (holeCount === 18) return holes;

  // Get the first 9 holes
  const nineHoles = holes.slice(0, 9);

  // Extract and sort the handicaps from just the first 9 holes
  const uniqueHcps = nineHoles.map((hole) => hole.hcp);
  uniqueHcps.sort((a, b) => a - b);

  // Create mapping for the first 9 holes (1-9)
  const hcpMapping = new Map(uniqueHcps.map((hcp, idx) => [hcp, idx + 1]));

  // Only normalize the first 9 holes
  return nineHoles.map((hole) => ({
    ...hole,
    hcp: hcpMapping.get(hole.hcp) || hole.hcp,
  }));
};

/**
 * Gets the displayed holes based on the selected tee and hole count
 * @param selectedTee - The selected tee
 * @param holeCount - The number of holes to display
 * @returns The displayed holes
 */
export const getDisplayedHoles = (
  selectedTee: { holes?: Hole[] } | undefined,
  holeCount: number
): Hole[] => {
  if (!selectedTee?.holes) return [];
  return normalizeHcpForNineHoles(selectedTee.holes, holeCount) || [];
};

/**
 * Rounds a date to the nearest minute
 * @param date - The date to round
 * @returns The rounded date
 */
export const roundToNearestMinute = (date: Date) => {
  const newDate = new Date(date);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
};
