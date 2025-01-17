import { Hole } from "@/types/scorecard";

export const HOLES_MOCK: Hole[] = [
  {
    holeNumber: 1,
    par: 3,
    hcp: 1,
    strokes: 10,
    hcpStrokes: 2,
  },
  {
    holeNumber: 2,
    par: 3,
    hcp: 2,
    strokes: 5,
    hcpStrokes: 0,
  },
  {
    holeNumber: 3,
    par: 3,
    hcp: 3,
    strokes: 4,
    hcpStrokes: 0,
  },
  {
    holeNumber: 4,
    par: 3,
    hcp: 4,
    strokes: 5,
    hcpStrokes: 0,
  },
  {
    holeNumber: 5,
    par: 3,
    hcp: 5,
    strokes: 7,
    hcpStrokes: 0,
  },
  {
    holeNumber: 6,
    par: 3,
    hcp: 6,
    strokes: 6,
    hcpStrokes: 0,
  },
  {
    holeNumber: 7,
    par: 3,
    hcp: 7,
    strokes: 4,
    hcpStrokes: 0,
  },
  {
    holeNumber: 8,
    par: 3,
    hcp: 8,
    strokes: 7,
    hcpStrokes: 0,
  },
  {
    holeNumber: 9,
    par: 3,
    hcp: 9,
    strokes: 5,
    hcpStrokes: 0,
  },
];

export const TWENTY_SCORE_DIFFERENTIALS: number[] = [
  20.3, 21.4, 22.5, 23.6, 24.7, 25.8, 26.9, 28.0, 29.1, 30.2, 31.3, 32.4, 33.5,
  34.6, 35.7, 36.8, 37.9, 39.0, 40.1, 41.2,
];

export const HANDICAP_INDEX = 54;
export const COURSE_RATING = 50.3;
export const SLOPE_RATING = 82;
export const PAR_VALUE = 54;
export const COURSE_HANDICAP_ANSWER = 35.485840708;

export const ADJUSTED_GROSS_SCORE = 82;
export const SCORE_DIFFERENTIAL_ANSWER = 43.68414634146342;

export const PLAYING_HANDICAP_MULTIPLIER = 0.95;

export const ADJUSTED_SCORE_ANSWER =
  45 + PAR_VALUE / 2 + Math.round((COURSE_HANDICAP_ANSWER / 18) * 9);

export const UNADJUSTED_HOLE: Hole = {
  hcp: 1,
  holeNumber: 1,
  par: 3,
  strokes: 5,
  hcpStrokes: 0,
};

export const UNADJUSTED_HOLE_OVER_MAX: Hole = {
  hcp: 1,
  holeNumber: 1,
  par: 3,
  strokes: 9,
  hcpStrokes: 2,
};

export const HOLE_WITH_HCP_OVER_MAX: Hole = {
  hcp: 18,
  holeNumber: 1,
  par: 3,
  strokes: 9,
  hcpStrokes: 4,
};
