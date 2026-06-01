import type { Meta, StoryObj } from "@storybook/nextjs";

import { PlayerTypeBadge } from "./player-type-badge";

const meta = {
  title: "Statistics/FunFacts/PlayerTypeBadge",
  component: PlayerTypeBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof PlayerTypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MrConsistent: Story = {
  args: {
    playerType: {
      type: "MR_CONSISTENT",
      name: "Mr. Consistent",
      description:
        "Your scores barely vary from round to round. You're a model of reliability on the course.",
      emoji: "🎯",
      confidence: 0.84,
    },
  },
};

export const SteadilyImproving: Story = {
  args: {
    playerType: {
      type: "STEADILY_IMPROVING",
      name: "Steadily Improving",
      description:
        "Your handicap is trending downward. Keep grinding — your hard work is paying off.",
      emoji: "📈",
      confidence: 0.72,
    },
  },
};

export const WeekendWarrior: Story = {
  args: {
    playerType: {
      type: "WEEKEND_WARRIOR",
      name: "Weekend Warrior",
      description:
        "You squeeze your golf in on Saturdays and Sundays. The course is your weekend sanctuary.",
      emoji: "⛳",
      confidence: 0.91,
    },
  },
};

export const Newcomer: Story = {
  args: {
    playerType: {
      type: "NEWCOMER",
      name: "Newcomer",
      description:
        "You're just getting started. Every round is a chance to learn something new.",
      emoji: "🌱",
      confidence: 0.65,
    },
  },
};
