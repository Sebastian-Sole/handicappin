/**
 * Characterization tests for `computeHandicapTimeline` — Plan 008.
 *
 * These tests PIN the CURRENT production behavior of the merged Pass 1 +
 * Pass 2 rolling handicap computation (extracted verbatim from
 * `supabase/functions/process-handicap-queue/index.ts`). They are not a
 * spec of what the algorithm *should* do — some of the pinned values
 * reflect known, pre-existing quirks (documented inline) that are
 * out-of-scope to fix here. Intentional rule changes to the handicap
 * engine must update these tests deliberately, with a clear explanation
 * of what changed and why.
 *
 * Course fixtures use course rating 72.0 (or a fixed decimal offset from
 * it), slope 113, so that `calculateScoreDifferential`'s
 * `(AGS - rating) * (113 / slope)` collapses to `AGS - rating` — this
 * keeps every differential a simple, legible function of gross score.
 *
 * Discovered quirk (not fixing, just documenting): because
 * `calculateHandicapIndex` returns the placeholder `54` for fewer than 3
 * differentials, Pass 1's rolling index resets to `54` after round 1 and
 * stays there through round 2 (see `README` comment on
 * `computeHandicapTimeline`'s ESR section) — REGARDLESS of the player's
 * `initialHandicapIndex` or how well they actually played. In practice
 * this means rounds 2 and 3 of almost any player's history compare their
 * score against a rolling index of `54`, which nearly always trips
 * Exceptional Score Reduction (offset +2) on those rounds. Every
 * multi-round fixture below shows this as an `esrOffset` on rounds 0-2
 * that has nothing to do with the round actually being exceptional.
 */
import { describe, it, expect } from "vitest";
import {
  computeHandicapTimeline,
  calculateHandicapIndex,
  type ProcessedRound,
  type Tee,
  type Hole,
  type Score,
  type TimelineInputs,
} from "@handicappin/handicap-core";

// ---------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------

const HOLE_PARS = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];

function makeTee(id: number, overrides: Partial<Tee> = {}): Tee {
  return {
    id,
    name: `Tee ${id}`,
    gender: "mens",
    courseRating18: 72.0,
    slopeRating18: 113,
    courseRatingFront9: 36.0,
    slopeRatingFront9: 113,
    courseRatingBack9: 36.0,
    slopeRatingBack9: 113,
    outPar: 36,
    inPar: 36,
    totalPar: 72,
    outDistance: 3000,
    inDistance: 3000,
    totalDistance: 6000,
    distanceMeasurement: "yards",
    approvalStatus: "approved",
    holes: undefined,
    courseId: id,
    ...overrides,
  };
}

function makeHoles(teeId: number): Hole[] {
  return HOLE_PARS.map((par, idx) => ({
    id: teeId * 100 + idx + 1,
    teeId,
    holeNumber: idx + 1,
    par,
    hcp: idx + 1,
    distance: 400,
  }));
}

let scoreIdCounter = 1;

/**
 * Builds 18 hole scores summing to `72 + extraStrokes`. Extra strokes are
 * distributed as bogeys/double-bogeys (never worse than double bogey), so
 * for any realistic course handicap the Net Double Bogey cap
 * (`calculateHoleAdjustedScore`) never engages — adjustedPlayedScore always
 * equals the gross score, keeping the differential a simple function of
 * `extraStrokes`.
 */
function makeFullRoundScores(
  holes: Hole[],
  roundId: number,
  extraStrokes: number
): Score[] {
  if (extraStrokes < 0 || extraStrokes > 36) {
    throw new Error("extraStrokes out of double-bogey-safe range (0-36)");
  }
  let remaining = extraStrokes;
  return holes.map((hole) => {
    const extra = Math.min(2, remaining);
    remaining -= extra;
    return {
      id: scoreIdCounter++,
      roundId,
      holeId: hole.id,
      strokes: hole.par + extra,
      hcpStrokes: 0,
    };
  });
}

