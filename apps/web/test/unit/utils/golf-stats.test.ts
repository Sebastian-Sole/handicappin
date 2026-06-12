import { describe, expect, test } from "vitest";
import {
  calculatePlusMinusScore,
  calculateAverageScore,
  calculateAverageScoreChange,
  getChangeType,
  getAverageScoreChangeDescription,
  getHandicapChangeDescription,
} from "@/utils/golf-stats";

describe("calculatePlusMinusScore", () => {
  describe("happy path", () => {
    test("returns positive format for scores over par", () => {
      expect(calculatePlusMinusScore(77, 72)).toBe("+5");
      expect(calculatePlusMinusScore(73, 72)).toBe("+1");
      expect(calculatePlusMinusScore(100, 72)).toBe("+28");
    });

    test("returns negative format for scores under par", () => {
      expect(calculatePlusMinusScore(70, 72)).toBe("-2");
      expect(calculatePlusMinusScore(71, 72)).toBe("-1");
      expect(calculatePlusMinusScore(60, 72)).toBe("-12");
    });

    test("returns 'E' for even par", () => {
      expect(calculatePlusMinusScore(72, 72)).toBe("E");
      expect(calculatePlusMinusScore(70, 70)).toBe("E");
    });
  });

  describe("edge cases", () => {
    test("returns dash for null adjustedGrossScore", () => {
      expect(calculatePlusMinusScore(null, 72)).toBe("—");
    });

    test("returns dash for undefined adjustedGrossScore", () => {
      expect(calculatePlusMinusScore(undefined, 72)).toBe("—");
    });

    test("returns dash for null totalPar", () => {
      expect(calculatePlusMinusScore(85, null)).toBe("—");
    });

    test("returns dash for undefined totalPar", () => {
      expect(calculatePlusMinusScore(85, undefined)).toBe("—");
    });

    test("returns dash when both values are null", () => {
      expect(calculatePlusMinusScore(null, null)).toBe("—");
    });

    test("handles zero scores correctly", () => {
      // Edge case: score of 0 (invalid in real golf but should handle gracefully)
      expect(calculatePlusMinusScore(0, 72)).toBe("-72");
    });
  });
});

describe("calculateAverageScore", () => {
  describe("happy path", () => {
    test("calculates average for multiple scores", () => {
      expect(calculateAverageScore([80, 85, 90])).toBe("85.0");
      expect(calculateAverageScore([72, 74, 76, 78])).toBe("75.0");
    });

    test("returns single decimal precision", () => {
      expect(calculateAverageScore([81, 82, 83])).toBe("82.0");
      expect(calculateAverageScore([80, 81])).toBe("80.5");
      expect(calculateAverageScore([79, 80, 81])).toBe("80.0");
    });

    test("handles single element array", () => {
      expect(calculateAverageScore([85])).toBe("85.0");
    });

    test("handles decimal result correctly", () => {
      // 80 + 83 = 163, 163 / 2 = 81.5
      expect(calculateAverageScore([80, 83])).toBe("81.5");
      // 70 + 71 + 72 = 213, 213 / 3 = 71.0
      expect(calculateAverageScore([70, 71, 72])).toBe("71.0");
    });
  });

  describe("edge cases", () => {
    test("returns dash for empty array", () => {
      expect(calculateAverageScore([])).toBe("—");
    });

    test("returns dash for null/undefined input", () => {
      expect(calculateAverageScore(null as unknown as number[])).toBe("—");
      expect(calculateAverageScore(undefined as unknown as number[])).toBe("—");
    });

    test("handles large scores", () => {
      expect(calculateAverageScore([150, 160, 170])).toBe("160.0");
    });

    test("handles low scores", () => {
      expect(calculateAverageScore([60, 62, 64])).toBe("62.0");
    });
  });
});

