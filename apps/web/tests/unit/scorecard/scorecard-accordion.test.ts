/**
 * Read-only viewer logic (plan 013 D2): result labels and the "no empty
 * stat chips" rule. Mirrored at
 * apps/native/tests/unit/scorecard-accordion.test.ts.
 */
import { describe, expect, it } from "vitest";

import { holeHasDetail, scoreResultLabel } from "@/lib/scorecard/hole-detail";
import type { Score } from "@/types/scorecard-input";

const score = (overrides: Partial<Score> = {}): Score => ({
  strokes: 4,
  hcpStrokes: 0,
  ...overrides,
});

describe("scoreResultLabel", () => {
  it("names the classic results", () => {
    expect(scoreResultLabel(2, 4)).toBe("Eagle");
    expect(scoreResultLabel(3, 4)).toBe("Birdie");
    expect(scoreResultLabel(4, 4)).toBe("Par");
    expect(scoreResultLabel(5, 4)).toBe("Bogey");
  });

  it("falls back to signed diffs beyond one over / three under", () => {
    expect(scoreResultLabel(6, 4)).toBe("+2");
    expect(scoreResultLabel(9, 4)).toBe("+5");
    expect(scoreResultLabel(2, 5)).toBe("-3");
  });
});

describe("holeHasDetail (score-only rounds show no empty chips)", () => {
  it("is false when no detail was captured", () => {
    expect(holeHasDetail(score())).toBe(false);
    expect(
      holeHasDetail(
        score({ putts: null, fairwayHit: null, penaltyStrokes: null })
      )
    ).toBe(false);
  });

  it("is true when any single field was captured", () => {
    expect(holeHasDetail(score({ putts: 2 }))).toBe(true);
    expect(holeHasDetail(score({ fairwayHit: false }))).toBe(true);
    expect(holeHasDetail(score({ penaltyStrokes: 0 }))).toBe(true);
  });
});
