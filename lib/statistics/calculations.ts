import type { ScorecardWithRound } from "@/types/scorecard-input";
import type {
  OverviewStats,
  CoursePerformance,
  DayOfWeekStats,
  TimeOfDayStats,
  HolesPlayedStats,
  MonthlyRoundCount,
  StrokesByParType,
  ScoreDistribution,
} from "@/types/statistics";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Get the number of holes played from a scorecard
 * Uses the scores array length as the most reliable indicator
 */
function getHolesPlayed(scorecard: ScorecardWithRound): number {
  return scorecard.scores.length;
}

export function filterByTimeRange(
  scorecards: ScorecardWithRound[],
  range: "6months" | "1year" | "all"
): ScorecardWithRound[] {
  if (range === "all") return scorecards;

  const now = new Date();
  const cutoff = new Date();

  if (range === "6months") {
    cutoff.setMonth(now.getMonth() - 6);
  } else {
    cutoff.setFullYear(now.getFullYear() - 1);
  }

  return scorecards.filter((scorecard) => new Date(scorecard.teeTime) >= cutoff);
}

export function calculateOverviewStats(
  scorecards: ScorecardWithRound[],
  currentHandicap: number
): OverviewStats {
  if (scorecards.length === 0) {
    return {
      totalRounds: 0,
      avgScore: 0,
      bestDifferential: 0,
      worstDifferential: 0,
      improvementRate: 0,
      currentHandicap,
      handicapChange: 0,
    };
  }

  const sorted = [...scorecards].sort(
    (a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime()
  );

  const differentials = sorted.map((scorecard) => scorecard.round.scoreDifferential);
  const scores = sorted.map((scorecard) => scorecard.round.adjustedGrossScore);

  const firstHandicap = sorted[0].round.existingHandicapIndex;
  const lastHandicap = sorted[sorted.length - 1].round.updatedHandicapIndex;
  const handicapChange = lastHandicap - firstHandicap;

  const improvementRate =
    firstHandicap !== 0
      ? ((firstHandicap - lastHandicap) / firstHandicap) * 100
      : 0;

  return {
    totalRounds: scorecards.length,
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    bestDifferential: Math.min(...differentials),
    worstDifferential: Math.max(...differentials),
    improvementRate,
    currentHandicap,
    handicapChange,
  };
}

export function calculateCoursePerformance(
  scorecards: ScorecardWithRound[]
): CoursePerformance[] {
  const courseMap = new Map<number, ScorecardWithRound[]>();

  scorecards.forEach((scorecard) => {
    const courseId = scorecard.course.id;
    if (courseId === undefined) return;

    const existing = courseMap.get(courseId) || [];
    courseMap.set(courseId, [...existing, scorecard]);
  });

  return Array.from(courseMap.entries())
    .map(([courseId, rounds]) => {
      const differentials = rounds.map((round) => round.round.scoreDifferential);
      const scores = rounds.map((round) => round.round.adjustedGrossScore);
      const course = rounds[0].course;

      return {
        courseId,
        courseName: course.name,
        city: course.city,
        country: course.country,
        roundCount: rounds.length,
        avgDifferential:
          differentials.reduce((a, b) => a + b, 0) / differentials.length,
        bestDifferential: Math.min(...differentials),
        worstDifferential: Math.max(...differentials),
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      };
    })
    .sort((a, b) => b.roundCount - a.roundCount);
}

export function calculateDayOfWeekStats(
  scorecards: ScorecardWithRound[]
): DayOfWeekStats[] {
  const dayMap = new Map<number, ScorecardWithRound[]>();

  // Initialize all days
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    dayMap.set(dayIndex, []);
  }

  scorecards.forEach((scorecard) => {
    const dayIndex = new Date(scorecard.teeTime).getDay();
    const existing = dayMap.get(dayIndex) || [];
    dayMap.set(dayIndex, [...existing, scorecard]);
  });

  return Array.from(dayMap.entries())
    .map(([dayIndex, rounds]) => {
      if (rounds.length === 0) {
        return {
          day: DAYS_OF_WEEK[dayIndex],
          dayIndex,
          roundCount: 0,
          avgScore: 0,
          avgDifferential: 0,
          totalStrokes: 0,
        };
      }

      const scores = rounds.map((round) => round.round.adjustedGrossScore);
      const differentials = rounds.map((round) => round.round.scoreDifferential);
      const strokes = rounds.map((round) => round.round.totalStrokes);

      return {
        day: DAYS_OF_WEEK[dayIndex],
        dayIndex,
        roundCount: rounds.length,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        avgDifferential:
          differentials.reduce((a, b) => a + b, 0) / differentials.length,
        totalStrokes: strokes.reduce((a, b) => a + b, 0),
      };
    })
    .sort((a, b) => a.dayIndex - b.dayIndex);
}

