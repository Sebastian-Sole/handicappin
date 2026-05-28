import type { Meta, StoryObj } from "@storybook/nextjs";

import { TimeDistributionChart } from "./time-distribution-chart";

const meta = {
  title: "Statistics/RoundInsights/TimeDistributionChart",
  component: TimeDistributionChart,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof TimeDistributionChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [
      { period: "morning", roundCount: 12, avgScore: 86, percentage: 50 },
      { period: "afternoon", roundCount: 8, avgScore: 88, percentage: 33 },
      { period: "evening", roundCount: 4, avgScore: 90, percentage: 17 },
    ],
  },
};

export const MorningOnly: Story = {
  args: {
    data: [
      { period: "morning", roundCount: 18, avgScore: 85, percentage: 100 },
      { period: "afternoon", roundCount: 0, avgScore: 0, percentage: 0 },
      { period: "evening", roundCount: 0, avgScore: 0, percentage: 0 },
    ],
  },
};

export const Empty: Story = {
  args: {
    data: [
      { period: "morning", roundCount: 0, avgScore: 0, percentage: 0 },
      { period: "afternoon", roundCount: 0, avgScore: 0, percentage: 0 },
      { period: "evening", roundCount: 0, avgScore: 0, percentage: 0 },
    ],
  },
};
