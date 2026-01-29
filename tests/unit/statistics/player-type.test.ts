import { describe, test, expect } from "vitest";
import {
  calculatePlayerType,
  PLAYER_TYPES,
  PLAYER_TYPE_THRESHOLDS,
} from "@/lib/statistics/player-type";
import type { ScorecardWithRound } from "@/types/scorecard-input";
import { createMockScorecard } from "./test-fixtures";

describe("Player Type Classification", () => {
  describe("PLAYER_TYPE_THRESHOLDS", () => {
    test("should have correct minimum rounds threshold", () => {
      expect(PLAYER_TYPE_THRESHOLDS.MIN_ROUNDS_FOR_CLASSIFICATION).toBe(5);
    });

    test("should have reasonable variance thresholds", () => {
      expect(PLAYER_TYPE_THRESHOLDS.CONSISTENT_VARIANCE_MAX).toBe(2.5);
      expect(PLAYER_TYPE_THRESHOLDS.HIGH_VARIANCE_MIN).toBe(5.0);
      expect(PLAYER_TYPE_THRESHOLDS.CONSISTENT_VARIANCE_MAX).toBeLessThan(
        PLAYER_TYPE_THRESHOLDS.HIGH_VARIANCE_MIN
      );
    });
  });

  describe("PLAYER_TYPES", () => {
    test("should have all required player types defined", () => {
      const expectedTypes = [
        "MR_CONSISTENT",
        "RAGER",
        "YO_YO",
        "STEADILY_IMPROVING",
        "WEEKEND_WARRIOR",
        "EARLY_BIRD",
        "TWILIGHT_GOLFER",
        "COURSE_EXPLORER",
        "HOME_COURSE_HERO",
        "GRINDER",
        "NEWCOMER",
      ];

      expectedTypes.forEach((type) => {
        expect(PLAYER_TYPES[type as keyof typeof PLAYER_TYPES]).toBeDefined();
        expect(PLAYER_TYPES[type as keyof typeof PLAYER_TYPES].name).toBeTruthy();
        expect(PLAYER_TYPES[type as keyof typeof PLAYER_TYPES].emoji).toBeTruthy();
        expect(PLAYER_TYPES[type as keyof typeof PLAYER_TYPES].description).toBeTruthy();
      });
    });
  });

  describe("calculatePlayerType - Newcomer Classification", () => {
    test("should classify as NEWCOMER with 0 rounds", () => {
      const result = calculatePlayerType([]);
      expect(result.type).toBe("NEWCOMER");
      expect(result.confidence).toBe(1);
    });

    test("should classify as NEWCOMER with less than 5 rounds", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-01-01T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-08T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-15T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-22T10:00:00Z" }),
      ];

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("NEWCOMER");
      expect(result.confidence).toBe(1);
    });

    test("should not classify as NEWCOMER with 5+ rounds", () => {
      const scorecards = Array.from({ length: 5 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).not.toBe("NEWCOMER");
    });
  });

  describe("calculatePlayerType - Consistent Player", () => {
    test("should classify as MR_CONSISTENT with low variance", () => {
      // Create scorecards with very consistent differentials (low variance)
      const scorecards = Array.from({ length: 10 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
          scoreDifferential: 10 + (index % 2) * 0.5, // Alternates between 10.0 and 10.5
          courseId: 1, // Same course
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("MR_CONSISTENT");
    });
  });

  describe("calculatePlayerType - High Variance Player", () => {
    test("should classify as RAGER or YO_YO with high variance differentials", () => {
      // Create scorecards with high variance (big swings)
      // Also vary tee times to avoid EARLY_BIRD detection
      const differentials = [5, 15, 3, 18, 4, 20, 2, 17, 6, 19]; // High variance
      const hours = [7, 14, 9, 16, 8, 15, 10, 17, 11, 18]; // Mixed times
      const scorecards = differentials.map((diff, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T${String(hours[index]).padStart(2, "0")}:00:00Z`,
          scoreDifferential: diff,
          courseId: (index % 5) + 1, // Varied courses to avoid HOME_COURSE_HERO
        })
      );

      const result = calculatePlayerType(scorecards);
      // Should be either RAGER or YO_YO due to high variance
      expect(["RAGER", "YO_YO"]).toContain(result.type);
    });
  });

  describe("calculatePlayerType - Time Pattern Classification", () => {
    test("should classify as WEEKEND_WARRIOR with mostly weekend rounds", () => {
      // Create 10 rounds, 8 on weekends (Saturday=6, Sunday=0)
      // Use varied differentials (variance > 2.5) to avoid MR_CONSISTENT
      const scorecards: ScorecardWithRound[] = [];

      // 8 weekend rounds with varied differentials
      for (let weekNumber = 0; weekNumber < 4; weekNumber++) {
        // Saturday
        scorecards.push(
          createMockScorecard({
            teeTime: `2024-01-${String(6 + weekNumber * 7).padStart(2, "0")}T10:00:00Z`,
            scoreDifferential: 8 + weekNumber * 2, // Varied: 8, 10, 12, 14
            courseId: weekNumber + 1, // Vary courses to avoid HOME_COURSE_HERO
          })
        );
        // Sunday
        scorecards.push(
          createMockScorecard({
            teeTime: `2024-01-${String(7 + weekNumber * 7).padStart(2, "0")}T10:00:00Z`,
            scoreDifferential: 9 + weekNumber * 2, // Varied: 9, 11, 13, 15
            courseId: weekNumber + 1,
          })
        );
      }

      // Add 2 weekday rounds
      scorecards.push(
        createMockScorecard({
          teeTime: "2024-01-03T10:00:00Z", // Wednesday
          scoreDifferential: 16,
          courseId: 5,
        })
      );
      scorecards.push(
        createMockScorecard({
          teeTime: "2024-01-10T10:00:00Z", // Wednesday
          scoreDifferential: 17,
          courseId: 6,
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("WEEKEND_WARRIOR");
    });

    test("should classify as EARLY_BIRD with mostly morning tee times", () => {
      // 10 rounds, all before noon with varied differentials
      const scorecards = Array.from({ length: 10 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T07:00:00Z`, // 7 AM
          scoreDifferential: 8 + index, // Varied: 8-17
          courseId: index + 1, // Different courses
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("EARLY_BIRD");
    });

    test("should classify as TWILIGHT_GOLFER with mostly afternoon rounds", () => {
      // 10 rounds, all in evening (very few morning) with varied differentials
      const scorecards = Array.from({ length: 10 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T17:00:00Z`, // 5 PM
          scoreDifferential: 8 + index, // Varied: 8-17
          courseId: index + 1,
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("TWILIGHT_GOLFER");
    });
  });

  describe("calculatePlayerType - Course Pattern Classification", () => {
    test("should classify as COURSE_EXPLORER with high course variety", () => {
      // 10 rounds at 10 different courses (100% variety) with varied differentials
      // Mix times evenly to avoid time-based classifications (5 morning, 5 afternoon)
      const hours = [7, 14, 8, 15, 9, 16, 10, 14, 11, 13]; // 5 morning (<12), 5 afternoon
      const scorecards = Array.from({ length: 10 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T${String(hours[index]).padStart(2, "0")}:00:00Z`,
          scoreDifferential: 8 + index, // Varied: 8-17
          courseId: index + 1, // Each round at different course
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("COURSE_EXPLORER");
    });

    test("should classify as HOME_COURSE_HERO with low course variety", () => {
      // 10 rounds at only 1 course with varied differentials
      // Mix time of day to avoid EARLY_BIRD/TWILIGHT
      const hours = [9, 14, 10, 15, 8, 13, 11, 16, 7, 12];
      const scorecards = Array.from({ length: 10 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T${String(hours[index]).padStart(2, "0")}:00:00Z`,
          scoreDifferential: 8 + index, // Varied: 8-17
          courseId: 1, // Same course every time
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("HOME_COURSE_HERO");
    });
  });

  describe("calculatePlayerType - Improving Player", () => {
    test("should classify as STEADILY_IMPROVING with declining handicap trend", () => {
      // Create 10 rounds with consistently improving handicap
      // Large improvement to exceed the IMPROVING_SLOPE_MAX threshold (-0.1)
      // Mix times to avoid time-based classifications
      const hours = [9, 14, 10, 15, 8, 13, 11, 16, 7, 12];
      const scorecards = Array.from({ length: 10 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T${String(hours[index]).padStart(2, "0")}:00:00Z`,
          scoreDifferential: 20 - index * 1.5, // Strong improvement: 20, 18.5, 17, ...
          updatedHandicapIndex: 20 - index * 1.5, // Strongly declining handicap
          existingHandicapIndex: 20 - (index > 0 ? (index - 1) * 1.5 : 0),
          courseId: index + 1, // Different courses
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("STEADILY_IMPROVING");
    });
  });

  describe("calculatePlayerType - Volume Classification", () => {
    test("should classify as GRINDER with high round volume", () => {
      // Create 30 rounds in 1 month (>6 rounds/month)
      // Use varied differentials and mixed times
      const hours = [7, 9, 11, 13, 15, 17]; // 6 different times
      const scorecards = Array.from({ length: 30 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String((index % 28) + 1).padStart(2, "0")}T${String(hours[index % 6]).padStart(2, "0")}:00:00Z`,
          scoreDifferential: 8 + (index % 10), // Varied: 8-17
          courseId: (index % 10) + 1, // 10 different courses
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.type).toBe("GRINDER");
    });
  });

  describe("calculatePlayerType - Confidence Levels", () => {
    test("should return confidence between 0.5 and 1.0", () => {
      const scorecards = Array.from({ length: 10 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
          scoreDifferential: 10,
        })
      );

      const result = calculatePlayerType(scorecards);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test("should return full result object with all properties", () => {
      const scorecards = Array.from({ length: 5 }, (_, index) =>
        createMockScorecard({
          teeTime: `2024-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
        })
      );

      const result = calculatePlayerType(scorecards);

      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("description");
      expect(result).toHaveProperty("emoji");
      expect(result).toHaveProperty("confidence");
    });
  });
});
