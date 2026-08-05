/**
 * Round → activity-feed transform — mirror of
 * apps/web/utils/activity-transform.ts over the native RoundRow shape.
 * Covered by native unit tests.
 */
import type { RoundRow } from "@/lib/api/schemas/round";
import { HOMEPAGE_ROUNDS_LIMIT } from "./golf-stats";

export interface ActivityItem {
  id: number;
  date: Date;
  courseName: string;
  score: number;
  scoreDifferential: number;
  handicapAfter: number;
  handicapChange: number;
  isPersonalBest: boolean;
  approvalStatus: "approved" | "pending" | "rejected";
  isMilestone?: string;
  /** Accept-and-quarantine (decision D4): visible but not counted. */
  quarantined: boolean;
}

export function transformRoundsToActivities(
  rounds: RoundRow[],
  courses: Map<number, string>,
  totalRounds?: number,
): ActivityItem[] {
  if (rounds.length === 0) return [];

  const sortedRounds = [...rounds].sort(
    (a, b) => new Date(b.teeTime).getTime() - new Date(a.teeTime).getTime(),
  );

  // Quarantined rounds (decision D4) are excluded from the personal-best
  // scan — they don't feed the handicap, so they can't claim "Best".
  let bestDifferential = Infinity;
  const personalBestIds = new Set<number>();
  const chronologicalRounds = [...sortedRounds].reverse();
  chronologicalRounds.forEach((round) => {
    if (round.quarantined) return;
    if (round.scoreDifferential < bestDifferential) {
      bestDifferential = round.scoreDifferential;
      personalBestIds.add(round.id);
    }
  });

  return sortedRounds.map((round, index) => {
    const previousRound = sortedRounds[index + 1];
    const handicapChange = previousRound
      ? round.updatedHandicapIndex - previousRound.updatedHandicapIndex
      : 0;

    // Quarantined rounds don't count toward milestones (totalRounds — the
    // server count — already excludes them), so the position arithmetic
    // skips them and a quarantined round never carries a milestone itself.
    let milestone: string | undefined;
    const countedInList = sortedRounds.filter((r) => !r.quarantined).length;
    const actualTotal = totalRounds ?? countedInList;
    const isTruncated =
      totalRounds === undefined && rounds.length === HOMEPAGE_ROUNDS_LIMIT;

    if (!isTruncated && !round.quarantined) {
      const countedBefore = sortedRounds
        .slice(0, index)
        .filter((r) => !r.quarantined).length;
      const roundNumber = actualTotal - countedBefore;
      if (roundNumber === 1) milestone = "First round!";
      else if (roundNumber === 10) milestone = "10th round";
      else if (roundNumber === 20) milestone = "Full handicap index";
      else if (roundNumber === 50) milestone = "50th round";
      else if (roundNumber === 100) milestone = "100th round";
    }

    return {
      id: round.id,
      date: new Date(round.teeTime),
      courseName: courses.get(round.courseId) || "Unknown Course",
      score: round.adjustedGrossScore,
      scoreDifferential: round.scoreDifferential,
      handicapAfter: round.updatedHandicapIndex,
      handicapChange,
      isPersonalBest: personalBestIds.has(round.id),
      approvalStatus:
        round.approvalStatus === "pending" ||
        round.approvalStatus === "rejected"
          ? round.approvalStatus
          : "approved",
      isMilestone: milestone,
      quarantined: round.quarantined,
    };
  });
}
