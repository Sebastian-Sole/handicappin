import type { Meta, StoryObj } from "@storybook/nextjs";

import { BestTimeInsight } from "./best-time-insight";

const meta = {
  title: "Statistics/Patterns/BestTimeInsight",
  component: BestTimeInsight,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof BestTimeInsight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SaturdayMornings: Story = {
  args: {
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
      { period: "morning", roundCount: 12, avgScore: 85, percentage: 50 },
      { period: "afternoon", roundCount: 8, avgScore: 88, percentage: 33 },
      { period: "evening", roundCount: 4, avgScore: 90, percentage: 17 },
    ],
  },
};

export const MarginalDifference: Story = {
  args: {
    dayOfWeekStats: [
      { day: "Saturday", dayIndex: 6, roundCount: 5, avgScore: 87, avgDifferential: 13.1, totalStrokes: 435 },
      { day: "Sunday", dayIndex: 0, roundCount: 5, avgScore: 87, avgDifferential: 13.3, totalStrokes: 435 },
      { day: "Monday", dayIndex: 1, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Tuesday", dayIndex: 2, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Wednesday", dayIndex: 3, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Thursday", dayIndex: 4, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Friday", dayIndex: 5, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
    ],
    timeOfDayStats: [],
  },
};
