import { describe, expect, test } from "vitest";
import {
  transformRoundsToActivities,
  ActivityItem,
} from "@/utils/activity-transform";
import { Tables } from "@/types/supabase";

// Helper to create mock round data
function createMockRound(overrides: Partial<Tables<"round">>): Tables<"round"> {
  return {
    id: 1,
    userId: "user-123",
    courseId: 100,
    teeId: 200,
    teeTime: new Date("2024-01-15T10:00:00Z").toISOString(),
    totalStrokes: 90,
    parPlayed: 72,
    adjustedGrossScore: 88,
    adjustedPlayedScore: 88,
    courseHandicap: 15,
    scoreDifferential: 18.5,
    existingHandicapIndex: 15.0,
    updatedHandicapIndex: 14.8,
    ...overrides,
  } as Tables<"round">;
}

// Helper to create a map of course names
function createCourseMap(
  entries: Array<[number, string]>
): Map<number, string> {
  return new Map(entries);
}

describe("transformRoundsToActivities", () => {
  describe("empty input handling", () => {
    test("returns empty array for empty rounds array", () => {
      const result = transformRoundsToActivities([], new Map());
      expect(result).toEqual([]);
    });

    test("returns empty array for empty rounds with populated course map", () => {
      const courseMap = createCourseMap([[100, "Pebble Beach"]]);
      const result = transformRoundsToActivities([], courseMap);
      expect(result).toEqual([]);
    });
  });

  describe("single round handling", () => {
    test("transforms single round correctly", () => {
      const rounds = [createMockRound({ id: 1, courseId: 100 })];
      const courseMap = createCourseMap([[100, "Augusta National"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        courseName: "Augusta National",
        score: 88,
        scoreDifferential: 18.5,
        handicapAfter: 14.8,
        handicapChange: 0, // No previous round
        isPersonalBest: true, // Only round = personal best
        isMilestone: "First round!",
      });
    });

    test("uses 'Unknown Course' when course not in map", () => {
      const rounds = [createMockRound({ id: 1, courseId: 999 })];
      const courseMap = createCourseMap([[100, "Augusta National"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result[0].courseName).toBe("Unknown Course");
    });
  });

  describe("sorting behavior", () => {
    test("returns rounds sorted by date descending (most recent first)", () => {
      const rounds = [
        createMockRound({
          id: 1,
          teeTime: new Date("2024-01-01T10:00:00Z").toISOString(),
        }),
        createMockRound({
          id: 2,
          teeTime: new Date("2024-01-15T10:00:00Z").toISOString(),
        }),
        createMockRound({
          id: 3,
          teeTime: new Date("2024-01-10T10:00:00Z").toISOString(),
        }),
      ];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result.map((r) => r.id)).toEqual([2, 3, 1]);
    });
  });

  describe("personal best detection", () => {
    test("marks lowest differential as personal best", () => {
      const rounds = [
        createMockRound({
          id: 1,
          teeTime: new Date("2024-01-01").toISOString(),
          scoreDifferential: 20.0,
        }),
        createMockRound({
          id: 2,
          teeTime: new Date("2024-01-10").toISOString(),
          scoreDifferential: 15.0, // Personal best
        }),
        createMockRound({
          id: 3,
          teeTime: new Date("2024-01-20").toISOString(),
          scoreDifferential: 18.0,
        }),
      ];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      // Find each round in results (sorted by date desc: 3, 2, 1)
      const round1 = result.find((r) => r.id === 1)!;
      const round2 = result.find((r) => r.id === 2)!;
      const round3 = result.find((r) => r.id === 3)!;

      expect(round1.isPersonalBest).toBe(true); // First round is always PB
      expect(round2.isPersonalBest).toBe(true); // Beat previous best
      expect(round3.isPersonalBest).toBe(false); // Did not beat round 2
    });

    test("marks multiple personal bests when progressively improving", () => {
      const rounds = [
        createMockRound({
          id: 1,
          teeTime: new Date("2024-01-01").toISOString(),
          scoreDifferential: 25.0,
        }),
        createMockRound({
          id: 2,
          teeTime: new Date("2024-01-10").toISOString(),
          scoreDifferential: 20.0, // PB
        }),
        createMockRound({
          id: 3,
          teeTime: new Date("2024-01-20").toISOString(),
          scoreDifferential: 15.0, // New PB
        }),
        createMockRound({
          id: 4,
          teeTime: new Date("2024-01-30").toISOString(),
          scoreDifferential: 10.0, // New PB
        }),
      ];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result.find((r) => r.id === 1)!.isPersonalBest).toBe(true);
      expect(result.find((r) => r.id === 2)!.isPersonalBest).toBe(true);
      expect(result.find((r) => r.id === 3)!.isPersonalBest).toBe(true);
      expect(result.find((r) => r.id === 4)!.isPersonalBest).toBe(true);
    });

    test("handles equal differentials correctly", () => {
      const rounds = [
        createMockRound({
          id: 1,
          teeTime: new Date("2024-01-01").toISOString(),
          scoreDifferential: 15.0,
        }),
        createMockRound({
          id: 2,
          teeTime: new Date("2024-01-10").toISOString(),
          scoreDifferential: 15.0, // Equal, not strictly less
        }),
      ];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result.find((r) => r.id === 1)!.isPersonalBest).toBe(true);
      expect(result.find((r) => r.id === 2)!.isPersonalBest).toBe(false); // Equal != beat
    });
  });

  describe("handicap change calculation", () => {
    test("calculates handicap change between consecutive rounds", () => {
      const rounds = [
        createMockRound({
          id: 1,
          teeTime: new Date("2024-01-01").toISOString(),
          updatedHandicapIndex: 20.0,
        }),
        createMockRound({
          id: 2,
          teeTime: new Date("2024-01-10").toISOString(),
          updatedHandicapIndex: 18.5,
        }),
        createMockRound({
          id: 3,
          teeTime: new Date("2024-01-20").toISOString(),
          updatedHandicapIndex: 17.0,
        }),
      ];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      // Results sorted by date desc: [3, 2, 1]
      // Round 3 (most recent): change from round 2 = 17.0 - 18.5 = -1.5
      // Round 2: change from round 1 = 18.5 - 20.0 = -1.5
      // Round 1 (oldest): no previous, change = 0
      expect(result[0].handicapChange).toBeCloseTo(-1.5); // Round 3
      expect(result[1].handicapChange).toBeCloseTo(-1.5); // Round 2
      expect(result[2].handicapChange).toBe(0); // Round 1 (no previous)
    });

    test("first round has zero handicap change", () => {
      const rounds = [createMockRound({ id: 1, updatedHandicapIndex: 15.0 })];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result[0].handicapChange).toBe(0);
    });

    test("handles handicap increases (regression)", () => {
      const rounds = [
        createMockRound({
          id: 1,
          teeTime: new Date("2024-01-01").toISOString(),
          updatedHandicapIndex: 15.0,
        }),
        createMockRound({
          id: 2,
          teeTime: new Date("2024-01-10").toISOString(),
          updatedHandicapIndex: 17.5, // Handicap went up
        }),
      ];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      // Round 2: change = 17.5 - 15.0 = 2.5 (positive = handicap increased)
      expect(result[0].handicapChange).toBeCloseTo(2.5);
    });
  });

  describe("milestone detection", () => {
    test("marks first round as milestone", () => {
      const rounds = [createMockRound({ id: 1 })];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result[0].isMilestone).toBe("First round!");
    });

    test("marks 10th round as milestone", () => {
      const rounds = Array.from({ length: 10 }, (_, index) =>
        createMockRound({
          id: index + 1,
          teeTime: new Date(2024, 0, index + 1).toISOString(),
        })
      );
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      // Results are sorted most recent first, so we need to find round 10
      const round10 = result.find((r) => r.id === 10);
      expect(round10?.isMilestone).toBe("10th round");
    });

    test("marks 20th round as full handicap milestone", () => {
      const rounds = Array.from({ length: 20 }, (_, index) =>
        createMockRound({
          id: index + 1,
          teeTime: new Date(2024, 0, index + 1).toISOString(),
        })
      );
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      const round20 = result.find((r) => r.id === 20);
      expect(round20?.isMilestone).toBe("Full handicap index");
    });

    test("marks 50th round as milestone", () => {
      const rounds = Array.from({ length: 50 }, (_, index) =>
        createMockRound({
          id: index + 1,
          teeTime: new Date(2024, 0, index + 1).toISOString(),
        })
      );
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      const round50 = result.find((r) => r.id === 50);
      expect(round50?.isMilestone).toBe("50th round");
    });

    test("marks 100th round as milestone", () => {
      const rounds = Array.from({ length: 100 }, (_, index) =>
        createMockRound({
          id: index + 1,
          teeTime: new Date(2024, 0, index + 1).toISOString(),
        })
      );
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      const round100 = result.find((r) => r.id === 100);
      expect(round100?.isMilestone).toBe("100th round");
    });

    test("non-milestone rounds have undefined milestone", () => {
      const rounds = Array.from({ length: 5 }, (_, index) =>
        createMockRound({
          id: index + 1,
          teeTime: new Date(2024, 0, index + 1).toISOString(),
        })
      );
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      // Rounds 2-5 should not have milestones
      const nonMilestoneRounds = result.filter(
        (r) => r.id !== 1 && r.id !== 10 && r.id !== 20 && r.id !== 50 && r.id !== 100
      );
      nonMilestoneRounds.forEach((round) => {
        expect(round.isMilestone).toBeUndefined();
      });
    });
  });

  describe("date conversion", () => {
    test("converts teeTime string to Date object", () => {
      const rounds = [
        createMockRound({
          id: 1,
          teeTime: "2024-06-15T14:30:00Z",
        }),
      ];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result[0].date).toBeInstanceOf(Date);
      expect(result[0].date.toISOString()).toBe("2024-06-15T14:30:00.000Z");
    });
  });

  describe("score and differential mapping", () => {
    test("maps adjustedGrossScore to score field", () => {
      const rounds = [createMockRound({ id: 1, adjustedGrossScore: 95 })];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result[0].score).toBe(95);
    });

    test("maps scoreDifferential correctly", () => {
      const rounds = [createMockRound({ id: 1, scoreDifferential: 22.3 })];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result[0].scoreDifferential).toBe(22.3);
    });

    test("maps updatedHandicapIndex to handicapAfter", () => {
      const rounds = [createMockRound({ id: 1, updatedHandicapIndex: 16.7 })];
      const courseMap = createCourseMap([[100, "Test Course"]]);

      const result = transformRoundsToActivities(rounds, courseMap);

      expect(result[0].handicapAfter).toBe(16.7);
    });
  });

  describe("complex scenarios", () => {
    test("handles realistic golf season data", () => {
      const rounds = [
        createMockRound({
          id: 1,
          courseId: 101,
          teeTime: "2024-03-15T09:00:00Z",
          scoreDifferential: 28.5,
          updatedHandicapIndex: 28.5,
        }),
        createMockRound({
          id: 2,
          courseId: 102,
          teeTime: "2024-04-01T10:30:00Z",
          scoreDifferential: 25.0,
          updatedHandicapIndex: 26.75,
        }),
        createMockRound({
          id: 3,
          courseId: 101,
          teeTime: "2024-04-15T08:00:00Z",
          scoreDifferential: 23.2,
          updatedHandicapIndex: 25.57,
        }),
        createMockRound({
          id: 4,
          courseId: 103,
          teeTime: "2024-05-01T07:30:00Z",
          scoreDifferential: 20.1,
          updatedHandicapIndex: 24.2,
        }),
      ];
      const courseMap = createCourseMap([
        [101, "Local Muni"],
        [102, "Country Club"],
        [103, "Resort Course"],
      ]);

      const result = transformRoundsToActivities(rounds, courseMap);

      // Verify order (most recent first)
      expect(result[0].id).toBe(4);
      expect(result[3].id).toBe(1);

      // Verify course names resolved
      expect(result[0].courseName).toBe("Resort Course");
      expect(result[1].courseName).toBe("Local Muni");

      // Verify personal bests (all improving, so all are PB)
      expect(result.every((r) => r.isPersonalBest)).toBe(true);

      // Verify first round milestone
      expect(result[3].isMilestone).toBe("First round!");
    });
  });
});
