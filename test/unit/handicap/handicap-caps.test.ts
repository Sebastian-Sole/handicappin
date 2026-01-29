import { describe, expect, test } from "vitest";
import {
  calculateLowHandicapIndex,
  applyHandicapCaps,
  type ProcessedRound,
} from "@/lib/handicap/calculations";

/**
 * Helper to create a ProcessedRound with minimal required fields
 */
function createProcessedRound(
  overrides: Partial<ProcessedRound> & { id: number; teeTime: Date }
): ProcessedRound {
  return {
    adjustedGrossScore: 85,
    adjustedPlayedScore: 85,
    existingHandicapIndex: 10.0,
    rawDifferential: 10.0,
    esrOffset: 0,
    finalDifferential: 10.0,
    updatedHandicapIndex: 10.0,
    teeId: 1,
    courseHandicap: 10,
    approvalStatus: "approved",
    ...overrides,
  };
}

describe("Handicap Caps (USGA Rule 5.7)", () => {
  describe("calculateLowHandicapIndex", () => {
    test("returns null when no rounds exist in 365-day window", () => {
      // All rounds are more than 365 days before the current round
      const now = new Date();
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setDate(twoYearsAgo.getDate() - 730);

      const rounds: ProcessedRound[] = [
        createProcessedRound({
          id: 1,
          teeTime: twoYearsAgo,
          updatedHandicapIndex: 15.0,
        }),
        createProcessedRound({
          id: 2,
          teeTime: now,
          updatedHandicapIndex: 20.0,
        }),
      ];

      // Round at index 1 (current) should have no rounds in its 365-day window
      // since round 0 is 730 days ago
      const result = calculateLowHandicapIndex(rounds, 1);

      expect(result).toBeNull();
    });

    test("returns lowest handicap index when rounds exist in 365-day window", () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

      const rounds: ProcessedRound[] = [
        createProcessedRound({
          id: 1,
          teeTime: sixMonthsAgo,
          updatedHandicapIndex: 12.0,
        }),
        createProcessedRound({
          id: 2,
          teeTime: threeMonthsAgo,
          updatedHandicapIndex: 10.0, // This is the lowest
        }),
        createProcessedRound({
          id: 3,
          teeTime: now,
          updatedHandicapIndex: 15.0,
        }),
      ];

      const result = calculateLowHandicapIndex(rounds, 2);

      expect(result).toBe(10.0);
    });

    test("only considers approved rounds", () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

      const rounds: ProcessedRound[] = [
        createProcessedRound({
          id: 1,
          teeTime: sixMonthsAgo,
          updatedHandicapIndex: 5.0, // Lowest but not approved
          approvalStatus: "pending",
        }),
        createProcessedRound({
          id: 2,
          teeTime: threeMonthsAgo,
          updatedHandicapIndex: 12.0,
          approvalStatus: "approved",
        }),
        createProcessedRound({
          id: 3,
          teeTime: now,
          updatedHandicapIndex: 15.0,
          approvalStatus: "approved",
        }),
      ];

      const result = calculateLowHandicapIndex(rounds, 2);

      // Should return 12.0 (the lowest approved round), not 5.0 (pending)
      expect(result).toBe(12.0);
    });

    test("returns null when only non-approved rounds exist in window", () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

      const rounds: ProcessedRound[] = [
        createProcessedRound({
          id: 1,
          teeTime: sixMonthsAgo,
          updatedHandicapIndex: 10.0,
          approvalStatus: "pending", // Not approved
        }),
        createProcessedRound({
          id: 2,
          teeTime: now,
          updatedHandicapIndex: 15.0,
          approvalStatus: "approved",
        }),
      ];

      // Only the current round is approved, but we exclude the current round
      // from the window (per USGA: rounds PRECEDING the current score)
      // So effectively no approved rounds in the window
      const result = calculateLowHandicapIndex(rounds, 1);

      // No approved previous rounds exist, so null is returned
      expect(result).toBeNull();
    });

    test("handles edge of 365-day boundary correctly", () => {
      const now = new Date();
      const exactlyOneYearAgo = new Date(now);
      exactlyOneYearAgo.setDate(exactlyOneYearAgo.getDate() - 365);
      const dayAfterOneYearAgo = new Date(now);
      dayAfterOneYearAgo.setDate(dayAfterOneYearAgo.getDate() - 364);

      const rounds: ProcessedRound[] = [
        createProcessedRound({
          id: 1,
          teeTime: exactlyOneYearAgo,
          updatedHandicapIndex: 8.0, // At the boundary - should be included
        }),
        createProcessedRound({
          id: 2,
          teeTime: dayAfterOneYearAgo,
          updatedHandicapIndex: 12.0,
        }),
        createProcessedRound({
          id: 3,
          teeTime: now,
          updatedHandicapIndex: 15.0,
        }),
      ];

      const result = calculateLowHandicapIndex(rounds, 2);

      // Round 1 at exactly 365 days ago should be included (>= oneYearAgo)
      expect(result).toBe(8.0);
    });
  });

  describe("applyHandicapCaps", () => {
    test("returns newIndex unchanged when lowHandicapIndex is null", () => {
      const newIndex = 25.0;
      const lowHandicapIndex = null;

      const result = applyHandicapCaps(newIndex, lowHandicapIndex);

      expect(result).toBe(25.0);
    });

    test("returns newIndex unchanged when it is lower than lowHandicapIndex", () => {
      const newIndex = 8.0;
      const lowHandicapIndex = 10.0;

      const result = applyHandicapCaps(newIndex, lowHandicapIndex);

      expect(result).toBe(8.0);
    });

    test("returns newIndex unchanged when it equals lowHandicapIndex", () => {
      const newIndex = 10.0;
      const lowHandicapIndex = 10.0;

      const result = applyHandicapCaps(newIndex, lowHandicapIndex);

      expect(result).toBe(10.0);
    });

    test("returns newIndex unchanged when increase is within soft cap threshold (3.0)", () => {
      const newIndex = 12.5; // 2.5 above low
      const lowHandicapIndex = 10.0;

      const result = applyHandicapCaps(newIndex, lowHandicapIndex);

      expect(result).toBe(12.5);
    });

    test("applies soft cap when increase exceeds 3.0 strokes", () => {
      // Soft cap: increase above 3.0 is reduced by 50%
      const newIndex = 15.0; // 5.0 above low
      const lowHandicapIndex = 10.0;

      const result = applyHandicapCaps(newIndex, lowHandicapIndex);

      // Difference = 5.0
      // Soft cap increase = 3.0 + (5.0 - 3.0) * 0.5 = 3.0 + 1.0 = 4.0
      // Result = 10.0 + 4.0 = 14.0
      expect(result).toBe(14.0);
    });

    test("applies hard cap when increase exceeds 5.0 strokes", () => {
      // Hard cap: maximum increase is 5.0 strokes
      const newIndex = 20.0; // 10.0 above low
      const lowHandicapIndex = 10.0;

      const result = applyHandicapCaps(newIndex, lowHandicapIndex);

      // Hard cap = lowHandicapIndex + 5.0 = 15.0
      expect(result).toBe(15.0);
    });

    test("soft cap calculation is applied before hard cap check", () => {
      // Even with soft cap, result shouldn't exceed hard cap
      const newIndex = 25.0; // 15.0 above low
      const lowHandicapIndex = 10.0;

      const result = applyHandicapCaps(newIndex, lowHandicapIndex);

      // Soft cap would give: 3.0 + (15.0 - 3.0) * 0.5 = 3.0 + 6.0 = 9.0 increase
      // That exceeds hard cap of 5.0, so hard cap applies
      expect(result).toBe(15.0);
    });

    test("rounds result to handicap precision (1 decimal)", () => {
      const newIndex = 13.75; // 3.75 above low
      const lowHandicapIndex = 10.0;

      const result = applyHandicapCaps(newIndex, lowHandicapIndex);

      // Difference = 3.75
      // Soft cap increase = 3.0 + (3.75 - 3.0) * 0.5 = 3.0 + 0.375 = 3.375
      // Result = 10.0 + 3.375 = 13.375
      // Rounded to 1 decimal = 13.4
      expect(result).toBe(13.4);
    });
  });

  describe("integration: calculateLowHandicapIndex + applyHandicapCaps", () => {
    test("no caps applied when no rounds in 365-day window", () => {
      const now = new Date();
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setDate(twoYearsAgo.getDate() - 730);

      const rounds: ProcessedRound[] = [
        createProcessedRound({
          id: 1,
          teeTime: twoYearsAgo,
          updatedHandicapIndex: 5.0, // Very low, but too old
        }),
        createProcessedRound({
          id: 2,
          teeTime: now,
          updatedHandicapIndex: 25.0, // High increase, but no cap applies
        }),
      ];

      const lowHandicapIndex = calculateLowHandicapIndex(rounds, 1);
      const cappedIndex = applyHandicapCaps(25.0, lowHandicapIndex);

      expect(lowHandicapIndex).toBeNull();
      expect(cappedIndex).toBe(25.0); // No cap applied
    });

    test("caps correctly applied when rounds exist in window", () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

      const rounds: ProcessedRound[] = [
        createProcessedRound({
          id: 1,
          teeTime: sixMonthsAgo,
          updatedHandicapIndex: 10.0,
        }),
        createProcessedRound({
          id: 2,
          teeTime: now,
          updatedHandicapIndex: 20.0, // 10.0 above low
        }),
      ];

      const lowHandicapIndex = calculateLowHandicapIndex(rounds, 1);
      const cappedIndex = applyHandicapCaps(20.0, lowHandicapIndex);

      expect(lowHandicapIndex).toBe(10.0);
      expect(cappedIndex).toBe(15.0); // Hard cap applied (10 + 5)
    });
  });
});
