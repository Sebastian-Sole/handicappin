import type { Meta, StoryObj } from "@storybook/nextjs";
import { TrendingDown, Trophy, Calendar, Target } from "lucide-react";
import StatBox from "./statBox";

const meta = {
  title: "Homepage/StatBox",
  component: StatBox,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    change: { control: "text" },
  },
} satisfies Meta<typeof StatBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Improvement: Story = {
  args: {
    title: "Handicap Index",
    value: "12.4",
    change: "improvement",
    description: "Down from 14.8 last month",
    icon: <TrendingDown className="h-5 w-5 text-success" />,
  },
};

export const Achievement: Story = {
  args: {
    title: "Personal Best",
    value: "82",
    change: "achievement",
    description: "At Pebble Beach on May 16",
    icon: <Trophy className="h-5 w-5 text-warning" />,
  },
};

export const Increase: Story = {
  args: {
    title: "Rounds Played",
    value: "27",
    change: "increase",
    description: "Up 4 from last quarter",
    icon: <Calendar className="h-5 w-5 text-info" />,
  },
};

export const Neutral: Story = {
  args: {
    title: "Goal Progress",
    value: "48%",
    change: "tracking",
    description: "Halfway to scratch",
    icon: <Target className="h-5 w-5 text-muted-foreground" />,
  },
};
