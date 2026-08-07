import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseDbTimestamp } from "@/lib/parse-db-timestamp";
import { transformRoundsToActivities } from "@/utils/activity-transform";
import type { Tables } from "@/types/supabase";

// Pin the process timezone to Norway for the one ambient-TZ assertion below
// (Node >=13 re-reads TZ on subsequent date operations), and restore it so
// no other suite in the worker inherits it. The load-bearing assertions all
// pass `timeZone: "Europe/Oslo"` explicitly and don't depend on ambient TZ.
beforeAll(() => {
  vi.stubEnv("TZ", "Europe/Oslo");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const osloClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const osloDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

describe("parseDbTimestamp", () => {
  it("parses a zone-less PostgREST timestamp as UTC (Norwegian summer, UTC+2)", () => {
    const parsed = parseDbTimestamp("2026-07-15T21:30:00");
    expect(parsed.toISOString()).toBe("2026-07-15T21:30:00.000Z");
    expect(osloClock.format(parsed)).toBe("23:30");
    // The date must stay on the 15th — the old local-parse bug rendered
    // stored evening instants hours early.
    expect(osloDate.format(parsed)).toBe("15/07/2026");
  });

  it("does not shift a late-evening round onto the previous date", () => {
    // Played 00:30 local on the 16th → stored as 22:30 UTC on the 15th.
    // The buggy local parse rendered this on the 15th.
    const parsed = parseDbTimestamp("2026-07-15T22:30:00");
    expect(osloDate.format(parsed)).toBe("16/07/2026");
    expect(osloClock.format(parsed)).toBe("00:30");
  });

  it("handles Norwegian winter (CET, UTC+1)", () => {
    const parsed = parseDbTimestamp("2026-01-15T21:30:00");
    expect(osloClock.format(parsed)).toBe("22:30");
  });

  it("respects the ambient TZ=Europe/Oslo when no explicit zone is given to the formatter", () => {
    const parsed = parseDbTimestamp("2026-07-15T21:30:00");
    expect(
      parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    ).toBe("23:30");
  });

  it("parses fractional-second PostgREST output", () => {
    const parsed = parseDbTimestamp("2026-07-15T21:30:00.123456");
    expect(parsed.toISOString()).toBe("2026-07-15T21:30:00.123Z");
  });

  it("passes through values that already carry Z (no double offset)", () => {
    const iso = "2026-07-15T21:30:00.000Z";
    expect(parseDbTimestamp(iso).getTime()).toBe(new Date(iso).getTime());
    expect(parseDbTimestamp(iso).toISOString()).toBe(iso);
  });

  it("passes through values that already carry a numeric offset", () => {
    const withColon = parseDbTimestamp("2026-07-15T23:30:00+02:00");
    const compact = parseDbTimestamp("2026-07-15T23:30:00+0200");
    const hourOnly = parseDbTimestamp("2026-07-15T23:30:00+02");
    const expected = Date.UTC(2026, 6, 15, 21, 30, 0);
    expect(withColon.getTime()).toBe(expected);
    expect(compact.getTime()).toBe(expected);
    expect(hourOnly.getTime()).toBe(expected);
  });

  it("treats date-only strings as UTC midnight", () => {
    expect(parseDbTimestamp("2026-07-15").toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    );
  });

  it("returns null for null and undefined", () => {
    expect(parseDbTimestamp(null)).toBeNull();
    expect(parseDbTimestamp(undefined)).toBeNull();
  });
});

describe("activity feed call site (transformRoundsToActivities)", () => {
  const makeRound = (
    overrides: Partial<Tables<"round">> & Pick<Tables<"round">, "id" | "teeTime">
  ): Tables<"round"> => ({
    adjustedGrossScore: 85,
    adjustedPlayedScore: 85,
    approvalStatus: "approved",
    course_rating_used: 72.1,
    courseHandicap: 12,
    courseId: 1,
    createdAt: "2026-07-15T21:35:00",
    exceptionalScoreAdjustment: 0,
    existingHandicapIndex: 12.4,
    externalId: null,
    holes_played: 18,
    nine_hole_section: null,
    notes: null,
    parPlayed: 72,
    quarantined: false,
    scoreDifferential: 10.2,
    slope_rating_used: 128,
    submitted_via: null,
    teeId: 1,
    totalStrokes: 85,
    updated_at: "2026-07-15T21:35:00.000Z",
    updatedHandicapIndex: 12.1,
    userId: "00000000-0000-0000-0000-000000000000",
    ...overrides,
  });

  it("carries the true UTC instant for a PostgREST-fed round", () => {
    // Stored value is the UTC rendering: round played 23:30 Oslo on the 15th.
    const rounds = [makeRound({ id: 1, teeTime: "2026-07-15T21:30:00" })];
    const [activity] = transformRoundsToActivities(
      rounds,
      new Map([[1, "Ballerud GK"]]),
      1
    );
    expect(activity.date.toISOString()).toBe("2026-07-15T21:30:00.000Z");
    expect(osloClock.format(activity.date)).toBe("23:30");
    expect(osloDate.format(activity.date)).toBe("15/07/2026");
  });

  it("sorts boundary-day rounds by their real instants", () => {
    const rounds = [
      // Stored 22:30 UTC on the 15th = 00:30 local on the 16th.
      makeRound({ id: 1, teeTime: "2026-07-15T22:30:00" }),
      // Drizzle-style serialization of a later instant the same night.
      makeRound({ id: 2, teeTime: "2026-07-15T23:00:00.000Z" }),
    ];
    const activities = transformRoundsToActivities(
      rounds,
      new Map([[1, "Ballerud GK"]]),
      2
    );
    // Most recent first — id 2 (23:00Z) is later than id 1 (22:30Z), and the
    // mixed representations must not be offset against each other.
    expect(activities.map((a) => a.id)).toEqual([2, 1]);
    expect(activities[0].date.getTime() - activities[1].date.getTime()).toBe(
      30 * 60 * 1000
    );
  });
});
