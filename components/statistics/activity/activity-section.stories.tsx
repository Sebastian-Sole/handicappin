import type { Meta, StoryObj } from "@storybook/nextjs";

import { ActivitySection } from "./activity-section";

const meta = {
  title: "Statistics/Activity/ActivitySection",
  component: ActivitySection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ActivitySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    roundsPerMonth: [
      { month: "Jan", year: 2026, count: 1 },
      { month: "Feb", year: 2026, count: 2 },
      { month: "Mar", year: 2026, count: 4 },
      { month: "Apr", year: 2026, count: 5 },
      { month: "May", year: 2026, count: 3 },
    ],
    holesPlayedStats: [
      { type: "9-hole", count: 6, avgDifferential: 13.4 },
      { type: "18-hole", count: 18, avgDifferential: 12.8 },
    ],
    dayOfWeekStats: [
      { day: "Sunday", dayIndex: 0, roundCount: 6, avgScore: 88, avgDifferential: 14.2, totalStrokes: 528 },
      { day: "Monday", dayIndex: 1, roundCount: 1, avgScore: 92, avgDifferential: 17.8, totalStrokes: 92 },
      { day: "Tuesday", dayIndex: 2, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Wednesday", dayIndex: 3, roundCount: 2, avgScore: 86, avgDifferential: 13.1, totalStrokes: 172 },
      { day: "Thursday", dayIndex: 4, roundCount: 3, avgScore: 87, avgDifferential: 13.8, totalStrokes: 261 },
      { day: "Friday", dayIndex: 5, roundCount: 4, avgScore: 85, avgDifferential: 12.4, totalStrokes: 340 },
      { day: "Saturday", dayIndex: 6, roundCount: 8, avgScore: 84, avgDifferential: 10.6, totalStrokes: 672 },
    ],
    timeOfDayStats: [
      { period: "morning", roundCount: 12, avgScore: 86, percentage: 50 },
      { period: "afternoon", roundCount: 8, avgScore: 88, percentage: 33 },
      { period: "evening", roundCount: 4, avgScore: 90, percentage: 17 },
    ],
    activityStats: {
      avgRoundsPerMonth: 2.4,
      mostActiveMonth: { month: "April", year: 2026, count: 5 },
      longestGap: 34,
      currentStreak: 3,
      seasonalStats: [
        { season: "Spring", roundCount: 9, avgDifferential: 11.4 },
        { season: "Summer", roundCount: 8, avgDifferential: 12.8 },
        { season: "Fall", roundCount: 5, avgDifferential: 14.2 },
        { season: "Winter", roundCount: 2, avgDifferential: 16.5 },
      ],
    },
  },
};

export const Empty: Story = {
  args: {
    roundsPerMonth: [],
    holesPlayedStats: [],
    dayOfWeekStats: [
      { day: "Sunday", dayIndex: 0, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Monday", dayIndex: 1, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Tuesday", dayIndex: 2, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Wednesday", dayIndex: 3, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Thursday", dayIndex: 4, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Friday", dayIndex: 5, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Saturday", dayIndex: 6, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
    ],
    timeOfDayStats: [],
    activityStats: {
      avgRoundsPerMonth: 0,
      mostActiveMonth: null,
      longestGap: 0,
      currentStreak: 0,
      seasonalStats: [],
    },
  },
};
