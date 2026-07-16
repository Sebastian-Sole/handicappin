/**
 * Shot-level detail through the live session (plan 013, phase 5): the
 * HOLE_DETAIL_SET transition, detail preservation across SCORE_SET,
 * the `detailed` session flag, codec round-trip/back-compat, and the
 * to-scorecard payload rules (detail only for detailed rounds; score-only
 * payloads byte-identical to pre-013).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEvent,
  startSession,
  MAX_PENALTIES,
  MAX_PUTTS,
} from "../../lib/round-session/engine";
import { decodeSession, encodeSession } from "../../lib/round-session/codec";
import { toScorecardInput } from "../../lib/round-session/to-scorecard";
import type { RoundSession } from "../../lib/round-session/types";
import { makeSessionCourse, makeTee, T0 } from "./round-session-fixtures";

const start = (detailed = true): RoundSession =>
  startSession({
    id: "s-1",
    userId: "u-1",
    course: makeSessionCourse(),
    tee: makeTee(),
    holeCount: 18,
    detailed,
    now: T0,
  });

const detailEvent = (
  patch: Partial<{
    putts: number | null;
    fairwayHit: boolean | null;
    penaltyStrokes: number | null;
  }>,
  holeIndex = 0,
) => ({
  type: "HOLE_DETAIL_SET" as const,
  holeIndex,
  ...patch,
  at: T0,
});

describe("startSession detailed flag", () => {
  it("stores detailed=true and omits the key when false", () => {
    assert.equal(start(true).detailed, true);
    assert.equal("detailed" in start(false), false);
  });
});

describe("applyEvent / HOLE_DETAIL_SET", () => {
  it("sets present fields and leaves absent fields unchanged", () => {
    let s = start();
    s = applyEvent(s, detailEvent({ putts: 2 }));
    s = applyEvent(s, detailEvent({ fairwayHit: true }));
    assert.equal(s.entries[0].putts, 2);
    assert.equal(s.entries[0].fairwayHit, true);
    assert.equal(s.entries[0].penaltyStrokes ?? null, null);
    assert.equal(s.eventSeq, 2);
  });

  it("null clears a previously set field", () => {
    let s = start();
    s = applyEvent(s, detailEvent({ putts: 3 }));
    s = applyEvent(s, detailEvent({ putts: null }));
    assert.equal(s.entries[0].putts, null);
    assert.equal(s.eventSeq, 2);
  });

  it("no-ops (same reference) when nothing changes", () => {
    let s = start();
    s = applyEvent(s, detailEvent({ putts: 2 }));
    const again = applyEvent(s, detailEvent({ putts: 2 }));
    assert.equal(again, s);
    // Clearing an already-unset field is also a no-op.
    const clearUnset = applyEvent(s, detailEvent({ fairwayHit: null }));
    assert.equal(clearUnset, s);
  });

  it("clamps and rounds numeric fields, ignores non-finite values", () => {
    let s = start();
    s = applyEvent(s, detailEvent({ putts: 99 }));
    assert.equal(s.entries[0].putts, MAX_PUTTS);
    s = applyEvent(s, detailEvent({ penaltyStrokes: -3 }));
    assert.equal(s.entries[0].penaltyStrokes, 0);
    s = applyEvent(s, detailEvent({ putts: 2.6 }));
    assert.equal(s.entries[0].putts, 3);
    const before = s;
    s = applyEvent(s, detailEvent({ putts: Number.NaN }));
    assert.equal(s, before);
    s = applyEvent(s, detailEvent({ penaltyStrokes: MAX_PENALTIES + 5 }));
    assert.equal(s.entries[0].penaltyStrokes, MAX_PENALTIES);
  });

  it("rejects out-of-range holes and non-active sessions", () => {
    const s = start();
    assert.equal(applyEvent(s, detailEvent({ putts: 2 }, 18)), s);
    const finishing = applyEvent(s, { type: "FINISH_STARTED", at: T0 });
    assert.equal(
      applyEvent(finishing, detailEvent({ putts: 2 })),
      finishing,
    );
  });
});

describe("detail consistency rule (putts + penalties ≤ strokes − 1)", () => {
  it("bounds incoming detail against a scored hole (putts keep priority)", () => {
    let s = start();
    s = applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: 4, at: T0 });
    s = applyEvent(s, detailEvent({ putts: 4, penaltyStrokes: 2 }));
    assert.equal(s.entries[0].putts, 3);
    assert.equal(s.entries[0].penaltyStrokes, 0);
  });

  it("re-fits existing detail when the score is edited down", () => {
    let s = start();
    s = applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: 5, at: T0 });
    s = applyEvent(s, detailEvent({ putts: 4 }));
    s = applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: 4, at: T0 });
    assert.equal(s.entries[0].putts, 3);
  });

  it("leaves unscored holes unbounded (detail can land before the score)", () => {
    let s = start();
    s = applyEvent(s, detailEvent({ putts: 6, penaltyStrokes: 3 }));
    assert.equal(s.entries[0].putts, 6);
    assert.equal(s.entries[0].penaltyStrokes, 3);
  });
});

describe("detail vs score transitions", () => {
  it("SCORE_SET preserves captured detail; SCORE_CLEARED wipes it", () => {
    let s = start();
    s = applyEvent(s, detailEvent({ putts: 2, fairwayHit: false }));
    s = applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: 5, at: T0 });
    assert.equal(s.entries[0].strokes, 5);
    assert.equal(s.entries[0].putts, 2);
    assert.equal(s.entries[0].fairwayHit, false);

    // Re-scoring keeps the detail too.
    s = applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: 6, at: T0 });
    assert.equal(s.entries[0].putts, 2);

    s = applyEvent(s, { type: "SCORE_CLEARED", holeIndex: 0, at: T0 });
    assert.equal(s.entries[0].strokes, null);
    assert.equal(s.entries[0].putts ?? null, null);
    assert.equal(s.entries[0].fairwayHit ?? null, null);
  });
});

describe("codec round-trip and back-compat", () => {
  it("round-trips detail fields and the detailed flag", () => {
    let s = start();
    s = applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: 5, at: T0 });
    s = applyEvent(
      s,
      detailEvent({ putts: 2, fairwayHit: true, penaltyStrokes: 1 }),
    );
    const decoded = decodeSession(encodeSession(s));
    assert.ok(decoded);
    assert.equal(decoded.detailed, true);
    assert.equal(decoded.entries[0].putts, 2);
    assert.equal(decoded.entries[0].fairwayHit, true);
    assert.equal(decoded.entries[0].penaltyStrokes, 1);
  });

  it("decodes pre-013 payloads (no detailed key, no detail fields)", () => {
    const legacy = startSession({
      id: "s-legacy",
      userId: "u-1",
      course: makeSessionCourse(),
      tee: makeTee(),
      holeCount: 18,
      now: T0,
    });
    const raw = encodeSession(legacy);
    assert.equal(raw.includes("detailed"), false);
    const decoded = decodeSession(raw);
    assert.ok(decoded);
    assert.equal(decoded.detailed ?? false, false);
  });
});

describe("toScorecardInput detail rules", () => {
  const scoreAll = (s: RoundSession): RoundSession => {
    for (let i = 0; i < s.holeCount; i += 1) {
      s = applyEvent(s, {
        type: "SCORE_SET",
        holeIndex: i,
        strokes: 5,
        at: T0,
      });
    }
    return s;
  };

  it("detailed round: detail rides along, penalties default to 0", () => {
    let s = start(true);
    s = scoreAll(s);
    s = applyEvent(s, detailEvent({ putts: 2, fairwayHit: true }, 0));
    s = applyEvent(s, detailEvent({ penaltyStrokes: 2 }, 3));
    const payload = toScorecardInput(s, { teeTime: T0, submitAs: "18" });
    assert.deepEqual(payload.scores[0], {
      strokes: 5,
      hcpStrokes: 0,
      putts: 2,
      fairwayHit: true,
      penaltyStrokes: 0,
    });
    // Hole 4 recorded only penalties: putts/fairway keys OMITTED entirely.
    assert.deepEqual(payload.scores[3], {
      strokes: 5,
      hcpStrokes: 0,
      penaltyStrokes: 2,
    });
    assert.equal("putts" in payload.scores[3], false);
    assert.equal("fairwayHit" in payload.scores[3], false);
  });

  it("scores-only round: payload byte-identical to pre-013 (no detail keys)", () => {
    let s = start(false);
    s = scoreAll(s);
    // Detail sneaking in through the reducer must STILL be stripped.
    s = applyEvent(s, detailEvent({ putts: 2 }, 0));
    const payload = toScorecardInput(s, { teeTime: T0, submitAs: "18" });
    for (const score of payload.scores) {
      assert.deepEqual(score, { strokes: 5, hcpStrokes: 0 });
    }
  });

  it("front-9 submit of a detailed 18-hole session slices detail with it", () => {
    let s = start(true);
    for (let i = 0; i < 9; i += 1) {
      s = applyEvent(s, {
        type: "SCORE_SET",
        holeIndex: i,
        strokes: 4,
        at: T0,
      });
    }
    s = applyEvent(s, detailEvent({ putts: 1 }, 8));
    const payload = toScorecardInput(s, { teeTime: T0, submitAs: "front9" });
    assert.equal(payload.scores.length, 9);
    assert.equal(payload.scores[8].putts, 1);
    assert.equal(payload.nineHoleSection, "front");
  });
});
