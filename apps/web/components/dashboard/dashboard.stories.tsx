import type { Meta, StoryObj } from "@storybook/nextjs";
import { Dashboard } from "./dashboard";
import type { ScorecardWithRound, Course, Tee, Score } from "@/types/scorecard-input";
import type { Tables } from "@/types/supabase";

const USER_ID = "00000000-0000-0000-0000-000000000001";

const profile: Tables<"profile"> = {
  id: USER_ID,
  email: "storybook@handicappin.local",
  name: "Storybook User",
  handicapIndex: 12.4,
  initialHandicapIndex: 18.5,
  billing_version: 1,
  cancel_at_period_end: false,
  createdAt: "2024-09-01T00:00:00.000Z",
  current_period_end: null,
  plan_selected: null,
  plan_selected_at: null,
  subscription_status: null,
  billing_provider: null,
  verified: true,
};

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

const emptyScores: Score[] = [];

const buildScorecard = (
  id: number,
  courseName: string,
  teeTime: string,
  score: number,
  diff: number,
  updatedHcp: number,
): ScorecardWithRound => ({
  userId: USER_ID,
  course: buildCourse(courseName),
  teePlayed: tee,
  scores: emptyScores,
  teeTime,
  approvalStatus: "approved",
  round: {
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
    exceptionalScoreAdjustment: 0,
    existingHandicapIndex: updatedHcp,
    holes_played: 18,
    nine_hole_section: null,
    notes: null,
    parPlayed: 72,
    scoreDifferential: diff,
    slope_rating_used: 128,
    totalStrokes: score,
    updatedHandicapIndex: updatedHcp,
  },
});

const scorecards: ScorecardWithRound[] = [
  buildScorecard(101, "Pebble Beach", "2025-01-15T10:00:00.000Z", 92, 18.4, 14.6),
  buildScorecard(102, "Spyglass Hill", "2025-01-29T11:00:00.000Z", 89, 16.1, 14.3),
  buildScorecard(103, "Bandon Dunes", "2025-02-12T09:30:00.000Z", 94, 21.2, 14.5),
  buildScorecard(104, "Pinehurst No. 2", "2025-02-26T13:00:00.000Z", 88, 15.8, 14.0),
  buildScorecard(105, "Whistling Straits", "2025-03-12T10:30:00.000Z", 86, 14.7, 13.6),
  buildScorecard(106, "Augusta National", "2025-03-26T08:45:00.000Z", 91, 19.3, 13.8),
  buildScorecard(107, "St Andrews", "2025-04-09T11:30:00.000Z", 85, 13.5, 13.2),
  buildScorecard(108, "Carnoustie", "2025-04-23T10:00:00.000Z", 84, 12.9, 12.8),
  buildScorecard(109, "Royal County Down", "2025-05-07T10:00:00.000Z", 89, 17.4, 12.9),
  buildScorecard(110, "Cypress Point", "2025-05-21T10:00:00.000Z", 83, 12.1, 12.4),
];

const meta = {
  title: "Dashboard/Dashboard",
  component: Dashboard,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof Dashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    profile,
    scorecards,
    header: "Your handicap is trending in the right direction!",
  },
};

export const NoRounds: Story = {
  args: {
    profile,
    scorecards: [],
    header: "Log your first round to get started.",
  },
};

export const HighHandicap: Story = {
  args: {
    profile: { ...profile, handicapIndex: 28.6, initialHandicapIndex: 36.0 },
    scorecards: scorecards.slice(0, 5),
    header: "Welcome to the world of golf — every round counts.",
  },
};
