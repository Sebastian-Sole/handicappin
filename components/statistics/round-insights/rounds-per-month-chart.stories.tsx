import type { Meta, StoryObj } from "@storybook/nextjs";

import { RoundsPerMonthChart } from "./rounds-per-month-chart";

const meta = {
  title: "Statistics/RoundInsights/RoundsPerMonthChart",
  component: RoundsPerMonthChart,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof RoundsPerMonthChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwelveMonths: Story = {
  args: {
    data: [
      { month: "Jun", year: 2025, count: 2 },
      { month: "Jul", year: 2025, count: 3 },
      { month: "Aug", year: 2025, count: 4 },
      { month: "Sep", year: 2025, count: 3 },
      { month: "Oct", year: 2025, count: 2 },
      { month: "Nov", year: 2025, count: 1 },
      { month: "Dec", year: 2025, count: 0 },
      { month: "Jan", year: 2026, count: 1 },
      { month: "Feb", year: 2026, count: 2 },
      { month: "Mar", year: 2026, count: 4 },
      { month: "Apr", year: 2026, count: 5 },
      { month: "May", year: 2026, count: 3 },
    ],
  },
};

export const Sparse: Story = {
  args: {
    data: [
      { month: "Apr", year: 2026, count: 1 },
      { month: "May", year: 2026, count: 2 },
    ],
  },
};

export const Empty: Story = {
  args: { data: [] },
};
