import type { Meta, StoryObj } from "@storybook/nextjs";
import ScoreDifferentialStep from "./score-differential-step";
import { RoundCalculationProvider } from "@/contexts/roundCalculationContext";
import {
  fixtureScorecard,
  fixtureScorecardNineHole,
} from "../__fixtures__/scorecard";

const meta = {
  title: "Round/Steps/ScoreDifferentialStep",
  component: ScoreDifferentialStep,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ScoreDifferentialStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EighteenHoles: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <ScoreDifferentialStep />
    </RoundCalculationProvider>
  ),
};

export const NineHoles: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecardNineHole}>
      <ScoreDifferentialStep />
    </RoundCalculationProvider>
  ),
};
