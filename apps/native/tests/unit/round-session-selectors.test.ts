/** Unit tests — round-session selectors (derived views). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyEvent, startSession } from "../../lib/round-session/engine";
import {
  finishEligibility,
  isAutoResumable,
  isComplete,
  isStale,
  scoredCount,
  totalStrokes,
  vsPar,
} from "../../lib/round-session/selectors";
import type { RoundSession } from "../../lib/round-session/types";
import { makeSessionCourse, makeTee, T0 } from "./round-session-fixtures";

const at = "2026-07-06T10:00:00.000Z";

const start = (holeCount: 9 | 18 = 18, section?: "front" | "back") =>
  startSession({
    id: "s",
    userId: "u",
    course: makeSessionCourse(),
    tee: makeTee(),
    holeCount,
    nineHoleSection: holeCount === 9 ? (section ?? "front") : undefined,
    now: T0,
  });

const score = (s: RoundSession, holeIndex: number, strokes: number) =>
  applyEvent(s, { type: "SCORE_SET", holeIndex, strokes, at });

const scoreRange = (
  s: RoundSession,
  from: number,
  to: number,
  strokes = 4,
): RoundSession => {
  let next = s;
  for (let i = from; i < to; i += 1) next = score(next, i, strokes);
  return next;
};

describe("counting selectors", () => {
  it("counts and sums scored holes only", () => {
    let s = start();
    assert.equal(scoredCount(s), 0);
    assert.equal(totalStrokes(s), 0);
    assert.equal(vsPar(s), 0);
    s = score(s, 0, 5); // par 4 → +1
    s = score(s, 1, 3); // par 4 → −1
    s = score(s, 2, 6); // par 4 → +2
    assert.equal(scoredCount(s), 3);
    assert.equal(totalStrokes(s), 14);
    assert.equal(vsPar(s), 2);
    assert.equal(isComplete(s), false);
  });
});

describe("finishEligibility", () => {
  it("full 18: eligible as 18", () => {
    const s = scoreRange(start(), 0, 18);
    const e = finishEligibility(s);
    assert.equal(e.as18, true);
    assert.deepEqual(e.missing, []);
  });

  it("front nine only of an 18-hole session: eligible as front 9", () => {
    const s = scoreRange(start(), 0, 9);
    const e = finishEligibility(s);
    assert.equal(e.as18, false);
    assert.equal(e.asNine, "front");
    assert.equal(e.missing.length, 9);
  });

  it("back nine only of an 18-hole session: eligible as back 9", () => {
    const s = scoreRange(start(), 9, 18);
    const e = finishEligibility(s);
    assert.equal(e.as18, false);
    assert.equal(e.asNine, "back");
  });

  it("ragged 13 of 18: not eligible, lists the missing holes", () => {
    const s = scoreRange(start(), 0, 13);
    const e = finishEligibility(s);
    assert.equal(e.as18, false);
    assert.equal(e.asNine, "front"); // front nine IS complete here
    assert.deepEqual(e.missing, [13, 14, 15, 16, 17]);
  });

  it("truly ragged (gaps in both nines): nothing is eligible", () => {
    let s = start();
    s = scoreRange(s, 0, 8); // front missing hole 9
    s = scoreRange(s, 9, 17); // back missing hole 18
    const e = finishEligibility(s);
    assert.equal(e.as18, false);
    assert.equal(e.asNine, null);
    assert.deepEqual(e.missing, [8, 17]);
  });

  it("complete 9-hole session: eligible as its own section", () => {
    const s = scoreRange(start(9, "back"), 0, 9);
    const e = finishEligibility(s);
    assert.equal(e.as18, false);
    assert.equal(e.asNine, "back");
  });
});

describe("staleness", () => {
  it("stale after 24h, auto-resumable under 12h", () => {
    const s = start();
    const plus1h = "2026-07-06T10:00:00.000Z";
    const plus13h = "2026-07-06T22:30:00.000Z";
    const plus25h = "2026-07-07T10:30:00.000Z";
    assert.equal(isStale(s, plus1h), false);
    assert.equal(isAutoResumable(s, plus1h), true);
    assert.equal(isAutoResumable(s, plus13h), false);
    assert.equal(isStale(s, plus13h), false);
    assert.equal(isStale(s, plus25h), true);
    assert.equal(isAutoResumable(s, plus25h), false);
  });
});
