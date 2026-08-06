/**
 * Unit tests — lib/api/schemas/stats.ts.
 *
 * The native course-detail screen badges quarantined rounds (decision D4), so
 * `quarantined` has to actually survive the wire. `.passthrough()` alone does
 * not: it keeps the value at runtime but types it `unknown`, which cannot
 * drive the badge. These cases pin the field as declared and REQUIRED, so a
 * server that stopped sending it fails loudly instead of silently rendering a
 * non-counting round as if it counts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  courseDetailRoundSchema,
  courseDetailSchema,
} from "../../lib/api/schemas/stats";

/** Shaped after a real `stats.getCourseDetail` rounds row. */
const wireRound = (overrides: Record<string, unknown> = {}) => ({
  id: 301,
  teeTime: "2026-05-21T10:00:00.000Z",
  totalStrokes: 92,
  parPlayed: 72,
  scoreDifferential: 16.5,
  holesPlayed: 18,
  nineHoleSection: null,
  teeName: "Yellow",
  quarantined: false,
  ...overrides,
});

describe("courseDetailRoundSchema", () => {
  it("parses `quarantined` as a real boolean the badge can branch on", () => {
    const parsed = courseDetailRoundSchema.parse(
      wireRound({ quarantined: true }),
    );
    assert.equal(parsed.quarantined, true);
    assert.equal(typeof parsed.quarantined, "boolean");
  });

  it("keeps a non-quarantined round unbadged", () => {
    assert.equal(courseDetailRoundSchema.parse(wireRound()).quarantined, false);
  });

  it("rejects a round row missing `quarantined` rather than defaulting it", () => {
    const { quarantined: _omitted, ...withoutFlag } = wireRound();
    assert.equal(courseDetailRoundSchema.safeParse(withoutFlag).success, false);
  });
});

describe("courseDetailSchema", () => {
  it("surfaces `quarantined` on every round of a full response", () => {
    const parsed = courseDetailSchema.parse({
      course: { id: 7, name: "Ballerud", city: "Bærum", country: "Norway" },
      summary: {
        roundCount: 1,
        avgScore: 88,
        avgDifferential: 12.3,
        bestDifferential: 12.3,
        worstDifferential: 12.3,
      },
      rounds: [
        wireRound({ id: 301, quarantined: false }),
        wireRound({ id: 302, quarantined: true }),
      ],
      holes: [],
    });

    assert.notEqual(parsed, null);
    assert.deepEqual(
      parsed!.rounds.map((r) => r.quarantined),
      [false, true],
    );
    // D4: the list carries BOTH rounds while the summary counts only one.
    assert.equal(parsed!.rounds.length, 2);
    assert.equal(parsed!.summary.roundCount, 1);
  });

  it("accepts the all-quarantined response shape (null aggregates, populated list)", () => {
    const parsed = courseDetailSchema.parse({
      course: { id: 7, name: "Ballerud", city: "Bærum", country: "Norway" },
      summary: {
        roundCount: 0,
        avgScore: null,
        avgDifferential: null,
        bestDifferential: null,
        worstDifferential: null,
      },
      rounds: [wireRound({ quarantined: true })],
      holes: [],
    });

    assert.equal(parsed!.rounds.length, 1);
    assert.equal(parsed!.rounds[0]!.quarantined, true);
    assert.equal(parsed!.summary.roundCount, 0);
    assert.equal(parsed!.summary.avgScore, null);
  });
});
