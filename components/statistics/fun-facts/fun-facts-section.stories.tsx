import type { Meta, StoryObj } from "@storybook/nextjs";

import { ScoringBreakdownSection } from "./fun-facts-section";
import type { FunStats } from "@/types/statistics";

const meta = {
  title: "Statistics/FunFacts/ScoringBreakdownSection",
  component: ScoringBreakdownSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ScoringBreakdownSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const stats: FunStats = {
  totalStrokes: 8432,
  avgStrokesPerHole: 4.78,
  strokesByDayOfWeek: [],
  strokesByParType: [
    { parType: 3, totalStrokes: 1240, avgStrokes: 3.62, holeCount: 108 },
    { parType: 4, totalStrokes: 4680, avgStrokes: 4.78, holeCount: 216 },
    { parType: 5, totalStrokes: 2512, avgStrokes: 5.84, holeCount: 108 },
  ],
  scoreDistribution: {
    eagle: { count: 2, percentage: 0.5 },
    birdie: { count: 24, percentage: 5.6 },
    par: { count: 102, percentage: 23.7 },
    bogey: { count: 168, percentage: 39.1 },
    doubleBogey: { count: 96, percentage: 22.3 },
    triplePlus: { count: 38, percentage: 8.8 },
  },
  daysSinceLastRound: 3,
  golfAgeDays: 410,
  playerType: {
    type: "MR_CONSISTENT",
    name: "Mr. Consistent",
    description: "Your scores barely vary round to round.",
    emoji: "🎯",
    confidence: 0.84,
  },
  perfectHoles: { total: 128, eagles: 2, birdies: 24, pars: 102 },
  bogeyFreeRounds: 1,
  holeByHoleStats: {
    holeStats: [],
    frontBackComparison: {
      front9: { avgStrokes: 41.2, avgOverPar: 0.6, totalHoles: 198 },
      back9: { avgStrokes: 42.1, avgOverPar: 0.8, totalHoles: 198 },
      betterHalf: "front",
      difference: 0.2,
    },
    streakStats: {
      longestParStreak: 4,
      longestBogeyStreak: 6,
      currentParStreak: 1,
      averageParStreak: 1.8,
    },
    distancePerformance: [],
    totalDistancePlayed: 102000,
    luckyNumber: 4,
    signatureScore: 87,
  },
  lunarPerformance: {
    phaseStats: [],
    bestPhase: null,
    worstPhase: null,
  },
  uniqueHolesPlayed: 126,
  uniqueCoursesPlayed: 7,
  countriesPlayed: 3,
};

export const Default: Story = {
  args: { stats },
};
