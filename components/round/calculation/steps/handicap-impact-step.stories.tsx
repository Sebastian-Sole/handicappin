import type { Meta, StoryObj } from "@storybook/nextjs";
import HandicapImpactStep from "./handicap-impact-step";
import { RoundCalculationProvider } from "@/contexts/roundCalculationContext";
import { fixtureScorecard } from "../__fixtures__/scorecard";

const meta = {
  title: "Round/Steps/HandicapImpactStep",
  component: HandicapImpactStep,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof HandicapImpactStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <HandicapImpactStep />
    </RoundCalculationProvider>
  ),
};

export const HandicapDecreased: Story = {
  render: () => {
    const withDecrease = {
      ...fixtureScorecard,
      round: {
        ...fixtureScorecard.round,
        existingHandicapIndex: 14.2,
        updatedHandicapIndex: 12.8,
      },
    };
    return (
      <RoundCalculationProvider scorecard={withDecrease}>
        <HandicapImpactStep />
      </RoundCalculationProvider>
    );
  },
};

export const ExceptionalScore: Story = {
  render: () => {
    const withEsr = {
      ...fixtureScorecard,
      round: {
        ...fixtureScorecard.round,
        existingHandicapIndex: 12.4,
        updatedHandicapIndex: 11.2,
        exceptionalScoreAdjustment: -1,
      },
    };
    return (
      <RoundCalculationProvider scorecard={withEsr}>
        <HandicapImpactStep />
      </RoundCalculationProvider>
    );
  },
};
