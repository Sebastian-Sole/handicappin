import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  filterByTimeRange,
  calculateOverviewStats,
  calculateCoursePerformance,
  calculateDayOfWeekStats,
  calculateTimeOfDayStats,
  calculateHolesPlayedStats,
  calculateRoundsPerMonth,
  calculateTotalStrokes,
  calculateAvgStrokesPerHole,
  calculateStrokesByParType,
  calculateScoreDistribution,
  calculateDaysSinceLastRound,
  calculateGolfAge,
  calculateAverageRoundsPerMonth,
  calculateMostActiveMonth,
  calculateLongestGap,
  calculateCurrentStreak,
  calculateScoringConsistency,
  calculateBestMonth,
  calculateUniqueCourses,
  calculateSeasonalStats,
  calculatePerfectHoles,
  calculateBogeyFreeRounds,
  calculateConsistencyRating,
  calculateExceptionalRounds,
  calculateHoleNumberStats,
  calculateFrontBackComparison,
  calculateStreakStats,
  calculateDistancePerformance,
  calculateTotalDistancePlayed,
  calculateLuckyNumber,
  calculateSignatureScore,
  calculateHoleByHoleStats,
  getLunarPhase,
  calculateLunarPerformance,
  calculateUniqueHolesPlayed,
} from "@/lib/statistics/calculations";
import {
  createMockScorecard,
  createMockScorecardSet,
  createScorecardForDayOfWeek,
  createScorecardForTimeOfDay,
  createMock9HoleScores,
  createScoringScenario,
} from "./test-fixtures";

