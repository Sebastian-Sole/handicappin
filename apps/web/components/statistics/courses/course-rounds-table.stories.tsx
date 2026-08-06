import type { Meta, StoryObj } from "@storybook/nextjs";

import {
  CourseRoundsTable,
  type CourseRoundRow,
} from "./course-rounds-table";

const meta = {
  title: "Statistics/Courses/CourseRoundsTable",
  component: CourseRoundsTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CourseRoundsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const buildRound = (
  id: number,
  teeTime: string,
  totalStrokes: number,
  scoreDifferential: number,
  overrides: Partial<CourseRoundRow> = {},
): CourseRoundRow => ({
  id,
  teeTime,
  totalStrokes,
  parPlayed: 72,
  scoreDifferential,
  holesPlayed: 18,
  nineHoleSection: null,
  teeName: "Yellow",
  quarantined: false,
  ...overrides,
});

const rounds: CourseRoundRow[] = [
  buildRound(301, "2026-05-21T10:00:00.000Z", 83, 12.1),
  buildRound(302, "2026-05-07T10:00:00.000Z", 89, 17.4),
  buildRound(303, "2026-04-23T10:00:00.000Z", 84, 12.9, {
    teeName: "White",
    holesPlayed: 9,
    nineHoleSection: "front",
    parPlayed: 36,
  }),
];

export const Default: Story = {
  args: {
    courseName: "Ballerud Golfklubb",
    rounds,
    quarantinedRounds: 0,
    listedRounds: rounds.length,
  },
};

/**
 * Accept-and-quarantine (D4): the round stays in the list, badged and with an
 * upgrade CTA, while the summary and per-hole stats above exclude it. The
 * subhead says how many of the listed rounds don't count.
 */
export const WithQuarantinedRound: Story = {
  args: {
    courseName: "Ballerud Golfklubb",
    rounds: [
      buildRound(304, "2026-06-02T10:00:00.000Z", 91, 19.8, {
        quarantined: true,
      }),
      ...rounds,
    ],
    quarantinedRounds: 1,
    listedRounds: rounds.length + 1,
  },
};

/**
 * Every round at the course is quarantined. The page shows no statistics at
 * all in this state, but the rounds themselves must stay visible — D4 forbids
 * a round disappearing because it doesn't count.
 */
export const AllRoundsQuarantined: Story = {
  args: {
    courseName: "Ballerud Golfklubb",
    rounds: rounds.map((round) => ({ ...round, quarantined: true })),
    quarantinedRounds: rounds.length,
    listedRounds: rounds.length,
  },
};