describe("calculateAverageScoreChange", () => {
  describe("happy path - improvement (negative change)", () => {
    test("returns negative when second half average is lower", () => {
      // First half: [90, 88] avg = 89
      // Second half: [82, 80] avg = 81
      // Change: 81 - 89 = -8 (improvement)
      const scores = [90, 88, 82, 80];
      expect(calculateAverageScoreChange(scores)).toBe(-8);
    });

    test("detects slight improvement", () => {
      // First half: [85, 84] avg = 84.5
      // Second half: [83, 82] avg = 82.5
      // Change: 82.5 - 84.5 = -2 (slight improvement)
      const scores = [85, 84, 83, 82];
      expect(calculateAverageScoreChange(scores)).toBe(-2);
    });
  });

  describe("happy path - regression (positive change)", () => {
    test("returns positive when second half average is higher", () => {
      // First half: [80, 82] avg = 81
      // Second half: [88, 90] avg = 89
      // Change: 89 - 81 = 8 (regression)
      const scores = [80, 82, 88, 90];
      expect(calculateAverageScoreChange(scores)).toBe(8);
    });

    test("detects slight regression", () => {
      // First half: [80, 81] avg = 80.5
      // Second half: [82, 83] avg = 82.5
      // Change: 82.5 - 80.5 = 2 (slight regression)
      const scores = [80, 81, 82, 83];
      expect(calculateAverageScoreChange(scores)).toBe(2);
    });
  });

  describe("happy path - no change", () => {
    test("returns zero when averages are equal", () => {
      // First half: [80, 84] avg = 82
      // Second half: [82, 82] avg = 82
      // Change: 82 - 82 = 0
      const scores = [80, 84, 82, 82];
      expect(calculateAverageScoreChange(scores)).toBe(0);
    });
  });

  describe("odd number of elements", () => {
    test("handles odd number of scores correctly", () => {
      // With 5 scores, halfLength = 2
      // First half: [90, 88] avg = 89
      // Second half: [85, 82, 80] avg = 82.33...
      // Change: ~82.33 - 89 = ~-6.67
      const scores = [90, 88, 85, 82, 80];
      const result = calculateAverageScoreChange(scores);
      expect(result).toBeCloseTo(-6.67, 1);
    });
  });

  describe("edge cases", () => {
    test("returns zero for empty array", () => {
      expect(calculateAverageScoreChange([])).toBe(0);
    });

    test("returns zero for single element", () => {
      expect(calculateAverageScoreChange([85])).toBe(0);
    });

    test("returns zero for null input", () => {
      expect(calculateAverageScoreChange(null as unknown as number[])).toBe(0);
    });

    test("returns zero for undefined input", () => {
      expect(calculateAverageScoreChange(undefined as unknown as number[])).toBe(0);
    });

    test("handles minimum valid case (2 elements)", () => {
      // First half: [90] avg = 90
      // Second half: [80] avg = 80
      // Change: 80 - 90 = -10
      const scores = [90, 80];
      expect(calculateAverageScoreChange(scores)).toBe(-10);
    });

    test("handles large arrays", () => {
      // 10 scores: first 5 average 90, second 5 average 80
      const scores = [90, 90, 90, 90, 90, 80, 80, 80, 80, 80];
      expect(calculateAverageScoreChange(scores)).toBe(-10);
    });
  });
});

describe("getChangeType", () => {
  test("returns improvement for negative changes", () => {
    expect(getChangeType(-5)).toBe("improvement");
    expect(getChangeType(-0.1)).toBe("improvement");
    expect(getChangeType(-100)).toBe("improvement");
  });

  test("returns increase for positive changes", () => {
    expect(getChangeType(5)).toBe("increase");
    expect(getChangeType(0.1)).toBe("increase");
    expect(getChangeType(100)).toBe("increase");
  });

  test("returns neutral for zero", () => {
    expect(getChangeType(0)).toBe("neutral");
  });
});

describe("getAverageScoreChangeDescription", () => {
  test("returns appropriate message for significant improvement", () => {
    expect(getAverageScoreChangeDescription(-10)).toBe(
      "Your average score is improving!"
    );
    expect(getAverageScoreChangeDescription(-5)).toBe(
      "Your average score is improving!"
    );
  });

  test("returns appropriate message for slight improvement", () => {
    expect(getAverageScoreChangeDescription(-4)).toBe(
      "Your average score is slightly improving!"
    );
    expect(getAverageScoreChangeDescription(-1)).toBe(
      "Your average score is slightly improving!"
    );
  });

  test("returns appropriate message for significant increase", () => {
    expect(getAverageScoreChangeDescription(10)).toBe(
      "Your average score is increasing"
    );
    expect(getAverageScoreChangeDescription(5)).toBe(
      "Your average score is increasing"
    );
  });

  test("returns appropriate message for slight increase", () => {
    expect(getAverageScoreChangeDescription(4)).toBe(
      "Your average score is slightly increasing"
    );
    expect(getAverageScoreChangeDescription(1)).toBe(
      "Your average score is slightly increasing"
    );
  });

  test("returns neutral message for no change", () => {
    expect(getAverageScoreChangeDescription(0)).toBe(
      "No change in average score"
    );
  });
});

describe("getHandicapChangeDescription", () => {
  test("returns appropriate message for significant improvement", () => {
    expect(getHandicapChangeDescription(-0.1)).toBe(
      "Your handicap is improving!"
    );
    expect(getHandicapChangeDescription(-0.07)).toBe(
      "Your handicap is improving!"
    );
  });

  test("returns appropriate message for slight improvement", () => {
    expect(getHandicapChangeDescription(-0.05)).toBe(
      "Your handicap is slightly improving!"
    );
    expect(getHandicapChangeDescription(-0.01)).toBe(
      "Your handicap is slightly improving!"
    );
  });

  test("returns appropriate message for significant increase", () => {
    expect(getHandicapChangeDescription(0.1)).toBe(
      "Your handicap is increasing"
    );
    expect(getHandicapChangeDescription(0.07)).toBe(
      "Your handicap is increasing"
    );
  });

  test("returns appropriate message for slight increase", () => {
    expect(getHandicapChangeDescription(0.05)).toBe(
      "Your handicap is slightly increasing"
    );
    expect(getHandicapChangeDescription(0.01)).toBe(
      "Your handicap is slightly increasing"
    );
  });

  test("returns neutral message for no change", () => {
    expect(getHandicapChangeDescription(0)).toBe("No change in handicap");
  });
});
