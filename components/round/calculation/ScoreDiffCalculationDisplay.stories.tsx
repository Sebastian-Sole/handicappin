import type { Meta, StoryObj } from "@storybook/nextjs";
import ScoreDiffCalculationDisplay from "./ScoreDiffCalculationDisplay";
import { RoundCalculationProvider } from "@/contexts/roundCalculationContext";
import { fixtureScorecard } from "./__fixtures__/scorecard";

const meta = {
  title: "Round/ScoreDiffCalculationDisplay",
  component: ScoreDiffCalculationDisplay,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ScoreDiffCalculationDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <ScoreDiffCalculationDisplay />
    </RoundCalculationProvider>
  ),
};
