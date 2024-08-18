import { Hole } from "@/types/round";
import {
  calculateAdjustedGrossScore,
  calculateAdjustedPlayedScore,
  calculateCappedHandicapIndex,
  calculateCourseHandicap,
  calculateHandicapIndex,
  calculateHoleAdjustedScore,
  calculatePlayingHandicap,
  calculateScoreDifferential,
  getRelevantDifferentials,
} from "../../utils/calculations/handicap";
import { expect, test } from "vitest";
import {
  FIVE_SCORE_DIFFERENTIALS,
  HOLES_MOCK,
  TWENTY_SCORE_DIFFERENTIALS,
} from "../utils/handicap";

const HANDICAP_INDEX = 54;
const COURSE_RATING = 50.3;
const SLOPE_RATING = 82;
const PAR_VALUE = 54;
const COURSE_HANDICAP_ANSWER = 35.485840708;

const ADJUSTED_GROSS_SCORE = 82;
const SCORE_DIFFERENTIAL_ANSWER = 43.68414634146342;

const PLAYING_HANDICAP_MULTIPLIER = 0.95;

const UNADJUSTED_HOLE: Hole = {
  hcp: 1,
  holeNumber: 1,
  par: 3,
  strokes: 5,
};

const ADJUSTED_HOLE: Hole = {
  hcp: 1,
  holeNumber: 1,
  par: 3,
  strokes: 5,
};

test("calculates course handicap", () => {
  expect(
    calculateCourseHandicap(
      HANDICAP_INDEX,
      SLOPE_RATING,
      COURSE_RATING,
      PAR_VALUE
    )
  ).toBe(Math.round(COURSE_HANDICAP_ANSWER));
});

test("calculates score differential", () => {
  expect(
    calculateScoreDifferential(
      ADJUSTED_GROSS_SCORE,
      COURSE_RATING,
      SLOPE_RATING
    )
  ).toBe(SCORE_DIFFERENTIAL_ANSWER);
});

test("calculates adjusted hole score", () => {
  // TODO: Correct tests
  expect(calculateHoleAdjustedScore(UNADJUSTED_HOLE)).toBeTruthy();
  expect(calculateHoleAdjustedScore(ADJUSTED_HOLE)).toBeTruthy();
});

test("calculates adjusted played score", () => {
  // TODO: Correct tests
  expect(calculateAdjustedPlayedScore(HOLES_MOCK)).toBeTruthy();
});

test("calculate adjusted gross score", () => {
  // Todo: Correct tests
  expect(
    calculateAdjustedGrossScore(
      HOLES_MOCK,
      HANDICAP_INDEX,
      SLOPE_RATING,
      COURSE_RATING,
      PAR_VALUE
    )
  ).toBeTruthy();
});

test("extracts relevant score differentials for handicap index calculation purposes", () => {
  // TODO: Implement
  expect(getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS)).toBeTruthy();
  expect(getRelevantDifferentials(FIVE_SCORE_DIFFERENTIALS)).toBeTruthy();
});

test("test handicap index calculation", () => {
  // TODO: Implement
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS)).toBeTruthy();
  expect(calculateHandicapIndex(FIVE_SCORE_DIFFERENTIALS)).toBeTruthy();
});

test("test playing handicap calculation", () => {
  expect(calculatePlayingHandicap(COURSE_HANDICAP_ANSWER)).toBe(
    Math.round(COURSE_HANDICAP_ANSWER * PLAYING_HANDICAP_MULTIPLIER)
  );
});

test("test capped handicap calculation", () => {
  expect(calculateCappedHandicapIndex(HANDICAP_INDEX, HANDICAP_INDEX)).toBe(
    HANDICAP_INDEX
  );
  expect(calculateCappedHandicapIndex(54, 30)).toBe(35);
  expect(calculateCappedHandicapIndex(34, 30)).toBe(33.5);
  expect(calculateCappedHandicapIndex(33, 36)).toBe(33);
  expect(calculateCappedHandicapIndex(33, 32)).toBe(33);
});
