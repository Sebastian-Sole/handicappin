import type { Meta, StoryObj } from "@storybook/nextjs";
import AdjustedScoresStep from "./adjusted-scores-step";
import { RoundCalculationProvider } from "@/contexts/roundCalculationContext";
import { fixtureScorecard } from "../__fixtures__/scorecard";

const meta = {
  title: "Round/Steps/AdjustedScoresStep",
  component: AdjustedScoresStep,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof AdjustedScoresStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <AdjustedScoresStep />
    </RoundCalculationProvider>
  ),
};
