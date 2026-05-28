import type { Meta, StoryObj } from "@storybook/nextjs";
import ScoreDistributionSidebar from "./score-distribution-sidebar";
import { RoundCalculationProvider } from "@/contexts/roundCalculationContext";
import {
  fixtureScorecard,
  fixtureScorecardNineHole,
} from "./__fixtures__/scorecard";

const meta = {
  title: "Round/ScoreDistributionSidebar",
  component: ScoreDistributionSidebar,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ScoreDistributionSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <div className="max-w-sm">
        <ScoreDistributionSidebar />
      </div>
    </RoundCalculationProvider>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <ScoreDistributionSidebar layout="horizontal" />
    </RoundCalculationProvider>
  ),
};

export const CompactNineHole: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecardNineHole}>
      <div className="max-w-sm">
        <ScoreDistributionSidebar compact />
      </div>
    </RoundCalculationProvider>
  ),
};
