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
 * Plan 012 (2026-07) — DELIBERATE behavior change, re-pinned here: the
 * historical quirk where rounds 0-2 compared their score against Pass 1's
 * fewer-than-3-differentials placeholder rolling index of `54` (nearly
 * always tripping Exceptional Score Reduction with offset +2 on rounds
 * 0-2 of every player's history) is FIXED. The rule is now: **ESR requires
 * an established Handicap Index, i.e. >= 3 prior differentials — ESR
 * detection is skipped entirely for round indices 0-2**, regardless of
 * `difference` and regardless of any seeded `initialHandicapIndex`
 * (Decision A: seeds do not enable ESR). Rounds 0-2 can still RECEIVE
 * offsets via the trailing-window application of a later (i >= 3) round's
 * genuine ESR trigger — that is correct WHS behavior, not contamination.
 *
 * Residual quirk (still present, out of plan 012's scope): rounds 1-2
 * still use the `54` placeholder as `existingHandicapIndex` for course
 * handicap / NDB / 9-hole expected-differential purposes even when the
 * user seeded a real index — see the mixed 9-hole suite below.
 *
 * Pre-fix baseline, 2026-07 (recorded per plan 012 Step 1, before the
 * ESR gate landed; three 10-round probe fixtures, rating-72/slope-113
 * tee so rawDifferential === extra strokes):
 *
 *   Fixture 1 — default seed 54, bogey golf, raws
 *   [18,19,17,18,20,18,17,19,18,18]:
 *     esrOffset  [6,4,2,0,0,0,0,0,0,0]
 *     updatedHI  [54,54,10,11,12,12.5,13.3,13.3,13.5,13.5]
 *   Fixture 2 — seeded 12.0, ~12-handicap golf, raws
 *   [12,13,11,12,14,12,11,13,12,12]:
 *     esrOffset  [4,4,2,0,0,0,0,0,0,0]
 *     updatedHI  [54,54,6,7,8,7.5,8.5,8.5,8.7,8.7]
 *   Fixture 3 — seeded 12.0, genuinely exceptional round 5 (raw 3.0),
 *   raws [12,13,11,12,3,12,11,13,12,12]:
 *     esrOffset  [5,5,3,1,1,0,0,0,0,0]
 *     updatedHI  [54,54,5,6,2,3.5,4.5,4.5,5.4,5.4]
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

/**
 * Builds 18 hole scores summing to `72 - strokesUnderPar`: birdies on the
 * first `strokesUnderPar` holes, par everywhere else. Used by the
 * CORRECTNESS-02 measurement cases, which need under-par rounds to open a
 * wide gap between the raw differential and the rolling index.
 */
function makeUnderParRoundScores(
  holes: Hole[],
  roundId: number,
  strokesUnderPar: number
): Score[] {
  if (strokesUnderPar < 0 || strokesUnderPar > 18) {
    throw new Error("strokesUnderPar out of birdie-safe range (0-18)");
  }
  let remaining = strokesUnderPar;
  return holes.map((hole) => {
    const sub = remaining > 0 ? 1 : 0;
    remaining -= sub;
    return {
      id: scoreIdCounter++,
      roundId,
      holeId: hole.id,
      strokes: hole.par - sub,
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
  // never triggers from round 3 onward; since plan 012 rounds 0-2 are
  // ESR-ineligible, so NO round in this fixture carries an offset.
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
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(result.map((r) => r.finalDifferential)).toEqual([
      15, 14, 16, 13, 17, 12, 18, 15, 14, 16, 13, 17, 15, 14, 16, 15, 17, 14,
      16, 15, 14, 17, 13, 16, 15,
    ]);
    const updated = result.map((r) => r.updatedHandicapIndex);
    const expectedUpdated = [
      54, 54, 12, 12, 13, 11.5, 12.5, 12.5, 13, 13, 12.7, 13, 13, 13, 13.2,
      13.2, 13.3, 13.3, 13.4, 13.6, 13.5, 13.6, 13.4, 13.6, 13.6,
    ];
    updated.forEach((v, i) => expect(v).toBeCloseTo(expectedUpdated[i], 5));
  });

  it("uses the fewer-than-20-rounds adjustment table as rounds accumulate", () => {
    // Round index 2 (3rd round): exactly 3 final differentials -> best-1
    // minus 2.0. finalDiffs so far = [15, 14, 16] -> best1 = 14 -> 12.0.
    expect(result[2].updatedHandicapIndex).toBeCloseTo(12.0, 5);
    // Round index 3 (4th round): exactly 4 final differentials -> best-1
    // minus 1.0. finalDiffs = [15, 14, 16, 13] -> best1 = 13 -> 12.0.
    expect(result[3].updatedHandicapIndex).toBeCloseTo(12.0, 5);
    // Round index 5 (6th round): exactly 6 final differentials -> best-2
    // avg minus 1.0. finalDiffs = [15,14,16,13,17,12] -> best2=[12,13]
    // avg 12.5 -> 11.5.
    expect(result[5].updatedHandicapIndex).toBeCloseTo(11.5, 5);
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

    // The <3-differentials guard in calculateHandicapIndex forces 54, and
    // since plan 012 rounds 0-2 are ESR-ineligible, so no offsets either.
    expect(result.map((r) => r.updatedHandicapIndex)).toEqual([54, 54]);
    expect(result.map((r) => r.esrOffset)).toEqual([0, 0]);
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

    // Since plan 012 rounds 0-2 trigger nothing of their own; every offset
    // below comes from the two deliberate triggers at round indices 3 and
    // 4, whose ESR windows both reach back to round 0. Round 3 (own
    // trigger + round 4's trigger) and round 4 (only its own trigger)
    // show the stacking: round 3's offset is one higher than the isolated
    // "offset 1" case in the ESR-boundary suite above, because round 4's
    // later trigger adds another +1 on top.
    expect(result.map((r) => r.esrOffset)).toEqual([2, 2, 2, 2, 1]);
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
    // 6 rounds establishing a low handicap index (8.0 — no ESR offsets
    // anywhere in this fixture since plan 012 removed the rounds-0-2
    // contamination and no round here is exceptional).
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
    expect(result[2].updatedHandicapIndex).toBeCloseTo(8.0, 5);

    // Best-8-of-20 resistance: while the 6 good (diff 10) rounds remain
    // in the 20-round window they fully populate the best-N selection, so
    // the index holds at 10.0 through round index 17 despite the blow-ups.
    expect(result[11].updatedHandicapIndex).toBeCloseTo(10.0, 5);
    expect(result[16].updatedHandicapIndex).toBeCloseTo(10.0, 5);

    // Soft cap engaging at round index 18 (uncapped calculation 13.4 is
    // more than 3.0 above the 365-day low of 8.0): 11.0 + 0.5*(13.4-11.0)
    // = 12.2.
    expect(result[18].updatedHandicapIndex).toBeCloseTo(12.2, 5);

    // Hard cap plateau: capped index cannot exceed low + 5.0 = 13.0, and
    // stays pinned there even as more blow-up rounds enter the window.
    expect(result[19].updatedHandicapIndex).toBeCloseTo(13.0, 5);
    expect(result[21].updatedHandicapIndex).toBeCloseTo(13.0, 5);

    // Confirm the hard cap is actually doing work: the UNCAPPED
    // calculation (recomputed from the same finalDifferentials) keeps
    // rising well past 13.0 while the returned (capped) value stays flat.
    const finals = result.map((r) => r.finalDifferential);
    const uncappedAt21 = calculateHandicapIndex(finals.slice(2, 22));
    expect(uncappedAt21).toBeGreaterThan(13.0 + 5); // well past the hard cap
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
    // scales with existingHandicapIndex -- and rounds 1-2 still use the
    // 54 placeholder as their rolling existingHandicapIndex (the residual
    // quirk documented at the top of this file; NOT fixed by plan 012),
    // which is why round index 1's raw differential (35) looks
    // disproportionate to its 8 extra strokes played. Plan 012 removed
    // the ESR offsets those placeholder comparisons used to generate, but
    // not the placeholder's effect on the 9-hole expected differential.
    expect(result.map((r) => r.rawDifferential)).toEqual([15, 35, 16, 14, 14]);
    expect(result.map((r) => r.esrOffset)).toEqual([0, 0, 0, 0, 0]);
    expect(result.map((r) => r.finalDifferential)).toEqual([15, 35, 16, 14, 14]);
    const updated = result.map((r) => r.updatedHandicapIndex);
    const expectedUpdated = [54, 54, 13, 13, 14];
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
// shown to the user. These two indices can diverge right after a capped
// blow-up round, and the ESR threshold check uses the uncapped one --
// meaning a subsequent good round can be treated as more exceptional
// than the player's displayed index implies.
//
// Plan 012 re-pin note: before plan 012, the rounds-0-2 ESR contamination
// depressed these fixtures' early finalDifferentials, which dragged the
// Low Handicap Index (and thus the capped basis) far below the uncapped
// one — most of the dramatic pre-fix divergence (e.g. capped 3.0 vs
// uncapped 8.0) was an artifact of that contamination. With the gate in
// place the gap in these short fixtures narrows: the first two cases now
// measure a boundary/severity relationship rather than a trigger/no-
// trigger flip, and the third still shows a genuine severity flip.
// CORRECTNESS-02 (Decision B of plan 012) remains deliberately unfixed;
// its largest remaining effect requires >20-round histories where good
// rounds age out of the window while caps pin the displayed index.
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: CORRECTNESS-02 measurement (uncapped vs capped ESR basis)", () => {
  it("uses the uncapped Pass-1 index as the ESR basis, diverging from the capped/displayed index", () => {
    const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);
    const rounds: RoundFixture[] = [
      { id: 1, teeId: TEE_B.id!, teeTime: day(0), scores: makeFullRoundScores(HOLES_B, 1, 8) },
      { id: 2, teeId: TEE_B.id!, teeTime: day(1), scores: makeFullRoundScores(HOLES_B, 2, 8) },
      { id: 3, teeId: TEE_B.id!, teeTime: day(2), scores: makeFullRoundScores(HOLES_B, 3, 8) },
      { id: 4, teeId: TEE_B.id!, teeTime: day(3), scores: makeFullRoundScores(HOLES_B, 4, 8) },
      // Hard-cap-triggering blow-up round: Pass 1's uncapped rolling index
      // climbs to 8.0, but Pass 2 caps the DISPLAYED index at 7.0.
      { id: 5, teeId: TEE_B.id!, teeTime: day(4), scores: makeFullRoundScores(HOLES_B, 5, 36) },
      // A perfectly average round (raw differential 0.0, i.e. shot exactly
      // course rating). Relative to the UNCAPPED index (8.0) this is 8.0
      // strokes better -> flagged exceptional (offset 1). The capped/
      // displayed basis (7.0) lands exactly AT the 7.0 threshold for this
      // fixture — pre-plan-012 it sat at 3.0 (a trigger/no-trigger flip),
      // but that gap was mostly the rounds-0-2 contamination dragging the
      // Low Handicap Index down. Recorded, not fixed (CORRECTNESS-02).
      { id: 6, teeId: TEE_B.id!, teeTime: day(5), scores: makeFullRoundScores(HOLES_B, 6, 0) },
    ];
    const result = runTimeline(rounds, [TEE_B], holesByTee, 8.0);
    const pass1Seq = pass1RollingIndexSequence(result);

    // Pin what the function ACTUALLY does today: it triggers, because it
    // compares against the uncapped Pass-1 index.
    expect(pass1Seq[4]).toBeCloseTo(8.0, 5);
    expect(result[4].updatedHandicapIndex).toBeCloseTo(7.0, 5); // capped/displayed
    expect(result[5].rawDifferential).toBe(0);
    expect(result[5].esrOffset).toBe(1); // triggers, using the uncapped basis
    expect(result.map((r) => r.esrOffset)).toEqual([1, 1, 1, 1, 1, 1]);

    // Measurement only: the uncapped basis clears the threshold with room
    // to spare (8.0 >= 7) while the capped basis sits exactly on the
    // boundary (7.0) — the bases still disagree, just no longer by enough
    // to flip detection in this short fixture. CORRECTNESS-02, recorded
    // here, not fixed.
    const differenceVsUncapped = pass1Seq[4] - result[5].rawDifferential;
    const differenceVsCapped =
      result[4].updatedHandicapIndex - result[5].rawDifferential;
    expect(differenceVsUncapped).toBeGreaterThanOrEqual(7);
    expect(differenceVsCapped).toBeCloseTo(7.0, 5);
    expect(differenceVsUncapped).toBeGreaterThan(differenceVsCapped);
  });

  // Shared fixture for the two severity-flip cases below: same 5-round
  // history as above (4 steady rounds of raw 8, then a hard-cap-triggering
  // blow-up of raw 36), followed by an UNDER-PAR round 6 whose raw
  // differential is chosen per case.
  //
  // Measurement caveat (applies to both cases): the "capped" comparison
  // value `result[4].updatedHandicapIndex` is recomputed by Pass 2 AFTER
  // round 6's own ESR offset has already adjusted rounds 0-4's final
  // differentials (Pass 1 writes offsets into the whole trailing window
  // before Pass 2 runs). So it is not literally "the capped index the
  // player had before teeing off on round 6" — it is the closest value
  // observable on the function's output, and here it lands at 6.0 (vs 7.0
  // in the average-round case above, where round 6's offset was only 1).
  function severityFlipFixture(round6Scores: Score[]): ProcessedRound[] {
    const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);
    const rounds: RoundFixture[] = [
      { id: 1, teeId: TEE_B.id!, teeTime: day(0), scores: makeFullRoundScores(HOLES_B, 1, 8) },
      { id: 2, teeId: TEE_B.id!, teeTime: day(1), scores: makeFullRoundScores(HOLES_B, 2, 8) },
      { id: 3, teeId: TEE_B.id!, teeTime: day(2), scores: makeFullRoundScores(HOLES_B, 3, 8) },
      { id: 4, teeId: TEE_B.id!, teeTime: day(3), scores: makeFullRoundScores(HOLES_B, 4, 8) },
      { id: 5, teeId: TEE_B.id!, teeTime: day(4), scores: makeFullRoundScores(HOLES_B, 5, 36) },
      { id: 6, teeId: TEE_B.id!, teeTime: day(5), scores: round6Scores },
    ];
    return runTimeline(rounds, [TEE_B], holesByTee, 8.0);
  }

  it("applies offset 2 against the uncapped index; the capped basis now agrees on severity for this fixture (pre-012 it flipped)", () => {
    // 5-under round: raw differential -5. Uncapped basis: 8.0 - (-5) = 13
    // >= 10 -> offset 2 (what production does). Capped basis:
    // 6.0 - (-5) = 11 -> also >= 10, so post-plan-012 both bases land on
    // offset 2 here. (Pre-012 the contaminated capped basis was 2.0,
    // giving 7 -> a severity flip; that flip was contamination-driven.
    // The 2-under case below still shows a genuine severity flip.)
    const result = severityFlipFixture(makeUnderParRoundScores(HOLES_B, 6, 5));
    const pass1Seq = pass1RollingIndexSequence(result);

    expect(pass1Seq[4]).toBeCloseTo(8.0, 5);
    expect(result[4].updatedHandicapIndex).toBeCloseTo(6.0, 5);
    expect(result[5].rawDifferential).toBe(-5);
    expect(result[5].esrOffset).toBe(2); // production: offset 2 (uncapped basis)
    expect(result.map((r) => r.esrOffset)).toEqual([2, 2, 2, 2, 2, 2]);

    const differenceVsUncapped = pass1Seq[4] - result[5].rawDifferential;
    const differenceVsCapped =
      result[4].updatedHandicapIndex - result[5].rawDifferential;
    expect(differenceVsUncapped).toBeGreaterThanOrEqual(10); // -> offset 2
    expect(differenceVsCapped).toBeGreaterThanOrEqual(10); // agrees post-012
    expect(differenceVsUncapped).toBeGreaterThan(differenceVsCapped);
  });

  it("applies offset 2 against the uncapped index where the capped index would imply only offset 1 (severity flip)", () => {
    // 2-under round: raw differential -2. Uncapped basis: 8.0 - (-2) = 10
    // >= 10 -> offset 2 (what production does). Capped basis:
    // 6.0 - (-2) = 8 -> >= 7 but < 10, so a capped-comparison design
    // would apply offset 1, not 2. Detection agrees; SEVERITY flips.
    // This is the live CORRECTNESS-02 divergence remaining in these
    // short fixtures after plan 012. (Pre-012 the contaminated capped
    // basis was 2.0, giving 4 -> no trigger at all.)
    const result = severityFlipFixture(makeUnderParRoundScores(HOLES_B, 6, 2));
    const pass1Seq = pass1RollingIndexSequence(result);

    expect(pass1Seq[4]).toBeCloseTo(8.0, 5);
    expect(result[4].updatedHandicapIndex).toBeCloseTo(6.0, 5);
    expect(result[5].rawDifferential).toBe(-2);
    expect(result[5].esrOffset).toBe(2); // production: offset 2 (uncapped basis)
    expect(result.map((r) => r.esrOffset)).toEqual([2, 2, 2, 2, 2, 2]);

    const differenceVsUncapped = pass1Seq[4] - result[5].rawDifferential;
    const differenceVsCapped =
      result[4].updatedHandicapIndex - result[5].rawDifferential;
    expect(differenceVsUncapped).toBeGreaterThanOrEqual(10); // -> offset 2
    expect(differenceVsCapped).toBeGreaterThanOrEqual(7); // would still trigger...
    expect(differenceVsCapped).toBeLessThan(10); // ...but only at offset 1
  });
});

// ---------------------------------------------------------------------
// 8. Plan 012: ESR requires an established index (>= 3 prior differentials)
//
// WHS Rule 5.9: ESR exists to catch a player beating THEIR ESTABLISHED
// index by 7+. With fewer than 3 differentials there is no established
// index — the 54 that calculateHandicapIndex returns is a display
// placeholder, not a comparison basis — so ESR detection is skipped
// entirely for round indices 0-2 (Decision A: even a seeded real
// initialHandicapIndex does not make rounds 0-2 eligible).
// ---------------------------------------------------------------------
describe("computeHandicapTimeline: ESR established-index gate (plan 012)", () => {
  const holesByTee = new Map([[TEE_B.id!, HOLES_B]]);

  it("never applies ESR offsets on rounds 0-2, even with difference >= 10", () => {
    // Three even-par rounds (raw differential 0) for a default-seeded
    // (54) player: every round beats the pre-012 comparison basis by 54
    // strokes — far past the offset-2 threshold — yet none may fire.
    const rounds: RoundFixture[] = [0, 1, 2].map((i) => ({
      id: i + 1,
      teeId: TEE_B.id!,
      teeTime: day(i),
      scores: makeFullRoundScores(HOLES_B, i + 1, 0),
    }));
    const result = runTimeline(rounds, [TEE_B], holesByTee, 54);

    expect(result.map((r) => r.rawDifferential)).toEqual([0, 0, 0]);
    expect(result.map((r) => r.esrOffset)).toEqual([0, 0, 0]);
    expect(result.map((r) => r.finalDifferential)).toEqual([0, 0, 0]);
  });

  it("still triggers ESR at round index 3 (first eligible) at both the 7.0 and 10.0 boundaries", () => {
    // 3 setup rounds of raw 20.0 -> Pass 1 rolling index entering round
    // index 3 is best-1(20.0) - 2 = 18.0 exactly (same construction as
    // the ESR-boundaries suite above).
    function firstEligibleCase(testExtra: number): ProcessedRound[] {
      const rounds: RoundFixture[] = [
        { id: 1, teeId: TEE_B.id!, teeTime: day(0), scores: makeFullRoundScores(HOLES_B, 1, 20) },
        { id: 2, teeId: TEE_B.id!, teeTime: day(1), scores: makeFullRoundScores(HOLES_B, 2, 20) },
        { id: 3, teeId: TEE_B.id!, teeTime: day(2), scores: makeFullRoundScores(HOLES_B, 3, 20) },
        { id: 4, teeId: TEE_B.id!, teeTime: day(3), scores: makeFullRoundScores(HOLES_B, 4, testExtra) },
      ];
      return runTimeline(rounds, [TEE_B], holesByTee, 54);
    }

    // difference = 18.0 - 11.0 = 7.0 -> offset 1, applied across the
    // trailing window [0..3] (window application into rounds 0-2 from an
    // ELIGIBLE round's trigger is correct and unaffected by the gate).
    const offset1 = firstEligibleCase(11);
    expect(offset1[3].rawDifferential).toBe(11);
    expect(offset1.map((r) => r.esrOffset)).toEqual([1, 1, 1, 1]);

    // difference = 18.0 - 8.0 = 10.0 -> offset 2 across [0..3].
    const offset2 = firstEligibleCase(8);
    expect(offset2[3].rawDifferential).toBe(8);
    expect(offset2.map((r) => r.esrOffset)).toEqual([2, 2, 2, 2]);
  });

  it("seeded player with a genuinely exceptional round 5 keeps that ESR; rounds 0-2 trigger nothing of their own", () => {
    // Step-1 probe fixture 3: seeded 12.0, ~12-handicap golf, round
    // index 4 exceptional (raw 3.0). Pass 1 rolling index entering round
    // index 4 is best-1([12,13,11,12]) - 1 = 10.0; difference = 10.0 -
    // 3.0 = 7.0 -> offset 1 across the window [0..4]. The offsets on
    // rounds 0-3 are solely that window application — pre-012 the same
    // fixture carried [5,5,3,1,1] from rounds 0-2's own spurious
    // placeholder-basis triggers.
    const extras = [12, 13, 11, 12, 3, 12, 11, 13, 12, 12];
    const rounds: RoundFixture[] = extras.map((extra, i) => ({
      id: i + 1,
      teeId: TEE_B.id!,
      teeTime: day(i),
      scores: makeFullRoundScores(HOLES_B, i + 1, extra),
    }));
    const result = runTimeline(rounds, [TEE_B], holesByTee, 12.0);

    expect(result[4].rawDifferential).toBe(3);
    expect(result[4].esrOffset).toBe(1); // the genuine ESR is preserved
    expect(result.map((r) => r.esrOffset)).toEqual([
      1, 1, 1, 1, 1, 0, 0, 0, 0, 0,
    ]);
    expect(result.map((r) => r.finalDifferential)).toEqual([
      11, 12, 10, 11, 2, 12, 11, 13, 12, 12,
    ]);
    const updated = result.map((r) => r.updatedHandicapIndex);
    const expectedUpdated = [54, 54, 8, 9, 2, 5, 5.5, 5.5, 6.4, 6.4];
    updated.forEach((v, i) => expect(v).toBeCloseTo(expectedUpdated[i], 5));
  });
});
