/**
 * Unit tests — utils/activity-transform.ts, focused on the accept-and-
 * quarantine behavior (decision D4): quarantined rounds stay VISIBLE in the
 * activity feed but are excluded from every handicap-derived statistic
 * (personal best, milestone numbering). Mirrors the native suite in
 * apps/native/tests/unit/activity-transform.test.ts.
 */
import { describe, it, expect } from "vitest";

import { transformRoundsToActivities } from "@/utils/activity-transform";
import type { Tables } from "@/types/supabase";

const baseRound = (
  overrides: Partial<Tables<"round">>
): Tables<"round"> => ({
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
  quarantined: false,
  externalId: null,
  submitted_via: null,
  notes: null,
  createdAt: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-01T10:00:00Z",
  course_rating_used: 72,
  slope_rating_used: 113,
  holes_played: 18,
  nine_hole_section: null,
  ...overrides,
});

describe("transformRoundsToActivities — quarantine (D4)", () => {
  it("keeps quarantined rounds visible and surfaces the flag", () => {
    const rounds = [
      baseRound({ id: 1, teeTime: "2026-01-01T10:00:00Z" }),
      baseRound({ id: 2, teeTime: "2026-02-01T10:00:00Z", quarantined: true }),
    ];
    const activities = transformRoundsToActivities(rounds, new Map(), 1);
    expect(activities).toHaveLength(2);
    expect(activities.find((a) => a.id === 2)?.quarantined).toBe(true);
    expect(activities.find((a) => a.id === 1)?.quarantined).toBe(false);
  });

  it("never marks a quarantined round as personal best, even with the lowest differential", () => {
    const rounds = [
      baseRound({
        id: 1,
        teeTime: "2026-01-01T10:00:00Z",
        scoreDifferential: 15,
      }),
      baseRound({
        id: 2,
        teeTime: "2026-02-01T10:00:00Z",
        scoreDifferential: 1.2,
        quarantined: true,
      }),
      baseRound({
        id: 3,
        teeTime: "2026-03-01T10:00:00Z",
        scoreDifferential: 12,
      }),
    ];
    const activities = transformRoundsToActivities(rounds, new Map(), 2);
    expect(activities.find((a) => a.id === 2)?.isPersonalBest).toBe(false);
    // Counted rounds still earn their bests: 15 (first counted), then 12 —
    // the quarantined 1.2 must not have raised the bar in between.
    expect(activities.find((a) => a.id === 1)?.isPersonalBest).toBe(true);
    expect(activities.find((a) => a.id === 3)?.isPersonalBest).toBe(true);
  });

  it("skips quarantined rounds in milestone numbering and never labels them", () => {
    const rounds = [
      baseRound({ id: 1, teeTime: "2026-01-01T10:00:00Z" }),
      baseRound({ id: 2, teeTime: "2026-02-01T10:00:00Z", quarantined: true }),
      baseRound({ id: 3, teeTime: "2026-03-01T10:00:00Z" }),
    ];
    // Server-side total (round.getCountByUserId) excludes quarantined: 2.
    const activities = transformRoundsToActivities(rounds, new Map(), 2);
    expect(activities.find((a) => a.id === 1)?.isMilestone).toBe(
      "First round!"
    );
    expect(activities.find((a) => a.id === 2)?.isMilestone).toBeUndefined();
    expect(activities.find((a) => a.id === 3)?.isMilestone).toBeUndefined();
  });

  it("is unchanged for all-counted histories (regression guard)", () => {
    const rounds = [
      baseRound({
        id: 1,
        teeTime: "2026-01-01T10:00:00Z",
        scoreDifferential: 15,
      }),
      baseRound({
        id: 2,
        teeTime: "2026-02-01T10:00:00Z",
        scoreDifferential: 12,
      }),
    ];
    const activities = transformRoundsToActivities(rounds, new Map(), 2);
    expect(activities.map((a) => a.id)).toEqual([2, 1]);
    expect(activities.find((a) => a.id === 2)?.isPersonalBest).toBe(true);
    expect(activities.find((a) => a.id === 1)?.isMilestone).toBe(
      "First round!"
    );
  });
});
