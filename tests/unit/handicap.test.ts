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
import { HOLES_MOCK, TWENTY_SCORE_DIFFERENTIALS } from "../utils/handicap";

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
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 3))
  ).toStrictEqual([20.3]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 4))
  ).toStrictEqual([20.3]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 5))
  ).toStrictEqual([20.3]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 6))
  ).toStrictEqual([20.3, 21.4]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 7))
  ).toStrictEqual([20.3, 21.4]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 9))
  ).toStrictEqual([20.3, 21.4, 22.5]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 12))
  ).toStrictEqual([20.3, 21.4, 22.5, 23.6]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 15))
  ).toStrictEqual([20.3, 21.4, 22.5, 23.6, 24.7]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 17))
  ).toStrictEqual([20.3, 21.4, 22.5, 23.6, 24.7, 25.8]);
  expect(
    getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS.slice(0, 19))
  ).toStrictEqual([20.3, 21.4, 22.5, 23.6, 24.7, 25.8, 26.9]);
  expect(getRelevantDifferentials(TWENTY_SCORE_DIFFERENTIALS)).toStrictEqual([
    20.3, 21.4, 22.5, 23.6, 24.7, 25.8, 26.9, 28.0,
  ]);
});

test("test handicap index calculation", () => {
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 3))).toBe(
    20.3 - 2
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 4))).toBe(
    20.3 - 1
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 5))).toBe(
    20.3
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 6))).toBe(
    19.9
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 7))).toBe(
    20.9
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 9))).toBe(
    21.4
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 12))).toBe(
    22
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 15))).toBe(
    22.5
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 17))).toBe(
    23.1
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS.slice(0, 19))).toBe(
    23.6
  );
  expect(calculateHandicapIndex(TWENTY_SCORE_DIFFERENTIALS)).toBe(24.2);
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
