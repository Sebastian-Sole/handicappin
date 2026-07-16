import type { Meta, StoryObj } from "@storybook/nextjs";
import { ScorecardTable, TableSkeleton } from "./scorecard-table";
import {
  fixtureTee,
  fixtureHoles,
  fixtureScores,
  fixtureDetailedScores,
  emptyScores,
} from "./__fixtures__/tee";

const meta = {
  title: "Scorecard/ScorecardTable",
  component: ScorecardTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ScorecardTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    selectedTee: fixtureTee,
    displayedHoles: fixtureHoles,
    holeCount: 18,
    scores: fixtureScores,
    onScoreChange: () => {},
    disabled: false,
  },
};

export const EmptyHoles: Story = {
  args: {
    selectedTee: fixtureTee,
    displayedHoles: fixtureHoles,
    holeCount: 18,
    scores: emptyScores,
    onScoreChange: () => {},
    disabled: false,
  },
};

export const NineHoles: Story = {
  args: {
    selectedTee: fixtureTee,
    displayedHoles: fixtureHoles.slice(0, 9),
    holeCount: 9,
    scores: fixtureScores.slice(0, 9),
    onScoreChange: () => {},
    disabled: false,
  },
};

export const CompleteRound: Story = {
  args: {
    selectedTee: fixtureTee,
    displayedHoles: fixtureHoles,
    holeCount: 18,
    scores: fixtureScores,
    onScoreChange: () => {},
    disabled: true,
  },
};

export const DetailedScoring: Story = {
  args: {
    selectedTee: fixtureTee,
    displayedHoles: fixtureHoles,
    holeCount: 18,
    scores: fixtureDetailedScores,
    onScoreChange: () => {},
    disabled: false,
    detailedScoring: true,
    onScoreDetailChange: () => {},
  },
};

export const Skeleton: StoryObj = {
  render: () => <TableSkeleton holeCount={18} />,
};
