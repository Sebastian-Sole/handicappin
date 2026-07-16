import type { Tee, Hole, Score } from "@/types/scorecard-input";

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

export const fixtureTee: Tee = {
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
};

const SAMPLE_STROKES = [4, 5, 4, 5, 4, 6, 5, 3, 5, 5, 5, 4, 4, 6, 5, 3, 5, 4];

export const fixtureScores: Score[] = SAMPLE_STROKES.map((strokes, idx) => ({
  id: idx + 1,
  roundId: 1,
  holeId: idx + 1,
  strokes,
  hcpStrokes: HCPS[idx] <= 13 ? 1 : 0,
}));

// Detailed-scoring sample: two-digit strokes/putts (regression guard against
// digits clipping in the compact cell inputs) plus a mix of set / unset
// penalties so the "+" affordance and the numeric field both render.
const SAMPLE_PUTTS = [2, 2, 1, 2, 3, 2, 2, 1, 10, 2, 2, 1, 2, 12, 2, 1, 2, 2];
const SAMPLE_FAIRWAY = [
  true, false, null, true, false, true, true, null, false, true, false, null,
  true, true, false, null, true, false,
];
const SAMPLE_PENALTIES = [1, 0, null, null, 2, null, null, null, null, null,
  null, null, null, null, null, null, null, null];

export const fixtureDetailedScores: Score[] = SAMPLE_STROKES.map(
  (strokes, idx) => ({
    id: idx + 1,
    roundId: 1,
    holeId: idx + 1,
    strokes: idx === 8 ? 10 : idx === 13 ? 12 : strokes,
    hcpStrokes: HCPS[idx] <= 13 ? 1 : 0,
    putts: SAMPLE_PUTTS[idx],
    fairwayHit: SAMPLE_FAIRWAY[idx],
    penaltyStrokes: SAMPLE_PENALTIES[idx],
  })
);

export const emptyScores: Score[] = Array(18)
  .fill(null)
  .map((_, idx) => ({
    id: undefined,
    roundId: undefined,
    holeId: idx + 1,
    strokes: 0,
    hcpStrokes: 0,
  }));
