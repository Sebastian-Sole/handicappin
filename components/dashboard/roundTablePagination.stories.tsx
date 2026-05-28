import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import RoundTablePagination from "./roundTablePagination";
import type { Scorecard } from "@/types/scorecard-input";

// Minimal scorecard stub — RoundTablePagination only reads `scorecards.length`.
const stubScorecard = {} as Scorecard;
const makeScorecards = (count: number): Scorecard[] =>
  Array.from({ length: count }, () => stubScorecard);

const meta = {
  title: "Dashboard/RoundTablePagination",
  component: RoundTablePagination,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  render: (args) => {
    const Wrapper = () => {
      const [page, setPage] = useState(args.page);
      return (
        <RoundTablePagination
          page={page}
          setPage={setPage}
          scorecards={args.scorecards}
        />
      );
    };
    return <Wrapper />;
  },
} satisfies Meta<typeof RoundTablePagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {
  args: {
    page: 0,
    setPage: () => {},
    scorecards: makeScorecards(85),
  },
};

export const MiddlePage: Story = {
  args: {
    page: 2,
    setPage: () => {},
    scorecards: makeScorecards(120),
  },
};

export const LastPage: Story = {
  args: {
    page: 4,
    setPage: () => {},
    scorecards: makeScorecards(95),
  },
};

export const SinglePage: Story = {
  args: {
    page: 0,
    setPage: () => {},
    scorecards: makeScorecards(12),
  },
};