/** Same as {@link makeFullRoundScores} but for a single 9-hole section. */
function makeNineHoleScores(
  holes: Hole[],
  roundId: number,
  section: "front" | "back",
  extraStrokes: number
): Score[] {
  const nineHoles = section === "front" ? holes.slice(0, 9) : holes.slice(9, 18);
  if (extraStrokes < 0 || extraStrokes > 18) {
    throw new Error("extraStrokes out of double-bogey-safe range (0-18)");
  }
  let remaining = extraStrokes;
  return nineHoles.map((hole) => {
    const extra = Math.min(2, remaining);
    remaining -= extra;
    return {
      id: scoreIdCounter++,
      roundId,
      holeId: hole.id,
      strokes: hole.par + extra,
      hcpStrokes: 0,
    };
  });
}

const BASE_DATE = new Date("2024-01-01T12:00:00.000Z");
function day(n: number): Date {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() + n);
  return d;
}

function stubRound(
  id: number,
  teeId: number,
  teeTime: Date,
  approvalStatus: ProcessedRound["approvalStatus"] = "approved"
): ProcessedRound {
  return {
    id,
    teeTime,
    teeId,
    approvalStatus,
    // Placeholders — computeHandicapTimeline overwrites every field below.
    existingHandicapIndex: 0,
    rawDifferential: 0,
    esrOffset: 0,
    finalDifferential: 0,
    updatedHandicapIndex: 0,
    adjustedGrossScore: 0,
    adjustedPlayedScore: 0,
    courseHandicap: 0,
  };
}

type RoundFixture = {
  id: number;
  teeId: number;
  teeTime: Date;
  approvalStatus?: ProcessedRound["approvalStatus"];
  scores: Score[];
  nineHoleSection?: "front" | "back";
};

function runTimeline(
  rounds: RoundFixture[],
  tees: Tee[],
  holesByTee: Map<number, Hole[]>,
  initialHandicapIndex: number
): ProcessedRound[] {
  const processedRounds = rounds.map((r) =>
    stubRound(r.id, r.teeId, r.teeTime, r.approvalStatus ?? "approved")
  );
  const teeMap = new Map(tees.map((t) => [t.id as number, t]));
  const roundScoresMap = new Map(rounds.map((r) => [r.id, r.scores]));
  const nineHoleSections = new Map<number, "front" | "back">();
  for (const r of rounds) {
    if (r.nineHoleSection) nineHoleSections.set(r.id, r.nineHoleSection);
  }
  const inputs: TimelineInputs = {
    processedRounds,
    teeMap,
    roundScoresMap,
    holesMap: holesByTee,
    nineHoleSections,
    initialHandicapIndex,
  };
  return computeHandicapTimeline(inputs);
}

/**
 * Recomputes Pass 1's internal (uncapped) rolling-index sequence from the
 * returned `rawDifferential`s. This is NOT observable directly on the
 * returned `ProcessedRound[]` because Pass 2 overwrites
 * `updatedHandicapIndex` with the capped value — see CORRECTNESS-02 tests
 * at the bottom of this file.
 */
function pass1RollingIndexSequence(result: ProcessedRound[]): number[] {
  const raws = result.map((r) => r.rawDifferential);
  const seq: number[] = [];
  for (let i = 0; i < raws.length; i++) {
    const startIdx = Math.max(0, i - 19);
    seq.push(calculateHandicapIndex(raws.slice(startIdx, i + 1)));
  }
  return seq;
}

const TEE_B = makeTee(1); // rating 72.0 -> diffs are exactly extraStrokes (integer, exact FP)
const TEE_C = makeTee(3, { courseRating18: 72.9 }); // rating 72.9 -> diffs are extraStrokes - 0.9
const HOLES_B = makeHoles(1);
const HOLES_C = makeHoles(3);

