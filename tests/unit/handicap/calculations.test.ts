import { describe, it, expect } from "vitest";
import {
  calculateScoreDifferential,
  calculateHandicapIndex,
  getRelevantDifferentials,
  applyHandicapCaps,
  calculateCourseHandicap,
  calculate9HoleScoreDifferential,
  calculateExpected9HoleDifferential,
  calculateHoleAdjustedScore,
  roundToHandicapPrecision,
  calculateAdjustedPlayedScore,
  calculateAdjustedGrossScore,
} from "@/lib/handicap/calculations";
import { Hole, Score, Tee } from "@/types/scorecard-input";

describe("Score Differential Calculation", () => {
  describe("calculateScoreDifferential", () => {
    it("calculates positive differential correctly", () => {
      // Formula: (Score - Course Rating) × (113 / Slope Rating)
      // (85 - 72.0) × (113 / 130) = 13 × 0.869 = 11.3
      const result = calculateScoreDifferential(85, 72.0, 130);
      expect(result).toBeCloseTo(11.3, 1);
    });

    it("calculates negative differential correctly (rounds toward zero)", () => {
      // (68 - 72.0) × (113 / 130) = -4 × 0.869 = -3.48 → rounds to -3.4 (toward zero)
      const result = calculateScoreDifferential(68, 72.0, 130);
      expect(result).toBe(-3.4);
    });

    it("handles scratch golfer score", () => {
      // Score equals course rating → differential = 0
      const result = calculateScoreDifferential(72, 72.0, 113);
      expect(result).toBe(0);
    });

    it("handles very difficult course (high slope)", () => {
      // (90 - 74.5) × (113 / 155) = 15.5 × 0.729 = 11.3
      const result = calculateScoreDifferential(90, 74.5, 155);
      expect(result).toBeCloseTo(11.3, 1);
    });

    it("handles easy course (low slope)", () => {
      // (80 - 68.0) × (113 / 90) = 12 × 1.256 = 15.1
      const result = calculateScoreDifferential(80, 68.0, 90);
      expect(result).toBeCloseTo(15.1, 1);
    });

    it("rounds positive differentials to 1 decimal place", () => {
      // (95 - 72.0) × (113 / 125) = 23 × 0.904 = 20.792 → 20.8
      const result = calculateScoreDifferential(95, 72.0, 125);
      expect(result).toBe(20.8);
    });
  });
});

