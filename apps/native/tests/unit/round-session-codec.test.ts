/** Unit tests — round-session persistence codec (encode/decode/migrate). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decodeSession, encodeSession } from "../../lib/round-session/codec";
import { applyEvent, startSession } from "../../lib/round-session/engine";
import { makeSessionCourse, makeTee, T0 } from "./round-session-fixtures";

const session = () => {
  const s = startSession({
    id: "s",
    userId: "u",
    course: makeSessionCourse(),
    tee: makeTee(),
    holeCount: 18,
    now: T0,
  });
  return applyEvent(s, {
    type: "SCORE_SET",
    holeIndex: 0,
    strokes: 5,
    at: "2026-07-06T10:00:00.000Z",
  });
};

describe("codec round-trip", () => {
  it("decode(encode(s)) preserves the session", () => {
    const s = session();
    const decoded = decodeSession(encodeSession(s));
    assert.deepEqual(decoded, s);
  });

  it("preserves 9-hole sections", () => {
    const s = startSession({
      id: "s",
      userId: "u",
      course: makeSessionCourse(),
      tee: makeTee(),
      holeCount: 9,
      nineHoleSection: "back",
      now: T0,
    });
    const decoded = decodeSession(encodeSession(s));
    assert.equal(decoded?.nineHoleSection, "back");
    assert.equal(decoded?.displayedHoles[0]?.holeNumber, 10);
  });
});

describe("codec rejection (returns null, never throws)", () => {
  it("null and corrupt JSON", () => {
    assert.equal(decodeSession(null), null);
    assert.equal(decodeSession("not json {"), null);
    assert.equal(decodeSession('"a string"'), null);
  });

  it("future schema versions", () => {
    const raw = JSON.stringify({ ...session(), schemaVersion: 2 });
    assert.equal(decodeSession(raw), null);
  });

  it("missing schemaVersion", () => {
    const { schemaVersion: _v, ...rest } = session();
    assert.equal(decodeSession(JSON.stringify(rest)), null);
  });

  it("structurally broken payloads", () => {
    const s = session();
    // entries shorter than holeCount
    assert.equal(
      decodeSession(JSON.stringify({ ...s, entries: s.entries.slice(0, 5) })),
      null,
    );
    // cursor out of range
    assert.equal(
      decodeSession(JSON.stringify({ ...s, currentHoleIndex: 18 })),
      null,
    );
    // 9-hole session without a section
    const nine = startSession({
      id: "s",
      userId: "u",
      course: makeSessionCourse(),
      tee: makeTee(),
      holeCount: 9,
      nineHoleSection: "front",
      now: T0,
    });
    const { nineHoleSection: _section, ...nineNoSection } = nine;
    assert.equal(decodeSession(JSON.stringify(nineNoSection)), null);
  });

  it("tolerates extra keys on tee/holes (lenient structural check)", () => {
    const s = session();
    const raw = JSON.stringify({
      ...s,
      tee: { ...s.tee, someFutureField: "ok" },
    });
    const decoded = decodeSession(raw);
    assert.ok(decoded);
  });
});
