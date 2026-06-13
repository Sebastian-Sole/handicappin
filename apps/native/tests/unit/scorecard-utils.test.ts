/** Unit tests — lib/scorecard.ts utilities (9-hole normalization etc.). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDisplayedHoles,
  normalizeHcpForNineHoles,
  roundToNearestMinute,
} from "../../lib/scorecard";

const hole = (holeNumber: number, hcp: number, par = 4) => ({
  holeNumber,
  par,
  hcp,
  distance: 350,
});

const eighteen = Array.from({ length: 18 }, (_, i) =>
  hole(i + 1, ((i * 7) % 18) + 1),
);

describe("normalizeHcpForNineHoles", () => {
  it("returns sorted holes untouched for 18-hole rounds", () => {
    const result = normalizeHcpForNineHoles([...eighteen].reverse(), 18);
    assert.equal(result.length, 18);
    assert.deepEqual(
      result.map((h) => h.holeNumber),
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it("remaps the front nine's handicaps onto 1–9", () => {
    const result = normalizeHcpForNineHoles(eighteen, 9, "front");
    assert.equal(result.length, 9);
    assert.deepEqual(
      [...result.map((h) => h.hcp)].sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
    // Relative order of difficulty is preserved.
    const original = eighteen.slice(0, 9);
    const hardestOriginal = original.reduce((min, h) =>
      h.hcp < min.hcp ? h : min,
    );
    const hardestRemapped = result.find((h) => h.hcp === 1);
    assert.equal(hardestRemapped?.holeNumber, hardestOriginal.holeNumber);
  });

  it("selects the back nine when asked", () => {
    const result = normalizeHcpForNineHoles(eighteen, 9, "back");
    assert.deepEqual(
      result.map((h) => h.holeNumber),
      [10, 11, 12, 13, 14, 15, 16, 17, 18],
    );
  });

  it("handles missing holes", () => {
    assert.deepEqual(normalizeHcpForNineHoles(undefined, 18), []);
  });
});

describe("getDisplayedHoles", () => {
  it("returns empty without a tee", () => {
    assert.deepEqual(getDisplayedHoles(undefined, 18), []);
  });
  it("delegates to the normalizer", () => {
    const result = getDisplayedHoles({ holes: eighteen }, 9, "back");
    assert.equal(result[0]?.holeNumber, 10);
  });
});

describe("roundToNearestMinute", () => {
  it("zeroes seconds and milliseconds", () => {
    const rounded = roundToNearestMinute(
      new Date("2026-06-10T10:30:45.678Z"),
    );
    assert.equal(rounded.getSeconds(), 0);
    assert.equal(rounded.getMilliseconds(), 0);
  });
});