// ---------------------------------------------------------------------
// 1. Rolling baseline: 25 rounds, best-8-of-20 window + fewer-than-20 table
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: rolling baseline (25 rounds)", () => {
  const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);
  // Differentials oscillate 12-18 around an initial index of 18.0 so ESR
  // never spuriously triggers from round 3 onward (see quirk note above
  // for why rounds 0-2 are contaminated regardless).
  const extrasPattern = [
    15, 14, 16, 13, 17, 12, 18, 15, 14, 16, 13, 17, 15, 14, 16, 15, 17, 14, 16,
    15, 14, 17, 13, 16, 15,
  ];
  const rounds: RoundFixture[] = extrasPattern.map((extra, i) => ({
    id: i + 1,
    teeId: TEE_B.id!,
    teeTime: day(i),
    scores: makeFullRoundScores(HOLES_B, i + 1, extra),
  }));
  const result = runTimeline(rounds, [TEE_B], holesByTee, 18.0);

  it("pins the exact esrOffset/finalDifferential/updatedHandicapIndex sequences", () => {
    expect(result.map((r) => r.esrOffset)).toEqual([
      4, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(result.map((r) => r.finalDifferential)).toEqual([
      11, 10, 14, 13, 17, 12, 18, 15, 14, 16, 13, 17, 15, 14, 16, 15, 17, 14,
      16, 15, 14, 17, 13, 16, 15,
    ]);
    const updated = result.map((r) => r.updatedHandicapIndex);
    const expectedUpdated = [
      54, 54, 8, 9, 10, 9.5, 10.5, 10.5, 11, 11, 11, 11.3, 11.3, 11.3, 11.4,
      11.4, 11.6, 11.6, 11.7, 11.8, 12, 12.3, 12.2, 12.3, 12.3,
    ];
    updated.forEach((v, i) => expect(v).toBeCloseTo(expectedUpdated[i], 5));
  });

  it("uses the fewer-than-20-rounds adjustment table as rounds accumulate", () => {
    // Round index 2 (3rd round): exactly 3 final differentials -> best-1
    // minus 2.0. finalDiffs so far = [11, 10, 14] -> best1 = 10 -> 8.0.
    expect(result[2].updatedHandicapIndex).toBeCloseTo(8.0, 5);
    // Round index 3 (4th round): exactly 4 final differentials -> best-1
    // minus 1.0. finalDiffs = [11, 10, 14, 13] -> best1 = 10 -> 9.0.
    expect(result[3].updatedHandicapIndex).toBeCloseTo(9.0, 5);
    // Round index 5 (6th round): exactly 6 final differentials -> best-2
    // avg minus 1.0. finalDiffs = [11,10,14,13,17,12] -> best2=[10,11]
    // avg 10.5 -> 9.5.
    expect(result[5].updatedHandicapIndex).toBeCloseTo(9.5, 5);
  });
});

// ---------------------------------------------------------------------
// 2. New player: initialHandicapIndex = 54, fewer than 3 rounds
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: brand-new player", () => {
  it("keeps the index at 54 for fewer than 3 rounds regardless of ESR", () => {
    const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);
    const rounds: RoundFixture[] = [0, 1].map((i) => ({
      id: i + 1,
      teeId: TEE_B.id!,
      teeTime: day(i),
      scores: makeFullRoundScores(HOLES_B, i + 1, 15),
    }));
    const result = runTimeline(rounds, [TEE_B], holesByTee, 54);

    // The <3-differentials guard in calculateHandicapIndex forces 54
    // regardless of the (spurious) ESR contamination on these rounds.
    expect(result.map((r) => r.updatedHandicapIndex)).toEqual([54, 54]);
    expect(result.map((r) => r.esrOffset)).toEqual([4, 2]);
  });
});

