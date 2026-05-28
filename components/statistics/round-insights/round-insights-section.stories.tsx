import type { Meta, StoryObj } from "@storybook/nextjs";

import { RoundInsightsSection } from "./round-insights-section";

const meta = {
  title: "Statistics/RoundInsights/RoundInsightsSection",
  component: RoundInsightsSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof RoundInsightsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    dayOfWeekStats: [
      { day: "Sunday", dayIndex: 0, roundCount: 6, avgScore: 88, avgDifferential: 14.2, totalStrokes: 528 },
      { day: "Monday", dayIndex: 1, roundCount: 1, avgScore: 92, avgDifferential: 17.8, totalStrokes: 92 },
      { day: "Tuesday", dayIndex: 2, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Wednesday", dayIndex: 3, roundCount: 2, avgScore: 86, avgDifferential: 13.1, totalStrokes: 172 },
      { day: "Thursday", dayIndex: 4, roundCount: 3, avgScore: 87, avgDifferential: 13.8, totalStrokes: 261 },
      { day: "Friday", dayIndex: 5, roundCount: 4, avgScore: 85, avgDifferential: 12.4, totalStrokes: 340 },
      { day: "Saturday", dayIndex: 6, roundCount: 8, avgScore: 86, avgDifferential: 12.9, totalStrokes: 688 },
    ],
    timeOfDayStats: [
      { period: "morning", roundCount: 12, avgScore: 86, percentage: 50 },
      { period: "afternoon", roundCount: 8, avgScore: 88, percentage: 33 },
      { period: "evening", roundCount: 4, avgScore: 90, percentage: 17 },
    ],
    holesPlayedStats: [
      { type: "9-hole", count: 6, avgDifferential: 13.4 },
      { type: "18-hole", count: 18, avgDifferential: 12.8 },
    ],
    roundsPerMonth: [
      { month: "Jan", year: 2026, count: 1 },
      { month: "Feb", year: 2026, count: 2 },
      { month: "Mar", year: 2026, count: 4 },
      { month: "Apr", year: 2026, count: 5 },
      { month: "May", year: 2026, count: 3 },
    ],
  },
};
