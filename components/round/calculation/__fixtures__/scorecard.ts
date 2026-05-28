/**
 * Shared Storybook fixture for round-calculation stories.
 *
 * Inlines a realistic 18-hole round to satisfy the heavy
 * `ScorecardWithRound` shape used by `RoundCalculationProvider`.
 */
import type { ScorecardWithRound, Hole, Score } from "@/types/scorecard-input";
import type { Tables } from "@/types/supabase";

// Realistic par-72 hole layout. HCP values are unique 1..18.
const PARS = [4, 5, 3, 4, 4, 5, 4, 3, 4, 5, 4, 3, 4, 5, 4, 3, 4, 4];
const HCPS = [9, 5, 17, 1, 11, 3, 13, 15, 7, 8, 4, 18, 2, 6, 12, 16, 10, 14];
const DISTANCES = [
  380, 510, 165, 420, 395, 540, 410, 175, 405, 525, 425, 155, 440, 530, 395,
  170, 415, 405,
];

export const fixtureHoles: Hole[] = PARS.map((par, idx) => ({
  id: idx + 1,
  teeId: 1,
  holeNumber: idx + 1,
  par,
  hcp: HCPS[idx],
  distance: DISTANCES[idx],
}));

// Sample scores totalling 84 (12 over par)
const STROKES = [4, 5, 4, 5, 4, 6, 5, 3, 5, 5, 5, 4, 4, 6, 5, 3, 5, 4];

export const fixtureScores: Score[] = STROKES.map((strokes, idx) => ({
  id: idx + 1,
  roundId: 1,
  holeId: idx + 1,
  strokes,
  hcpStrokes: HCPS[idx] <= 13 ? 1 : 0,
}));

export const fixtureRound: Tables<"round"> = {
  id: 1,
  adjustedGrossScore: 82,
  adjustedPlayedScore: 82,
  approvalStatus: "approved",
  course_rating_used: 71.5,
  courseHandicap: 13,
  courseId: 1,
  createdAt: new Date("2025-05-12T14:00:00.000Z").toISOString(),
  exceptionalScoreAdjustment: 0,
  existingHandicapIndex: 12.4,
  holes_played: 18,
  nine_hole_section: null,
  notes: null,
  parPlayed: 72,
  scoreDifferential: 11.1,
  slope_rating_used: 130,
  teeId: 1,
  teeTime: new Date("2025-05-12T14:00:00.000Z").toISOString(),
  totalStrokes: 84,
  updatedHandicapIndex: 12.3,
  userId: "00000000-0000-0000-0000-000000000001",
};

export const fixtureScorecard: ScorecardWithRound = {
  userId: "00000000-0000-0000-0000-000000000001",
  approvalStatus: "approved",
  teeTime: new Date("2025-05-12T14:00:00.000Z").toISOString(),
  notes: "Sample round used for Storybook.",
  course: {
    id: 1,
    name: "Pebble Beach Golf Links",
    approvalStatus: "approved",
    country: "United States",
    city: "Pebble Beach",
    website: "https://example.com",
    tees: undefined,
  },
  teePlayed: {
    id: 1,
    name: "Blue",
    gender: "mens",
    courseId: 1,
    courseRating18: 71.5,
    slopeRating18: 130,
    courseRatingFront9: 35.6,
    slopeRatingFront9: 128,
    courseRatingBack9: 35.9,
    slopeRatingBack9: 132,
    outPar: 36,
    inPar: 36,
    totalPar: 72,
    outDistance: 3440,
    inDistance: 3470,
    totalDistance: 6910,
    distanceMeasurement: "yards",
    approvalStatus: "approved",
    holes: fixtureHoles,
  },
  scores: fixtureScores,
  round: fixtureRound,
};

export const fixtureScorecardNineHole: ScorecardWithRound = {
  ...fixtureScorecard,
  scores: fixtureScores.slice(0, 9),
  nineHoleSection: "front",
  round: { ...fixtureRound, holes_played: 9, nine_hole_section: "front" },
};
