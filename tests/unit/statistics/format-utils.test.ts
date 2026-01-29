import { describe, test, expect } from "vitest";
import {
  isValidNumber,
  formatDifferential,
  formatPercentage,
  formatScore,
  formatDecimal,
  formatNumber,
  formatGolfAge,
  formatStrokesPerHole,
  formatWithSign,
} from "@/lib/statistics/format-utils";

describe("Format Utils - Safe Number Formatting", () => {
  describe("isValidNumber", () => {
    test("should return true for valid finite numbers", () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(42)).toBe(true);
      expect(isValidNumber(-10.5)).toBe(true);
      expect(isValidNumber(3.14159)).toBe(true);
    });

    test("should return false for NaN", () => {
      expect(isValidNumber(NaN)).toBe(false);
    });

    test("should return false for Infinity", () => {
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
    });

    test("should return false for null and undefined", () => {
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
    });

    test("should return false for non-number types", () => {
      expect(isValidNumber("42")).toBe(false);
      expect(isValidNumber("")).toBe(false);
      expect(isValidNumber({})).toBe(false);
      expect(isValidNumber([])).toBe(false);
      expect(isValidNumber(true)).toBe(false);
    });
  });

  describe("formatDifferential", () => {
    test("should format valid differentials to 1 decimal place", () => {
      expect(formatDifferential(10.5)).toBe("10.5");
      expect(formatDifferential(12.34)).toBe("12.3");
      expect(formatDifferential(0)).toBe("0.0");
      expect(formatDifferential(-5.67)).toBe("-5.7");
    });

    test("should return '--' for invalid values", () => {
      expect(formatDifferential(null)).toBe("--");
      expect(formatDifferential(undefined)).toBe("--");
      expect(formatDifferential(NaN)).toBe("--");
      expect(formatDifferential(Infinity)).toBe("--");
    });
  });

  describe("formatPercentage", () => {
    test("should format valid percentages with % suffix", () => {
      expect(formatPercentage(50)).toBe("50.0%");
      expect(formatPercentage(33.333)).toBe("33.3%");
      expect(formatPercentage(100)).toBe("100.0%");
      expect(formatPercentage(0)).toBe("0.0%");
    });

    test("should return '--' for invalid values", () => {
      expect(formatPercentage(null)).toBe("--");
      expect(formatPercentage(undefined)).toBe("--");
      expect(formatPercentage(NaN)).toBe("--");
    });
  });

  describe("formatScore", () => {
    test("should format valid scores as whole numbers", () => {
      expect(formatScore(85)).toBe("85");
      expect(formatScore(85.4)).toBe("85");
      expect(formatScore(85.6)).toBe("86");
      expect(formatScore(72)).toBe("72");
    });

    test("should return '--' for invalid values", () => {
      expect(formatScore(null)).toBe("--");
      expect(formatScore(undefined)).toBe("--");
      expect(formatScore(NaN)).toBe("--");
    });
  });

  describe("formatDecimal", () => {
    test("should format to specified precision (default 2)", () => {
      expect(formatDecimal(3.14159)).toBe("3.14");
      expect(formatDecimal(10.5)).toBe("10.50");
      expect(formatDecimal(0)).toBe("0.00");
    });

    test("should respect custom precision", () => {
      expect(formatDecimal(3.14159, 3)).toBe("3.142");
      expect(formatDecimal(3.14159, 1)).toBe("3.1");
      expect(formatDecimal(3.14159, 0)).toBe("3");
    });

    test("should return '--' for invalid values", () => {
      expect(formatDecimal(null)).toBe("--");
      expect(formatDecimal(undefined)).toBe("--");
      expect(formatDecimal(NaN, 2)).toBe("--");
    });
  });

  describe("formatNumber", () => {
    test("should format numbers with locale separators", () => {
      // Use toLocaleString() for expected values to avoid locale-dependent test failures
      expect(formatNumber(1000)).toBe((1000).toLocaleString());
      expect(formatNumber(1000000)).toBe((1000000).toLocaleString());
      expect(formatNumber(42)).toBe((42).toLocaleString());
    });

    test("should return '--' for invalid values", () => {
      expect(formatNumber(null)).toBe("--");
      expect(formatNumber(undefined)).toBe("--");
      expect(formatNumber(NaN)).toBe("--");
    });
  });

  describe("formatGolfAge", () => {
    test("should format days correctly", () => {
      expect(formatGolfAge(1)).toBe("1 day");
      expect(formatGolfAge(15)).toBe("15 days");
      expect(formatGolfAge(29)).toBe("29 days");
    });

    test("should format months correctly", () => {
      expect(formatGolfAge(30)).toBe("1 month");
      expect(formatGolfAge(60)).toBe("2 months");
      expect(formatGolfAge(364)).toBe("12 months");
    });

    test("should format years correctly", () => {
      expect(formatGolfAge(365)).toBe("1.0 years");
      expect(formatGolfAge(730)).toBe("2.0 years");
      expect(formatGolfAge(548)).toBe("1.5 years");
    });

    test("should return '--' for invalid values", () => {
      expect(formatGolfAge(null)).toBe("--");
      expect(formatGolfAge(undefined)).toBe("--");
      expect(formatGolfAge(-1)).toBe("--");
      expect(formatGolfAge(NaN)).toBe("--");
    });

    test("should handle zero days", () => {
      expect(formatGolfAge(0)).toBe("0 days");
    });
  });

  describe("formatStrokesPerHole", () => {
    test("should return correct display and context for over par", () => {
      const result = formatStrokesPerHole(4.5);
      expect(result.display).toBe("4.50");
      expect(result.context).toBe("0.5 over par avg");
    });

    test("should return correct display and context for under par", () => {
      const result = formatStrokesPerHole(3.5);
      expect(result.display).toBe("3.50");
      expect(result.context).toBe("0.5 under par avg");
    });

    test("should return 'Right at par!' for values close to 4", () => {
      const result = formatStrokesPerHole(4.0);
      expect(result.display).toBe("4.00");
      expect(result.context).toBe("Right at par!");
    });

    test("should handle near-par values within tolerance", () => {
      const result = formatStrokesPerHole(4.04);
      expect(result.context).toBe("Right at par!");
    });

    test("should return '--' and 'No data' for invalid values", () => {
      expect(formatStrokesPerHole(null)).toEqual({
        display: "--",
        context: "No data",
      });
      expect(formatStrokesPerHole(undefined)).toEqual({
        display: "--",
        context: "No data",
      });
      expect(formatStrokesPerHole(NaN)).toEqual({
        display: "--",
        context: "No data",
      });
    });
  });

  describe("formatWithSign", () => {
    test("should add + prefix for positive numbers", () => {
      expect(formatWithSign(5)).toBe("+5.0");
      expect(formatWithSign(0.5)).toBe("+0.5");
    });

    test("should keep - prefix for negative numbers", () => {
      expect(formatWithSign(-5)).toBe("-5.0");
      expect(formatWithSign(-0.5)).toBe("-0.5");
    });

    test("should format zero without prefix", () => {
      expect(formatWithSign(0)).toBe("0.0");
    });

    test("should respect custom precision", () => {
      expect(formatWithSign(5.123, 2)).toBe("+5.12");
      expect(formatWithSign(-5.123, 0)).toBe("-5");
    });

    test("should return '--' for invalid values", () => {
      expect(formatWithSign(null)).toBe("--");
      expect(formatWithSign(undefined)).toBe("--");
      expect(formatWithSign(NaN)).toBe("--");
    });
  });
});
