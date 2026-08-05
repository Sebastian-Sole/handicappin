/** Unit tests — lib/round-session/watch-stats.ts (watch home-stats shaping). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RoundRow } from "../../lib/api/schemas/round";
import { seasonRounds, toWatchLastRound } from "../../lib/round-session/watch-stats";

const baseRound = (overrides: Partial<RoundRow>): RoundRow => ({
  id: 1,
  userId: "u",
  courseId: 10,
  teeId: 5,
  teeTime: "2026-07-15T21:30:00",
  totalStrokes: 90,
  parPlayed: 72,
  adjustedGrossScore: 88,
  adjustedPlayedScore: 88,
  courseHandicap: 12,
  scoreDifferential: 14.2,
  existingHandicapIndex: 13,
  updatedHandicapIndex: 12.8,
  exceptionalScoreAdjustment: 0,
  approvalStatus: "approved",
  notes: null,
  createdAt: "2026-07-15T21:35:00",
  course_rating_used: 72.1,
  slope_rating_used: 128,
  holes_played: 18,
  nine_hole_section: null,
  ...overrides,
});

describe("toWatchLastRound", () => {
  it("sends playedAt as the Z-suffixed UTC instant of a zone-less teeTime", () => {
    const last = toWatchLastRound(
      baseRound({ teeTime: "2026-07-15T21:30:00" }),
      "Ballerud GK",
    );
    // Millisecond-precision Z form — exactly what the watch's shared
    // ISO8601DateFormatter (.withFractionalSeconds) parses.
    assert.equal(last.playedAt, "2026-07-15T21:30:00.000Z");
    assert.equal(last.courseName, "Ballerud GK");
    assert.equal(last.toPar, 18);
  });

  it("does not double-apply an offset when teeTime already carries Z", () => {
    const last = toWatchLastRound(
      baseRound({ teeTime: "2026-07-15T21:30:00.000Z" }),
      "",
    );
    assert.equal(last.playedAt, "2026-07-15T21:30:00.000Z");
  });

  it("omits nineHoleSection unless front/back (NSNull rule)", () => {
    const eighteen = toWatchLastRound(baseRound({}), "");
    assert.equal("nineHoleSection" in eighteen, false);
    const nine = toWatchLastRound(
      baseRound({ holes_played: 9, nine_hole_section: "back" }),
      "",
    );
    assert.equal(nine.nineHoleSection, "back");
  });
});

describe("seasonRounds", () => {
  it("classifies zone-less teeTimes by their real instant, not a local misparse", () => {
    const rounds = [
      // 23:30 UTC Dec 31 2025 — device-local year depends on the zone, but
      // the instant must first be read as UTC; a local misparse of the naive
      // string could differ by the device offset.
      baseRound({ id: 1, teeTime: "2025-12-31T23:30:00" }),
      baseRound({ id: 2, teeTime: "2026-07-15T21:30:00" }),
      baseRound({ id: 3, teeTime: "2026-01-01T00:30:00.000Z" }),
    ];
    const season = seasonRounds(rounds, 2026);
    // Assert on instants, not zone-dependent membership of round 1/3:
    // round 2 is unambiguously 2026 in every zone the suite runs in
    // (mid-July; no populated zone is offset far enough to change its year).
    assert.equal(season.some((r) => r.id === 2), true);
    // And the boundary rounds are classified from the correctly-parsed
    // instant: both are within 1h of the UTC year boundary, so their
    // local year matches what parseDbTimestamp + getFullYear yields.
    for (const r of rounds) {
      const expectedYear = new Date(
        r.teeTime.endsWith("Z") ? r.teeTime : `${r.teeTime}Z`,
      ).getFullYear();
      assert.equal(
        season.some((s) => s.id === r.id),
        expectedYear === 2026,
        `round ${r.id} classified against its true instant`,
      );
    }
  });
});
