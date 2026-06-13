/** Unit tests — lib/activity-transform.ts (chart/feed data shaping). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { transformRoundsToActivities } from "../../lib/activity-transform";
import type { RoundRow } from "../../lib/api/schemas/round";

const baseRound = (overrides: Partial<RoundRow>): RoundRow => ({
  id: 1,
  userId: "u",
  courseId: 10,
  teeId: 5,
  teeTime: "2026-01-01T10:00:00Z",
  totalStrokes: 90,
  parPlayed: 72,
  adjustedGrossScore: 90,
  adjustedPlayedScore: 90,
  courseHandicap: 10,
  scoreDifferential: 15,
  existingHandicapIndex: 20,
  updatedHandicapIndex: 20,
  exceptionalScoreAdjustment: 0,
  approvalStatus: "approved",
  notes: null,
  createdAt: "2026-01-01T10:00:00Z",
  course_rating_used: 72,
  slope_rating_used: 113,
  holes_played: 18,
  nine_hole_section: null,
  ...overrides,
});

describe("transformRoundsToActivities", () => {
  it("returns empty for no rounds", () => {
    assert.deepEqual(transformRoundsToActivities([], new Map()), []);
  });

  it("orders newest first, marks personal bests chronologically", () => {
    const rounds = [
      baseRound({ id: 1, teeTime: "2026-01-01T10:00:00Z", scoreDifferential: 15 }),
      baseRound({ id: 2, teeTime: "2026-02-01T10:00:00Z", scoreDifferential: 12 }),
      baseRound({ id: 3, teeTime: "2026-03-01T10:00:00Z", scoreDifferential: 14 }),
    ];
    const activities = transformRoundsToActivities(
      rounds,
      new Map([[10, "Test Course"]]),
      3,
    );
    assert.deepEqual(
      activities.map((a) => a.id),
      [3, 2, 1],
    );
    // Bests in chronological order: 15 (first), then 12 — 14 is not a best.
    assert.equal(activities.find((a) => a.id === 1)?.isPersonalBest, true);
    assert.equal(activities.find((a) => a.id === 2)?.isPersonalBest, true);
    assert.equal(activities.find((a) => a.id === 3)?.isPersonalBest, false);
  });

  it("computes handicap change versus the previous round", () => {
    const rounds = [
      baseRound({ id: 1, teeTime: "2026-01-01T10:00:00Z", updatedHandicapIndex: 20 }),
      baseRound({ id: 2, teeTime: "2026-02-01T10:00:00Z", updatedHandicapIndex: 18.5 }),
    ];
    const activities = transformRoundsToActivities(rounds, new Map(), 2);
    assert.equal(activities[0].handicapChange, 18.5 - 20);
    assert.equal(activities[1].handicapChange, 0);
  });

  it("labels milestones from the total count", () => {
    const rounds = [
      baseRound({ id: 1, teeTime: "2026-01-01T10:00:00Z" }),
      baseRound({ id: 2, teeTime: "2026-02-01T10:00:00Z" }),
    ];
    const activities = transformRoundsToActivities(rounds, new Map(), 2);
    assert.equal(
      activities.find((a) => a.id === 1)?.isMilestone,
      "First round!",
    );
  });

  it("falls back to Unknown Course without a courses entry", () => {
    const activities = transformRoundsToActivities(
      [baseRound({})],
      new Map(),
      1,
    );
    assert.equal(activities[0].courseName, "Unknown Course");
  });
});
