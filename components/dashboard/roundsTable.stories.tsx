import type { Meta, StoryObj } from "@storybook/nextjs";
import { RoundsTable } from "./roundsTable";
import type { ScorecardWithRound, Course, Tee, Score } from "@/types/scorecard-input";
import type { Tables } from "@/types/supabase";

const USER_ID = "00000000-0000-0000-0000-000000000001";

const tee: Tee = {
  name: "White",
  gender: "mens",
  courseRating18: 71.2,
  slopeRating18: 128,
  courseRatingFront9: 35.6,
  slopeRatingFront9: 128,
  courseRatingBack9: 35.6,
  slopeRatingBack9: 128,
  outPar: 36,
  inPar: 36,
  totalPar: 72,
  outDistance: 3250,
  inDistance: 3300,
  totalDistance: 6550,
  distanceMeasurement: "yards",
  approvalStatus: "approved",
  holes: undefined,
};

const buildCourse = (name: string): Course => ({
  name,
  approvalStatus: "approved",
  country: "USA",
  city: "Pebble Beach",
  tees: undefined,
});

const buildRound = (
  id: number,
  teeTime: string,
  score: number,
  par: number,
  differential: number,
  exceptionalAdj = 0,
): Tables<"round"> => ({
  id,
  userId: USER_ID,
  teeId: 1,
  courseId: 1,
  createdAt: teeTime,
  teeTime,
  adjustedGrossScore: score,
  adjustedPlayedScore: score,
  approvalStatus: "approved",
  course_rating_used: 71.2,
  courseHandicap: 14,
  exceptionalScoreAdjustment: exceptionalAdj,
  existingHandicapIndex: 12.4,
  holes_played: 18,
  nine_hole_section: null,
  notes: null,
  parPlayed: par,
  scoreDifferential: differential,
  slope_rating_used: 128,
  totalStrokes: score,
  updatedHandicapIndex: 12.4,
});

const emptyScores: Score[] = [];

const rounds: ScorecardWithRound[] = [
  {
    userId: USER_ID,
    course: buildCourse("Pebble Beach Golf Links"),
    teePlayed: tee,
    scores: emptyScores,
    teeTime: "2025-05-16T10:00:00.000Z",
    approvalStatus: "approved",
    round: buildRound(101, "2025-05-16T10:00:00.000Z", 84, 72, 12.1),
  },
  {
    userId: USER_ID,
    course: buildCourse("Spyglass Hill"),
    teePlayed: tee,
    scores: emptyScores,
    teeTime: "2025-05-02T10:00:00.000Z",
    approvalStatus: "approved",
    round: buildRound(102, "2025-05-02T10:00:00.000Z", 89, 72, 17.4),
  },
  {
    userId: USER_ID,
    course: buildCourse("St Andrews — Old Course"),
    teePlayed: tee,
    scores: emptyScores,
    teeTime: "2025-04-18T10:00:00.000Z",
    approvalStatus: "approved",
    round: buildRound(103, "2025-04-18T10:00:00.000Z", 82, 72, 12.9),
  },
  {
    userId: USER_ID,
    course: buildCourse("Augusta National"),
    teePlayed: tee,
    scores: emptyScores,
    teeTime: "2025-04-04T10:00:00.000Z",
    approvalStatus: "approved",
    round: buildRound(104, "2025-04-04T10:00:00.000Z", 86, 72, 13.5, -1.0),
  },
  {
    userId: USER_ID,
    course: buildCourse("Pinehurst No. 2"),
    teePlayed: tee,
    scores: emptyScores,
    teeTime: "2025-03-21T08:45:00.000Z",
    approvalStatus: "approved",
    round: buildRound(105, "2025-03-21T08:45:00.000Z", 91, 72, 19.3),
  },
  {
    userId: USER_ID,
    course: buildCourse("Bandon Dunes"),
    teePlayed: tee,
    scores: emptyScores,
    teeTime: "2025-03-07T10:30:00.000Z",
    approvalStatus: "approved",
    round: buildRound(106, "2025-03-07T10:30:00.000Z", 85, 72, 14.7),
  },
  {
    userId: USER_ID,
    course: buildCourse("Whistling Straits"),
    teePlayed: tee,
    scores: emptyScores,
    teeTime: "2025-02-21T13:00:00.000Z",
    approvalStatus: "approved",
    round: buildRound(107, "2025-02-21T13:00:00.000Z", 87, 72, 15.8),
  },
];

const meta = {
  title: "Dashboard/RoundsTable",
  component: RoundsTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof RoundsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { scorecards: rounds },
};

export const Empty: Story = {
  args: { scorecards: [] },
};

export const SinglePage: Story = {
  args: { scorecards: rounds.slice(0, 3), showPagination: false, showSearch: false },
};

export const WithCustomTitle: Story = {
  args: {
    scorecards: rounds,
    title: "Recent Rounds",
  },
};