describe("Handicap Index Calculation", () => {
  describe("getRelevantDifferentials", () => {
    it("returns 1 differential for 1-5 rounds", () => {
      const diffs = [5.0, 8.0, 12.0, 15.0, 18.0];
      expect(getRelevantDifferentials(diffs)).toEqual([5.0]);
    });

    it("returns 2 differentials for 6-8 rounds", () => {
      const diffs = [5.0, 8.0, 12.0, 15.0, 18.0, 20.0, 22.0];
      expect(getRelevantDifferentials(diffs)).toEqual([5.0, 8.0]);
    });

    it("returns 3 differentials for 9-11 rounds", () => {
      const diffs = Array.from({ length: 10 }, (_, i) => i + 1);
      expect(getRelevantDifferentials(diffs)).toHaveLength(3);
    });

    it("returns 4 differentials for 12-14 rounds", () => {
      const diffs = Array.from({ length: 13 }, (_, i) => i + 1);
      expect(getRelevantDifferentials(diffs)).toHaveLength(4);
    });

    it("returns 5 differentials for 15-16 rounds", () => {
      const diffs = Array.from({ length: 15 }, (_, i) => i + 1);
      expect(getRelevantDifferentials(diffs)).toHaveLength(5);
    });

    it("returns 6 differentials for 17-18 rounds", () => {
      const diffs = Array.from({ length: 17 }, (_, i) => i + 1);
      expect(getRelevantDifferentials(diffs)).toHaveLength(6);
    });

    it("returns 7 differentials for 19 rounds", () => {
      const diffs = Array.from({ length: 19 }, (_, i) => i + 1);
      expect(getRelevantDifferentials(diffs)).toHaveLength(7);
    });

    it("returns 8 differentials for 20+ rounds", () => {
      const diffs = Array.from({ length: 25 }, (_, i) => i + 1);
      expect(getRelevantDifferentials(diffs)).toHaveLength(8);
      expect(getRelevantDifferentials(diffs)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe("calculateHandicapIndex", () => {
    it("returns 54 for less than 3 rounds", () => {
      expect(calculateHandicapIndex([10.0, 12.0])).toBe(54);
    });

    it("applies -2 adjustment for exactly 3 rounds", () => {
      // Lowest 1 of 3: 10.0, then -2 = 8.0
      const result = calculateHandicapIndex([10.0, 12.0, 15.0]);
      expect(result).toBe(8.0);
    });

    it("applies -1 adjustment for exactly 4 rounds", () => {
      // Lowest 1 of 4: 10.0, then -1 = 9.0
      const result = calculateHandicapIndex([10.0, 12.0, 15.0, 18.0]);
      expect(result).toBe(9.0);
    });

    it("no adjustment for 5 rounds", () => {
      // Lowest 1 of 5: 10.0
      const result = calculateHandicapIndex([10.0, 12.0, 15.0, 18.0, 20.0]);
      expect(result).toBe(10.0);
    });

    it("applies -1 adjustment for exactly 6 rounds", () => {
      // Lowest 2 of 6: avg(10.0, 11.0) = 10.5, then -1 = 9.5
      const result = calculateHandicapIndex([
        10.0, 11.0, 12.0, 15.0, 18.0, 20.0,
      ]);
      expect(result).toBe(9.5);
    });

    it("calculates correctly for 20 rounds (uses lowest 8)", () => {
      const diffs = [
        5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 15.0, 16.0, 17.0, 18.0, 19.0,
        20.0, 21.0, 22.0, 23.0, 24.0, 25.0, 26.0,
      ];
      // Average of lowest 8: (5+6+7+8+9+10+11+12)/8 = 68/8 = 8.5
      const result = calculateHandicapIndex(diffs);
      expect(result).toBe(8.5);
    });

    it("sorts differentials before selecting lowest", () => {
      // Unsorted input - should still work correctly
      const diffs = [20.0, 5.0, 15.0, 10.0, 25.0];
      // Lowest 1 of 5: 5.0
      const result = calculateHandicapIndex(diffs);
      expect(result).toBe(5.0);
    });
  });
});

describe("Handicap Caps (USGA Rule 5.7)", () => {
  describe("applyHandicapCaps", () => {
    it("returns original index when lowHandicapIndex is null", () => {
      const result = applyHandicapCaps(15.0, null);
      expect(result).toBe(15.0);
    });

    it("returns original index when below low handicap", () => {
      const result = applyHandicapCaps(8.0, 10.0);
      expect(result).toBe(8.0);
    });

    it("returns original index within soft cap threshold (<=3.0)", () => {
      // 13.0 is 3.0 above 10.0 (exactly at threshold)
      const result = applyHandicapCaps(13.0, 10.0);
      expect(result).toBe(13.0);
    });

    it("applies soft cap when difference > 3.0 but <= 5.0", () => {
      // 14.0 is 4.0 above 10.0
      // Soft cap: 3.0 + (4.0 - 3.0) × 0.5 = 3.0 + 0.5 = 3.5
      // Result: 10.0 + 3.5 = 13.5
      const result = applyHandicapCaps(14.0, 10.0);
      expect(result).toBe(13.5);
    });

    it("applies hard cap when difference > 5.0", () => {
      // 20.0 is 10.0 above 10.0 (way above hard cap)
      // Hard cap: 10.0 + 5.0 = 15.0
      const result = applyHandicapCaps(20.0, 10.0);
      expect(result).toBe(15.0);
    });

    it("soft cap calculation at boundary (exactly 5.0 difference)", () => {
      // 15.0 is 5.0 above 10.0
      // Soft cap: 3.0 + (5.0 - 3.0) × 0.5 = 3.0 + 1.0 = 4.0
      // Result: 10.0 + 4.0 = 14.0
      const result = applyHandicapCaps(15.0, 10.0);
      expect(result).toBe(14.0);
    });

    it("returns original index when difference is exactly 0", () => {
      const result = applyHandicapCaps(10.0, 10.0);
      expect(result).toBe(10.0);
    });
  });
});

describe("Course Handicap Calculation", () => {
  describe("calculateCourseHandicap", () => {
    const mockTee: Tee = {
      id: 1,
      courseId: 1,
      name: "Blue",
      gender: "mens",
      courseRating18: 72.0,
      slopeRating18: 130,
      courseRatingFront9: 36.0,
      slopeRatingFront9: 128,
      courseRatingBack9: 36.0,
      slopeRatingBack9: 132,
      outPar: 36,
      inPar: 36,
      totalPar: 72,
      outDistance: 3400,
      inDistance: 3500,
      totalDistance: 6900,
      distanceMeasurement: "yards",
      approvalStatus: "approved",
      holes: undefined,
    };

    it("calculates 18-hole course handicap correctly", () => {
      // Formula: Handicap Index × (Slope / 113) + (Course Rating - Par)
      // 15.0 × (130 / 113) + (72.0 - 72) = 15.0 × 1.15 + 0 = 17.25 → 17
      const result = calculateCourseHandicap(15.0, mockTee, 18);
      expect(result).toBe(17);
    });

    it("calculates 9-hole course handicap correctly", () => {
      // Uses half handicap index for 9 holes
      // (15.0 / 2) × (128 / 113) + (36.0 - 36) = 7.5 × 1.133 + 0 = 8.496 → 8
      const result = calculateCourseHandicap(15.0, mockTee, 9);
      expect(result).toBe(8);
    });

    it("handles zero handicap", () => {
      const result = calculateCourseHandicap(0, mockTee, 18);
      expect(result).toBe(0);
    });

    it("handles course rating above par", () => {
      const difficultTee: Tee = {
        ...mockTee,
        courseRating18: 74.5,
      };
      // 15.0 × (130 / 113) + (74.5 - 72) = 17.25 + 2.5 = 19.75 → 20
      const result = calculateCourseHandicap(15.0, difficultTee, 18);
      expect(result).toBe(20);
    });

    it("handles course rating below par", () => {
      const easyTee: Tee = {
        ...mockTee,
        courseRating18: 70.0,
      };
      // 15.0 × (130 / 113) + (70.0 - 72) = 17.25 - 2 = 15.25 → 15
      const result = calculateCourseHandicap(15.0, easyTee, 18);
      expect(result).toBe(15);
    });
  });
});

describe("9-Hole Calculations", () => {
  describe("calculateExpected9HoleDifferential", () => {
    it("calculates expected differential for unplayed 9", () => {
      // For a 15.0 handicap on a 36.0 rating, 128 slope, par 36 nine
      const result = calculateExpected9HoleDifferential(15.0, 36.0, 128, 36);
      // 9-hole CH = round((15.0/2) × (128/113) + (36.0 - 36)) = round(8.496) = 8
      // Expected score = 36 + 8 = 44
      // Expected diff = (44 - 36.0) × (113 / 128) = 8 × 0.883 = 7.0625
      expect(result).toBeCloseTo(7.06, 1);
    });

    it("handles scratch golfer", () => {
      // 0 handicap should result in expected score = par
      const result = calculateExpected9HoleDifferential(0, 36.0, 113, 36);
      // Expected score = 36 + 0 = 36
      // Expected diff = (36 - 36) × (113 / 113) = 0
      expect(result).toBe(0);
    });
  });

  describe("calculate9HoleScoreDifferential", () => {
    it("combines played and expected differentials", () => {
      // Played 42 on par 36, rating 36.0, slope 128
      // Played diff = (42 - 36.0) × (113 / 128) = 6 × 0.883 = 5.3
      // With expected diff of 7.95, combined = 5.3 + 7.95 = 13.25 → 13.3
      const result = calculate9HoleScoreDifferential(42, 36.0, 128, 7.95);
      expect(result).toBeCloseTo(13.2, 1);
    });

    it("handles negative combined differential (rounds toward zero)", () => {
      // Played 32 on par 36, rating 36.0, slope 128
      // Played diff = (32 - 36.0) × (113 / 128) = -4 × 0.883 = -3.53
      // With expected diff of 2.0, combined = -3.53 + 2.0 = -1.53 → -1.5
      const result = calculate9HoleScoreDifferential(32, 36.0, 128, 2.0);
      expect(result).toBe(-1.5);
    });

    it("handles exactly par score", () => {
      // Played 36 on par 36, rating 36.0, slope 113
      // Played diff = 0
      // With expected diff of 5.0, combined = 5.0
      const result = calculate9HoleScoreDifferential(36, 36.0, 113, 5.0);
      expect(result).toBe(5.0);
    });
  });
});

describe("Score Adjustment (USGA Rule 3.1)", () => {
  describe("calculateHoleAdjustedScore", () => {
    const mockHole: Hole = {
      id: 1,
      holeNumber: 1,
      par: 4,
      hcp: 5,
      distance: 380,
      teeId: 1,
    };

    it("caps at par + 5 for player without established handicap", () => {
      const score: Score = { holeId: 1, strokes: 12, hcpStrokes: 0 };
      const result = calculateHoleAdjustedScore(mockHole, score, false);
      expect(result).toBe(9); // par 4 + 5 = 9
    });

    it("uses net double bogey for established handicap", () => {
      // Par 4 + 2 + 1 handicap stroke = 7
      const score: Score = { holeId: 1, strokes: 10, hcpStrokes: 1 };
      const result = calculateHoleAdjustedScore(mockHole, score, true);
      expect(result).toBe(7);
    });

    it("caps at par + 5 even with many handicap strokes", () => {
      // Par 4 + 2 + 4 strokes = 10, but max is par + 5 = 9
      const score: Score = { holeId: 1, strokes: 15, hcpStrokes: 4 };
      const result = calculateHoleAdjustedScore(mockHole, score, true);
      expect(result).toBe(9);
    });

    it("returns actual score when under max", () => {
      const score: Score = { holeId: 1, strokes: 5, hcpStrokes: 1 };
      const result = calculateHoleAdjustedScore(mockHole, score, true);
      expect(result).toBe(5);
    });

    it("handles par 3 hole", () => {
      const par3Hole: Hole = { ...mockHole, holeNumber: 2, par: 3 };
      const score: Score = { holeId: 1, strokes: 10, hcpStrokes: 1 };
      // Max = min(par+5=8, par+2+1=6) = 6
      const result = calculateHoleAdjustedScore(par3Hole, score, true);
      expect(result).toBe(6);
    });

    it("handles par 5 hole", () => {
      const par5Hole: Hole = { ...mockHole, holeNumber: 3, par: 5 };
      const score: Score = { holeId: 1, strokes: 12, hcpStrokes: 2 };
      // Max = min(par+5=10, par+2+2=9) = 9
      const result = calculateHoleAdjustedScore(par5Hole, score, true);
      expect(result).toBe(9);
    });
  });

  describe("calculateAdjustedPlayedScore", () => {
    it("sums adjusted scores for all holes", () => {
      const holes: Hole[] = [
        { id: 1, holeNumber: 1, par: 4, hcp: 1, distance: 400, teeId: 1 },
        { id: 2, holeNumber: 2, par: 3, hcp: 2, distance: 180, teeId: 1 },
      ];
      const scores: Score[] = [
        { holeId: 1, strokes: 5, hcpStrokes: 1 },
        { holeId: 2, strokes: 4, hcpStrokes: 0 },
      ];
      // Hole 1: actual 5, max = min(9, 7) = 7, use 5
      // Hole 2: actual 4, max = min(8, 5) = 5, use 4
      // Total: 5 + 4 = 9
      const result = calculateAdjustedPlayedScore(holes, scores, true);
      expect(result).toBe(9);
    });

    it("applies net double bogey caps when needed", () => {
      const holes: Hole[] = [
        { id: 1, holeNumber: 1, par: 4, hcp: 1, distance: 400, teeId: 1 },
      ];
      const scores: Score[] = [{ holeId: 1, strokes: 10, hcpStrokes: 1 }];
      // Max = min(9, 7) = 7
      const result = calculateAdjustedPlayedScore(holes, scores, true);
      expect(result).toBe(7);
    });

    it("handles missing scores gracefully", () => {
      const holes: Hole[] = [
        { id: 1, holeNumber: 1, par: 4, hcp: 1, distance: 400, teeId: 1 },
        { id: 2, holeNumber: 2, par: 4, hcp: 2, distance: 400, teeId: 1 },
      ];
      const scores: Score[] = [{ holeId: 1, strokes: 5, hcpStrokes: 1 }];
      // Only one score provided, second hole returns 0
      const result = calculateAdjustedPlayedScore(holes, scores, true);
      expect(result).toBe(5);
    });
  });
});

describe("Adjusted Gross Score Calculation", () => {
  describe("calculateAdjustedGrossScore", () => {
    it("returns adjusted played score for 18 holes", () => {
      const holes: Hole[] = [];
      const scores: Score[] = [];
      const result = calculateAdjustedGrossScore(85, 15, 18, holes, scores);
      expect(result).toBe(85);
    });

    it("adds predicted strokes for partial rounds", () => {
      const holes: Hole[] = [
        { id: 10, holeNumber: 10, par: 4, hcp: 1, distance: 400, teeId: 1 },
        { id: 11, holeNumber: 11, par: 4, hcp: 2, distance: 400, teeId: 1 },
      ];
      const scores: Score[] = [{ holeId: 1, strokes: 5, hcpStrokes: 1 }];
      // Played 9 holes with score 42
      // Remaining 9 holes: par = 4+4 = 8 (only 2 holes in test data)
      // Predicted strokes = round(18 / 18 * 9) = 9 (but formula uses holesLeft)
      // Since only 2 unplayed holes in test: par = 8
      // Holes left = 18 - 9 = 9
      // Predicted = round(18 / 18 * 9) = 9
      // AGS = 42 + 9 + 8 = 59 (with simplified test data)
      const result = calculateAdjustedGrossScore(42, 18, 9, holes, scores);
      // holesLeft = 9, predictedStrokes = round(18/18 * 9) = 9
      // parForRemaining = 4 + 4 = 8 (holes 10, 11 not in scores)
      expect(result).toBe(42 + 9 + 8);
    });
  });
});

describe("Precision and Rounding", () => {
  describe("roundToHandicapPrecision", () => {
    it("rounds to 1 decimal place - round up", () => {
      expect(roundToHandicapPrecision(10.45)).toBe(10.5);
    });

    it("rounds to 1 decimal place - round down", () => {
      expect(roundToHandicapPrecision(10.44)).toBe(10.4);
    });

    it("handles whole numbers", () => {
      expect(roundToHandicapPrecision(10.0)).toBe(10.0);
    });

    it("handles negative numbers", () => {
      expect(roundToHandicapPrecision(-3.45)).toBe(-3.4);
    });

    it("handles very small decimals", () => {
      expect(roundToHandicapPrecision(0.04)).toBe(0.0);
    });

    it("handles boundary at .05", () => {
      expect(roundToHandicapPrecision(10.05)).toBe(10.1);
    });
  });
});
