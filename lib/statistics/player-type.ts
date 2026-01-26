import type { ScorecardWithRound } from "@/types/scorecard-input";
import type { PlayerTypeResult, PlayerTypeId } from "@/types/statistics";

export const PLAYER_TYPES: Record<PlayerTypeId, Omit<PlayerTypeResult, "confidence">> = {
  MR_CONSISTENT: {
    type: "MR_CONSISTENT",
    name: "Mr. Consistent",
    description: "Low score variance - reliable round after round",
    emoji: "🎯",
  },
  RAGER: {
    type: "RAGER",
    name: "The Rager",
    description: "High variance with occasional brilliant rounds",
    emoji: "🎢",
  },
  YO_YO: {
    type: "YO_YO",
    name: "Yo-Yo Player",
    description: "Handicap fluctuates significantly between rounds",
    emoji: "🪀",
  },
  STEADILY_IMPROVING: {
    type: "STEADILY_IMPROVING",
    name: "Steadily Improving",
    description: "Consistent downward handicap trend",
    emoji: "📈",
  },
  WEEKEND_WARRIOR: {
    type: "WEEKEND_WARRIOR",
    name: "Weekend Warrior",
    description: "Plays mostly on Saturdays and Sundays",
    emoji: "⛳",
  },
  EARLY_BIRD: {
    type: "EARLY_BIRD",
    name: "Early Bird",
    description: "Prefers morning tee times",
    emoji: "🌅",
  },
  TWILIGHT_GOLFER: {
    type: "TWILIGHT_GOLFER",
    name: "Twilight Golfer",
    description: "Prefers afternoon and evening rounds",
    emoji: "🌇",
  },
  COURSE_EXPLORER: {
    type: "COURSE_EXPLORER",
    name: "Course Explorer",
    description: "Loves playing different courses",
    emoji: "🗺️",
  },
  HOME_COURSE_HERO: {
    type: "HOME_COURSE_HERO",
    name: "Home Course Hero",
    description: "Loyal to one or two favorite courses",
    emoji: "🏠",
  },
  GRINDER: {
    type: "GRINDER",
    name: "The Grinder",
    description: "High volume of rounds played",
    emoji: "💪",
  },
  NEWCOMER: {
    type: "NEWCOMER",
    name: "Newcomer",
    description: "Just getting started on the golf journey",
    emoji: "🌱",
  },
};

