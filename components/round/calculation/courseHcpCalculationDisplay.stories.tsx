import type { Meta, StoryObj } from "@storybook/nextjs";
import CourseHandicapCalculationDisplay from "./courseHcpCalculationDisplay";
import { RoundCalculationProvider } from "@/contexts/roundCalculationContext";
import {
  fixtureScorecard,
  fixtureScorecardNineHole,
} from "./__fixtures__/scorecard";

const meta = {
  title: "Round/CourseHandicapCalculationDisplay",
  component: CourseHandicapCalculationDisplay,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CourseHandicapCalculationDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EighteenHoles: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <CourseHandicapCalculationDisplay />
    </RoundCalculationProvider>
  ),
};

export const NineHoles: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecardNineHole}>
      <CourseHandicapCalculationDisplay />
    </RoundCalculationProvider>
  ),
};
