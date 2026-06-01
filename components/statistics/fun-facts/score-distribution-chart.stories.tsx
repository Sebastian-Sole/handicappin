import type { Meta, StoryObj } from "@storybook/nextjs";

import { ScoreDistributionChart } from "./score-distribution-chart";

const meta = {
  title: "Statistics/FunFacts/ScoreDistributionChart",
  component: ScoreDistributionChart,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ScoreDistributionChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: {
      eagle: { count: 2, percentage: 0.5 },
      birdie: { count: 24, percentage: 5.6 },
      par: { count: 102, percentage: 23.7 },
      bogey: { count: 168, percentage: 39.1 },
      doubleBogey: { count: 96, percentage: 22.3 },
      triplePlus: { count: 38, percentage: 8.8 },
    },
  },
};

export const BogeyHeavy: Story = {
  args: {
    data: {
      eagle: { count: 0, percentage: 0 },
      birdie: { count: 4, percentage: 2.2 },
      par: { count: 30, percentage: 16.7 },
      bogey: { count: 88, percentage: 48.9 },
      doubleBogey: { count: 42, percentage: 23.3 },
      triplePlus: { count: 16, percentage: 8.9 },
    },
  },
};

export const Empty: Story = {
  args: {
    data: {
      eagle: { count: 0, percentage: 0 },
      birdie: { count: 0, percentage: 0 },
      par: { count: 0, percentage: 0 },
      bogey: { count: 0, percentage: 0 },
      doubleBogey: { count: 0, percentage: 0 },
      triplePlus: { count: 0, percentage: 0 },
    },
  },
};