interface PlayerMetrics {
  scoreVariance: number;
  handicapTrendSlope: number;
  weekendPercentage: number;
  morningPercentage: number;
  courseVariety: number;
  roundsPerMonth: number;
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

function calculateTrendSlope(scorecards: ScorecardWithRound[]): number {
  if (scorecards.length < 2) return 0;

  const sorted = [...scorecards].sort(
    (a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime()
  );

  const points = sorted.map((scorecard, index) => ({
    x: index,
    y: scorecard.round.updatedHandicapIndex,
  }));

  const pointCount = points.length;
  const sumX = points.reduce((a, point) => a + point.x, 0);
  const sumY = points.reduce((a, point) => a + point.y, 0);
  const sumXY = points.reduce((a, point) => a + point.x * point.y, 0);
  const sumXX = points.reduce((a, point) => a + point.x * point.x, 0);

  const denominator = pointCount * sumXX - sumX * sumX;
  if (denominator === 0) return 0;

  return (pointCount * sumXY - sumX * sumY) / denominator;
}

function calculateMetrics(scorecards: ScorecardWithRound[]): PlayerMetrics {
  const differentials = scorecards.map(
    (scorecard) => scorecard.round.scoreDifferential
  );
  const scoreVariance = calculateStandardDeviation(differentials);
  const handicapTrendSlope = calculateTrendSlope(scorecards);

  const weekendRounds = scorecards.filter((scorecard) => {
    const day = new Date(scorecard.teeTime).getDay();
    return day === 0 || day === 6;
  });
  const weekendPercentage =
    scorecards.length > 0 ? weekendRounds.length / scorecards.length : 0;

  const morningRounds = scorecards.filter((scorecard) => {
    const hour = new Date(scorecard.teeTime).getHours();
    return hour < 12;
  });
  const morningPercentage =
    scorecards.length > 0 ? morningRounds.length / scorecards.length : 0;

  const uniqueCourses = new Set(
    scorecards.map((scorecard) => scorecard.course.id)
  ).size;
  const courseVariety =
    scorecards.length > 0 ? uniqueCourses / scorecards.length : 0;

  // Calculate rounds per month
  let roundsPerMonth = 0;
  if (scorecards.length >= 2) {
    const sorted = [...scorecards].sort(
      (a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime()
    );
    const firstDate = new Date(sorted[0].teeTime);
    const lastDate = new Date(sorted[sorted.length - 1].teeTime);
    const monthsDiff =
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    roundsPerMonth = scorecards.length / Math.max(1, monthsDiff);
  }

  return {
    scoreVariance,
    handicapTrendSlope,
    weekendPercentage,
    morningPercentage,
    courseVariety,
    roundsPerMonth,
  };
}

export function calculatePlayerType(
  scorecards: ScorecardWithRound[]
): PlayerTypeResult {
  if (scorecards.length < 5) {
    return { ...PLAYER_TYPES.NEWCOMER, confidence: 1 };
  }

  const metrics = calculateMetrics(scorecards);

  const scores: Record<PlayerTypeId, number> = {
    MR_CONSISTENT: 0,
    RAGER: 0,
    YO_YO: 0,
    STEADILY_IMPROVING: 0,
    WEEKEND_WARRIOR: 0,
    EARLY_BIRD: 0,
    TWILIGHT_GOLFER: 0,
    COURSE_EXPLORER: 0,
    HOME_COURSE_HERO: 0,
    GRINDER: 0,
    NEWCOMER: 0,
  };

  // Score based on variance
  if (metrics.scoreVariance < 2.5) {
    scores.MR_CONSISTENT += 3;
  } else if (metrics.scoreVariance > 5) {
    scores.RAGER += 2;
    scores.YO_YO += 1;
  }

  // Score based on handicap trend
  if (metrics.handicapTrendSlope < -0.1) {
    scores.STEADILY_IMPROVING += 3;
  } else if (Math.abs(metrics.handicapTrendSlope) > 0.3) {
    scores.YO_YO += 2;
  }

  // Score based on time patterns
  if (metrics.weekendPercentage > 0.7) {
    scores.WEEKEND_WARRIOR += 3;
  }
  if (metrics.morningPercentage > 0.7) {
    scores.EARLY_BIRD += 3;
  } else if (metrics.morningPercentage < 0.3) {
    scores.TWILIGHT_GOLFER += 2;
  }

  // Score based on course patterns
  if (metrics.courseVariety > 0.5) {
    scores.COURSE_EXPLORER += 2;
  } else if (metrics.courseVariety < 0.2) {
    scores.HOME_COURSE_HERO += 2;
  }

  // Score based on volume
  if (metrics.roundsPerMonth > 6) {
    scores.GRINDER += 2;
  }

  // Find highest scoring type
  const sortedTypes = Object.entries(scores)
    .filter(([key]) => key !== "NEWCOMER")
    .sort(([, a], [, b]) => b - a);

  const [topType, topScore] = sortedTypes[0];
  const [, secondScore] = sortedTypes[1] || [null, 0];

  // If no clear winner, default to MR_CONSISTENT
  if (topScore === 0) {
    return { ...PLAYER_TYPES.MR_CONSISTENT, confidence: 0.5 };
  }

  // Confidence based on margin over second place
  const confidence = Math.min(1, (topScore - secondScore) / topScore + 0.5);

  return {
    ...PLAYER_TYPES[topType as PlayerTypeId],
    confidence,
  };
}
