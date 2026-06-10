export type TimeRange = "6months" | "1year" | "all";

export interface OverviewStats {
  totalRounds: number;
  avgScore: number;
  avgPar: number | null;
  bestDifferential: number;
  worstDifferential: number;
  improvementRate: number;
  currentHandicap: number;
  handicapChange: number;
}

export interface CoursePerformance {
  courseId: number;
  courseName: string;
  city: string;
  country: string;
  roundCount: number;
  avgDifferential: number;
  bestDifferential: number;
  worstDifferential: number;
  avgScore: number;
}

export interface DayOfWeekStats {
  day: string;
  dayIndex: number;
  roundCount: number;
  avgScore: number;
  avgDifferential: number;
  totalStrokes: number;
}

export interface TimeOfDayStats {
  period: "morning" | "afternoon" | "evening";
  roundCount: number;
  avgScore: number;
  percentage: number;
}

export interface HolesPlayedStats {
  type: "9-hole" | "18-hole";
  count: number;
  avgDifferential: number;
}

export interface MonthlyRoundCount {
  month: string;
  year: number;
  count: number;
}

export interface StrokesByParType {
  parType: 3 | 4 | 5;
  totalStrokes: number;
  avgStrokes: number;
  holeCount: number;
}

export interface ScoreDistribution {
  eagle: { count: number; percentage: number };
  birdie: { count: number; percentage: number };
  par: { count: number; percentage: number };
  bogey: { count: number; percentage: number };
  doubleBogey: { count: number; percentage: number };
  triplePlus: { count: number; percentage: number };
}

export interface PlayerTypeResult {
  type: PlayerTypeId;
  name: string;
  description: string;
  emoji: string;
  confidence: number;
}

export type PlayerTypeId =
  | "MR_CONSISTENT"
  | "RAGER"
  | "YO_YO"
  | "STEADILY_IMPROVING"
  | "WEEKEND_WARRIOR"
  | "EARLY_BIRD"
  | "TWILIGHT_GOLFER"
  | "COURSE_EXPLORER"
  | "HOME_COURSE_HERO"
  | "GRINDER"
  | "NEWCOMER";

export interface FunStats {
  totalStrokes: number;
  avgStrokesPerHole: number;
  strokesByDayOfWeek: DayOfWeekStats[];
  strokesByParType: StrokesByParType[];
  scoreDistribution: ScoreDistribution;
  daysSinceLastRound: number;
  golfAgeDays: number;
  playerType: PlayerTypeResult;
  perfectHoles: PerfectHoles;
  bogeyFreeRounds: number;
  // New fun stats
  holeByHoleStats: HoleByHoleStats;
  lunarPerformance: LunarPerformance;
  uniqueHolesPlayed: number;
  uniqueCoursesPlayed: number;
  countriesPlayed: number;
}

export interface PerfectHoles {
  total: number;
  eagles: number;
  birdies: number;
  pars: number;
}

export interface ActivityStats {
  avgRoundsPerMonth: number;
  mostActiveMonth: { month: string; year: number; count: number } | null;
  longestGap: number;
  currentStreak: number;
  seasonalStats: SeasonalStats[];
}

export interface SeasonalStats {
  season: string;
  roundCount: number;
  avgDifferential: number;
}

export interface PerformanceExtendedStats {
  consistencyRating: number;
  scoringConsistency: number;
  bestMonth: { month: string; year: number; avgDifferential: number; roundCount: number } | null;
  uniqueCourses: number;
  exceptionalRounds: ExceptionalRound[];
}

export interface ExceptionalRound {
  roundId: number;
  courseName: string;
  country: string;
  date: string;
  differential: number;
  adjustment: number;
}

// Hole-by-hole analysis types
export interface HoleNumberStats {
  holeNumber: number;
  avgStrokes: number;
  avgOverPar: number;
  totalPlayed: number;
  parCount: number;
  birdieCount: number;
  bogeyCount: number;
}

export interface FrontBackComparison {
  front9: {
    avgStrokes: number;
    avgOverPar: number;
    totalHoles: number;
  };
  back9: {
    avgStrokes: number;
    avgOverPar: number;
    totalHoles: number;
  };
  betterHalf: "front" | "back" | "even";
  difference: number;
}

export interface StreakStats {
  longestParStreak: number;
  longestBogeyStreak: number;
  currentParStreak: number;
  averageParStreak: number;
}

export interface DistancePerformance {
  category: "short" | "medium" | "long";
  label: string;
  avgOverPar: number;
  holeCount: number;
  minDistance: number;
  maxDistance: number;
}

export interface HoleByHoleStats {
  holeStats: HoleNumberStats[];
  frontBackComparison: FrontBackComparison;
  streakStats: StreakStats;
  distancePerformance: DistancePerformance[];
  totalDistancePlayed: number;
  luckyNumber: number | null;
  signatureScore: number | null;
}

// Lunar phase types
export type LunarPhase =
  | "new_moon"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full_moon"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

export interface LunarPhaseStats {
  phase: LunarPhase;
  phaseName: string;
  emoji: string;
  roundCount: number;
  avgDifferential: number;
}

export interface LunarPerformance {
  phaseStats: LunarPhaseStats[];
  bestPhase: LunarPhaseStats | null;
  worstPhase: LunarPhaseStats | null;
}
