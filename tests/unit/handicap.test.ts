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
  ADJUSTED_GROSS_SCORE,
  ADJUSTED_SCORE_ANSWER,
  COURSE_HANDICAP_ANSWER,
  COURSE_RATING,
  HANDICAP_INDEX,
  HOLE_WITH_HCP_OVER_MAX,
  HOLES_MOCK,
  PAR_VALUE,
  PLAYING_HANDICAP_MULTIPLIER,
  SCORE_DIFFERENTIAL_ANSWER,
  SLOPE_RATING,
  TWENTY_SCORE_DIFFERENTIALS,
  UNADJUSTED_HOLE,
  UNADJUSTED_HOLE_OVER_MAX,
} from "../utils/handicap";

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
  expect(calculateHoleAdjustedScore(UNADJUSTED_HOLE)).toBe(5);
  expect(calculateHoleAdjustedScore(UNADJUSTED_HOLE_OVER_MAX)).toBe(7);
  expect(calculateHoleAdjustedScore(HOLE_WITH_HCP_OVER_MAX)).toBe(8);
});

test("calculates adjusted played score", () => {
  expect(calculateAdjustedPlayedScore(HOLES_MOCK)).toBe(45);
});

test("calculate adjusted gross score", () => {
  expect(
    calculateAdjustedGrossScore(
      HOLES_MOCK,
      HANDICAP_INDEX,
      SLOPE_RATING,
      COURSE_RATING,
      PAR_VALUE
    )
  ).toBe(ADJUSTED_SCORE_ANSWER);
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
