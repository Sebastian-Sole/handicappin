import type { Meta, StoryObj } from "@storybook/nextjs";
import HolesTable from "./holesTable";
import { RoundCalculationProvider } from "@/contexts/roundCalculationContext";
import {
  fixtureScorecard,
  fixtureScorecardNineHole,
} from "./__fixtures__/scorecard";

const meta = {
  title: "Round/HolesTable",
  component: HolesTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof HolesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EighteenHoles: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecard}>
      <HolesTable />
    </RoundCalculationProvider>
  ),
};

export const NineHoles: Story = {
  render: () => (
    <RoundCalculationProvider scorecard={fixtureScorecardNineHole}>
      <HolesTable />
    </RoundCalculationProvider>
  ),
};
