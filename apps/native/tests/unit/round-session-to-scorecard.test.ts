/** Unit tests — RoundSession → submitScorecard payload conversion. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyEvent, startSession } from "../../lib/round-session/engine";
import { toScorecardInput } from "../../lib/round-session/to-scorecard";
import type { RoundSession } from "../../lib/round-session/types";
import { scorecardInputSchema } from "../../lib/scorecard";
import { makeSessionCourse, makeTee, T0 } from "./round-session-fixtures";

const at = "2026-07-06T10:00:00.000Z";
const teeTime = "2026-07-06T09:00:00.000Z";

const start = (holeCount: 9 | 18 = 18, section?: "front" | "back") =>
  startSession({
    id: "s",
    userId: "5f4c2a5e-9d0e-4bb1-a1f0-1234567890ab",
    course: makeSessionCourse(),
    tee: makeTee(),
    holeCount,
    nineHoleSection: holeCount === 9 ? (section ?? "front") : undefined,
    now: T0,
  });

const scoreRange = (
  s: RoundSession,
  from: number,
  to: number,
  strokes = 4,
): RoundSession => {
  let next = s;
  for (let i = from; i < to; i += 1) {
    next = applyEvent(next, { type: "SCORE_SET", holeIndex: i, strokes, at });
  }
  return next;
};

describe("toScorecardInput / 18 holes", () => {
  it("produces a payload the input schema accepts, hcpStrokes all 0", () => {
    const s = scoreRange(start(), 0, 18, 5);
    const input = toScorecardInput(s, { teeTime, submitAs: "18" });
    assert.equal(input.scores.length, 18);
    assert.ok(input.scores.every((x) => x.strokes === 5 && x.hcpStrokes === 0));
    assert.equal(input.nineHoleSection, undefined);
    assert.equal(input.teeTime, teeTime);
    // The exact contract the server-side scorecardSchema enforces.
    scorecardInputSchema.parse(input);
  });

  it("derives approvalStatus from course+tee approval", () => {
    const approved = scoreRange(start(), 0, 18);
    assert.equal(
      toScorecardInput(approved, { teeTime, submitAs: "18" }).approvalStatus,
      "approved",
    );
    const pendingCourse: RoundSession = {
      ...approved,
      course: { ...approved.course, approvalStatus: "pending" },
    };
    assert.equal(
      toScorecardInput(pendingCourse, { teeTime, submitAs: "18" })
        .approvalStatus,
      "pending",
    );
  });

  it("throws when a selected hole has no score", () => {
    const s = scoreRange(start(), 0, 17); // hole 18 missing
    assert.throws(
      () => toScorecardInput(s, { teeTime, submitAs: "18" }),
      /has no score/,
    );
  });
});

describe("toScorecardInput / nine-hole shapes", () => {
  it("front9 slice of an 18-hole session", () => {
    const s = scoreRange(start(), 0, 9, 4);
    const input = toScorecardInput(s, { teeTime, submitAs: "front9" });
    assert.equal(input.scores.length, 9);
    assert.equal(input.nineHoleSection, "front");
    scorecardInputSchema.parse(input);
  });

  it("back9 slice takes entries 9..17", () => {
    let s = start();
    s = scoreRange(s, 9, 18, 3);
    const input = toScorecardInput(s, { teeTime, submitAs: "back9" });
    assert.equal(input.scores.length, 9);
    assert.equal(input.nineHoleSection, "back");
    assert.ok(input.scores.every((x) => x.strokes === 3));
  });

  it("native 9-hole session uses its own section", () => {
    const s = scoreRange(start(9, "back"), 0, 9);
    const input = toScorecardInput(s, { teeTime, submitAs: "nine" });
    assert.equal(input.nineHoleSection, "back");
    assert.equal(input.scores.length, 9);
    scorecardInputSchema.parse(input);
  });

  it("teePlayed is the FULL frozen 18-hole tee snapshot even for nines", () => {
    const s = scoreRange(start(9, "front"), 0, 9);
    const input = toScorecardInput(s, { teeTime, submitAs: "nine" });
    assert.equal(input.teePlayed.holes?.length, 18);
  });

  it("rejects mismatched submitAs / session shapes", () => {
    const nine = scoreRange(start(9, "front"), 0, 9);
    assert.throws(() => toScorecardInput(nine, { teeTime, submitAs: "18" }));
    assert.throws(() =>
      toScorecardInput(nine, { teeTime, submitAs: "front9" }),
    );
    const eighteen = scoreRange(start(), 0, 18);
    assert.throws(() =>
      toScorecardInput(eighteen, { teeTime, submitAs: "nine" }),
    );
  });
});
