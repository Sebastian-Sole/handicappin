/**
 * Shot-level stats v1 (plans/010) — unit tests for the four headline
 * calculations. The critical properties under test:
 *   - partial data: compute over the subset of holes/rounds that HAVE the
 *     field, and report sampleSize honestly
 *   - zero data: value null / sampleSize 0 — never NaN, never a
 *     divide-by-zero
 *   - GIR derivation boundary: (strokes − putts) == (par − 2) exactly IS a
 *     green in regulation
 *   - FIR: par-3 holes and NULLs are excluded from the denominator
 */
import { describe, it, expect } from "vitest";
import {
  calculatePuttsPerRound,
  calculateGIRPercentage,
  calculateFIRPercentage,
  calculatePenaltiesPerRound,
  calculateShotLevelStats,
} from "@/lib/statistics/calculations";
import type { ScorecardWithRound, Score } from "@/types/scorecard-input";
import {
  createMockScorecard,
  createMockScores,
  createMock9HoleScores,
} from "./test-fixtures";

/** A scorecard with a deterministic round id (fixtures randomize it). */
function scorecardWith(
  roundId: number,
  scores: Score[],
  teeTime = "2024-01-15T10:00:00Z"
): ScorecardWithRound {
  const scorecard = createMockScorecard({ teeTime, scores });
  scorecard.round.id = roundId;
  return scorecard;
}

// Fixture par sequence (createMockHoles):
// [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4] — par 3s at holes 2, 6, 11, 15.
const PAR_3_INDEXES = [1, 5, 10, 14];

describe("calculatePuttsPerRound", () => {
  it("averages rounds with full putts data", () => {
    const roundA = scorecardWith(
      1,
      createMockScores(Array.from({ length: 18 }, () => ({ putts: 2 }))) // 36
    );
    const roundB = scorecardWith(
      2,
      createMockScores(Array.from({ length: 18 }, () => ({ putts: 1 }))) // 18
    );
    const result = calculatePuttsPerRound([roundA, roundB]);
    expect(result.value).toBe(27);
    expect(result.sampleSize).toBe(2);
  });

  it("excludes rounds with partial putts data from the average", () => {
    const full = scorecardWith(
      1,
      createMockScores(Array.from({ length: 18 }, () => ({ putts: 2 })))
    );
    const partialOverrides: Partial<Score>[] = Array.from(
      { length: 18 },
      () => ({ putts: 2 })
    );
    partialOverrides[7] = {}; // hole 8 has no putts recorded
    const partial = scorecardWith(2, createMockScores(partialOverrides));

    const result = calculatePuttsPerRound([full, partial]);
    expect(result.value).toBe(36);
    expect(result.sampleSize).toBe(1);
  });

  it("scales 9-hole rounds to an 18-hole equivalent", () => {
    const nineHole = scorecardWith(
      1,
      createMock9HoleScores().map((score) => ({ ...score, putts: 2 })) // 18 ×2
    );
    const result = calculatePuttsPerRound([nineHole]);
    expect(result.value).toBe(36);
    expect(result.sampleSize).toBe(1);
  });

  it("returns null value and sampleSize 0 with zero data — no NaN", () => {
    const noDetail = scorecardWith(1, createMockScores());
    const result = calculatePuttsPerRound([noDetail]);
    expect(result.value).toBeNull();
    expect(result.sampleSize).toBe(0);
    const empty = calculatePuttsPerRound([]);
    expect(empty.value).toBeNull();
    expect(empty.sampleSize).toBe(0);
  });
});

describe("calculateGIRPercentage", () => {
  it("counts strokes − putts == par − 2 EXACTLY as a green in regulation", () => {
    // Hole 1 is par 4: strokes 4, putts 2 → 4−2 = 2 == par−2 → GIR.
    const overrides: Partial<Score>[] = Array.from({ length: 18 }, () => ({}));
    overrides[0] = { strokes: 4, putts: 2 };
    const scorecard = scorecardWith(1, createMockScores(overrides));

    const result = calculateGIRPercentage([scorecard]);
    expect(result.value).toBe(100);
    expect(result.sampleSize).toBe(1);
  });

  it("one stroke over the regulation boundary is NOT a GIR", () => {
    // Hole 1 is par 4: strokes 5, putts 2 → 3 > 2 → no GIR.
    const overrides: Partial<Score>[] = Array.from({ length: 18 }, () => ({}));
    overrides[0] = { strokes: 5, putts: 2 };
    const scorecard = scorecardWith(1, createMockScores(overrides));

    const result = calculateGIRPercentage([scorecard]);
    expect(result.value).toBe(0);
    expect(result.sampleSize).toBe(1);
  });

  it("computes over only the holes with putts data (partial rounds count)", () => {
    // Two holes tracked: hole 1 (par 4) GIR, hole 3 (par 5) not.
    const overrides: Partial<Score>[] = Array.from({ length: 18 }, () => ({}));
    overrides[0] = { strokes: 4, putts: 2 }; // 2 <= 2 → GIR
    overrides[2] = { strokes: 6, putts: 2 }; // 4 > 3 → miss
    const scorecard = scorecardWith(1, createMockScores(overrides));

    const result = calculateGIRPercentage([scorecard]);
    expect(result.value).toBe(50);
    expect(result.sampleSize).toBe(1);
  });

  it("returns null value and sampleSize 0 with zero data — no NaN", () => {
    const result = calculateGIRPercentage([
      scorecardWith(1, createMockScores()),
    ]);
    expect(result.value).toBeNull();
    expect(result.sampleSize).toBe(0);
  });
});

