export type TimeRange = "6months" | "1year" | "all";

export interface OverviewStats {
  totalRounds: number;
  avgScore: number;
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
}
