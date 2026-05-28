import type { Meta, StoryObj } from "@storybook/nextjs";

import { StatCard } from "./stat-card";

const meta = {
  title: "Statistics/Overview/StatCard",
  component: StatCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    trend: {
      control: "select",
      options: [undefined, "up", "down", "neutral"],
    },
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Average Score",
    value: 87,
    subtitle: "across 24 rounds",
  },
};

export const TrendingUp: Story = {
  args: {
    title: "Handicap Index",
    value: "12.4",
    subtitle: "down 0.8 in last 30 days",
    trend: "up",
  },
};

export const TrendingDown: Story = {
  args: {
    title: "Consistency",
    value: "62%",
    subtitle: "Consistent",
    trend: "down",
  },
};

export const NoSubtitle: Story = {
  args: {
    title: "Courses Played",
    value: 7,
  },
};
