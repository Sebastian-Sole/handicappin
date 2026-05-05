import { describe, expect, test } from "vitest";
import {
  calculateExpected9HoleDifferential,
  calculate9HoleScoreDifferential,
  calculateScoreDifferential,
} from "@handicappin/handicap-core";

describe("9-Hole Score Differential Calculations (USGA Rule 5.1b)", () => {
  describe("calculateExpected9HoleDifferential", () => {
    test("calculates expected differential for scratch golfer", () => {
      // Scratch golfer (0.0 handicap) on a course with:
      // Front 9: CR 35.0, Slope 120, Par 36
      const handicapIndex = 0.0;
      const nineHoleCourseRating = 35.0;
      const nineHoleSlopeRating = 120;
      const nineHolePar = 36;

      const expectedDiff = calculateExpected9HoleDifferential(
        handicapIndex,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        nineHolePar
      );

      // 9-hole course handicap = round((0/2) * (120/113) + (35 - 36)) = round(-1) = -1
      // Expected score = 36 + (-1) = 35
      // Expected differential = (35 - 35) * (113/120) = 0
      expect(expectedDiff).toBeCloseTo(0, 1);
    });

    test("calculates expected differential for mid-handicap golfer", () => {
      // 18 handicap golfer on a course with:
      // Front 9: CR 35.5, Slope 125, Par 36
      const handicapIndex = 18.0;
      const nineHoleCourseRating = 35.5;
      const nineHoleSlopeRating = 125;
      const nineHolePar = 36;

      const expectedDiff = calculateExpected9HoleDifferential(
        handicapIndex,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        nineHolePar
      );

      // 9-hole course handicap = round((18/2) * (125/113) + (35.5 - 36))
      //                        = round(9 * 1.106 - 0.5) = round(9.45) = 9
      // Expected score = 36 + 9 = 45
      // Expected differential = (45 - 35.5) * (113/125) = 9.5 * 0.904 = 8.588
      expect(expectedDiff).toBeCloseTo(8.6, 1);
    });

    test("calculates expected differential for high-handicap golfer", () => {
      // 36 handicap golfer on a course with:
      // Front 9: CR 34.0, Slope 110, Par 35
      const handicapIndex = 36.0;
      const nineHoleCourseRating = 34.0;
      const nineHoleSlopeRating = 110;
      const nineHolePar = 35;

      const expectedDiff = calculateExpected9HoleDifferential(
        handicapIndex,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        nineHolePar
      );

      // 9-hole course handicap = round((36/2) * (110/113) + (34 - 35))
      //                        = round(18 * 0.973 - 1) = round(16.52) = 17
      // Expected score = 35 + 17 = 52
      // Expected differential = (52 - 34) * (113/110) = 18 * 1.027 = 18.49
      expect(expectedDiff).toBeCloseTo(18.5, 1);
    });
  });

  describe("calculate9HoleScoreDifferential", () => {
    test("calculates 18-hole equivalent for typical 9-hole round", () => {
      // Player shoots 42 on front 9 (CR 35.0, Slope 120)
      // With an expected differential of 8.0 for the back 9
      const adjustedPlayedScore = 42;
      const nineHoleCourseRating = 35.0;
      const nineHoleSlopeRating = 120;
      const expectedDifferential = 8.0;

      const scoreDiff = calculate9HoleScoreDifferential(
        adjustedPlayedScore,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        expectedDifferential
      );

      // Played differential = (42 - 35) * (113/120) = 7 * 0.942 = 6.59
      // Combined = 6.59 + 8.0 = 14.59
      // Rounded = 14.6
      expect(scoreDiff).toBeCloseTo(14.6, 1);
    });

    test("handles negative played differential correctly", () => {
      // Player shoots 33 on front 9 (below course rating)
      // CR 35.0, Slope 120, Expected diff 10.0
      const adjustedPlayedScore = 33;
      const nineHoleCourseRating = 35.0;
      const nineHoleSlopeRating = 120;
      const expectedDifferential = 10.0;

      const scoreDiff = calculate9HoleScoreDifferential(
        adjustedPlayedScore,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        expectedDifferential
      );

      // Played differential = (33 - 35) * (113/120) = -2 * 0.942 = -1.88
      // Combined = -1.88 + 10.0 = 8.12
      // Rounded = 8.1
      expect(scoreDiff).toBeCloseTo(8.1, 1);
    });

    test("rounds negative combined differential towards zero", () => {
      // Player shoots exceptionally well: 30 on front 9
      // With low expected differential of 1.0
      const adjustedPlayedScore = 30;
      const nineHoleCourseRating = 35.0;
      const nineHoleSlopeRating = 120;
      const expectedDifferential = 1.0;

      const scoreDiff = calculate9HoleScoreDifferential(
        adjustedPlayedScore,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        expectedDifferential
      );

      // Played differential = (30 - 35) * (113/120) = -5 * 0.942 = -4.71
      // Combined = -4.71 + 1.0 = -3.71
      // Rounded towards zero = -3.7 (ceil of -3.71 to 1 decimal)
      expect(scoreDiff).toBe(-3.7);
    });

    test("matches 18-hole equivalent calculation", () => {
      // Simulate a player who plays 9 holes and we know what their 18-hole score would be
      // Player: 10 handicap, shoots 45 on front 9 (CR 35.5, Slope 125, Par 36)
      const adjustedPlayedScore = 45;
      const nineHoleCourseRating = 35.5;
      const nineHoleSlopeRating = 125;

      // Calculate expected differential for their handicap
      const expectedDiff = calculateExpected9HoleDifferential(
        10.0,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        36
      );

      const combinedDiff = calculate9HoleScoreDifferential(
        adjustedPlayedScore,
        nineHoleCourseRating,
        nineHoleSlopeRating,
        expectedDiff
      );

      // The combined differential should be reasonable for a 10-handicap
      // shooting slightly above expected (45 vs expected ~41)
      expect(combinedDiff).toBeGreaterThan(10);
      expect(combinedDiff).toBeLessThan(20);
    });
  });

  describe("comparison with 18-hole calculation", () => {
    test("9-hole differential formula matches 18-hole formula structure", () => {
      // Both formulas should use: (score - rating) * (113 / slope)
      const score18 = 85;
      const rating18 = 72.0;
      const slope18 = 130;

      const diff18 = calculateScoreDifferential(score18, rating18, slope18);

      // Expected: (85 - 72) * (113/130) = 13 * 0.869 = 11.3
      expect(diff18).toBeCloseTo(11.3, 1);

      // 9-hole with same relative values (score/2, rating/2)
      const score9 = 42;
      const rating9 = 36.0;
      const slope9 = 130;
      const expectedDiff = 5.65; // Half of the 18-hole expected

      const diff9 = calculate9HoleScoreDifferential(
        score9,
        rating9,
        slope9,
        expectedDiff
      );

      // Played diff = (42 - 36) * (113/130) = 6 * 0.869 = 5.22
      // Combined = 5.22 + 5.65 = 10.87
      expect(diff9).toBeCloseTo(10.9, 1);
    });
  });

  describe("back-9 inputs (USGA Rule 5.1b)", () => {
    test("calculates expected differential using back-9 ratings/par", () => {
      // The functions take ratings as parameters, so back-9 is just supplying
      // the back-9 numbers. Confirm the math with asymmetric back-9 values.
      const handicapIndex = 12.0;
      const back9CourseRating = 36.5;
      const back9SlopeRating = 135;
      const back9Par = 36;

      const expectedDiff = calculateExpected9HoleDifferential(
        handicapIndex,
        back9CourseRating,
        back9SlopeRating,
        back9Par
      );

      // 9-hole CH = round((12/2) × (135/113) + (36.5 - 36))
      //           = round(6 × 1.1947 + 0.5) = round(7.668) = 8
      // Expected score = 36 + 8 = 44
      // Expected diff (unrounded) = (44 - 36.5) × (113/135) = 7.5 × 0.837 = 6.278
      expect(expectedDiff).toBeCloseTo(6.28, 1);
    });

    test("calculates 18-hole equivalent for a back-9 round", () => {
      // Player shoots 44 on the back 9 (CR 36.5, Slope 135)
      const adjustedPlayedScore = 44;
      const back9CourseRating = 36.5;
      const back9SlopeRating = 135;
      const expectedDifferential = 9.0;

      const scoreDiff = calculate9HoleScoreDifferential(
        adjustedPlayedScore,
        back9CourseRating,
        back9SlopeRating,
        expectedDifferential
      );

      // Played diff = (44 - 36.5) × (113/135) = 7.5 × 0.837 = 6.278
      // Combined = 6.278 + 9 = 15.278 -> rounds to 15.3
      expect(scoreDiff).toBeCloseTo(15.3, 1);
    });

    test("front-9 vs back-9 ratings produce different results", () => {
      // Same played score, different 9-hole ratings -> different differentials.
      const score = 42;
      const expectedDiff = 7.0;
      const front = calculate9HoleScoreDifferential(score, 35.5, 125, expectedDiff);
      const back = calculate9HoleScoreDifferential(score, 36.5, 135, expectedDiff);
      expect(front).not.toBeCloseTo(back, 1);
    });
  });

  describe("edge cases", () => {
    test("handles exact par score on scratch course", () => {
      // Scratch course: CR = Par
      const score = 36;
      const rating = 36.0;
      const slope = 113; // Standard slope
      const expectedDiff = 0; // Scratch player

      const diff = calculate9HoleScoreDifferential(
        score,
        rating,
        slope,
        expectedDiff
      );

      // Should be exactly 0 (no adjustment needed)
      expect(diff).toBe(0);
    });

    test("handles high slope rating correctly", () => {
      // Very difficult course: Slope 155
      const score = 50;
      const rating = 38.0;
      const slope = 155;
      const expectedDiff = 15.0;

      const diff = calculate9HoleScoreDifferential(
        score,
        rating,
        slope,
        expectedDiff
      );

      // Played diff = (50 - 38) * (113/155) = 12 * 0.7290 = 8.748
      // Combined = 8.748 + 15 = 23.748 -> rounds to 23.7
      expect(diff).toBe(23.7);
    });

    test("handles low slope rating correctly", () => {
      // Easy course: Slope 90
      const score = 40;
      const rating = 34.0;
      const slope = 90;
      const expectedDiff = 5.0;

      const diff = calculate9HoleScoreDifferential(
        score,
        rating,
        slope,
        expectedDiff
      );

      // Played diff = (40 - 34) * (113/90) = 6 * 1.256 = 7.53
      // Combined = 7.53 + 5 = 12.53 -> 12.5
      expect(diff).toBeCloseTo(12.5, 1);
    });
  });
});
