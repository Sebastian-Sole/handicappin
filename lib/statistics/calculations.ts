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
  ExceptionalRound,
  HoleNumberStats,
  FrontBackComparison,
  StreakStats,
  DistancePerformance,
  HoleByHoleStats,
  LunarPhase,
  LunarPhaseStats,
  LunarPerformance,
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
  range: "6months" | "1year" | "all",
): ScorecardWithRound[] {
  if (range === "all") return scorecards;

  const now = new Date();
  const cutoff = new Date();

  if (range === "6months") {
    cutoff.setMonth(now.getMonth() - 6);
  } else {
    cutoff.setFullYear(now.getFullYear() - 1);
  }

  return scorecards.filter(
    (scorecard) => new Date(scorecard.teeTime) >= cutoff,
  );
}

export function calculateOverviewStats(
  scorecards: ScorecardWithRound[],
  currentHandicap: number,
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
    (a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime(),
  );

  const differentials = sorted.map(
    (scorecard) => scorecard.round.scoreDifferential,
  );
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
  scorecards: ScorecardWithRound[],
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
      const differentials = rounds.map(
        (round) => round.round.scoreDifferential,
      );
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
  scorecards: ScorecardWithRound[],
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
      const differentials = rounds.map(
        (round) => round.round.scoreDifferential,
      );
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
  scorecards: ScorecardWithRound[],
): TimeOfDayStats[] {
  const periods: Record<
    "morning" | "afternoon" | "evening",
    ScorecardWithRound[]
  > = {
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
  scorecards: ScorecardWithRound[],
): HolesPlayedStats[] {
  const nineHole = scorecards.filter(
    (scorecard) => getHolesPlayed(scorecard) === 9,
  );
  const eighteenHole = scorecards.filter(
    (scorecard) => getHolesPlayed(scorecard) === 18,
  );

  const calcAvgDiff = (rounds: ScorecardWithRound[]) => {
    if (rounds.length === 0) return 0;
    const diffs = rounds.map((round) => round.round.scoreDifferential);
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  };

  return [
    {
      type: "9-hole",
      count: nineHole.length,
      avgDifferential: calcAvgDiff(nineHole),
    },
    {
      type: "18-hole",
      count: eighteenHole.length,
      avgDifferential: calcAvgDiff(eighteenHole),
    },
  ];
}

export function calculateRoundsPerMonth(
  scorecards: ScorecardWithRound[],
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

export function calculateTotalStrokes(
  scorecards: ScorecardWithRound[],
): number {
  return scorecards.reduce(
    (total, scorecard) => total + scorecard.round.totalStrokes,
    0,
  );
}

export function calculateAvgStrokesPerHole(
  scorecards: ScorecardWithRound[],
): number {
  const totalStrokes = calculateTotalStrokes(scorecards);
  const totalHoles = scorecards.reduce(
    (total, scorecard) => total + getHolesPlayed(scorecard),
    0,
  );
  return totalHoles > 0 ? totalStrokes / totalHoles : 0;
}

export function calculateStrokesByParType(
  scorecards: ScorecardWithRound[],
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
  scorecards: ScorecardWithRound[],
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
    eagle: {
      count: distribution.eagle,
      percentage: (distribution.eagle / total) * 100,
    },
    birdie: {
      count: distribution.birdie,
      percentage: (distribution.birdie / total) * 100,
    },
    par: {
      count: distribution.par,
      percentage: (distribution.par / total) * 100,
    },
    bogey: {
      count: distribution.bogey,
      percentage: (distribution.bogey / total) * 100,
    },
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

export function calculateDaysSinceLastRound(
  scorecards: ScorecardWithRound[],
): number {
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

/**
 * Calculate average rounds per month
 */
export function calculateAverageRoundsPerMonth(
  scorecards: ScorecardWithRound[],
): number {
  if (scorecards.length === 0) return 0;

  const golfAgeDays = calculateGolfAge(scorecards);
  const months = Math.max(1, golfAgeDays / 30);
  return scorecards.length / months;
}

/**
 * Find the most active month (highest round count)
 */
export function calculateMostActiveMonth(
  scorecards: ScorecardWithRound[],
): { month: string; year: number; count: number } | null {
  if (scorecards.length === 0) return null;

  const monthMap = new Map<
    string,
    { month: string; year: number; count: number }
  >();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  scorecards.forEach((scorecard) => {
    const date = new Date(scorecard.teeTime);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      monthMap.set(key, {
        month: monthNames[date.getMonth()],
        year: date.getFullYear(),
        count: 1,
      });
    }
  });

  let mostActive: { month: string; year: number; count: number } | null = null;
  monthMap.forEach((value) => {
    if (!mostActive || value.count > mostActive.count) {
      mostActive = value;
    }
  });

  return mostActive;
}

/**
 * Calculate the longest gap between rounds (in days)
 */
export function calculateLongestGap(scorecards: ScorecardWithRound[]): number {
  if (scorecards.length < 2) return 0;

  const sorted = [...scorecards].sort(
    (a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime(),
  );

  let maxGap = 0;
  for (let roundIndex = 1; roundIndex < sorted.length; roundIndex++) {
    const gap =
      new Date(sorted[roundIndex].teeTime).getTime() -
      new Date(sorted[roundIndex - 1].teeTime).getTime();
    const gapDays = Math.floor(gap / (1000 * 60 * 60 * 24));
    if (gapDays > maxGap) {
      maxGap = gapDays;
    }
  }

  return maxGap;
}

/**
 * Generate a local date key in YYYY-MM-DD format without UTC conversion
 * This avoids timezone shifts that occur with toISOString()
 */
function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculate current playing streak (consecutive weeks with at least 1 round)
 */
export function calculateCurrentStreak(
  scorecards: ScorecardWithRound[],
): number {
  if (scorecards.length === 0) return 0;

  // Get all weeks with rounds
  const weeksWithRounds = new Set<string>();
  scorecards.forEach((scorecard) => {
    const date = new Date(scorecard.teeTime);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    weeksWithRounds.add(toLocalDateKey(weekStart));
  });

  // Check from current week backwards
  const now = new Date();
  let currentWeek = new Date(now);
  currentWeek.setDate(now.getDate() - now.getDay());

  let streak = 0;
  while (weeksWithRounds.has(toLocalDateKey(currentWeek))) {
    streak++;
    currentWeek.setDate(currentWeek.getDate() - 7);
  }

  return streak;
}

/**
 * Calculate scoring consistency (standard deviation of differentials)
 */
export function calculateScoringConsistency(
  scorecards: ScorecardWithRound[],
): number {
  // Need at least 2 rounds for a meaningful standard deviation
  if (scorecards.length < 2) return 0;

  const values = scorecards
    .map((sc) => Number(sc.round.scoreDifferential))
    .filter((value) => Number.isFinite(value));

  if (values.length < 2) return 0;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Find the best month (lowest average differential)
 */
export function calculateBestMonth(scorecards: ScorecardWithRound[]): {
  month: string;
  year: number;
  avgDifferential: number;
  roundCount: number;
} | null {
  if (scorecards.length === 0) return null;

  const monthMap = new Map<
    string,
    { month: string; year: number; differentials: number[] }
  >();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  scorecards.forEach((scorecard) => {
    const date = new Date(scorecard.teeTime);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.differentials.push(scorecard.round.scoreDifferential);
    } else {
      monthMap.set(key, {
        month: monthNames[date.getMonth()],
        year: date.getFullYear(),
        differentials: [scorecard.round.scoreDifferential],
      });
    }
  });

  let bestMonth: {
    month: string;
    year: number;
    avgDifferential: number;
    roundCount: number;
  } | null = null;

  monthMap.forEach((value) => {
    // Only consider months with at least 2 rounds for meaningful average
    if (value.differentials.length >= 2) {
      const avg =
        value.differentials.reduce((a, b) => a + b, 0) /
        value.differentials.length;
      if (!bestMonth || avg < bestMonth.avgDifferential) {
        bestMonth = {
          month: value.month,
          year: value.year,
          avgDifferential: avg,
          roundCount: value.differentials.length,
        };
      }
    }
  });

  return bestMonth;
}

/**
 * Count unique courses played
 */
export function calculateUniqueCourses(
  scorecards: ScorecardWithRound[],
): number {
  const courseIds = new Set(
    scorecards.filter((sc) => sc.course?.id != null).map((sc) => sc.course.id),
  );
  return courseIds.size;
}

/**
 * Calculate seasonal breakdown
 */
export function calculateSeasonalStats(
  scorecards: ScorecardWithRound[],
): { season: string; roundCount: number; avgDifferential: number }[] {
  const seasons = {
    Spring: { rounds: [] as number[], months: [2, 3, 4] }, // Mar, Apr, May
    Summer: { rounds: [] as number[], months: [5, 6, 7] }, // Jun, Jul, Aug
    Fall: { rounds: [] as number[], months: [8, 9, 10] }, // Sep, Oct, Nov
    Winter: { rounds: [] as number[], months: [11, 0, 1] }, // Dec, Jan, Feb
  };

  scorecards.forEach((scorecard) => {
    const month = new Date(scorecard.teeTime).getMonth();
    for (const [, data] of Object.entries(seasons)) {
      if (data.months.includes(month)) {
        data.rounds.push(scorecard.round.scoreDifferential);
        break;
      }
    }
  });

  return Object.entries(seasons).map(([season, data]) => ({
    season,
    roundCount: data.rounds.length,
    avgDifferential:
      data.rounds.length > 0
        ? data.rounds.reduce((a, b) => a + b, 0) / data.rounds.length
        : 0,
  }));
}

/**
 * Count "perfect holes" (pars, birdies, eagles)
 */
export function calculatePerfectHoles(scorecards: ScorecardWithRound[]): {
  total: number;
  eagles: number;
  birdies: number;
  pars: number;
} {
  let eagles = 0;
  let birdies = 0;
  let pars = 0;

  scorecards.forEach((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return;

    scorecard.scores.forEach((score) => {
      const hole = holes.find((h) => h.id === score.holeId);
      if (!hole) return;

      const diff = score.strokes - hole.par;
      if (diff <= -2) eagles++;
      else if (diff === -1) birdies++;
      else if (diff === 0) pars++;
    });
  });

  return { total: eagles + birdies + pars, eagles, birdies, pars };
}

/**
 * Count bogey-free rounds (rounds with no bogeys or worse)
 */
export function calculateBogeyFreeRounds(
  scorecards: ScorecardWithRound[],
): number {
  return scorecards.filter((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return false;

    return scorecard.scores.every((score) => {
      const hole = holes.find((h) => h.id === score.holeId);
      if (!hole) return false; // Disqualify round if hole not found
      return score.strokes <= hole.par; // Par or better
    });
  }).length;
}

/**
 * Calculate consistency rating (1-100 scale based on standard deviation)
 * Lower std dev = higher consistency
 */
export function calculateConsistencyRating(
  scorecards: ScorecardWithRound[],
): number {
  if (scorecards.length < 3) return 0;

  const stdDev = calculateScoringConsistency(scorecards);
  // A std dev of 0 = 100 (perfect consistency)
  // A std dev of 10+ = 0 (very inconsistent)
  const rating = Math.max(0, Math.min(100, 100 - stdDev * 10));
  return Math.round(rating);
}

/**
 * Find exceptional rounds (rounds with ESR adjustment)
 * An exceptional round is 7+ strokes better than handicap
 */
export function calculateExceptionalRounds(
  scorecards: ScorecardWithRound[],
): ExceptionalRound[] {
  return scorecards
    .filter(
      (scorecard) => Number(scorecard.round.exceptionalScoreAdjustment) > 0,
    )
    .map((scorecard) => ({
      roundId: scorecard.round.id,
      courseName: scorecard.course.name,
      country: scorecard.course.country,
      date: scorecard.teeTime,
      differential: scorecard.round.scoreDifferential,
      adjustment: Number(scorecard.round.exceptionalScoreAdjustment),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Calculate average score per hole number (1-18)
 */
export function calculateHoleNumberStats(
  scorecards: ScorecardWithRound[],
): HoleNumberStats[] {
  const holeData: Map<
    number,
    {
      strokes: number[];
      pars: number[];
      birdies: number;
      bogeys: number;
      parCount: number;
    }
  > = new Map();

  // Initialize all 18 holes
  for (let holeIndex = 1; holeIndex <= 18; holeIndex++) {
    holeData.set(holeIndex, {
      strokes: [],
      pars: [],
      birdies: 0,
      bogeys: 0,
      parCount: 0,
    });
  }

  scorecards.forEach((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return;

    scorecard.scores.forEach((score) => {
      const hole = holes.find((h) => h.id === score.holeId);
      if (!hole || hole.holeNumber < 1 || hole.holeNumber > 18) return;

      const data = holeData.get(hole.holeNumber)!;
      data.strokes.push(score.strokes);
      data.pars.push(hole.par);

      const diff = score.strokes - hole.par;
      if (diff === 0) data.parCount++;
      else if (diff < 0) data.birdies++;
      else if (diff >= 1) data.bogeys++;
    });
  });

  return Array.from(holeData.entries())
    .map(([holeNumber, data]) => {
      const totalPlayed = data.strokes.length;
      const avgStrokes =
        totalPlayed > 0
          ? data.strokes.reduce((a, b) => a + b, 0) / totalPlayed
          : 0;
      const avgPar =
        totalPlayed > 0
          ? data.pars.reduce((a, b) => a + b, 0) / totalPlayed
          : 0;

      return {
        holeNumber,
        avgStrokes,
        avgOverPar: avgStrokes - avgPar,
        totalPlayed,
        parCount: data.parCount,
        birdieCount: data.birdies,
        bogeyCount: data.bogeys,
      };
    })
    .sort((a, b) => a.holeNumber - b.holeNumber);
}

/**
 * Compare front 9 vs back 9 performance
 */
export function calculateFrontBackComparison(
  scorecards: ScorecardWithRound[],
): FrontBackComparison {
  let front9Strokes = 0;
  let front9Par = 0;
  let front9Count = 0;
  let back9Strokes = 0;
  let back9Par = 0;
  let back9Count = 0;

  scorecards.forEach((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return;

    scorecard.scores.forEach((score) => {
      const hole = holes.find((h) => h.id === score.holeId);
      if (!hole) return;

      if (hole.holeNumber >= 1 && hole.holeNumber <= 9) {
        front9Strokes += score.strokes;
        front9Par += hole.par;
        front9Count++;
      } else if (hole.holeNumber >= 10 && hole.holeNumber <= 18) {
        back9Strokes += score.strokes;
        back9Par += hole.par;
        back9Count++;
      }
    });
  });

  const front9AvgStrokes = front9Count > 0 ? front9Strokes / front9Count : 0;
  const front9AvgPar = front9Count > 0 ? front9Par / front9Count : 0;
  const front9AvgOverPar = front9AvgStrokes - front9AvgPar;

  const back9AvgStrokes = back9Count > 0 ? back9Strokes / back9Count : 0;
  const back9AvgPar = back9Count > 0 ? back9Par / back9Count : 0;
  const back9AvgOverPar = back9AvgStrokes - back9AvgPar;

  const difference = Math.abs(front9AvgOverPar - back9AvgOverPar);
  let betterHalf: "front" | "back" | "even" = "even";
  if (difference > 0.05) {
    betterHalf = front9AvgOverPar < back9AvgOverPar ? "front" : "back";
  }

  return {
    front9: {
      avgStrokes: front9AvgStrokes,
      avgOverPar: front9AvgOverPar,
      totalHoles: front9Count,
    },
    back9: {
      avgStrokes: back9AvgStrokes,
      avgOverPar: back9AvgOverPar,
      totalHoles: back9Count,
    },
    betterHalf,
    difference,
  };
}

/**
 * Calculate par and bogey streaks
 */
export function calculateStreakStats(
  scorecards: ScorecardWithRound[],
): StreakStats {
  let longestParStreak = 0;
  let longestBogeyStreak = 0;
  const parStreaks: number[] = [];
  let lastRoundParStreak = 0;

  // Sort by date (oldest first) so most recent round is processed last
  const sortedScorecards = [...scorecards].sort(
    (a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime(),
  );

  // Process each round
  sortedScorecards.forEach((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return;

    let currentParStreak = 0;
    let currentBogeyStreak = 0;

    // Sort scores by hole number
    const sortedScores = [...scorecard.scores].sort((a, b) => {
      const holeA = holes.find((h) => h.id === a.holeId);
      const holeB = holes.find((h) => h.id === b.holeId);
      return (holeA?.holeNumber ?? 0) - (holeB?.holeNumber ?? 0);
    });

    sortedScores.forEach((score) => {
      const hole = holes.find((h) => h.id === score.holeId);
      if (!hole) return;

      const diff = score.strokes - hole.par;

      // Par streak (par or better)
      if (diff <= 0) {
        currentParStreak++;
        longestParStreak = Math.max(longestParStreak, currentParStreak);
      } else {
        if (currentParStreak > 0) {
          parStreaks.push(currentParStreak);
        }
        currentParStreak = 0;
      }

      // Bogey streak (bogey or worse)
      if (diff >= 1) {
        currentBogeyStreak++;
        longestBogeyStreak = Math.max(longestBogeyStreak, currentBogeyStreak);
      } else {
        currentBogeyStreak = 0;
      }
    });

    if (currentParStreak > 0) {
      parStreaks.push(currentParStreak);
    }

    // Capture ending streak from this round (last iteration = most recent round)
    lastRoundParStreak = currentParStreak;
  });

  const averageParStreak =
    parStreaks.length > 0
      ? parStreaks.reduce((a, b) => a + b, 0) / parStreaks.length
      : 0;

  return {
    longestParStreak,
    longestBogeyStreak,
    currentParStreak: lastRoundParStreak,
    averageParStreak,
  };
}

/**
 * Calculate performance by hole distance
 */
export function calculateDistancePerformance(
  scorecards: ScorecardWithRound[],
): DistancePerformance[] {
  const categories: Record<
    "short" | "medium" | "long",
    { strokes: number; pars: number; count: number; distances: number[] }
  > = {
    short: { strokes: 0, pars: 0, count: 0, distances: [] },
    medium: { strokes: 0, pars: 0, count: 0, distances: [] },
    long: { strokes: 0, pars: 0, count: 0, distances: [] },
  };

  scorecards.forEach((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return;

    scorecard.scores.forEach((score) => {
      const hole = holes.find((h) => h.id === score.holeId);
      if (!hole) return;

      let category: "short" | "medium" | "long";
      if (hole.distance < 350) {
        category = "short";
      } else if (hole.distance < 450) {
        category = "medium";
      } else {
        category = "long";
      }

      categories[category].strokes += score.strokes;
      categories[category].pars += hole.par;
      categories[category].count++;
      categories[category].distances.push(hole.distance);
    });
  });

  return (["short", "medium", "long"] as const).map((category) => {
    const data = categories[category];
    const avgOverPar =
      data.count > 0 ? data.strokes / data.count - data.pars / data.count : 0;

    return {
      category,
      label:
        category === "short"
          ? "< 350 yds"
          : category === "medium"
            ? "350-450 yds"
            : "> 450 yds",
      avgOverPar,
      holeCount: data.count,
      minDistance: data.distances.length > 0 ? Math.min(...data.distances) : 0,
      maxDistance: data.distances.length > 0 ? Math.max(...data.distances) : 0,
    };
  });
}

/**
 * Calculate total distance played (all holes combined)
 */
export function calculateTotalDistancePlayed(
  scorecards: ScorecardWithRound[],
): number {
  let totalDistance = 0;

  scorecards.forEach((scorecard) => {
    const holes = scorecard.teePlayed.holes;
    if (!holes) return;

    scorecard.scores.forEach((score) => {
      const hole = holes.find((h) => h.id === score.holeId);
      if (hole) {
        totalDistance += hole.distance;
      }
    });
  });

  return totalDistance;
}

/**
 * Find the "lucky number" - most common score on any hole
 */
export function calculateLuckyNumber(
  scorecards: ScorecardWithRound[],
): number | null {
  const scoreCounts: Map<number, number> = new Map();

  scorecards.forEach((scorecard) => {
    scorecard.scores.forEach((score) => {
      scoreCounts.set(score.strokes, (scoreCounts.get(score.strokes) || 0) + 1);
    });
  });

  if (scoreCounts.size === 0) return null;

  let maxCount = 0;
  let luckyNumber = 0;
  scoreCounts.forEach((count, strokes) => {
    if (count > maxCount) {
      maxCount = count;
      luckyNumber = strokes;
    }
  });

  return luckyNumber;
}

/**
 * Find the "signature score" - most common total round score
 */
export function calculateSignatureScore(
  scorecards: ScorecardWithRound[],
): number | null {
  const scoreCounts: Map<number, number> = new Map();

  scorecards.forEach((scorecard) => {
    const roundScore = scorecard.round.adjustedGrossScore;
    scoreCounts.set(roundScore, (scoreCounts.get(roundScore) || 0) + 1);
  });

  if (scoreCounts.size === 0) return null;

  let maxCount = 0;
  let signatureScore = 0;
  scoreCounts.forEach((count, score) => {
    if (count > maxCount) {
      maxCount = count;
      signatureScore = score;
    }
  });

  // Only return if it appeared more than once
  return maxCount > 1 ? signatureScore : null;
}

/**
 * Calculate all hole-by-hole statistics
 */
export function calculateHoleByHoleStats(
  scorecards: ScorecardWithRound[],
): HoleByHoleStats {
  return {
    holeStats: calculateHoleNumberStats(scorecards),
    frontBackComparison: calculateFrontBackComparison(scorecards),
    streakStats: calculateStreakStats(scorecards),
    distancePerformance: calculateDistancePerformance(scorecards),
    totalDistancePlayed: calculateTotalDistancePlayed(scorecards),
    luckyNumber: calculateLuckyNumber(scorecards),
    signatureScore: calculateSignatureScore(scorecards),
  };
}

// ==================== LUNAR PHASE CALCULATIONS ====================

const LUNAR_PHASE_INFO: Record<LunarPhase, { name: string; emoji: string }> = {
  new_moon: { name: "New Moon", emoji: "🌑" },
  waxing_crescent: { name: "Waxing Crescent", emoji: "🌒" },
  first_quarter: { name: "First Quarter", emoji: "🌓" },
  waxing_gibbous: { name: "Waxing Gibbous", emoji: "🌔" },
  full_moon: { name: "Full Moon", emoji: "🌕" },
  waning_gibbous: { name: "Waning Gibbous", emoji: "🌖" },
  last_quarter: { name: "Last Quarter", emoji: "🌗" },
  waning_crescent: { name: "Waning Crescent", emoji: "🌘" },
};

/**
 * Calculate lunar phase for a given date
 * Uses the synodic month (29.53 days) from a known new moon
 * No external API needed - pure algorithmic calculation
 */
export function getLunarPhase(date: Date): LunarPhase {
  // Known new moon: January 6, 2000 at 18:14 UTC
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const synodicMonth = 29.530588853; // Days in lunar cycle

  const daysSinceNewMoon =
    (date.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
  const lunarAge =
    ((daysSinceNewMoon % synodicMonth) + synodicMonth) % synodicMonth;
  const phase = lunarAge / synodicMonth;

  // Divide the cycle into 8 phases
  if (phase < 0.0625) return "new_moon";
  if (phase < 0.1875) return "waxing_crescent";
  if (phase < 0.3125) return "first_quarter";
  if (phase < 0.4375) return "waxing_gibbous";
  if (phase < 0.5625) return "full_moon";
  if (phase < 0.6875) return "waning_gibbous";
  if (phase < 0.8125) return "last_quarter";
  if (phase < 0.9375) return "waning_crescent";
  return "new_moon";
}

/**
 * Calculate golf performance by lunar phase
 */
export function calculateLunarPerformance(
  scorecards: ScorecardWithRound[],
): LunarPerformance {
  const phaseData: Map<LunarPhase, number[]> = new Map();

  // Initialize all phases
  const phases: LunarPhase[] = [
    "new_moon",
    "waxing_crescent",
    "first_quarter",
    "waxing_gibbous",
    "full_moon",
    "waning_gibbous",
    "last_quarter",
    "waning_crescent",
  ];
  phases.forEach((phase) => phaseData.set(phase, []));

  // Categorize rounds by lunar phase
  scorecards.forEach((scorecard) => {
    const teeTime = new Date(scorecard.teeTime);
    const phase = getLunarPhase(teeTime);
    phaseData.get(phase)!.push(scorecard.round.scoreDifferential);
  });

  // Calculate stats for each phase
  const phaseStats: LunarPhaseStats[] = phases.map((phase) => {
    const differentials = phaseData.get(phase)!;
    const info = LUNAR_PHASE_INFO[phase];
    return {
      phase,
      phaseName: info.name,
      emoji: info.emoji,
      roundCount: differentials.length,
      avgDifferential:
        differentials.length > 0
          ? differentials.reduce((a, b) => a + b, 0) / differentials.length
          : 0,
    };
  });

  // Find best and worst phases (only if at least 1 round)
  const phasesWithRounds = phaseStats.filter((p) => p.roundCount > 0);
  const bestPhase =
    phasesWithRounds.length > 0
      ? [...phasesWithRounds].sort(
          (a, b) => a.avgDifferential - b.avgDifferential,
        )[0]
      : null;
  const worstPhase =
    phasesWithRounds.length > 0
      ? [...phasesWithRounds].sort(
          (a, b) => b.avgDifferential - a.avgDifferential,
        )[0]
      : null;

  return {
    phaseStats,
    bestPhase,
    worstPhase,
  };
}

/**
 * Get total unique holes played (for "hole collector" stat)
 */
export function calculateUniqueHolesPlayed(
  scorecards: ScorecardWithRound[],
): number {
  const uniqueHoles = new Set<string>();

  scorecards.forEach((scorecard) => {
    const courseId = scorecard.course.id;
    const holes = scorecard.teePlayed.holes;
    if (!holes || !courseId) return;

    scorecard.scores.forEach((score) => {
      const hole = holes.find((h) => h.id === score.holeId);
      if (hole) {
        // Create unique identifier: courseId-holeNumber
        uniqueHoles.add(`${courseId}-${hole.holeNumber}`);
      }
    });
  });

  return uniqueHoles.size;
}
