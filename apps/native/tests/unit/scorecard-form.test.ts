/**
 * Add-course/add-tee form schema layer (D21): blankTee shape, the
 * refinement rules web layers over the core tee schema, the grouped
 * error list, and the course website transform.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Tee } from "@handicappin/handicap-core";

import {
  blankTee,
  courseFormSchema,
  getTeeValidationErrors,
  isTeeValid,
  teeFormSchema,
} from "../../lib/scorecard-form";

const validTee = (): Tee => ({
  name: "GOLD",
  gender: "mens",
  courseRating18: 72.5,
  courseRatingFront9: 36,
  courseRatingBack9: 36.5,
  slopeRating18: 131,
  slopeRatingFront9: 130,
  slopeRatingBack9: 132,
  outPar: 36,
  inPar: 36,
  totalPar: 72,
  outDistance: 2700,
  inDistance: 2700,
  totalDistance: 5400,
  distanceMeasurement: "meters",
  approvalStatus: "pending",
  holes: Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    hcp: i + 1,
    distance: 300,
  })),
});

describe("blankTee", () => {
  it("produces 18 numbered holes and starts invalid", () => {
    const tee = blankTee();
    assert.equal(tee.holes?.length, 18);
    assert.deepEqual(
      tee.holes?.map((hole) => hole.holeNumber),
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    assert.equal(tee.approvalStatus, "pending");
    assert.equal(isTeeValid(tee), false);
  });

  it("returns fresh objects (no shared hole references)", () => {
    const a = blankTee();
    const b = blankTee();
    a.holes![0]!.par = 5;
    assert.equal(b.holes![0]!.par, 0);
  });
});

describe("teeFormSchema refinements", () => {
  it("accepts a fully valid tee", () => {
    assert.equal(isTeeValid(validTee()), true);
    assert.deepEqual(getTeeValidationErrors(validTee()), []);
  });

  it("rejects totals that do not equal out + in", () => {
    const tee = { ...validTee(), totalPar: 71 };
    const result = teeFormSchema.safeParse(tee);
    assert.equal(result.success, false);
    assert.ok(
      result.error!.issues.some((issue) =>
        issue.message.includes("totalPar must equal outPar + inPar"),
      ),
    );
  });

  it("rejects duplicate hole handicaps and names the duplicates", () => {
    const tee = validTee();
    tee.holes![1] = { ...tee.holes![1]!, hcp: 1 }; // duplicate hcp 1
    const errors = getTeeValidationErrors(tee);
    assert.ok(errors.some((message) => message.includes("Duplicate values: 1")));
  });
});

describe("getTeeValidationErrors grouping", () => {
  it("collapses per-hole issues to one line per field", () => {
    const errors = getTeeValidationErrors(blankTee());
    const parLines = errors.filter((message) =>
      message.includes("par values is less than 1"),
    );
    const hcpLines = errors.filter((message) =>
      message.includes("HCP values is less than 1"),
    );
    const distanceLines = errors.filter((message) =>
      message.includes("distance values is less than 1"),
    );
    assert.equal(parLines.length, 1);
    assert.equal(hcpLines.length, 1);
    assert.equal(distanceLines.length, 1);
  });
});

describe("courseFormSchema", () => {
  const baseCourse = {
    id: -1,
    name: "Maestro Test Course",
    approvalStatus: "pending" as const,
    country: "norway",
    city: "Oslo",
    tees: [validTee()],
  };

  it("prefixes bare domains with https://", () => {
    const parsed = courseFormSchema.parse({
      ...baseCourse,
      website: "example.com",
    });
    assert.equal(parsed.website, "https://example.com");
  });

  it("keeps an empty website empty", () => {
    const parsed = courseFormSchema.parse({ ...baseCourse, website: "" });
    assert.equal(parsed.website, "");
  });

  it("requires at least one tee and unique name+gender", () => {
    assert.equal(
      courseFormSchema.safeParse({ ...baseCourse, tees: [] }).success,
      false,
    );
    assert.equal(
      courseFormSchema.safeParse({
        ...baseCourse,
        tees: [validTee(), validTee()],
      }).success,
      false,
    );
  });
});
