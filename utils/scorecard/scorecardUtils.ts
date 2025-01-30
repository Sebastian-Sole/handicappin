import { Hole } from "@/types/scorecard";

/**
 * Calculates the total score for a range of holes
 */
export const calculateTotal = (
  scores: number[],
  start: number,
  end: number
): number => scores.slice(start, end).reduce((sum, score) => sum + score, 0);

/**
 * Normalizes handicap values for nine holes
 * When playing 9 holes, we need to adjust the handicaps to be 1-9 instead of potentially using values from 1-18
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
 */
export const getDisplayedHoles = (
  selectedTee: { holes?: Hole[] } | undefined,
  holeCount: number
): Hole[] => {
  if (!selectedTee?.holes) return [];
  return normalizeHcpForNineHoles(selectedTee.holes, holeCount) || [];
};