export function calculateTimeOfDayStats(
  scorecards: ScorecardWithRound[]
): TimeOfDayStats[] {
  const periods: Record<"morning" | "afternoon" | "evening", ScorecardWithRound[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  scorecards.forEach((scorecard) => {
    const hour = new Date(scorecard.teeTime).getHours();
    if (hour < 12) {
      periods.morning.push(scorecard);
    } else if (hour < 17) {
      periods.afternoon.push(scorecard);
    } else {
      periods.evening.push(scorecard);
    }
  });

  const total = scorecards.length || 1;

  return (["morning", "afternoon", "evening"] as const).map((period) => {
    const rounds = periods[period];
    const scores = rounds.map((round) => round.round.adjustedGrossScore);

    return {
      period,
      roundCount: rounds.length,
      avgScore:
        rounds.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0,
      percentage: (rounds.length / total) * 100,
    };
  });
}

export function calculateHolesPlayedStats(
  scorecards: ScorecardWithRound[]
): HolesPlayedStats[] {
  const nineHole = scorecards.filter((scorecard) => getHolesPlayed(scorecard) === 9);
  const eighteenHole = scorecards.filter((scorecard) => getHolesPlayed(scorecard) === 18);

  const calcAvgDiff = (rounds: ScorecardWithRound[]) => {
    if (rounds.length === 0) return 0;
    const diffs = rounds.map((round) => round.round.scoreDifferential);
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  };

  return [
    { type: "9-hole", count: nineHole.length, avgDifferential: calcAvgDiff(nineHole) },
    {
      type: "18-hole",
      count: eighteenHole.length,
      avgDifferential: calcAvgDiff(eighteenHole),
    },
  ];
}

export function calculateRoundsPerMonth(
  scorecards: ScorecardWithRound[]
): MonthlyRoundCount[] {
  const monthMap = new Map<string, number>();

  scorecards.forEach((scorecard) => {
    const date = new Date(scorecard.teeTime);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) || 0) + 1);
  });

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return Array.from(monthMap.entries())
    .map(([key, count]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        month: monthNames[month - 1],
        year,
        count,
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return monthNames.indexOf(a.month) - monthNames.indexOf(b.month);
    });
}

export function calculateTotalStrokes(scorecards: ScorecardWithRound[]): number {
  return scorecards.reduce((total, scorecard) => total + scorecard.round.totalStrokes, 0);
}

export function calculateAvgStrokesPerHole(scorecards: ScorecardWithRound[]): number {
  const totalStrokes = calculateTotalStrokes(scorecards);
  const totalHoles = scorecards.reduce(
    (total, scorecard) => total + getHolesPlayed(scorecard),
    0
  );
  return totalHoles > 0 ? totalStrokes / totalHoles : 0;
}

export function calculateStrokesByParType(
  scorecards: ScorecardWithRound[]
): StrokesByParType[] {
  const parTypes: Record<3 | 4 | 5, { strokes: number; count: number }> = {
    3: { strokes: 0, count: 0 },
    4: { strokes: 0, count: 0 },
    5: { strokes: 0, count: 0 },
  };

  scorecards.forEach((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return;

    scorecard.scores.forEach((score) => {
      const hole = holes.find((holeItem) => holeItem.id === score.holeId);
      if (hole && (hole.par === 3 || hole.par === 4 || hole.par === 5)) {
        parTypes[hole.par as 3 | 4 | 5].strokes += score.strokes;
        parTypes[hole.par as 3 | 4 | 5].count += 1;
      }
    });
  });

  return ([3, 4, 5] as const).map((parType) => ({
    parType,
    totalStrokes: parTypes[parType].strokes,
    avgStrokes:
      parTypes[parType].count > 0
        ? parTypes[parType].strokes / parTypes[parType].count
        : 0,
    holeCount: parTypes[parType].count,
  }));
}

export function calculateScoreDistribution(
  scorecards: ScorecardWithRound[]
): ScoreDistribution {
  const distribution = {
    eagle: 0,
    birdie: 0,
    par: 0,
    bogey: 0,
    doubleBogey: 0,
    triplePlus: 0,
  };

  let totalHoles = 0;

  scorecards.forEach((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return;

    scorecard.scores.forEach((score) => {
      const hole = holes.find((holeItem) => holeItem.id === score.holeId);
      if (!hole) return;

      totalHoles++;
      const diff = score.strokes - hole.par;

      if (diff <= -2) distribution.eagle++;
      else if (diff === -1) distribution.birdie++;
      else if (diff === 0) distribution.par++;
      else if (diff === 1) distribution.bogey++;
      else if (diff === 2) distribution.doubleBogey++;
      else distribution.triplePlus++;
    });
  });

  const total = totalHoles || 1;

  return {
    eagle: { count: distribution.eagle, percentage: (distribution.eagle / total) * 100 },
    birdie: {
      count: distribution.birdie,
      percentage: (distribution.birdie / total) * 100,
    },
    par: { count: distribution.par, percentage: (distribution.par / total) * 100 },
    bogey: { count: distribution.bogey, percentage: (distribution.bogey / total) * 100 },
    doubleBogey: {
      count: distribution.doubleBogey,
      percentage: (distribution.doubleBogey / total) * 100,
    },
    triplePlus: {
      count: distribution.triplePlus,
      percentage: (distribution.triplePlus / total) * 100,
    },
  };
}

export function calculateDaysSinceLastRound(scorecards: ScorecardWithRound[]): number {
  if (scorecards.length === 0) return 0;

  const mostRecent = scorecards.reduce((latest, scorecard) => {
    const date = new Date(scorecard.teeTime);
    return date > latest ? date : latest;
  }, new Date(0));

  const now = new Date();
  const diffTime = now.getTime() - mostRecent.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function calculateGolfAge(scorecards: ScorecardWithRound[]): number {
  if (scorecards.length === 0) return 0;

  const oldest = scorecards.reduce((earliest, scorecard) => {
    const date = new Date(scorecard.teeTime);
    return date < earliest ? date : earliest;
  }, new Date());

  const now = new Date();
  const diffTime = now.getTime() - oldest.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
