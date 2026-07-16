/**
 * Trio logic (plan 013 D7): stepper clamp/unset semantics and the fairway
 * tri-state toggle. Mirrored at apps/native/tests/unit/hole-detail.test.ts.
 */
import { describe, expect, it } from "vitest";

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
} from "@/lib/scorecard/hole-detail";

describe("stepDetailCount", () => {
  it("starts at 1 when incrementing from unset", () => {
    expect(stepDetailCount(null, 1, MAX_PUTTS)).toBe(1);
    expect(stepDetailCount(undefined, 1, MAX_PUTTS)).toBe(1);
  });

  it("stays unset when decrementing from unset", () => {
    expect(stepDetailCount(null, -1, MAX_PUTTS)).toBeUndefined();
    expect(stepDetailCount(undefined, -1, MAX_PUTTS)).toBeUndefined();
  });

  it("reaches a real 0 and clears below it (0 and unset are distinct)", () => {
    expect(stepDetailCount(1, -1, MAX_PUTTS)).toBe(0);
    expect(stepDetailCount(0, -1, MAX_PUTTS)).toBeUndefined();
  });

  it("clamps at the max", () => {
    expect(stepDetailCount(MAX_PUTTS, 1, MAX_PUTTS)).toBe(MAX_PUTTS);
    expect(stepDetailCount(MAX_PENALTIES, 1, MAX_PENALTIES)).toBe(
      MAX_PENALTIES
    );
  });

  it("increments and decrements ordinary values", () => {
    expect(stepDetailCount(2, 1, MAX_PUTTS)).toBe(3);
    expect(stepDetailCount(2, -1, MAX_PUTTS)).toBe(1);
  });
});

describe("strokes-bounded detail (putts + penalties ≤ strokes − 1)", () => {
  it("caps putts at strokes − 1 minus recorded penalties", () => {
    expect(maxPuttsForStrokes(5, null)).toBe(4);
    expect(maxPuttsForStrokes(5, 2)).toBe(2);
    expect(maxPuttsForStrokes(1, null)).toBe(0);
  });

  it("caps penalties at strokes − 1 minus recorded putts", () => {
    expect(maxPenaltiesForStrokes(5, null)).toBe(4);
    expect(maxPenaltiesForStrokes(5, 2)).toBe(2);
    expect(maxPenaltiesForStrokes(1, null)).toBe(0);
  });

  it("an unset or zero score doesn't constrain the steppers", () => {
    expect(maxPuttsForStrokes(null, null)).toBe(MAX_PUTTS);
    expect(maxPuttsForStrokes(0, null)).toBe(MAX_PUTTS);
    expect(maxPenaltiesForStrokes(undefined, 3)).toBe(MAX_PENALTIES);
  });

  it("never exceeds the absolute caps on huge scores", () => {
    expect(maxPuttsForStrokes(30, null)).toBe(MAX_PUTTS);
    expect(maxPenaltiesForStrokes(30, null)).toBe(MAX_PENALTIES);
  });

  it("clampDetailToStrokes re-fits putts first, then penalties", () => {
    expect(clampDetailToStrokes({ putts: 4 }, 4)).toEqual({ putts: 3 });
    expect(clampDetailToStrokes({ putts: 4, penaltyStrokes: 2 }, 4)).toEqual({
      putts: 3,
      penaltyStrokes: 0,
    });
    expect(
      clampDetailToStrokes({ putts: 2, penaltyStrokes: 1, fairwayHit: true }, 6)
    ).toEqual({ putts: 2, penaltyStrokes: 1, fairwayHit: true });
  });

  it("clampDetailToStrokes preserves unset fields and ignores unset scores", () => {
    expect(clampDetailToStrokes({ penaltyStrokes: 3 }, 2)).toEqual({
      penaltyStrokes: 1,
    });
    expect(clampDetailToStrokes({ putts: 9 }, null)).toEqual({ putts: 9 });
    expect(clampDetailToStrokes({ putts: 9 }, 0)).toEqual({ putts: 9 });
  });
});

describe("toggleFairway", () => {
  it("selects a side from unset", () => {
    expect(toggleFairway(null, "hit")).toBe(true);
    expect(toggleFairway(undefined, "miss")).toBe(false);
  });

  it("re-tapping the selected side clears to unset", () => {
    expect(toggleFairway(true, "hit")).toBeUndefined();
    expect(toggleFairway(false, "miss")).toBeUndefined();
  });

  it("switches directly between sides", () => {
    expect(toggleFairway(true, "miss")).toBe(false);
    expect(toggleFairway(false, "hit")).toBe(true);
  });
});

describe("fairway display", () => {
  it("renders hit / miss / unset glyphs", () => {
    expect(fairwayGlyph(true, false)).toBe("✓");
    expect(fairwayGlyph(false, false)).toBe("✗");
    expect(fairwayGlyph(null, false)).toBe("–");
  });

  it("par 3 overrides any stored value", () => {
    expect(fairwayGlyph(true, true)).toBe("N/A");
    expect(fairwayLabel(true, true)).toBe("not applicable (par 3)");
  });

  it("labels states for accessibility", () => {
    expect(fairwayLabel(true, false)).toBe("hit");
    expect(fairwayLabel(false, false)).toBe("missed");
    expect(fairwayLabel(undefined, false)).toBe("not set");
  });
});
