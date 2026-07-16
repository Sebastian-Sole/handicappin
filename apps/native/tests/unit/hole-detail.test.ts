/**
 * Trio logic (plan 013 D7) — native mirror of
 * apps/web/tests/unit/scorecard/hole-detail.test.ts. The two hole-detail
 * modules must stay byte-equivalent in behaviour.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampDetailToStrokes,
  fairwayGlyph,
  fairwayLabel,
  MAX_PENALTIES,
  MAX_PUTTS,
  maxPenaltiesForStrokes,
  maxPuttsForStrokes,
  stepDetailCount,
  toggleFairway,
} from "../../lib/hole-detail";

describe("stepDetailCount", () => {
  it("starts at 1 when incrementing from unset", () => {
    assert.equal(stepDetailCount(null, 1, MAX_PUTTS), 1);
    assert.equal(stepDetailCount(undefined, 1, MAX_PUTTS), 1);
  });

  it("stays unset when decrementing from unset", () => {
    assert.equal(stepDetailCount(null, -1, MAX_PUTTS), undefined);
    assert.equal(stepDetailCount(undefined, -1, MAX_PUTTS), undefined);
  });

  it("reaches a real 0 and clears below it (0 and unset are distinct)", () => {
    assert.equal(stepDetailCount(1, -1, MAX_PUTTS), 0);
    assert.equal(stepDetailCount(0, -1, MAX_PUTTS), undefined);
  });

  it("clamps at the max", () => {
    assert.equal(stepDetailCount(MAX_PUTTS, 1, MAX_PUTTS), MAX_PUTTS);
    assert.equal(
      stepDetailCount(MAX_PENALTIES, 1, MAX_PENALTIES),
      MAX_PENALTIES,
    );
  });

  it("increments and decrements ordinary values", () => {
    assert.equal(stepDetailCount(2, 1, MAX_PUTTS), 3);
    assert.equal(stepDetailCount(2, -1, MAX_PUTTS), 1);
  });
});

describe("strokes-bounded detail (putts + penalties ≤ strokes − 1)", () => {
  it("caps putts at strokes − 1 minus recorded penalties", () => {
    assert.equal(maxPuttsForStrokes(5, null), 4);
    assert.equal(maxPuttsForStrokes(5, 2), 2);
    assert.equal(maxPuttsForStrokes(1, null), 0);
  });

  it("caps penalties at strokes − 1 minus recorded putts", () => {
    assert.equal(maxPenaltiesForStrokes(5, null), 4);
    assert.equal(maxPenaltiesForStrokes(5, 2), 2);
    assert.equal(maxPenaltiesForStrokes(1, null), 0);
  });

  it("an unset or zero score doesn't constrain the steppers", () => {
    assert.equal(maxPuttsForStrokes(null, null), MAX_PUTTS);
    assert.equal(maxPuttsForStrokes(0, null), MAX_PUTTS);
    assert.equal(maxPenaltiesForStrokes(undefined, 3), MAX_PENALTIES);
  });

  it("never exceeds the absolute caps on huge scores", () => {
    assert.equal(maxPuttsForStrokes(30, null), MAX_PUTTS);
    assert.equal(maxPenaltiesForStrokes(30, null), MAX_PENALTIES);
  });

  it("clampDetailToStrokes re-fits putts first, then penalties", () => {
    assert.deepEqual(clampDetailToStrokes({ putts: 4 }, 4), { putts: 3 });
    assert.deepEqual(
      clampDetailToStrokes({ putts: 4, penaltyStrokes: 2 }, 4),
      { putts: 3, penaltyStrokes: 0 },
    );
    assert.deepEqual(
      clampDetailToStrokes({ putts: 2, penaltyStrokes: 1, fairwayHit: true }, 6),
      { putts: 2, penaltyStrokes: 1, fairwayHit: true },
    );
  });

  it("clampDetailToStrokes preserves unset fields and ignores unset scores", () => {
    assert.deepEqual(clampDetailToStrokes({ penaltyStrokes: 3 }, 2), {
      penaltyStrokes: 1,
    });
    assert.deepEqual(clampDetailToStrokes({ putts: 9 }, null), { putts: 9 });
    assert.deepEqual(clampDetailToStrokes({ putts: 9 }, 0), { putts: 9 });
  });
});

describe("toggleFairway", () => {
  it("selects a side from unset", () => {
    assert.equal(toggleFairway(null, "hit"), true);
    assert.equal(toggleFairway(undefined, "miss"), false);
  });

  it("re-tapping the selected side clears to unset", () => {
    assert.equal(toggleFairway(true, "hit"), undefined);
    assert.equal(toggleFairway(false, "miss"), undefined);
  });

  it("switches directly between sides", () => {
    assert.equal(toggleFairway(true, "miss"), false);
    assert.equal(toggleFairway(false, "hit"), true);
  });
});

describe("fairway display", () => {
  it("renders hit / miss / unset glyphs", () => {
    assert.equal(fairwayGlyph(true, false), "✓");
    assert.equal(fairwayGlyph(false, false), "✗");
    assert.equal(fairwayGlyph(null, false), "–");
  });

  it("par 3 overrides any stored value", () => {
    assert.equal(fairwayGlyph(true, true), "N/A");
    assert.equal(fairwayLabel(true, true), "not applicable (par 3)");
  });

  it("labels states for accessibility", () => {
    assert.equal(fairwayLabel(true, false), "hit");
    assert.equal(fairwayLabel(false, false), "missed");
    assert.equal(fairwayLabel(undefined, false), "not set");
  });
});
