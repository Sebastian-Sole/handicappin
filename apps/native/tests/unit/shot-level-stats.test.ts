/**
 * Shot-level stats v1 (plans/010) — native mirror of
 * apps/web/tests/unit/statistics/shot-level.test.ts over the native
 * trust-boundary scorecard type. Covers the same critical properties:
 * partial data, zero data (no NaN), the exact GIR boundary, and FIR's
 * par-3/NULL exclusion.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculatePuttsPerRound,
  calculateGIRPercentage,
  calculateFIRPercentage,
  calculatePenaltiesPerRound,
  calculateShotLevelStats,
} from "../../lib/statistics/calculations";
import type { ScorecardWithRound } from "../../lib/api/schemas/scorecard";

type MockScore = ScorecardWithRound["scores"][number];

// Same par sequence as web's statistics fixtures: par 3s at holes 2, 6, 11, 15.
const PAR_SEQUENCE = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];

function mockHoles() {
  return PAR_SEQUENCE.map((par, index) => ({
    id: index + 1,
    teeId: 1,
    holeNumber: index + 1,
    par,
    hcp: index + 1,
    distance: 400,
  }));
}

function mockScores(overrides: Partial<MockScore>[] = []): MockScore[] {
  return Array.from({ length: 18 }, (_, index) => ({
    holeId: index + 1,
    strokes: 5,
    hcpStrokes: 0,
    ...(overrides[index] ?? {}),
  }));
}

function mockScorecard(
  roundId: number,
  scores: MockScore[],
): ScorecardWithRound {
  return {
    userId: "test-user",
    teeTime: "2024-01-15T10:00:00Z",
    course: { id: 1, name: "Test Course", city: "Oslo", country: "Norway" },
    teePlayed: {
      id: 1,
      name: "Blue",
      gender: "mens",
      totalPar: 72,
      outPar: 36,
      inPar: 36,
      courseRating18: 72,
      slopeRating18: 130,
      courseRatingFront9: 36,
      slopeRatingFront9: 130,
      courseRatingBack9: 36,
      slopeRatingBack9: 130,
      totalDistance: 6600,
      distanceMeasurement: "yards",
      holes: mockHoles(),
    },
    scores,
    round: {
      id: roundId,
      courseId: 1,
      teeId: 1,
      teeTime: "2024-01-15T10:00:00Z",
      totalStrokes: 90,
      adjustedGrossScore: 90,
      adjustedPlayedScore: 90,
      parPlayed: 72,
      scoreDifferential: 15.9,
      courseHandicap: 18,
      existingHandicapIndex: 18,
      updatedHandicapIndex: 18,
      exceptionalScoreAdjustment: 0,
      approvalStatus: "approved",
      userId: "test-user",
    },
  };
}

describe("calculatePuttsPerRound (native mirror)", () => {
  it("averages rounds with full putts data; skips partial", () => {
    const full = mockScorecard(
      1,
      mockScores(Array.from({ length: 18 }, () => ({ putts: 2 }))),
    );
    const partialOverrides: Partial<MockScore>[] = Array.from(
      { length: 18 },
      () => ({ putts: 2 }),
    );
    partialOverrides[7] = {};
    const partial = mockScorecard(2, mockScores(partialOverrides));

    const result = calculatePuttsPerRound([full, partial]);
    assert.equal(result.value, 36);
    assert.equal(result.sampleSize, 1);
  });

  it("zero data → null value, sampleSize 0 (no NaN)", () => {
    const result = calculatePuttsPerRound([mockScorecard(1, mockScores())]);
    assert.equal(result.value, null);
    assert.equal(result.sampleSize, 0);
  });
});

describe("calculateGIRPercentage (native mirror)", () => {
  it("strokes − putts == par − 2 exactly IS a GIR; one over is not", () => {
    const overrides: Partial<MockScore>[] = Array.from(
      { length: 18 },
      () => ({}),
    );
    overrides[0] = { strokes: 4, putts: 2 }; // par 4: 2 <= 2 → GIR
    overrides[3] = { strokes: 5, putts: 2 }; // par 4: 3 > 2 → miss
    const result = calculateGIRPercentage([
      mockScorecard(1, mockScores(overrides)),
    ]);
    assert.equal(result.value, 50);
    assert.equal(result.sampleSize, 1);
  });

  it("zero data → null value, sampleSize 0", () => {
    const result = calculateGIRPercentage([mockScorecard(1, mockScores())]);
    assert.equal(result.value, null);
    assert.equal(result.sampleSize, 0);
  });
});

describe("calculateFIRPercentage (native mirror)", () => {
  it("excludes par-3s and NULLs from the denominator", () => {
    const overrides: Partial<MockScore>[] = Array.from(
      { length: 18 },
      () => ({}),
    );
    overrides[0] = { fairwayHit: true }; // par 4 → counts
    overrides[3] = { fairwayHit: false }; // par 4 → counts
    overrides[1] = { fairwayHit: true }; // hole 2 is par 3 → EXCLUDED
    const result = calculateFIRPercentage([
      mockScorecard(1, mockScores(overrides)),
    ]);
    assert.equal(result.value, 50);
    assert.equal(result.sampleSize, 1);
  });

  it("excludes holes whose par can't be resolved (unknown holeId)", () => {
    // An unresolvable hole could be a par 3 for all we know — exclude it
    // like GIR does, never count it.
    const overrides: Partial<MockScore>[] = Array.from(
      { length: 18 },
      () => ({}),
    );
    overrides[0] = { fairwayHit: true }; // resolvable par 4 → counts
    overrides[3] = { fairwayHit: false, holeId: 9999 }; // no such hole → EXCLUDED
    const result = calculateFIRPercentage([
      mockScorecard(1, mockScores(overrides)),
    ]);
    assert.equal(result.value, 100); // 1 of 1 eligible — not 1 of 2
    assert.equal(result.sampleSize, 1);
  });

  it("zero data → null value, sampleSize 0 (no NaN)", () => {
    const result = calculateFIRPercentage([mockScorecard(1, mockScores())]);
    assert.equal(result.value, null);
    assert.equal(result.sampleSize, 0);
  });
});

describe("calculatePenaltiesPerRound (native mirror)", () => {
  it("averages fully-tracked rounds and skips partial rounds", () => {
    const tracked = mockScorecard(
      1,
      mockScores(
        Array.from({ length: 18 }, (_, index) => ({
          penaltyStrokes: index === 0 ? 2 : 0, // 2 total
        })),
      ),
    );
    const untracked = mockScorecard(2, mockScores());

    const result = calculatePenaltiesPerRound([tracked, untracked]);
    assert.equal(result.value, 2);
    assert.equal(result.sampleSize, 1);
  });

  it("averages fully-tracked rounds and scales 9-hole rounds ×2", () => {
    const nineHole = mockScorecard(
      1,
      mockScores().slice(0, 9).map((score) => ({
        ...score,
        penaltyStrokes: 1,
      })),
    );
    const result = calculatePenaltiesPerRound([nineHole]);
    assert.equal(result.value, 18);
    assert.equal(result.sampleSize, 1);
  });
});

describe("calculateShotLevelStats (native mirror)", () => {
  it("stays all-empty on legacy data", () => {
    const result = calculateShotLevelStats([mockScorecard(1, mockScores())]);
    assert.deepEqual(result.puttsPerRound, { value: null, sampleSize: 0 });
    assert.deepEqual(result.girPercentage, { value: null, sampleSize: 0 });
    assert.deepEqual(result.firPercentage, { value: null, sampleSize: 0 });
    assert.deepEqual(result.penaltiesPerRound, { value: null, sampleSize: 0 });
  });

  it("reports per-stat sample sizes independently", () => {
    // Round tracked putts only — GIR/putts populate, FIR/penalties stay empty.
    const puttsOnly = mockScorecard(
      1,
      mockScores(Array.from({ length: 18 }, () => ({ putts: 2 }))),
    );
    const result = calculateShotLevelStats([puttsOnly]);
    assert.equal(result.puttsPerRound.sampleSize, 1);
    assert.equal(result.girPercentage.sampleSize, 1);
    assert.deepEqual(result.firPercentage, { value: null, sampleSize: 0 });
    assert.deepEqual(result.penaltiesPerRound, { value: null, sampleSize: 0 });
  });
});
