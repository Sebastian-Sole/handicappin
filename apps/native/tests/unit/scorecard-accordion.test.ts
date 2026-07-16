/**
 * Read-only viewer logic (plan 013 D2) — native mirror of
 * apps/web/tests/unit/scorecard/scorecard-accordion.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  holeHasDetail,
  scoreResultLabel,
  type HoleDetailValue,
} from "../../lib/hole-detail";

const score = (overrides: HoleDetailValue = {}): HoleDetailValue => ({
  ...overrides,
});

describe("scoreResultLabel", () => {
  it("names the classic results", () => {
    assert.equal(scoreResultLabel(2, 4), "Eagle");
    assert.equal(scoreResultLabel(3, 4), "Birdie");
    assert.equal(scoreResultLabel(4, 4), "Par");
    assert.equal(scoreResultLabel(5, 4), "Bogey");
  });

  it("falls back to signed diffs beyond one over / three under", () => {
    assert.equal(scoreResultLabel(6, 4), "+2");
    assert.equal(scoreResultLabel(9, 4), "+5");
    assert.equal(scoreResultLabel(2, 5), "-3");
  });
});

describe("holeHasDetail (score-only rounds show no empty chips)", () => {
  it("is false when no detail was captured", () => {
    assert.equal(holeHasDetail(score()), false);
    assert.equal(
      holeHasDetail(
        score({ putts: null, fairwayHit: null, penaltyStrokes: null }),
      ),
      false,
    );
  });

  it("is true when any single field was captured", () => {
    assert.equal(holeHasDetail(score({ putts: 2 })), true);
    assert.equal(holeHasDetail(score({ fairwayHit: false })), true);
    assert.equal(holeHasDetail(score({ penaltyStrokes: 0 })), true);
  });
});
