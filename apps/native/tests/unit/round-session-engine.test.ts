/** Unit tests — round-session pure reducer (engine.ts). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEvent,
  nextHoleAfterScore,
  startSession,
} from "../../lib/round-session/engine";
import type { RoundSession } from "../../lib/round-session/types";
import { makeSessionCourse, makeTee, T0 } from "./round-session-fixtures";

const start = (holeCount: 9 | 18 = 18, section?: "front" | "back") =>
  startSession({
    id: "session-1",
    userId: "user-1",
    course: makeSessionCourse(),
    tee: makeTee(),
    holeCount,
    nineHoleSection: holeCount === 9 ? (section ?? "front") : undefined,
    now: T0,
  });

const at = "2026-07-06T10:05:00.000Z";

describe("startSession", () => {
  it("initializes an 18-hole session", () => {
    const s = start();
    assert.equal(s.status, "active");
    assert.equal(s.eventSeq, 0);
    assert.equal(s.entries.length, 18);
    assert.ok(s.entries.every((e) => e.strokes === null));
    assert.equal(s.displayedHoles.length, 18);
    assert.equal(s.currentHoleIndex, 0);
  });

  it("freezes back-nine displayed holes with normalized hcp", () => {
    const s = start(9, "back");
    assert.equal(s.entries.length, 9);
    assert.deepEqual(
      s.displayedHoles.map((h) => h.holeNumber),
      [10, 11, 12, 13, 14, 15, 16, 17, 18],
    );
    // USGA 5.1b: nine-hole stroke indexes re-mapped onto 1–9.
    assert.deepEqual(
      [...s.displayedHoles.map((h) => h.hcp)].sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
  });

  it("requires a section for 9-hole sessions", () => {
    assert.throws(() =>
      startSession({
        id: "s",
        userId: "u",
        course: makeSessionCourse(),
        tee: makeTee(),
        holeCount: 9,
        now: T0,
      }),
    );
  });
});

describe("applyEvent / SCORE_SET", () => {
  it("records a score and bumps eventSeq", () => {
    const s = applyEvent(start(), {
      type: "SCORE_SET",
      holeIndex: 0,
      strokes: 5,
      at,
    });
    assert.equal(s.entries[0]?.strokes, 5);
    assert.equal(s.eventSeq, 1);
    assert.equal(s.lastEventAt, at);
  });

  it("is idempotent: identical score returns the SAME reference", () => {
    const s1 = applyEvent(start(), {
      type: "SCORE_SET",
      holeIndex: 3,
      strokes: 4,
      at,
    });
    const s2 = applyEvent(s1, {
      type: "SCORE_SET",
      holeIndex: 3,
      strokes: 4,
      at: "2026-07-06T10:06:00.000Z",
    });
    assert.equal(s1, s2);
    assert.equal(s2.eventSeq, 1);
  });

  it("rejects non-finite strokes (same reference, nothing persisted)", () => {
    const s = start();
    assert.equal(
      applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: NaN, at }),
      s,
    );
    assert.equal(
      applyEvent(s, {
        type: "SCORE_SET",
        holeIndex: 0,
        strokes: Infinity,
        at,
      }),
      s,
    );
  });

  it("clamps strokes to 1..30", () => {
    const low = applyEvent(start(), {
      type: "SCORE_SET",
      holeIndex: 0,
      strokes: 0,
      at,
    });
    assert.equal(low.entries[0]?.strokes, 1);
    const high = applyEvent(start(), {
      type: "SCORE_SET",
      holeIndex: 0,
      strokes: 99,
      at,
    });
    assert.equal(high.entries[0]?.strokes, 30);
  });

  it("ignores out-of-range holes and non-active sessions", () => {
    const s = start();
    assert.equal(
      applyEvent(s, { type: "SCORE_SET", holeIndex: 18, strokes: 4, at }),
      s,
    );
    const finishing = applyEvent(s, { type: "FINISH_STARTED", at });
    assert.equal(
      applyEvent(finishing, {
        type: "SCORE_SET",
        holeIndex: 0,
        strokes: 4,
        at,
      }),
      finishing,
    );
  });
});

describe("applyEvent / lifecycle", () => {
  it("walks active → finishing → submitted and rejects invalid jumps", () => {
    const s = start();
    // SUBMITTED straight from active is rejected.
    assert.equal(applyEvent(s, { type: "SUBMITTED", at }), s);
    const finishing = applyEvent(s, { type: "FINISH_STARTED", at });
    assert.equal(finishing.status, "finishing");
    // Double FINISH_STARTED is a no-op (double-submit gate).
    assert.equal(applyEvent(finishing, { type: "FINISH_STARTED", at }), finishing);
    const back = applyEvent(finishing, { type: "FINISH_CANCELLED", at });
    assert.equal(back.status, "active");
    const submitted = applyEvent(
      applyEvent(back, { type: "FINISH_STARTED", at }),
      { type: "SUBMITTED", at },
    );
    assert.equal(submitted.status, "submitted");
    // Terminal: nothing moves a submitted session.
    assert.equal(
      applyEvent(submitted, { type: "FINISH_CANCELLED", at }),
      submitted,
    );
  });

  it("eventSeq increases monotonically across accepted events", () => {
    let s: RoundSession = start();
    const seqs = [s.eventSeq];
    s = applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: 4, at });
    seqs.push(s.eventSeq);
    s = applyEvent(s, { type: "HOLE_SELECTED", holeIndex: 5, at });
    seqs.push(s.eventSeq);
    s = applyEvent(s, { type: "NOTES_SET", notes: "windy", at });
    seqs.push(s.eventSeq);
    assert.deepEqual(seqs, [0, 1, 2, 3]);
  });
});

describe("SCORE_CLEARED and HOLE_SELECTED", () => {
  it("clears a score; clearing an empty hole is a no-op", () => {
    const scored = applyEvent(start(), {
      type: "SCORE_SET",
      holeIndex: 2,
      strokes: 6,
      at,
    });
    const cleared = applyEvent(scored, {
      type: "SCORE_CLEARED",
      holeIndex: 2,
      at,
    });
    assert.equal(cleared.entries[2]?.strokes, null);
    assert.equal(applyEvent(cleared, { type: "SCORE_CLEARED", holeIndex: 2, at }), cleared);
  });

  it("moves the cursor; same index is a no-op", () => {
    const s = start();
    const moved = applyEvent(s, { type: "HOLE_SELECTED", holeIndex: 7, at });
    assert.equal(moved.currentHoleIndex, 7);
    assert.equal(applyEvent(moved, { type: "HOLE_SELECTED", holeIndex: 7, at }), moved);
  });
});

describe("nextHoleAfterScore", () => {
  it("advances to the next unscored hole", () => {
    let s = start();
    s = applyEvent(s, { type: "SCORE_SET", holeIndex: 0, strokes: 4, at });
    assert.equal(nextHoleAfterScore(s, 0), 1);
  });

  it("skips already-scored holes and wraps around", () => {
    let s = start(9, "front");
    // Score holes 1..8 (indexes), leaving only index 0 open, then score 8.
    for (let i = 1; i < 9; i += 1) {
      s = applyEvent(s, { type: "SCORE_SET", holeIndex: i, strokes: 4, at });
    }
    assert.equal(nextHoleAfterScore(s, 8), 0);
  });

  it("stays put when every hole is scored", () => {
    let s = start(9, "front");
    for (let i = 0; i < 9; i += 1) {
      s = applyEvent(s, { type: "SCORE_SET", holeIndex: i, strokes: 4, at });
    }
    assert.equal(nextHoleAfterScore(s, 4), 4);
  });
});
