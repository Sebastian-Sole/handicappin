/**
 * Unit tests — lib/statistics/course-detail-display.ts (decision D4).
 *
 * `stats.getCourseDetail` returns every round in `rounds` but counts only
 * non-quarantined ones in `summary.roundCount`. These cases pin the branch
 * that keeps a fully-quarantined course's rounds on screen instead of
 * collapsing the page into "No rounds at this course yet". Mirrors the native
 * suite in apps/native/tests/unit/course-detail-display.test.ts.
 */
import { describe, it, expect } from "vitest";

import { getCourseDetailDisplay } from "@/lib/statistics/course-detail-display";

describe("getCourseDetailDisplay", () => {
  it("reports 'empty' only when no round exists at the course", () => {
    expect(getCourseDetailDisplay(0, 0)).toEqual({
      state: "empty",
      listedRounds: 0,
      countedRounds: 0,
      quarantinedRounds: 0,
    });
  });

  it("keeps a fully-quarantined course visible instead of showing the empty state", () => {
    // The D4 regression: summary.roundCount is 0 because every round is
    // quarantined, but three rounds exist and must still be listed.
    expect(getCourseDetailDisplay(3, 0)).toEqual({
      state: "all-quarantined",
      listedRounds: 3,
      countedRounds: 0,
      quarantinedRounds: 3,
    });
  });

  it("reports 'has-stats' when at least one round counts", () => {
    expect(getCourseDetailDisplay(1, 1)).toEqual({
      state: "has-stats",
      listedRounds: 1,
      countedRounds: 1,
      quarantinedRounds: 0,
    });
  });

  it("derives the quarantined count from the gap between listed and counted", () => {
    expect(getCourseDetailDisplay(5, 2)).toMatchObject({
      state: "has-stats",
      quarantinedRounds: 3,
    });
  });

  it("never reports a negative quarantined count when counted exceeds listed", () => {
    expect(getCourseDetailDisplay(2, 7)).toEqual({
      state: "has-stats",
      listedRounds: 2,
      countedRounds: 2,
      quarantinedRounds: 0,
    });
  });

  it("clamps negative inputs rather than propagating them into the copy", () => {
    expect(getCourseDetailDisplay(-1, -4)).toEqual({
      state: "empty",
      listedRounds: 0,
      countedRounds: 0,
      quarantinedRounds: 0,
    });
  });
});
