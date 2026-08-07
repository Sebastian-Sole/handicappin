/**
 * Unit tests — lib/statistics/course-detail-display.ts (decision D4).
 *
 * `stats.getCourseDetail` returns every round in `rounds` but counts only
 * non-quarantined ones in `summary.roundCount`. These cases pin the branch
 * that keeps a fully-quarantined course's rounds on screen instead of
 * collapsing the screen into "No rounds at this course yet". Mirrors the web
 * suite in apps/web/tests/unit/course-detail-display.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getCourseDetailDisplay } from "../../lib/statistics/course-detail-display";

describe("getCourseDetailDisplay", () => {
  it("reports 'empty' only when no round exists at the course", () => {
    assert.deepEqual(getCourseDetailDisplay(0, 0), {
      state: "empty",
      listedRounds: 0,
      countedRounds: 0,
      quarantinedRounds: 0,
    });
  });

  it("keeps a fully-quarantined course visible instead of showing the empty state", () => {
    // The D4 regression: summary.roundCount is 0 because every round is
    // quarantined, but three rounds exist and must still be listed.
    assert.deepEqual(getCourseDetailDisplay(3, 0), {
      state: "all-quarantined",
      listedRounds: 3,
      countedRounds: 0,
      quarantinedRounds: 3,
    });
  });

  it("reports 'has-stats' when at least one round counts", () => {
    assert.deepEqual(getCourseDetailDisplay(1, 1), {
      state: "has-stats",
      listedRounds: 1,
      countedRounds: 1,
      quarantinedRounds: 0,
    });
  });

  it("derives the quarantined count from the gap between listed and counted", () => {
    const display = getCourseDetailDisplay(5, 2);
    assert.equal(display.state, "has-stats");
    assert.equal(display.quarantinedRounds, 3);
  });

  it("never reports a negative quarantined count when counted exceeds listed", () => {
    assert.deepEqual(getCourseDetailDisplay(2, 7), {
      state: "has-stats",
      listedRounds: 2,
      countedRounds: 2,
      quarantinedRounds: 0,
    });
  });

  it("clamps negative inputs rather than propagating them into the copy", () => {
    assert.deepEqual(getCourseDetailDisplay(-1, -4), {
      state: "empty",
      listedRounds: 0,
      countedRounds: 0,
      quarantinedRounds: 0,
    });
  });
});
