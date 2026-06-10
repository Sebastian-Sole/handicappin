import type { ScorecardWithRound } from "@/types/scorecard-input";
import type { PlayerTypeResult, PlayerTypeId } from "@/types/statistics";

/**
 * Thresholds for player type classification algorithm.
 * These values are based on typical golf statistics and can be tuned based on real user data.
 */
export const PLAYER_TYPE_THRESHOLDS = {
  // Minimum rounds needed for meaningful classification (below this = NEWCOMER)
  MIN_ROUNDS_FOR_CLASSIFICATION: 5,

  // Score variance thresholds (standard deviation of score differentials)
  CONSISTENT_VARIANCE_MAX: 2.5, // <2.5 stdev = very consistent player
  HIGH_VARIANCE_MIN: 5.0, // >5.0 stdev = highly variable/volatile player

  // Handicap trend slope thresholds (negative = improving)
  IMPROVING_SLOPE_MAX: -0.1, // Slope below -0.1 = steadily improving
  VOLATILE_SLOPE_MIN: 0.3, // Absolute slope >0.3 = yo-yo handicap

  // Time pattern thresholds (percentage of rounds)
  WEEKEND_HEAVY_MIN: 0.7, // 70%+ weekend rounds = weekend warrior
  MORNING_HEAVY_MIN: 0.7, // 70%+ morning tee times = early bird
  AFTERNOON_PREFERENCE_MAX: 0.3, // <30% morning rounds = prefers afternoon/twilight

  // Course diversity thresholds (unique courses / total rounds)
  EXPLORER_VARIETY_MIN: 0.5, // 50%+ different courses = course explorer
  HOME_COURSE_VARIETY_MAX: 0.2, // <20% variety = loyal to home course

  // Playing volume thresholds
  GRINDER_ROUNDS_PER_MONTH: 6, // 6+ rounds/month = high volume grinder
} as const;

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
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return 0;
  const mean = finiteValues.reduce((a, b) => a + b, 0) / finiteValues.length;
  const squaredDiffs = finiteValues.map((value) => Math.pow(value - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((a, b) => a + b, 0) / finiteValues.length;
  return Math.sqrt(avgSquaredDiff);
}

function calculateTrendSlope(scorecards: ScorecardWithRound[]): number {
  if (scorecards.length < 2) return 0;

  const sorted = [...scorecards].sort(
    (a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime()
  );

  const points: { x: number; y: number }[] = [];
  sorted.forEach((scorecard, index) => {
    const handicapIndex = scorecard.round.updatedHandicapIndex;
    if (Number.isFinite(handicapIndex)) {
      points.push({ x: index, y: handicapIndex });
    }
  });

  if (points.length < 2) return 0;

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
  if (scorecards.length < PLAYER_TYPE_THRESHOLDS.MIN_ROUNDS_FOR_CLASSIFICATION) {
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
  if (metrics.scoreVariance < PLAYER_TYPE_THRESHOLDS.CONSISTENT_VARIANCE_MAX) {
    scores.MR_CONSISTENT += 3;
  } else if (metrics.scoreVariance > PLAYER_TYPE_THRESHOLDS.HIGH_VARIANCE_MIN) {
    scores.RAGER += 2;
    scores.YO_YO += 1;
  }

  // Score based on handicap trend
  if (metrics.handicapTrendSlope < PLAYER_TYPE_THRESHOLDS.IMPROVING_SLOPE_MAX) {
    scores.STEADILY_IMPROVING += 3;
  } else if (Math.abs(metrics.handicapTrendSlope) > PLAYER_TYPE_THRESHOLDS.VOLATILE_SLOPE_MIN) {
    scores.YO_YO += 2;
  }

  // Score based on time patterns
  if (metrics.weekendPercentage > PLAYER_TYPE_THRESHOLDS.WEEKEND_HEAVY_MIN) {
    scores.WEEKEND_WARRIOR += 3;
  }
  if (metrics.morningPercentage > PLAYER_TYPE_THRESHOLDS.MORNING_HEAVY_MIN) {
    scores.EARLY_BIRD += 3;
  } else if (metrics.morningPercentage < PLAYER_TYPE_THRESHOLDS.AFTERNOON_PREFERENCE_MAX) {
    scores.TWILIGHT_GOLFER += 2;
  }

  // Score based on course patterns
  if (metrics.courseVariety > PLAYER_TYPE_THRESHOLDS.EXPLORER_VARIETY_MIN) {
    scores.COURSE_EXPLORER += 2;
  } else if (metrics.courseVariety < PLAYER_TYPE_THRESHOLDS.HOME_COURSE_VARIETY_MAX) {
    scores.HOME_COURSE_HERO += 2;
  }

  // Score based on volume
  if (metrics.roundsPerMonth > PLAYER_TYPE_THRESHOLDS.GRINDER_ROUNDS_PER_MONTH) {
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
