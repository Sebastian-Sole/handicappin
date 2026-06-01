import type { Meta, StoryObj } from "@storybook/nextjs";
import CourseHandicapStep from "./course-handicap-step";
import { RoundCalculationProvider } from "@/contexts/roundCalculationContext";
import {
  fixtureScorecard,
  fixtureScorecardNineHole,
} from "../__fixtures__/scorecard";

const meta = {
  title: "Round/Steps/CourseHandicapStep",
  component: CourseHandicapStep,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CourseHandicapStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EighteenHoles: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <CourseHandicapStep />
    </RoundCalculationProvider>
  ),
};

export const NineHoles: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecardNineHole}>
      <CourseHandicapStep />
    </RoundCalculationProvider>
  ),
};
