import { Tables } from "@/types/supabase";

export interface ActivityItem {
  id: number;
  date: Date;
  courseName: string;
  score: number;
  scoreDifferential: number;
  handicapAfter: number;
  handicapChange: number;
  isPersonalBest: boolean;
  isMilestone?: string;
}

export function transformRoundsToActivities(
  rounds: Tables<"round">[],
  courses: Map<number, string>, // courseId -> courseName
  totalRounds?: number // Total rounds the user has (for accurate milestone calculation)
): ActivityItem[] {
  if (rounds.length === 0) {
    return [];
  }

  // Sort by date descending (most recent first)
  const sortedRounds = [...rounds].sort(
    (a, b) => new Date(b.teeTime).getTime() - new Date(a.teeTime).getTime()
  );

  // Track personal best differential
  let bestDifferential = Infinity;
  const personalBestIds = new Set<number>();

  // Process in chronological order to determine personal bests
  const chronologicalRounds = [...sortedRounds].reverse();

  chronologicalRounds.forEach((round) => {
    if (round.scoreDifferential < bestDifferential) {
      bestDifferential = round.scoreDifferential;
      personalBestIds.add(round.id);
    }
  });

  // Build activity items (in reverse chronological order for display)
  const activities: ActivityItem[] = sortedRounds.map((round, index) => {
    const previousRound = sortedRounds[index + 1];
    const handicapChange = previousRound
      ? round.updatedHandicapIndex - previousRound.updatedHandicapIndex
      : 0;

    // Determine milestones
    // Use totalRounds if provided for accurate milestone calculation
    // If not provided and data appears truncated (exactly 20 rounds), suppress milestones
    // to avoid incorrect labels like "First round!" on the oldest of 20 loaded rounds
    let milestone: string | undefined;
    const actualTotal = totalRounds ?? rounds.length;
    const isTruncated = totalRounds === undefined && rounds.length === 20;

    if (!isTruncated) {
      const roundNumber = actualTotal - index;
      if (roundNumber === 1) {
        milestone = "First round!";
      } else if (roundNumber === 10) {
        milestone = "10th round";
      } else if (roundNumber === 20) {
        milestone = "Full handicap index";
      } else if (roundNumber === 50) {
        milestone = "50th round";
      } else if (roundNumber === 100) {
        milestone = "100th round";
      }
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
      isMilestone: milestone,
    };
  });

  return activities;
}
