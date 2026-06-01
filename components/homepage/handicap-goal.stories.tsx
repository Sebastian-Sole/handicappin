import type { Meta, StoryObj } from "@storybook/nextjs";
import { HandicapGoal } from "./handicap-goal";

const meta = {
  title: "Homepage/HandicapGoal",
  component: HandicapGoal,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof HandicapGoal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { currentHandicap: 12.4, startingHandicap: 18.5 },
};

export const JustStarted: Story = {
  args: { currentHandicap: 18.2, startingHandicap: 18.5 },
};

export const Halfway: Story = {
  args: { currentHandicap: 9.2, startingHandicap: 18.5 },
};

export const NearScratch: Story = {
  args: { currentHandicap: 1.4, startingHandicap: 18.5 },
};

export const NotImproving: Story = {
  args: { currentHandicap: 20.6, startingHandicap: 18.5 },
};
