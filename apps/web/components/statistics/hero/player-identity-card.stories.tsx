import type { Meta, StoryObj } from "@storybook/nextjs";

import { PlayerIdentityCard } from "./player-identity-card";

const meta = {
  title: "Statistics/Hero/PlayerIdentityCard",
  component: PlayerIdentityCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof PlayerIdentityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    playerType: {
      type: "MR_CONSISTENT",
      name: "Mr. Consistent",
      description:
        "Your scores barely vary from round to round. You're a model of reliability on the course.",
      emoji: "🎯",
      confidence: 0.84,
    },
    currentHandicap: 12.4,
    handicapChange: -0.8,
    totalRounds: 24,
    golfAgeDays: 410,
    daysSinceLastRound: 3,
  },
};

export const HighHandicapNewcomer: Story = {
  args: {
    playerType: {
      type: "NEWCOMER",
      name: "Newcomer",
      description: "You're just getting started — every round is a learning experience.",
      emoji: "🌱",
      confidence: 0.65,
    },
    currentHandicap: 28.6,
    handicapChange: 0,
    totalRounds: 4,
    golfAgeDays: 32,
    daysSinceLastRound: 1,
  },
};

export const InactiveUrgentNudge: Story = {
  args: {
    playerType: {
      type: "WEEKEND_WARRIOR",
      name: "Weekend Warrior",
      description: "You squeeze your golf in on Saturdays and Sundays.",
      emoji: "⛳",
      confidence: 0.78,
    },
    currentHandicap: 18.2,
    handicapChange: 1.2,
    totalRounds: 16,
    golfAgeDays: 730,
    daysSinceLastRound: 42,
  },
};