// ---------------------------------------------------------------------
// 3. ESR boundaries: exactly 6.9 (no offset), 7.0 (offset 1), 10.0 (offset 2)
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: ESR boundaries", () => {
  // 3 prior rounds on TEE_B, raw = 20.0 each (integer, exact FP) ->
  // Pass 1's rolling index after round 3 = best-1(20.0) - 2 = 18.0 exactly.
  function esrBoundaryCase(
    testTee: Tee,
    testHoles: Hole[],
    testExtra: number
  ): ProcessedRound[] {
    const holesByTee = new Map([
      [TEE_B.id!, HOLES_B],
      [TEE_C.id!, HOLES_C],
    ]);
    const rounds: RoundFixture[] = [
      { id: 1, teeId: TEE_B.id!, teeTime: day(0), scores: makeFullRoundScores(HOLES_B, 1, 20) },
      { id: 2, teeId: TEE_B.id!, teeTime: day(1), scores: makeFullRoundScores(HOLES_B, 2, 20) },
      { id: 3, teeId: TEE_B.id!, teeTime: day(2), scores: makeFullRoundScores(HOLES_B, 3, 20) },
      { id: 4, teeId: testTee.id!, teeTime: day(3), scores: makeFullRoundScores(testHoles, 4, testExtra) },
    ];
    return runTimeline(rounds, [TEE_B, TEE_C], holesByTee, 54);
  }

  it("does not trigger ESR when the rolling index is exactly 6.9 better", () => {
    // testDiff = 18.0 - 6.9 = 11.1 (TEE_C, rating 72.9, extraStrokes=12)
    const result = esrBoundaryCase(TEE_C, HOLES_C, 12);
    expect(pass1RollingIndexSequence(result)[2]).toBeCloseTo(18.0, 5);
    expect(result[3].rawDifferential).toBeCloseTo(11.1, 5);
    expect(result[3].esrOffset).toBe(0);
    expect(result[3].finalDifferential).toBeCloseTo(11.1, 5);
  });

  it("triggers ESR offset 1 when the rolling index is exactly 7.0 better", () => {
    // testDiff = 18.0 - 7.0 = 11.0 (TEE_B, extraStrokes=11)
    const result = esrBoundaryCase(TEE_B, HOLES_B, 11);
    expect(pass1RollingIndexSequence(result)[2]).toBeCloseTo(18.0, 5);
    expect(result[3].rawDifferential).toBe(11);
    expect(result[3].esrOffset).toBe(1);
    expect(result[3].finalDifferential).toBe(10);
  });

  it("triggers ESR offset 2 when the rolling index is exactly 10.0 better", () => {
    // testDiff = 18.0 - 10.0 = 8.0 (TEE_B, extraStrokes=8)
    const result = esrBoundaryCase(TEE_B, HOLES_B, 8);
    expect(pass1RollingIndexSequence(result)[2]).toBeCloseTo(18.0, 5);
    expect(result[3].rawDifferential).toBe(8);
    expect(result[3].esrOffset).toBe(2);
    expect(result[3].finalDifferential).toBe(6);
  });
});

// ---------------------------------------------------------------------
// 4. ESR stacking: two exceptional rounds inside one 20-round window
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: ESR stacking", () => {
  it("accumulates esrOffset on rounds that fall inside overlapping ESR windows", () => {
    const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);
    const rounds: RoundFixture[] = [
      { id: 1, teeId: TEE_B.id!, teeTime: day(0), scores: makeFullRoundScores(HOLES_B, 1, 20) },
      { id: 2, teeId: TEE_B.id!, teeTime: day(1), scores: makeFullRoundScores(HOLES_B, 2, 20) },
      { id: 3, teeId: TEE_B.id!, teeTime: day(2), scores: makeFullRoundScores(HOLES_B, 3, 20) },
      // Round index 3: rolling index (Pass 1) = 18.0, raw = 11.0 ->
      // difference 7.0 -> offset 1, applied to the whole window [0..3].
      { id: 4, teeId: TEE_B.id!, teeTime: day(3), scores: makeFullRoundScores(HOLES_B, 4, 11) },
      // Round index 4: a SECOND exceptional round vs. the new rolling
      // index -> offset 1, applied to the whole window [0..4].
      { id: 5, teeId: TEE_B.id!, teeTime: day(4), scores: makeFullRoundScores(HOLES_B, 5, 3) },
    ];
    const result = runTimeline(rounds, [TEE_B], holesByTee, 54);

    // Rounds 0-2 carry the inherent "first three rounds compare against a
    // rolling index of 54" contamination (documented at the top of this
    // file) PLUS both deliberate triggers below, since their ESR windows
    // both reach back to round 0. Round 3 (own trigger + round 4's
    // trigger) and round 4 (only its own trigger) show the stacking most
    // clearly: round 3's offset is one higher than the isolated
    // "offset 1" case in the ESR-boundary suite above, because round 4's
    // later trigger adds another +1 on top.
    expect(result.map((r) => r.esrOffset)).toEqual([8, 6, 4, 2, 1]);
    expect(pass1RollingIndexSequence(result)).toEqual([54, 54, 18, 10, 3]);
  });
});

