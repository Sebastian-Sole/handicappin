import type { Meta, StoryObj } from "@storybook/nextjs";

import { FrivolitiesSection } from "./frivolities-section";
import type { FunStats } from "@/types/statistics";

const meta = {
  title: "Statistics/Frivolities/FrivolitiesSection",
  component: FrivolitiesSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof FrivolitiesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const populatedStats: FunStats = {
  totalStrokes: 8432,
  avgStrokesPerHole: 4.78,
  strokesByDayOfWeek: [
    { day: "Sunday", dayIndex: 0, roundCount: 6, avgScore: 88, avgDifferential: 14.2, totalStrokes: 528 },
    { day: "Monday", dayIndex: 1, roundCount: 1, avgScore: 92, avgDifferential: 17.8, totalStrokes: 92 },
    { day: "Tuesday", dayIndex: 2, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
    { day: "Wednesday", dayIndex: 3, roundCount: 2, avgScore: 86, avgDifferential: 13.1, totalStrokes: 172 },
    { day: "Thursday", dayIndex: 4, roundCount: 3, avgScore: 87, avgDifferential: 13.8, totalStrokes: 261 },
    { day: "Friday", dayIndex: 5, roundCount: 4, avgScore: 85, avgDifferential: 12.4, totalStrokes: 340 },
    { day: "Saturday", dayIndex: 6, roundCount: 8, avgScore: 86, avgDifferential: 12.9, totalStrokes: 688 },
  ],
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
    phaseStats: [
      { phase: "new_moon", phaseName: "New Moon", emoji: "🌑", roundCount: 3, avgDifferential: 13.2 },
      { phase: "waxing_crescent", phaseName: "Waxing Crescent", emoji: "🌒", roundCount: 4, avgDifferential: 12.8 },
      { phase: "first_quarter", phaseName: "First Quarter", emoji: "🌓", roundCount: 2, avgDifferential: 14.1 },
      { phase: "waxing_gibbous", phaseName: "Waxing Gibbous", emoji: "🌔", roundCount: 3, avgDifferential: 11.4 },
      { phase: "full_moon", phaseName: "Full Moon", emoji: "🌕", roundCount: 5, avgDifferential: 12.0 },
      { phase: "waning_gibbous", phaseName: "Waning Gibbous", emoji: "🌖", roundCount: 2, avgDifferential: 15.6 },
      { phase: "last_quarter", phaseName: "Last Quarter", emoji: "🌗", roundCount: 3, avgDifferential: 13.8 },
      { phase: "waning_crescent", phaseName: "Waning Crescent", emoji: "🌘", roundCount: 2, avgDifferential: 14.4 },
    ],
    bestPhase: {
      phase: "waxing_gibbous",
      phaseName: "Waxing Gibbous",
      emoji: "🌔",
      roundCount: 3,
      avgDifferential: 11.4,
    },
    worstPhase: {
      phase: "waning_gibbous",
      phaseName: "Waning Gibbous",
      emoji: "🌖",
      roundCount: 2,
      avgDifferential: 15.6,
    },
  },
  uniqueHolesPlayed: 126,
  uniqueCoursesPlayed: 7,
  countriesPlayed: 3,
};

export const Populated: Story = {
  args: { stats: populatedStats },
};

export const Empty: Story = {
  args: {
    stats: {
      ...populatedStats,
      totalStrokes: 0,
      strokesByDayOfWeek: populatedStats.strokesByDayOfWeek.map((d) => ({
        ...d,
        roundCount: 0,
        totalStrokes: 0,
      })),
    },
  },
};
