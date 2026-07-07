/** Unit tests — persistence layer with an injected Map-backed KvBackend. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyEvent, startSession } from "../../lib/round-session/engine";
import {
  ACTIVE_SESSION_KEY,
  createSessionPersistence,
  LAST_SETUP_KEY,
  PENDING_SUBMIT_KEY,
  type KvBackend,
} from "../../lib/round-session/persistence";
import { toScorecardInput } from "../../lib/round-session/to-scorecard";
import type { RoundSession } from "../../lib/round-session/types";
import { makeSessionCourse, makeTee, T0 } from "./round-session-fixtures";

const makeKv = (): KvBackend & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItemSync: (k) => map.get(k) ?? null,
    setItemSync: (k, v) => void map.set(k, v),
    removeItemSync: (k) => void map.delete(k),
  };
};

const session = (): RoundSession =>
  startSession({
    id: "s",
    userId: "5f4c2a5e-9d0e-4bb1-a1f0-1234567890ab",
    course: makeSessionCourse(),
    tee: makeTee(),
    holeCount: 18,
    now: T0,
  });

describe("active session persistence", () => {
  it("save/load round-trips", () => {
    const kv = makeKv();
    const p = createSessionPersistence(kv);
    const s = session();
    p.saveActiveSession(s);
    assert.deepEqual(p.loadActiveSession(), s);
    p.clearActiveSession();
    assert.equal(p.loadActiveSession(), null);
  });

  it("clears the key when the payload is unreadable", () => {
    const kv = makeKv();
    const p = createSessionPersistence(kv);
    kv.setItemSync(ACTIVE_SESSION_KEY, "corrupt{");
    assert.equal(p.loadActiveSession(), null);
    assert.equal(kv.map.has(ACTIVE_SESSION_KEY), false);
  });
});

describe("pending submit persistence", () => {
  it("round-trips a real payload", () => {
    const kv = makeKv();
    const p = createSessionPersistence(kv);
    let s = session();
    for (let i = 0; i < 18; i += 1) {
      s = applyEvent(s, {
        type: "SCORE_SET",
        holeIndex: i,
        strokes: 4,
        at: T0,
      });
    }
    const pending = {
      v: 1 as const,
      sessionId: s.id,
      payload: toScorecardInput(s, { teeTime: T0, submitAs: "18" }),
      attempts: 1,
      lastAttemptAt: T0,
    };
    p.savePendingSubmit(pending);
    assert.deepEqual(p.loadPendingSubmit(), pending);
    p.clearPendingSubmit();
    assert.equal(p.loadPendingSubmit(), null);
  });

  it("rejects and clears malformed pending payloads", () => {
    const kv = makeKv();
    const p = createSessionPersistence(kv);
    kv.setItemSync(
      PENDING_SUBMIT_KEY,
      JSON.stringify({ v: 1, sessionId: "x", payload: {}, attempts: 0 }),
    );
    assert.equal(p.loadPendingSubmit(), null);
    assert.equal(kv.map.has(PENDING_SUBMIT_KEY), false);
  });
});

describe("last setup persistence", () => {
  it("round-trips and prefill survives with the full tee snapshot", () => {
    const kv = makeKv();
    const p = createSessionPersistence(kv);
    const setup = {
      v: 1 as const,
      course: makeSessionCourse(),
      tee: makeTee(),
      holeCount: 18 as const,
      savedAt: T0,
    };
    p.saveLastSetup(setup);
    const loaded = p.loadLastSetup();
    assert.equal(loaded?.course.name, "Test Links");
    assert.equal(loaded?.tee.holes?.length, 18);
  });

  it("rejects a lastSetup whose tee is missing its holes", () => {
    const kv = makeKv();
    const p = createSessionPersistence(kv);
    const { holes: _holes, ...teeWithoutHoles } = makeTee();
    kv.setItemSync(
      LAST_SETUP_KEY,
      JSON.stringify({
        v: 1,
        course: makeSessionCourse(),
        tee: teeWithoutHoles,
        holeCount: 18,
        savedAt: T0,
      }),
    );
    // Offline prefill is the whole point of the snapshot — a tee without
    // holes is useless, so the loader must reject (and clear) it.
    assert.equal(p.loadLastSetup(), null);
    assert.equal(kv.map.has(LAST_SETUP_KEY), false);
  });
});