// ---------------------------------------------------------------------
// 5. Cap interaction: soft cap engaging, then hard cap plateauing, with
//    prior ESR contamination already in the history.
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: soft/hard cap interaction (USGA Rule 5.7)", () => {
  it("engages the soft cap then plateaus at the hard cap as bad rounds accumulate", () => {
    const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);
    const rounds: RoundFixture[] = [];
    // 6 rounds establishing a low handicap index (~4.0, despite the usual
    // rounds-0-2 ESR contamination).
    for (let i = 0; i < 6; i++) {
      rounds.push({
        id: i + 1,
        teeId: TEE_B.id!,
        teeTime: day(i * 10),
        scores: makeFullRoundScores(HOLES_B, i + 1, 10),
      });
    }
    // 16 consecutive blow-up rounds: best-8-of-20 averaging is resistant to
    // a single bad round, so it takes a run of them to move the
    // uncapped calculated index far enough above the low index to engage
    // first the soft cap, then the hard cap.
    for (let i = 0; i < 16; i++) {
      rounds.push({
        id: i + 7,
        teeId: TEE_B.id!,
        teeTime: day(60 + i * 10),
        scores: makeFullRoundScores(HOLES_B, i + 7, 34),
      });
    }
    const result = runTimeline(rounds, [TEE_B], holesByTee, 10.0);

    // Low Handicap Index established at round index 2.
    expect(result[2].updatedHandicapIndex).toBeCloseTo(4.0, 5);

    // Soft cap engaging (rise > 3.0 above the 365-day low of 4.0): the
    // capped index rises much more slowly than the uncapped calculation
    // would (uncapped keeps climbing toward 34 as more bad rounds enter
    // the best-8 window; capped tracks low + softened increase).
    expect(result[11].updatedHandicapIndex).toBeCloseTo(7.3, 5);
    expect(result[16].updatedHandicapIndex).toBeCloseTo(7.7, 5);

    // Hard cap plateau: capped index cannot exceed low + 5.0 = 9.0, and
    // stays pinned there even as more blow-up rounds enter the window.
    expect(result[19].updatedHandicapIndex).toBeCloseTo(9.0, 5);
    expect(result[21].updatedHandicapIndex).toBeCloseTo(9.0, 5);

    // Confirm the hard cap is actually doing work: the UNCAPPED
    // calculation (recomputed from the same finalDifferentials) keeps
    // rising well past 9.0 while the returned (capped) value stays flat.
    const finals = result.map((r) => r.finalDifferential);
    const uncappedAt21 = calculateHandicapIndex(finals.slice(2, 22));
    expect(uncappedAt21).toBeGreaterThan(9.0 + 5); // well past the hard cap
  });
});

// ---------------------------------------------------------------------
// 6. Mixed 9-hole rounds (front and back) interleaved with 18-hole rounds
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: mixed 9-hole and 18-hole rounds", () => {
  it("pins the sequence for front-9/back-9/18-hole rounds interleaved", () => {
    const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);
    const rounds: RoundFixture[] = [
      { id: 1, teeId: TEE_B.id!, teeTime: day(0), scores: makeFullRoundScores(HOLES_B, 1, 15) },
      {
        id: 2,
        teeId: TEE_B.id!,
        teeTime: day(1),
        scores: makeNineHoleScores(HOLES_B, 2, "front", 8),
        nineHoleSection: "front",
      },
      { id: 3, teeId: TEE_B.id!, teeTime: day(2), scores: makeFullRoundScores(HOLES_B, 3, 16) },
      {
        id: 4,
        teeId: TEE_B.id!,
        teeTime: day(3),
        scores: makeNineHoleScores(HOLES_B, 4, "back", 7),
        nineHoleSection: "back",
      },
      { id: 5, teeId: TEE_B.id!, teeTime: day(4), scores: makeFullRoundScores(HOLES_B, 5, 14) },
    ];
    const result = runTimeline(rounds, [TEE_B], holesByTee, 18.0);

    // Note the 9-hole rounds' raw differentials are dominated by the
    // "expected differential" for the unplayed 9 holes, which itself
    // scales with existingHandicapIndex -- rounds 1 and 3 (0-indexed)
    // inherit the same rounds-0-2 rolling-index-reset-to-54 contamination
    // documented at the top of this file, which is why round index 1's
    // raw differential (35) looks disproportionate to its 8 extra
    // strokes played.
    expect(result.map((r) => r.rawDifferential)).toEqual([15, 35, 16, 14, 14]);
    expect(result.map((r) => r.esrOffset)).toEqual([4, 4, 2, 0, 0]);
    expect(result.map((r) => r.finalDifferential)).toEqual([11, 31, 14, 14, 14]);
    const updated = result.map((r) => r.updatedHandicapIndex);
    const expectedUpdated = [54, 54, 9, 10, 11];
    updated.forEach((v, i) => expect(v).toBeCloseTo(expectedUpdated[i], 5));

    // adjustedGrossScore/adjustedPlayedScore for the 9-hole rounds equal
    // the 9-hole adjusted played score, NOT an 18-hole-equivalent score.
    expect(result[1].adjustedPlayedScore).toBe(44);
    expect(result[3].adjustedPlayedScore).toBe(43);
  });
});