describe("Statistics Calculations", () => {
  describe("filterByTimeRange", () => {
    test("should return all scorecards for 'all' range", () => {
      const scorecards = createMockScorecardSet(10);
      const result = filterByTimeRange(scorecards, "all");
      expect(result).toHaveLength(10);
      expect(result).toEqual(scorecards);
    });

    test("should filter scorecards older than 6 months", () => {
      const now = new Date();
      const recent = createMockScorecard({
        teeTime: new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 30 days ago
      });
      const old = createMockScorecard({
        teeTime: new Date(
          now.getTime() - 200 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 200 days ago
      });

      const result = filterByTimeRange([recent, old], "6months");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(recent);
    });

    test("should filter scorecards older than 1 year", () => {
      const now = new Date();
      const recent = createMockScorecard({
        teeTime: new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      const old = createMockScorecard({
        teeTime: new Date(
          now.getTime() - 400 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 400 days ago
      });

      const result = filterByTimeRange([recent, old], "1year");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(recent);
    });

    test("should return empty array when all scorecards are old", () => {
      const old = createMockScorecard({
        teeTime: "2020-01-01T10:00:00Z",
      });

      const result = filterByTimeRange([old], "6months");
      expect(result).toHaveLength(0);
    });
  });

  describe("calculateOverviewStats", () => {
    test("should return zeros for empty scorecard array", () => {
      const stats = calculateOverviewStats([], 10.0);

      expect(stats.totalRounds).toBe(0);
      expect(stats.avgScore).toBe(0);
      expect(stats.avgPar).toBeNull();
      expect(stats.bestDifferential).toBe(0);
      expect(stats.worstDifferential).toBe(0);
      expect(stats.improvementRate).toBe(0);
      expect(stats.currentHandicap).toBe(10.0);
      expect(stats.handicapChange).toBe(0);
    });

    test("should calculate correct stats for single round", () => {
      const scorecard = createMockScorecard({
        scoreDifferential: 15.0,
        adjustedGrossScore: 90,
        existingHandicapIndex: 15.0,
        updatedHandicapIndex: 15.0,
      });

      const stats = calculateOverviewStats([scorecard], 15.0);

      expect(stats.totalRounds).toBe(1);
      expect(stats.avgScore).toBe(90);
      expect(stats.bestDifferential).toBe(15.0);
      expect(stats.worstDifferential).toBe(15.0);
    });

    test("should calculate best and worst differentials correctly", () => {
      const scorecards = [
        createMockScorecard({
          teeTime: "2024-01-01T10:00:00Z",
          scoreDifferential: 10.0,
          existingHandicapIndex: 12.0,
          updatedHandicapIndex: 11.0,
        }),
        createMockScorecard({
          teeTime: "2024-01-08T10:00:00Z",
          scoreDifferential: 15.0,
          existingHandicapIndex: 11.0,
          updatedHandicapIndex: 12.0,
        }),
        createMockScorecard({
          teeTime: "2024-01-15T10:00:00Z",
          scoreDifferential: 8.0,
          existingHandicapIndex: 12.0,
          updatedHandicapIndex: 10.0,
        }),
      ];

      const stats = calculateOverviewStats(scorecards, 10.0);

      expect(stats.bestDifferential).toBe(8.0);
      expect(stats.worstDifferential).toBe(15.0);
    });

    test("should calculate improvement rate correctly", () => {
      const scorecards = [
        createMockScorecard({
          teeTime: "2024-01-01T10:00:00Z",
          existingHandicapIndex: 20.0,
          updatedHandicapIndex: 19.0,
        }),
        createMockScorecard({
          teeTime: "2024-06-01T10:00:00Z",
          existingHandicapIndex: 19.0,
          updatedHandicapIndex: 15.0,
        }),
      ];

      const stats = calculateOverviewStats(scorecards, 15.0);

      // Improvement rate: (20 - 15) / 20 * 100 = 25%
      expect(stats.improvementRate).toBe(25);
      expect(stats.handicapChange).toBe(-5); // 15 - 20 = -5 (improved)
    });

    test("should calculate average par from rounds", () => {
      const scorecards = [
        createMockScorecard({
          teeTime: "2024-01-01T10:00:00Z",
        }),
        createMockScorecard({
          teeTime: "2024-01-08T10:00:00Z",
        }),
      ];

      const stats = calculateOverviewStats(scorecards, 10.0);

      // Mock scorecards have parPlayed = 72
      expect(stats.avgPar).toBe(72);
    });
  });

  describe("calculateCoursePerformance", () => {
    test("should return empty array for no scorecards", () => {
      const result = calculateCoursePerformance([]);
      expect(result).toHaveLength(0);
    });

    test("should group rounds by course", () => {
      const scorecards = [
        createMockScorecard({ courseId: 1, courseName: "Course A" }),
        createMockScorecard({ courseId: 1, courseName: "Course A" }),
        createMockScorecard({ courseId: 2, courseName: "Course B" }),
      ];

      const result = calculateCoursePerformance(scorecards);

      expect(result).toHaveLength(2);
      const courseA = result.find((c) => c.courseId === 1);
      expect(courseA?.roundCount).toBe(2);
    });

    test("should sort by round count descending", () => {
      const scorecards = [
        createMockScorecard({ courseId: 1 }),
        createMockScorecard({ courseId: 2 }),
        createMockScorecard({ courseId: 2 }),
        createMockScorecard({ courseId: 2 }),
      ];

      const result = calculateCoursePerformance(scorecards);

      expect(result[0].courseId).toBe(2);
      expect(result[0].roundCount).toBe(3);
    });

    test("should calculate average differential per course", () => {
      const scorecards = [
        createMockScorecard({ courseId: 1, scoreDifferential: 10.0 }),
        createMockScorecard({ courseId: 1, scoreDifferential: 12.0 }),
      ];

      const result = calculateCoursePerformance(scorecards);

      expect(result[0].avgDifferential).toBe(11.0);
    });
  });

  describe("calculateDayOfWeekStats", () => {
    test("should return stats for all 7 days", () => {
      const result = calculateDayOfWeekStats([]);
      expect(result).toHaveLength(7);
      expect(result[0].day).toBe("Sunday");
      expect(result[6].day).toBe("Saturday");
    });

    test("should count rounds per day correctly", () => {
      const scorecards = [
        createScorecardForDayOfWeek(0), // Sunday
        createScorecardForDayOfWeek(0), // Sunday
        createScorecardForDayOfWeek(6), // Saturday
      ];

      const result = calculateDayOfWeekStats(scorecards);

      expect(result[0].roundCount).toBe(2); // Sunday
      expect(result[6].roundCount).toBe(1); // Saturday
      expect(result[1].roundCount).toBe(0); // Monday
    });

    test("should return zero averages for days with no rounds", () => {
      const result = calculateDayOfWeekStats([]);

      result.forEach((day) => {
        expect(day.roundCount).toBe(0);
        expect(day.avgScore).toBe(0);
        expect(day.avgDifferential).toBe(0);
      });
    });
  });

  describe("calculateTimeOfDayStats", () => {
    test("should categorize morning rounds (before 12)", () => {
      const scorecards = [
        createScorecardForTimeOfDay(7),
        createScorecardForTimeOfDay(10),
        createScorecardForTimeOfDay(11),
      ];

      const result = calculateTimeOfDayStats(scorecards);
      const morning = result.find((r) => r.period === "morning");

      expect(morning?.roundCount).toBe(3);
      expect(morning?.percentage).toBe(100);
    });

    test("should categorize afternoon rounds (12-17)", () => {
      const scorecards = [
        createScorecardForTimeOfDay(13),
        createScorecardForTimeOfDay(16),
      ];

      const result = calculateTimeOfDayStats(scorecards);
      const afternoon = result.find((r) => r.period === "afternoon");

      expect(afternoon?.roundCount).toBe(2);
    });

    test("should categorize evening rounds (17+)", () => {
      const scorecards = [
        createScorecardForTimeOfDay(18),
        createScorecardForTimeOfDay(19),
      ];

      const result = calculateTimeOfDayStats(scorecards);
      const evening = result.find((r) => r.period === "evening");

      expect(evening?.roundCount).toBe(2);
    });

    test("should calculate correct percentages", () => {
      const scorecards = [
        createScorecardForTimeOfDay(9), // morning
        createScorecardForTimeOfDay(14), // afternoon
        createScorecardForTimeOfDay(14), // afternoon
        createScorecardForTimeOfDay(18), // evening
      ];

      const result = calculateTimeOfDayStats(scorecards);

      expect(result.find((r) => r.period === "morning")?.percentage).toBe(25);
      expect(result.find((r) => r.period === "afternoon")?.percentage).toBe(50);
      expect(result.find((r) => r.period === "evening")?.percentage).toBe(25);
    });
  });

  describe("calculateHolesPlayedStats", () => {
    test("should count 18-hole rounds correctly", () => {
      const scorecards = [
        createMockScorecard(), // 18 holes by default
        createMockScorecard(),
      ];

      const result = calculateHolesPlayedStats(scorecards);
      const eighteenHole = result.find((r) => r.type === "18-hole");

      expect(eighteenHole?.count).toBe(2);
    });

    test("should count 9-hole rounds correctly", () => {
      const scorecard = createMockScorecard({
        scores: createMock9HoleScores(),
      });

      const result = calculateHolesPlayedStats([scorecard]);
      const nineHole = result.find((r) => r.type === "9-hole");

      expect(nineHole?.count).toBe(1);
    });

    test("should return zero for empty scorecards", () => {
      const result = calculateHolesPlayedStats([]);

      expect(result[0].count).toBe(0);
      expect(result[1].count).toBe(0);
    });
  });

  describe("calculateRoundsPerMonth", () => {
    test("should group rounds by month", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-01-15T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-20T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-02-15T10:00:00Z" }),
      ];

      const result = calculateRoundsPerMonth(scorecards);

      expect(result).toHaveLength(2);
      expect(result[0].month).toBe("Jan");
      expect(result[0].count).toBe(2);
      expect(result[1].month).toBe("Feb");
      expect(result[1].count).toBe(1);
    });

    test("should sort by date ascending", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-03-15T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-15T10:00:00Z" }),
      ];

      const result = calculateRoundsPerMonth(scorecards);

      expect(result[0].month).toBe("Jan");
      expect(result[1].month).toBe("Mar");
    });
  });

  describe("calculateTotalStrokes", () => {
    test("should sum all strokes from all rounds", () => {
      const scorecards = [
        createMockScorecard({ totalStrokes: 85 }),
        createMockScorecard({ totalStrokes: 90 }),
      ];

      const result = calculateTotalStrokes(scorecards);
      expect(result).toBe(175);
    });

    test("should return 0 for empty array", () => {
      const result = calculateTotalStrokes([]);
      expect(result).toBe(0);
    });
  });

  describe("calculateAvgStrokesPerHole", () => {
    test("should calculate average correctly", () => {
      const scorecards = [
        createMockScorecard({ totalStrokes: 90 }), // 18 holes = 5 per hole
        createMockScorecard({ totalStrokes: 72 }), // 18 holes = 4 per hole
      ];

      const result = calculateAvgStrokesPerHole(scorecards);
      expect(result).toBe(4.5); // (90 + 72) / 36 holes
    });

    test("should return 0 for empty array", () => {
      const result = calculateAvgStrokesPerHole([]);
      expect(result).toBe(0);
    });
  });

  describe("calculateStrokesByParType", () => {
    test("should group strokes by par 3, 4, and 5", () => {
      const scorecard = createMockScorecard();
      const result = calculateStrokesByParType([scorecard]);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.parType)).toEqual([3, 4, 5]);
    });

    test("should calculate average strokes per par type", () => {
      const scorecard = createMockScorecard();
      const result = calculateStrokesByParType([scorecard]);

      // All scores are 5 in mock data
      result.forEach((parType) => {
        if (parType.holeCount > 0) {
          expect(parType.avgStrokes).toBe(5);
        }
      });
    });
  });

  describe("calculateScoreDistribution", () => {
    test("should count all score types correctly", () => {
      const scorecard = createMockScorecard({
        scores: createScoringScenario("par"),
      });

      const result = calculateScoreDistribution([scorecard]);

      expect(result.par.count).toBe(18);
      expect(result.par.percentage).toBe(100);
    });

    test("should detect eagles (2 under par)", () => {
      const scorecard = createMockScorecard({
        scores: createScoringScenario("eagle"),
      });

      const result = calculateScoreDistribution([scorecard]);
      expect(result.eagle.count).toBe(18);
    });

    test("should detect birdies", () => {
      const scorecard = createMockScorecard({
        scores: createScoringScenario("birdie"),
      });

      const result = calculateScoreDistribution([scorecard]);
      expect(result.birdie.count).toBe(18);
    });

    test("should detect bogeys", () => {
      const scorecard = createMockScorecard({
        scores: createScoringScenario("bogey"),
      });

      const result = calculateScoreDistribution([scorecard]);
      expect(result.bogey.count).toBe(18);
    });

    test("should detect double bogeys", () => {
      const scorecard = createMockScorecard({
        scores: createScoringScenario("double"),
      });

      const result = calculateScoreDistribution([scorecard]);
      expect(result.doubleBogey.count).toBe(18);
    });

    test("should detect triple+ bogeys", () => {
      const scorecard = createMockScorecard({
        scores: createScoringScenario("triple"),
      });

      const result = calculateScoreDistribution([scorecard]);
      expect(result.triplePlus.count).toBe(18);
    });
  });

  describe("calculateDaysSinceLastRound", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("should return 0 for empty array", () => {
      const result = calculateDaysSinceLastRound([]);
      expect(result).toBe(0);
    });

    test("should calculate days since most recent round", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-06-10T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-06-01T10:00:00Z" }),
      ];

      const result = calculateDaysSinceLastRound(scorecards);
      expect(result).toBe(5); // June 15 - June 10 = 5 days
    });
  });

  describe("calculateGolfAge", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("should return 0 for empty array", () => {
      const result = calculateGolfAge([]);
      expect(result).toBe(0);
    });

    test("should calculate days since first round", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-06-10T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-15T10:00:00Z" }),
      ];

      const result = calculateGolfAge(scorecards);
      // From Jan 15 to June 15 is approximately 152 days
      expect(result).toBeGreaterThan(150);
    });
  });

  describe("calculateAverageRoundsPerMonth", () => {
    test("should return 0 for empty array", () => {
      const result = calculateAverageRoundsPerMonth([]);
      expect(result).toBe(0);
    });

    test("should calculate average based on golf age", () => {
      const scorecards = createMockScorecardSet(10);
      const result = calculateAverageRoundsPerMonth(scorecards);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe("calculateMostActiveMonth", () => {
    test("should return null for empty array", () => {
      const result = calculateMostActiveMonth([]);
      expect(result).toBeNull();
    });

    test("should find month with most rounds", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-01-01T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-15T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-20T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-02-15T10:00:00Z" }),
      ];

      const result = calculateMostActiveMonth(scorecards);

      expect(result?.month).toBe("January");
      expect(result?.count).toBe(3);
    });
  });

  describe("calculateLongestGap", () => {
    test("should return 0 for less than 2 rounds", () => {
      expect(calculateLongestGap([])).toBe(0);
      expect(calculateLongestGap([createMockScorecard()])).toBe(0);
    });

    test("should find longest gap between rounds", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-01-01T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-01-10T10:00:00Z" }), // 9 days gap
        createMockScorecard({ teeTime: "2024-02-15T10:00:00Z" }), // 36 days gap
      ];

      const result = calculateLongestGap(scorecards);
      expect(result).toBe(36);
    });
  });

  describe("calculateCurrentStreak", () => {
    test("should return 0 for empty array", () => {
      const result = calculateCurrentStreak([]);
      expect(result).toBe(0);
    });
  });

  describe("calculateScoringConsistency", () => {
    test("should return 0 for less than 2 rounds", () => {
      expect(calculateScoringConsistency([])).toBe(0);
      expect(calculateScoringConsistency([createMockScorecard()])).toBe(0);
    });

    test("should return low value for consistent scores", () => {
      const scorecards = [
        createMockScorecard({ scoreDifferential: 10.0 }),
        createMockScorecard({ scoreDifferential: 10.1 }),
        createMockScorecard({ scoreDifferential: 9.9 }),
      ];

      const result = calculateScoringConsistency(scorecards);
      expect(result).toBeLessThan(1);
    });

    test("should return higher value for inconsistent scores", () => {
      const scorecards = [
        createMockScorecard({ scoreDifferential: 5.0 }),
        createMockScorecard({ scoreDifferential: 20.0 }),
        createMockScorecard({ scoreDifferential: 8.0 }),
      ];

      const result = calculateScoringConsistency(scorecards);
      expect(result).toBeGreaterThan(5);
    });
  });

  describe("calculateBestMonth", () => {
    test("should return null for empty array", () => {
      const result = calculateBestMonth([]);
      expect(result).toBeNull();
    });

    test("should return null if no month has 2+ rounds", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-01-15T10:00:00Z" }),
        createMockScorecard({ teeTime: "2024-02-15T10:00:00Z" }),
      ];

      const result = calculateBestMonth(scorecards);
      expect(result).toBeNull();
    });

    test("should find month with lowest average differential", () => {
      const scorecards = [
        createMockScorecard({
          teeTime: "2024-01-01T10:00:00Z",
          scoreDifferential: 10.0,
        }),
        createMockScorecard({
          teeTime: "2024-01-15T10:00:00Z",
          scoreDifferential: 12.0,
        }),
        createMockScorecard({
          teeTime: "2024-02-01T10:00:00Z",
          scoreDifferential: 5.0,
        }),
        createMockScorecard({
          teeTime: "2024-02-15T10:00:00Z",
          scoreDifferential: 6.0,
        }),
      ];

      const result = calculateBestMonth(scorecards);

      expect(result?.month).toBe("February");
      expect(result?.avgDifferential).toBe(5.5);
    });
  });

  describe("calculateUniqueCourses", () => {
    test("should return 0 for empty array", () => {
      const result = calculateUniqueCourses([]);
      expect(result).toBe(0);
    });

    test("should count unique courses", () => {
      const scorecards = [
        createMockScorecard({ courseId: 1 }),
        createMockScorecard({ courseId: 1 }),
        createMockScorecard({ courseId: 2 }),
        createMockScorecard({ courseId: 3 }),
      ];

      const result = calculateUniqueCourses(scorecards);
      expect(result).toBe(3);
    });
  });

  describe("calculateSeasonalStats", () => {
    test("should return stats for all 4 seasons", () => {
      const result = calculateSeasonalStats([]);
      expect(result).toHaveLength(4);
      expect(result.map((s) => s.season)).toEqual([
        "Spring",
        "Summer",
        "Fall",
        "Winter",
      ]);
    });

    test("should categorize rounds by season correctly", () => {
      const scorecards = [
        createMockScorecard({ teeTime: "2024-04-15T10:00:00Z" }), // Spring (April)
        createMockScorecard({ teeTime: "2024-07-15T10:00:00Z" }), // Summer (July)
        createMockScorecard({ teeTime: "2024-10-15T10:00:00Z" }), // Fall (October)
        createMockScorecard({ teeTime: "2024-01-15T10:00:00Z" }), // Winter (January)
      ];

      const result = calculateSeasonalStats(scorecards);

      expect(result.find((s) => s.season === "Spring")?.roundCount).toBe(1);
      expect(result.find((s) => s.season === "Summer")?.roundCount).toBe(1);
      expect(result.find((s) => s.season === "Fall")?.roundCount).toBe(1);
      expect(result.find((s) => s.season === "Winter")?.roundCount).toBe(1);
    });
  });

  describe("calculatePerfectHoles", () => {
    test("should count eagles, birdies, and pars", () => {
      const eagleScorecard = createMockScorecard({
        scores: createScoringScenario("eagle"),
      });
      const birdieScorecard = createMockScorecard({
        scores: createScoringScenario("birdie"),
      });

      const result = calculatePerfectHoles([eagleScorecard, birdieScorecard]);

      expect(result.eagles).toBe(18);
      expect(result.birdies).toBe(18);
      expect(result.total).toBe(36);
    });

    test("should return zeros for empty array", () => {
      const result = calculatePerfectHoles([]);

      expect(result.total).toBe(0);
      expect(result.eagles).toBe(0);
      expect(result.birdies).toBe(0);
      expect(result.pars).toBe(0);
    });
  });

  describe("calculateBogeyFreeRounds", () => {
    test("should count rounds with no bogeys", () => {
      const parRound = createMockScorecard({
        scores: createScoringScenario("par"),
      });
      const bogeyRound = createMockScorecard({
        scores: createScoringScenario("bogey"),
      });

      const result = calculateBogeyFreeRounds([parRound, bogeyRound]);
      expect(result).toBe(1);
    });

    test("should return 0 for empty array", () => {
      const result = calculateBogeyFreeRounds([]);
      expect(result).toBe(0);
    });
  });

  describe("calculateConsistencyRating", () => {
    test("should return 0 for less than 3 rounds", () => {
      expect(calculateConsistencyRating([])).toBe(0);
      expect(calculateConsistencyRating([createMockScorecard()])).toBe(0);
    });

    test("should return high rating for consistent player", () => {
      const scorecards = [
        createMockScorecard({ scoreDifferential: 10.0 }),
        createMockScorecard({ scoreDifferential: 10.1 }),
        createMockScorecard({ scoreDifferential: 10.0 }),
        createMockScorecard({ scoreDifferential: 9.9 }),
      ];

      const result = calculateConsistencyRating(scorecards);
      expect(result).toBeGreaterThan(90);
    });

    test("should return low rating for inconsistent player", () => {
      const scorecards = [
        createMockScorecard({ scoreDifferential: 5.0 }),
        createMockScorecard({ scoreDifferential: 20.0 }),
        createMockScorecard({ scoreDifferential: 8.0 }),
        createMockScorecard({ scoreDifferential: 25.0 }),
      ];

      const result = calculateConsistencyRating(scorecards);
      expect(result).toBeLessThan(50);
    });

    test("should be bounded between 0 and 100", () => {
      const scorecards = createMockScorecardSet(10);
      const result = calculateConsistencyRating(scorecards);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe("calculateExceptionalRounds", () => {
    test("should return empty array when no exceptional rounds", () => {
      const scorecards = [
        createMockScorecard({ exceptionalScoreAdjustment: 0 }),
      ];

      const result = calculateExceptionalRounds(scorecards);
      expect(result).toHaveLength(0);
    });

    test("should find rounds with ESR adjustment", () => {
      const scorecards = [
        createMockScorecard({ exceptionalScoreAdjustment: 0 }),
        createMockScorecard({ exceptionalScoreAdjustment: 1 }),
        createMockScorecard({ exceptionalScoreAdjustment: 2 }),
      ];

      const result = calculateExceptionalRounds(scorecards);
      expect(result).toHaveLength(2);
    });

    test("should sort by date descending", () => {
      const scorecards = [
        createMockScorecard({
          teeTime: "2024-01-01T10:00:00Z",
          exceptionalScoreAdjustment: 1,
        }),
        createMockScorecard({
          teeTime: "2024-06-01T10:00:00Z",
          exceptionalScoreAdjustment: 1,
        }),
      ];

      const result = calculateExceptionalRounds(scorecards);
      expect(new Date(result[0].date).getTime()).toBeGreaterThan(
        new Date(result[1].date).getTime(),
      );
    });
  });

  describe("calculateHoleNumberStats", () => {
    test("should return stats for holes 1-18", () => {
      const result = calculateHoleNumberStats([]);
      expect(result).toHaveLength(18);
      expect(result[0].holeNumber).toBe(1);
      expect(result[17].holeNumber).toBe(18);
    });

    test("should calculate average strokes per hole number", () => {
      const scorecard = createMockScorecard();
      const result = calculateHoleNumberStats([scorecard]);

      result.forEach((hole) => {
        if (hole.totalPlayed > 0) {
          expect(hole.avgStrokes).toBe(5); // Mock scores are all 5
        }
      });
    });
  });

  describe("calculateFrontBackComparison", () => {
    test("should compare front 9 and back 9", () => {
      const scorecard = createMockScorecard();
      const result = calculateFrontBackComparison([scorecard]);

      expect(result).toHaveProperty("front9");
      expect(result).toHaveProperty("back9");
      expect(result).toHaveProperty("betterHalf");
      expect(result).toHaveProperty("difference");
    });

    test("should identify better half correctly", () => {
      const scorecard = createMockScorecard();
      const result = calculateFrontBackComparison([scorecard]);

      expect(["front", "back", "even"]).toContain(result.betterHalf);
    });
  });

  describe("calculateStreakStats", () => {
    test("should return streak statistics", () => {
      const scorecard = createMockScorecard();
      const result = calculateStreakStats([scorecard]);

      expect(result).toHaveProperty("longestParStreak");
      expect(result).toHaveProperty("longestBogeyStreak");
      expect(result).toHaveProperty("currentParStreak");
      expect(result).toHaveProperty("averageParStreak");
    });
  });

  describe("calculateDistancePerformance", () => {
    test("should return performance for short, medium, long holes", () => {
      const scorecard = createMockScorecard();
      const result = calculateDistancePerformance([scorecard]);

      expect(result).toHaveLength(3);
      expect(result.map((d) => d.category)).toEqual([
        "short",
        "medium",
        "long",
      ]);
    });

    test("should have correct labels", () => {
      const result = calculateDistancePerformance([]);

      expect(result[0].label).toBe("< 350 yds");
      expect(result[1].label).toBe("350-450 yds");
      expect(result[2].label).toBe("> 450 yds");
    });
  });

  describe("calculateTotalDistancePlayed", () => {
    test("should return 0 for empty array", () => {
      const result = calculateTotalDistancePlayed([]);
      expect(result).toBe(0);
    });

    test("should sum distances from all holes played", () => {
      const scorecard = createMockScorecard();
      const result = calculateTotalDistancePlayed([scorecard]);

      expect(result).toBeGreaterThan(0);
    });
  });

  describe("calculateLuckyNumber", () => {
    test("should return null for empty array", () => {
      const result = calculateLuckyNumber([]);
      expect(result).toBeNull();
    });

    test("should find most common score", () => {
      const scorecard = createMockScorecard();
      const result = calculateLuckyNumber([scorecard]);

      expect(result).toBe(5); // Mock scores are all 5
    });
  });

  describe("calculateSignatureScore", () => {
    test("should return null for empty array", () => {
      const result = calculateSignatureScore([]);
      expect(result).toBeNull();
    });

    test("should return null if no score appears more than once", () => {
      const scorecards = [
        createMockScorecard({ adjustedGrossScore: 85 }),
        createMockScorecard({ adjustedGrossScore: 90 }),
      ];

      const result = calculateSignatureScore(scorecards);
      expect(result).toBeNull();
    });

    test("should find most common round score", () => {
      const scorecards = [
        createMockScorecard({ adjustedGrossScore: 85 }),
        createMockScorecard({ adjustedGrossScore: 85 }),
        createMockScorecard({ adjustedGrossScore: 90 }),
      ];

      const result = calculateSignatureScore(scorecards);
      expect(result).toBe(85);
    });
  });

  describe("calculateHoleByHoleStats", () => {
    test("should return comprehensive hole stats", () => {
      const scorecard = createMockScorecard();
      const result = calculateHoleByHoleStats([scorecard]);

      expect(result).toHaveProperty("holeStats");
      expect(result).toHaveProperty("frontBackComparison");
      expect(result).toHaveProperty("streakStats");
      expect(result).toHaveProperty("distancePerformance");
      expect(result).toHaveProperty("totalDistancePlayed");
      expect(result).toHaveProperty("luckyNumber");
      expect(result).toHaveProperty("signatureScore");
    });
  });

  describe("getLunarPhase", () => {
    test("should return valid lunar phase", () => {
      const validPhases = [
        "new_moon",
        "waxing_crescent",
        "first_quarter",
        "waxing_gibbous",
        "full_moon",
        "waning_gibbous",
        "last_quarter",
        "waning_crescent",
      ];

      const result = getLunarPhase(new Date("2024-01-11")); // Known new moon
      expect(validPhases).toContain(result);
    });

    test("should return new_moon for known new moon dates", () => {
      // January 11, 2024 was a new moon
      const result = getLunarPhase(new Date("2024-01-11T12:00:00Z"));
      expect(result).toBe("new_moon");
    });

    test("should return full_moon for known full moon dates", () => {
      // January 25, 2024 was a full moon (approximately 14.77 days after new moon)
      const result = getLunarPhase(new Date("2024-01-25T12:00:00Z"));
      expect(result).toBe("full_moon");
    });
  });

  describe("calculateLunarPerformance", () => {
    test("should return stats for all 8 lunar phases", () => {
      const result = calculateLunarPerformance([]);
      expect(result.phaseStats).toHaveLength(8);
    });

    test("should include best and worst phase", () => {
      const result = calculateLunarPerformance([]);

      // With no rounds, both should be null
      expect(result.bestPhase).toBeNull();
      expect(result.worstPhase).toBeNull();
    });

    test("should categorize rounds by lunar phase", () => {
      const scorecards = [
        createMockScorecard({
          teeTime: "2024-01-11T12:00:00Z", // New moon
          scoreDifferential: 10.0,
        }),
        createMockScorecard({
          teeTime: "2024-01-25T12:00:00Z", // Full moon
          scoreDifferential: 15.0,
        }),
      ];

      const result = calculateLunarPerformance(scorecards);

      expect(result.bestPhase?.phase).toBe("new_moon");
      expect(result.worstPhase?.phase).toBe("full_moon");
    });
  });

  describe("calculateUniqueHolesPlayed", () => {
    test("should return 0 for empty array", () => {
      const result = calculateUniqueHolesPlayed([]);
      expect(result).toBe(0);
    });

    test("should count unique holes across courses", () => {
      const scorecard1 = createMockScorecard({ courseId: 1 });
      const scorecard2 = createMockScorecard({ courseId: 2 });

      const result = calculateUniqueHolesPlayed([scorecard1, scorecard2]);

      // 18 holes per course × 2 courses = 36 unique holes
      expect(result).toBe(36);
    });

    test("should not double-count same course holes", () => {
      const scorecard1 = createMockScorecard({ courseId: 1 });
      const scorecard2 = createMockScorecard({ courseId: 1 });

      const result = calculateUniqueHolesPlayed([scorecard1, scorecard2]);

      expect(result).toBe(18); // Same course, so only 18 unique holes
    });
  });
});
