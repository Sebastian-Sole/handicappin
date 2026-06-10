import type { Meta, StoryObj } from "@storybook/nextjs";
import { RoundCalculation } from "./round-calculation";
import { fixtureScorecard } from "./round/calculation/__fixtures__/scorecard";

const meta = {
  title: "Round/RoundCalculation",
  component: RoundCalculation,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof RoundCalculation>;

export default meta;
type Story = StoryObj<typeof meta>;

// Orchestrator story — composes all four step components plus the header,
// hole table, and sidebar.
export const Default: Story = {
  args: { scorecard: fixtureScorecard },
};