// ---------------------------------------------------------------------
// 7. Step 5: measuring CORRECTNESS-02 (NOT fixing it)
//
// The ESR check in Pass 1 compares a round's raw differential against
// `rollingIndex`, which is Pass 1's own UNCAPPED, running index (see
// `computeHandicapTimeline`'s doc comment). Pass 2 later applies
// soft/hard caps (USGA Rule 5.7) to produce the index that is actually
// shown to the user. These two indices can diverge significantly right
// after a capped blow-up round, and the ESR threshold check uses the
// uncapped one -- meaning a subsequent merely-average round can be
// flagged "exceptional" relative to an artificially-inflated index that
// the player never actually had.
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: CORRECTNESS-02 measurement (uncapped vs capped ESR basis)", () => {
  it("flags a round as exceptional against the uncapped index when it would NOT be exceptional against the capped index", () => {
    const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);
    const rounds: RoundFixture[] = [
      { id: 1, teeId: TEE_B.id!, teeTime: day(0), scores: makeFullRoundScores(HOLES_B, 1, 8) },
      { id: 2, teeId: TEE_B.id!, teeTime: day(1), scores: makeFullRoundScores(HOLES_B, 2, 8) },
      { id: 3, teeId: TEE_B.id!, teeTime: day(2), scores: makeFullRoundScores(HOLES_B, 3, 8) },
      { id: 4, teeId: TEE_B.id!, teeTime: day(3), scores: makeFullRoundScores(HOLES_B, 4, 8) },
      // Hard-cap-triggering blow-up round: Pass 1's uncapped rolling index
      // climbs to 8.0, but Pass 2 caps the DISPLAYED index at 3.0.
      { id: 5, teeId: TEE_B.id!, teeTime: day(4), scores: makeFullRoundScores(HOLES_B, 5, 36) },
      // A perfectly average round (raw differential 0.0, i.e. shot exactly
      // course rating). Relative to the UNCAPPED index (8.0) this is 8.0
      // strokes better -> flagged exceptional (offset 1). Relative to the
      // CAPPED/displayed index (3.0) it is only 3.0 strokes better -> would
      // NOT be exceptional under a hypothetical capped-comparison design.
      { id: 6, teeId: TEE_B.id!, teeTime: day(5), scores: makeFullRoundScores(HOLES_B, 6, 0) },
    ];
    const result = runTimeline(rounds, [TEE_B], holesByTee, 8.0);
    const pass1Seq = pass1RollingIndexSequence(result);

    // Pin what the function ACTUALLY does today: it triggers, because it
    // compares against the uncapped Pass-1 index.
    expect(pass1Seq[4]).toBeCloseTo(8.0, 5);
    expect(result[4].updatedHandicapIndex).toBeCloseTo(3.0, 5); // capped/displayed
    expect(result[5].rawDifferential).toBe(0);
    expect(result[5].esrOffset).toBe(1); // triggers, using the uncapped basis

    // Measurement only: had the check used the CAPPED index instead, it
    // would NOT have triggered (3.0 - 0.0 = 3.0 < 7). This is
    // CORRECTNESS-02 — recorded here, not fixed.
    const differenceVsUncapped = pass1Seq[4] - result[5].rawDifferential;
    const differenceVsCapped =
      result[4].updatedHandicapIndex - result[5].rawDifferential;
    expect(differenceVsUncapped).toBeGreaterThanOrEqual(7);
    expect(differenceVsCapped).toBeLessThan(7);
  });
});
