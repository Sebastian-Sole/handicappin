import { Hole } from "@/types/scorecard-input";

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
 * When playing 9 holes, we adjust the handicaps to be 1-9 instead of using
 * values from the full 1-18 range. The 9-hole `section` selects which 9 holes
 * are kept ("front" -> 1-9, "back" -> 10-18); legacy callers that omit the
 * argument default to "front".
 * @param holes - The holes to normalize
 * @param holeCount - The number of holes to display
 * @param section - Which 9-hole section is being played (front or back)
 * @returns The normalized holes
 */
export const normalizeHcpForNineHoles = (
  holes: Hole[] | undefined,
  holeCount: number,
  section: "front" | "back" = "front"
): Hole[] => {
  if (!holes) return [];

  // Defensive sort: positional slicing below assumes holeNumber order. API queries
  // already order by holeNumber, but enforce here so callers can't pass unsorted holes.
  const sortedHoles = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);

  // Only normalize if we're playing 9 holes
  if (holeCount === 18) return sortedHoles;

  // Pick the played 9 holes based on section
  const nineHoles =
    section === "back" ? sortedHoles.slice(9, 18) : sortedHoles.slice(0, 9);

  // Extract and sort the handicaps from just those 9 holes
  const uniqueHcps = nineHoles.map((hole) => hole.hcp);
  uniqueHcps.sort((a, b) => a - b);

  // Create mapping to a 1-9 stroke index for the played 9 holes
  const hcpMapping = new Map(uniqueHcps.map((hcp, idx) => [hcp, idx + 1]));

  return nineHoles.map((hole) => ({
    ...hole,
    hcp: hcpMapping.get(hole.hcp) || hole.hcp,
  }));
};

/**
 * Gets the displayed holes based on the selected tee, hole count, and section
 * @param selectedTee - The selected tee
 * @param holeCount - The number of holes to display
 * @param section - Which 9-hole section to show when holeCount === 9
 * @returns The displayed holes
 */
export const getDisplayedHoles = (
  selectedTee: { holes?: Hole[] } | undefined,
  holeCount: number,
  section: "front" | "back" = "front"
): Hole[] => {
  if (!selectedTee?.holes) return [];
  return normalizeHcpForNineHoles(selectedTee.holes, holeCount, section) || [];
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
