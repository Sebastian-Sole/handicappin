import { describe, it, expect } from "vitest";
import { scorecardSchema } from "@/types/scorecard-input";
import type { Hole, Score } from "@/types/scorecard-input";

/**
 * Cross-field validation tests for the `scorecardSchema` superRefine that
 * governs the `nineHoleSection` field (USGA Rule 5.1b).
 *
 * Rules under test:
 *  - 9-hole rounds (`scores.length === 9`) require `nineHoleSection`.
 *  - Non-9-hole rounds reject `nineHoleSection`.
 *
 * We deliberately do not exercise the rest of the schema (uuid, datetime,
 * tee/hole numeric bounds, etc.) — those aren't part of this PR.
 */

const REQUIRED_MESSAGE = "nineHoleSection is required for 9-hole rounds";
const FORBIDDEN_MESSAGE =
  "nineHoleSection is only allowed for 9-hole rounds";

const PAR_SEQUENCE = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
const DISTANCE_SEQUENCE = [
  380, 165, 520, 410, 390, 185, 430, 530, 400, 415, 175, 510, 395, 420, 195,
  440, 540, 385,
];

function buildHoles(): Hole[] {
  return PAR_SEQUENCE.map((par, index) => ({
    id: index + 1,
    teeId: 1,
    holeNumber: index + 1,
    par,
    hcp: index + 1, // unique 1..18 — required by teeSchema.superRefine
    distance: DISTANCE_SEQUENCE[index],
  }));
}

function build18Scores(): Score[] {
  return Array.from({ length: 18 }, (_, index) => ({
    id: index + 1,
    roundId: 1,
    holeId: index + 1,
    strokes: 5,
    hcpStrokes: 0,
  }));
}

function build9Scores(): Score[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    roundId: 1,
    holeId: index + 1,
    strokes: 5,
    hcpStrokes: 0,
  }));
}

const validTee = {
  id: 1,
  name: "Blue",
  gender: "mens" as const,
  courseRating18: 72.0,
  slopeRating18: 130,
  courseRatingFront9: 36.0,
  slopeRatingFront9: 130,
  courseRatingBack9: 36.0,
  slopeRatingBack9: 130,
  outPar: 36,
  inPar: 36,
  totalPar: 72,
  outDistance: 3400,
  inDistance: 3400,
  totalDistance: 6800,
  distanceMeasurement: "yards" as const,
  approvalStatus: "approved" as const,
  holes: buildHoles(),
  courseId: 1,
};

const validCourse = {
  id: 1,
  name: "Test Golf Club",
  approvalStatus: "approved" as const,
  country: "USA",
  city: "Test City",
  tees: [validTee],
};

const validBaseScorecard = {
  userId: "11111111-2222-4333-8444-555555555555",
  course: validCourse,
  teePlayed: validTee,
  scores: build18Scores(),
  teeTime: "2024-01-15T10:00:00Z",
  approvalStatus: "approved" as const,
};

describe("scorecardSchema — nineHoleSection cross-field validation", () => {
  it("accepts an 18-hole scorecard with no nineHoleSection", () => {
    const result = scorecardSchema.safeParse(validBaseScorecard);
    expect(result.success).toBe(true);
  });

  it("accepts a 9-hole scorecard with nineHoleSection: 'front'", () => {
    const result = scorecardSchema.safeParse({
      ...validBaseScorecard,
      scores: build9Scores(),
      nineHoleSection: "front",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 9-hole scorecard with nineHoleSection: 'back'", () => {
    const result = scorecardSchema.safeParse({
      ...validBaseScorecard,
      scores: build9Scores(),
      nineHoleSection: "back",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a 9-hole scorecard missing nineHoleSection", () => {
    const result = scorecardSchema.safeParse({
      ...validBaseScorecard,
      scores: build9Scores(),
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find(
      (i) =>
        i.path.length === 1 &&
        i.path[0] === "nineHoleSection" &&
        i.message === REQUIRED_MESSAGE
    );
    expect(issue).toBeDefined();
  });

  it("rejects an 18-hole scorecard with nineHoleSection: 'front'", () => {
    const result = scorecardSchema.safeParse({
      ...validBaseScorecard,
      nineHoleSection: "front",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find(
      (i) =>
        i.path.length === 1 &&
        i.path[0] === "nineHoleSection" &&
        i.message === FORBIDDEN_MESSAGE
    );
    expect(issue).toBeDefined();
  });

  it("rejects an 18-hole scorecard with nineHoleSection: 'back'", () => {
    const result = scorecardSchema.safeParse({
      ...validBaseScorecard,
      nineHoleSection: "back",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find(
      (i) =>
        i.path.length === 1 &&
        i.path[0] === "nineHoleSection" &&
        i.message === FORBIDDEN_MESSAGE
    );
    expect(issue).toBeDefined();
  });
});
