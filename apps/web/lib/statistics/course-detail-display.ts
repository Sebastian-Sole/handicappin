/**
 * Course-detail display state (decision D4).
 *
 * `stats.getCourseDetail` deliberately returns two different populations:
 * `rounds` is EVERY round at the course (quarantined ones included — D4 keeps
 * them visible), while `summary.roundCount` counts only the rounds that feed
 * handicap-derived statistics. Gating the whole page on `summary.roundCount`
 * would hide a course whose every round is quarantined, which is exactly the
 * disappearance D4 forbids.
 *
 * This derives the three display states from those two counts so web and
 * native branch identically. Native twin:
 * apps/native/lib/statistics/course-detail-display.ts.
 */

export type CourseDetailState =
  /** Nothing logged at this course at all — show the empty state. */
  | "empty"
  /** Rounds exist but none count yet — show the list, skip the statistics. */
  | "all-quarantined"
  /** At least one counted round — show statistics and the list. */
  | "has-stats";

export interface CourseDetailDisplay {
  state: CourseDetailState;
  /** Rounds rendered in the list. Always every round at the course. */
  listedRounds: number;
  /** Rounds behind the summary cards and per-hole aggregates. */
  countedRounds: number;
  /** Listed but not counted — drives the "n of m don't count" note. */
  quarantinedRounds: number;
}

/**
 * @param listedRounds  `rounds.length` from `stats.getCourseDetail`.
 * @param countedRounds `summary.roundCount` from `stats.getCourseDetail`.
 */
export function getCourseDetailDisplay(
  listedRounds: number,
  countedRounds: number,
): CourseDetailDisplay {
  // Defensive clamps: the two counts come from the same query, but a negative
  // or over-large count must never produce a nonsense "-1 rounds don't count".
  const listed = Math.max(0, listedRounds);
  const counted = Math.min(Math.max(0, countedRounds), listed);

  const state: CourseDetailState =
    listed === 0 ? "empty" : counted === 0 ? "all-quarantined" : "has-stats";

  return {
    state,
    listedRounds: listed,
    countedRounds: counted,
    quarantinedRounds: listed - counted,
  };
}
