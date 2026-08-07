/**
 * The `/v1` refinement layer (D5) — and the guarantee that it stays a LAYER.
 *
 * The failure this suite exists to prevent is tightening the shared schema:
 * `types/scorecard-input.ts` is consumed by the web and native submit paths,
 * and narrowing it after ship is a breaking change requiring `/v2` (§4).
 */
import { describe, expect, test } from "vitest";

import { scorecardSchema } from "@/types/scorecard-input";
import {
  TEE_TIME_FIELD_CODE,
  TEE_TIME_MAX_SKEW_MS,
  TEE_TIME_MIN_ISO,
  checkTeeTimeWindow,
  createV1ScorecardSchema,
  v1ScorecardSchema,
} from "@/app/api/v1/_lib/schemas";
import { validationProblem } from "@/lib/api/problem-mapper";

const NOW = Date.parse("2026-08-07T12:00:00.000Z");
const frozen = createV1ScorecardSchema({ now: () => NOW });

const hole = (holeNumber: number) => ({
  holeNumber,
  par: 4,
  hcp: holeNumber,
  distance: 350,
});

const tee = {
  name: "White",
  gender: "mens" as const,
  courseRating18: 72,
  slopeRating18: 113,
  courseRatingFront9: 36,
  slopeRatingFront9: 113,
  courseRatingBack9: 36,
  slopeRatingBack9: 113,
  outPar: 36,
  inPar: 36,
  totalPar: 72,
  outDistance: 3000,
  inDistance: 3000,
  totalDistance: 6000,
  distanceMeasurement: "meters" as const,
  approvalStatus: "approved" as const,
  holes: Array.from({ length: 18 }, (_v, i) => hole(i + 1)),
};

function scorecard(teeTime: string) {
  return {
    userId: "44444444-4444-4444-8444-444444444444",
    course: {
      name: "Test Course",
      approvalStatus: "approved" as const,
      country: "Norway",
      city: "Testville",
      tees: [tee],
    },
    teePlayed: tee,
    scores: Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 1 })),
    teeTime,
    approvalStatus: "approved" as const,
  };
}

describe("checkTeeTimeWindow (D5: 1990-01-01 … now + 24h)", () => {
  test.each([
    ["the lower bound itself is accepted", TEE_TIME_MIN_ISO, "ok"],
    ["a 1989 round is too early", "1989-12-31T23:59:59.999Z", "too-early"],
    ["a 2010 backfill is accepted", "2010-06-01T08:00:00.000Z", "ok"],
    ["today is accepted", "2026-08-07T06:00:00.000Z", "ok"],
    ["garbage is invalid", "not-a-date", "invalid"],
  ])("%s", (_label, teeTime, expected) => {
    expect(checkTeeTimeWindow(teeTime, NOW)).toBe(expected);
  });

  test("exactly now + 24h is accepted; one millisecond later is not", () => {
    expect(
      checkTeeTimeWindow(new Date(NOW + TEE_TIME_MAX_SKEW_MS).toISOString(), NOW)
    ).toBe("ok");
    expect(
      checkTeeTimeWindow(
        new Date(NOW + TEE_TIME_MAX_SKEW_MS + 1).toISOString(),
        NOW
      )
    ).toBe("too-late");
  });

  test("the window compares INSTANTS, so the offset notation does not matter", () => {
    // 1990-01-01T01:00:00+02:00 is 1989-12-31T23:00:00Z — before the bound.
    expect(checkTeeTimeWindow("1990-01-01T01:00:00+02:00", NOW)).toBe("too-early");
    expect(checkTeeTimeWindow("1990-01-01T03:00:00+02:00", NOW)).toBe("ok");
  });
});

describe("the /v1 schema layers the window on top of the shared schema", () => {
  test("an in-window round parses", () => {
    expect(frozen.safeParse(scorecard("2026-08-01T09:00:00.000Z")).success).toBe(
      true
    );
  });

  test.each([
    ["too early", "1985-06-01T09:00:00.000Z"],
    ["too far in the future", "2026-08-09T09:00:00.000Z"],
  ])("%s → a validation failure carrying the field-level code", (_l, teeTime) => {
    const result = frozen.safeParse(scorecard(teeTime));
    expect(result.success).toBe(false);
    if (result.success) return;

    const problem = validationProblem(result.error);
    expect(problem.code).toBe("validation_failed");
    expect(problem.status).toBe(422);
    expect(problem.errors).toEqual([
      expect.objectContaining({
        path: "teeTime",
        code: TEE_TIME_FIELD_CODE,
      }),
    ]);
  });

  test("the SHARED schema accepts exactly the rounds /v1 rejects", () => {
    // This is the whole point: web and native behaviour is untouched.
    for (const teeTime of [
      "1985-06-01T09:00:00.000Z",
      "2126-08-09T09:00:00.000Z",
    ]) {
      expect(scorecardSchema.safeParse(scorecard(teeTime)).success).toBe(true);
      expect(frozen.safeParse(scorecard(teeTime)).success).toBe(false);
    }
  });

  test("base-schema invariants still fire through the layer", () => {
    const invalid = { ...scorecard("2026-08-01T09:00:00.000Z"), scores: [] };
    const result = frozen.safeParse(invalid);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      validationProblem(result.error).errors?.some((e) => e.path === "scores")
    ).toBe(true);
  });

  test("the exported default reads the clock per parse, not at import time", () => {
    // A long-lived serverless instance must not freeze the upper bound at
    // cold-start. `now + 1h` is in-window whenever the test actually runs.
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(v1ScorecardSchema.safeParse(scorecard(soon)).success).toBe(true);

    const tooLate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    expect(v1ScorecardSchema.safeParse(scorecard(tooLate)).success).toBe(false);
  });
});
