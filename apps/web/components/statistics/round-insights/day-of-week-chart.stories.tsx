import type { Meta, StoryObj } from "@storybook/nextjs";

import { DayOfWeekChart } from "./day-of-week-chart";

const meta = {
  title: "Statistics/RoundInsights/DayOfWeekChart",
  component: DayOfWeekChart,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DayOfWeekChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const Default: Story = {
  args: {
    data: [
      { day: "Sunday", dayIndex: 0, roundCount: 6, avgScore: 88, avgDifferential: 14.2, totalStrokes: 528 },
      { day: "Monday", dayIndex: 1, roundCount: 1, avgScore: 92, avgDifferential: 17.8, totalStrokes: 92 },
      { day: "Tuesday", dayIndex: 2, roundCount: 0, avgScore: 0, avgDifferential: 0, totalStrokes: 0 },
      { day: "Wednesday", dayIndex: 3, roundCount: 2, avgScore: 86, avgDifferential: 13.1, totalStrokes: 172 },
      { day: "Thursday", dayIndex: 4, roundCount: 3, avgScore: 87, avgDifferential: 13.8, totalStrokes: 261 },
      { day: "Friday", dayIndex: 5, roundCount: 4, avgScore: 85, avgDifferential: 12.4, totalStrokes: 340 },
      { day: "Saturday", dayIndex: 6, roundCount: 8, avgScore: 86, avgDifferential: 12.9, totalStrokes: 688 },
    ],
  },
};

export const Empty: Story = {
  args: {
    data: DAYS.map((day, i) => ({
      day,
      dayIndex: i,
      roundCount: 0,
      avgScore: 0,
      avgDifferential: 0,
      totalStrokes: 0,
    })),
  },
};
