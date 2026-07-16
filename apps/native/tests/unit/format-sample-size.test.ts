/**
 * Sample-size display formatting (plan 013 D6) — native mirror of the
 * formatSampleSize cases in apps/web/tests/unit/statistics/format-utils.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatSampleSize } from "../../lib/statistics/format-utils";

describe("formatSampleSize (plan 013 D6)", () => {
  it("shows 'Based on N of M rounds'", () => {
    assert.equal(formatSampleSize(6, 20), "Based on 6 of 20 rounds");
    assert.equal(formatSampleSize(1, 1), "Based on 1 of 1 round");
  });

  it("nudges when no round has the data yet", () => {
    assert.equal(formatSampleSize(0, 20), "Track a few rounds to unlock this");
    assert.equal(formatSampleSize(0, 0), "Track a few rounds to unlock this");
  });

  it("never shows a sample larger than the total", () => {
    assert.equal(formatSampleSize(5, 3), "Based on 5 of 5 rounds");
  });
});