describe("calculateFIRPercentage", () => {
  it("excludes par-3 holes from the denominator even when data exists", () => {
    const overrides: Partial<Score>[] = Array.from({ length: 18 }, () => ({}));
    overrides[0] = { fairwayHit: true }; // hole 1, par 4 → counts (hit)
    overrides[3] = { fairwayHit: false }; // hole 4, par 4 → counts (miss)
    overrides[PAR_3_INDEXES[0]] = { fairwayHit: true }; // hole 2, par 3 → EXCLUDED
    const scorecard = scorecardWith(1, createMockScores(overrides));

    const result = calculateFIRPercentage([scorecard]);
    expect(result.value).toBe(50); // 1 of 2 eligible, not 2 of 3
    expect(result.sampleSize).toBe(1);
  });

  it("excludes NULL / untracked holes from the denominator", () => {
    const overrides: Partial<Score>[] = Array.from({ length: 18 }, () => ({}));
    overrides[0] = { fairwayHit: true };
    // All other holes untracked.
    const scorecard = scorecardWith(1, createMockScores(overrides));

    const result = calculateFIRPercentage([scorecard]);
    expect(result.value).toBe(100);
    expect(result.sampleSize).toBe(1);
  });

  it("returns null value and sampleSize 0 with zero data — no NaN", () => {
    const result = calculateFIRPercentage([
      scorecardWith(1, createMockScores()),
    ]);
    expect(result.value).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  it("excludes holes whose par can't be resolved (unknown holeId)", () => {
    // An unresolvable hole could be a par 3 for all we know — exclude it
    // like GIR does, never count it. A round with ONLY unresolvable data
    // contributes nothing to the sample either.
    const overrides: Partial<Score>[] = Array.from({ length: 18 }, () => ({}));
    overrides[0] = { fairwayHit: true }; // resolvable par 4 → counts
    overrides[3] = { fairwayHit: false, holeId: 9999 }; // no such hole → EXCLUDED
    const scorecard = scorecardWith(1, createMockScores(overrides));

    const result = calculateFIRPercentage([scorecard]);
    expect(result.value).toBe(100); // 1 of 1 eligible — not 1 of 2

    const onlyUnresolvable: Partial<Score>[] = Array.from(
      { length: 18 },
      () => ({})
    );
    onlyUnresolvable[0] = { fairwayHit: true, holeId: 9999 };
    const empty = calculateFIRPercentage([
      scorecardWith(2, createMockScores(onlyUnresolvable)),
    ]);
    expect(empty.value).toBeNull();
    expect(empty.sampleSize).toBe(0);
  });
});

describe("calculatePenaltiesPerRound", () => {
  it("averages rounds with full penalties data and skips partial rounds", () => {
    const tracked = scorecardWith(
      1,
      createMockScores(
        Array.from({ length: 18 }, (_, i) => ({
          penaltyStrokes: i === 0 ? 2 : 0, // 2 total
        }))
      )
    );
    const untracked = scorecardWith(2, createMockScores());

    const result = calculatePenaltiesPerRound([tracked, untracked]);
    expect(result.value).toBe(2);
    expect(result.sampleSize).toBe(1);
  });

  it("scales 9-hole rounds to an 18-hole equivalent", () => {
    const nineHole = scorecardWith(
      1,
      createMock9HoleScores().map((score) => ({
        ...score,
        penaltyStrokes: 1, // 9 total ×2 = 18
      }))
    );
    const result = calculatePenaltiesPerRound([nineHole]);
    expect(result.value).toBe(18);
    expect(result.sampleSize).toBe(1);
  });

  it("returns null value and sampleSize 0 with zero data — no NaN", () => {
    const result = calculatePenaltiesPerRound([]);
    expect(result.value).toBeNull();
    expect(result.sampleSize).toBe(0);
  });
});

describe("calculateShotLevelStats", () => {
  it("bundles all four stats and stays all-empty on legacy data", () => {
    const legacy = scorecardWith(1, createMockScores());
    const result = calculateShotLevelStats([legacy]);
    expect(result.puttsPerRound).toEqual({ value: null, sampleSize: 0 });
    expect(result.girPercentage).toEqual({ value: null, sampleSize: 0 });
    expect(result.firPercentage).toEqual({ value: null, sampleSize: 0 });
    expect(result.penaltiesPerRound).toEqual({ value: null, sampleSize: 0 });
  });

  it("reports per-stat sample sizes independently", () => {
    // Round tracked putts only — GIR/putts populate, FIR/penalties stay empty.
    const puttsOnly = scorecardWith(
      1,
      createMockScores(Array.from({ length: 18 }, () => ({ putts: 2 })))
    );
    const result = calculateShotLevelStats([puttsOnly]);
    expect(result.puttsPerRound.sampleSize).toBe(1);
    expect(result.girPercentage.sampleSize).toBe(1);
    expect(result.firPercentage).toEqual({ value: null, sampleSize: 0 });
    expect(result.penaltiesPerRound).toEqual({ value: null, sampleSize: 0 });
  });
});
