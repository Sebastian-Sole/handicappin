import type { Meta, StoryObj } from "@storybook/nextjs";

import { FunStatCard } from "./fun-stat-card";

const meta = {
  title: "Statistics/FunFacts/FunStatCard",
  component: FunStatCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof FunStatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Total Strokes",
    value: "8,432",
    emoji: "🏌️",
    subtitle: "across 432 holes",
  },
};

export const NoEmoji: Story = {
  args: {
    title: "Avg Strokes/Hole",
    value: "4.78",
    subtitle: "0.6 over par avg",
  },
};

export const NoSubtitle: Story = {
  args: {
    title: "Golf Journey",
    value: "1.4 years",
    emoji: "📅",
  },
};

export const NumericValue: Story = {
  args: {
    title: "Eagles",
    value: 3,
    emoji: "🦅",
    subtitle: "lifetime",
  },
};
