/** Unit tests — lib/golf-stats.ts (mirror of web's utils/golf-stats). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateAverageScore,
  calculateAverageScoreChange,
  calculatePlusMinusScore,
  getAverageScoreChangeDescription,
  getChangeType,
  getHandicapChangeDescription,
} from "../../lib/golf-stats";

describe("calculatePlusMinusScore", () => {
  it("formats even, over and under par", () => {
    assert.equal(calculatePlusMinusScore(72, 72), "E");
    assert.equal(calculatePlusMinusScore(77, 72), "+5");
    assert.equal(calculatePlusMinusScore(70, 72), "-2");
  });
  it("dashes on missing inputs", () => {
    assert.equal(calculatePlusMinusScore(null, 72), "—");
    assert.equal(calculatePlusMinusScore(80, undefined), "—");
  });
});

describe("calculateAverageScore", () => {
  it("averages with one decimal", () => {
    assert.equal(calculateAverageScore([10, 11]), "10.5");
  });
  it("dashes when empty", () => {
    assert.equal(calculateAverageScore([]), "—");
  });
});

describe("calculateAverageScoreChange", () => {
  it("compares second half to first half", () => {
    // first half avg 12, second half avg 10 → improving by -2
    assert.equal(calculateAverageScoreChange([12, 12, 10, 10]), -2);
  });
  it("returns 0 with fewer than two scores", () => {
    assert.equal(calculateAverageScoreChange([5]), 0);
  });
});

describe("change descriptions", () => {
  it("classifies direction", () => {
    assert.equal(getChangeType(-1), "improvement");
    assert.equal(getChangeType(1), "increase");
    assert.equal(getChangeType(0), "neutral");
  });
  it("describes slight vs significant average change", () => {
    assert.match(getAverageScoreChangeDescription(-1), /slightly improving/);
    assert.match(getAverageScoreChangeDescription(-7), /improving!/);
    assert.match(getAverageScoreChangeDescription(2), /slightly increasing/);
  });
  it("describes handicap change with the 7% threshold", () => {
    assert.match(getHandicapChangeDescription(-0.05), /slightly improving/);
    assert.match(getHandicapChangeDescription(-0.2), /improving!/);
    assert.equal(getHandicapChangeDescription(0), "No change in handicap");
  });
});
