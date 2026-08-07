/**
 * The central error → problem mapper, against the frozen §1 domain table.
 *
 * The Sentry boundary is mocked so the suite can assert WHICH failures alert:
 * "500 + Sentry" is half the contract for the unreachable cases, and an
 * unalerted 500 there would hide a broken quarantine promise.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

const captureSentryError = vi.fn();
vi.mock("@/lib/sentry-utils", () => ({
  captureSentryError: (...args: unknown[]) => captureSentryError(...args),
}));

const {
  duplicateRoundProblem,
  idempotencyConflictProblem,
  mapErrorToProblem,
  validationProblem,
  zodIssuesToFieldErrors,
} = await import("@/lib/api/problem-mapper");
const {
  CourseResolutionError,
  DuplicateRoundError,
  PlanNotSelectedError,
  RoundLimitReachedError,
  ScoreHoleMismatchError,
  SelfSubmissionError,
} = await import("@/server/services/scorecard/errors");

/** `RoundLimitRaceError` has no class in errors.ts — matched by name (§1). */
class RoundLimitRaceError extends Error {
  constructor() {
    super("race");
    this.name = "RoundLimitRaceError";
  }
}

/** A Drizzle-style wrapped Postgres error. */
function pgError(code: string, depth = 2): Error {
  let current: Error & { code?: string; cause?: unknown } = Object.assign(
    new Error("db"),
    { code }
  );
  for (let i = 0; i < depth; i++) {
    current = Object.assign(new Error("wrapped"), { cause: current });
  }
  return current;
}

beforeEach(() => {
  captureSentryError.mockClear();
});

describe("domain error → code mapping (frozen §1 table)", () => {
  test("SelfSubmissionError → 403 forbidden, no alert", () => {
    const problem = mapErrorToProblem(new SelfSubmissionError());
    expect(problem.code).toBe("forbidden");
    expect(problem.status).toBe(403);
    expect(captureSentryError).not.toHaveBeenCalled();
  });

  test("PlanNotSelectedError → 403 plan_required, no alert", () => {
    const problem = mapErrorToProblem(new PlanNotSelectedError());
    expect(problem.code).toBe("plan_required");
    expect(problem.status).toBe(403);
    expect(captureSentryError).not.toHaveBeenCalled();
  });

  test("CourseResolutionError → 422 course_not_found (stricter than tRPC)", () => {
    const problem = mapErrorToProblem(new CourseResolutionError("tee 91 gone"));
    expect(problem.code).toBe("course_not_found");
    expect(problem.status).toBe(422);
    // The thrown message must NOT reach the wire.
    expect(problem.detail).not.toContain("91");
  });

  test("RoundLimitReachedError → 500 internal_error + Sentry (unreachable)", () => {
    const problem = mapErrorToProblem(new RoundLimitReachedError(25));
    expect(problem.code).toBe("internal_error");
    expect(problem.status).toBe(500);
    expect(captureSentryError).toHaveBeenCalledTimes(1);
  });

  test("RoundLimitRaceError → 500 internal_error + Sentry (unreachable)", () => {
    const problem = mapErrorToProblem(new RoundLimitRaceError());
    expect(problem.code).toBe("internal_error");
    expect(captureSentryError).toHaveBeenCalledTimes(1);
  });

  test("neither limit error ever produces a round_limit_reached code", () => {
    for (const error of [new RoundLimitReachedError(25), new RoundLimitRaceError()]) {
      const problem = mapErrorToProblem(error);
      expect(problem.code).not.toBe("round_limit_reached");
      expect(problem.type).not.toContain("round_limit_reached");
      expect(problem.status).not.toBe(403);
    }
  });

  test("DuplicateRoundError is not mapped to a 409 — the handler's lookup decides", () => {
    const problem = mapErrorToProblem(new DuplicateRoundError("natural-key"));
    expect(problem.code).toBe("internal_error");
    expect(captureSentryError).toHaveBeenCalledTimes(1);
  });

  test("ScoreHoleMismatchError is not in the table → internal_error + Sentry", () => {
    // Deliberate and reported: §1's table does not name it, and its closing
    // rule is "anything not in this table is internal_error + a Sentry alert".
    const problem = mapErrorToProblem(new ScoreHoleMismatchError(5, 9));
    expect(problem.code).toBe("internal_error");
    expect(captureSentryError).toHaveBeenCalledTimes(1);
  });
});

describe("SQLSTATE 42501", () => {
  test("→ 403 forbidden and ALWAYS alerts", () => {
    const problem = mapErrorToProblem(pgError("42501"));
    expect(problem.code).toBe("forbidden");
    expect(problem.status).toBe(403);
    expect(captureSentryError).toHaveBeenCalledTimes(1);
  });

  test("is found through a nested cause chain", () => {
    expect(mapErrorToProblem(pgError("42501", 4)).code).toBe("forbidden");
  });

  test("an unrelated SQLSTATE falls through to internal_error", () => {
    const problem = mapErrorToProblem(pgError("23505"));
    expect(problem.code).toBe("internal_error");
    expect(captureSentryError).toHaveBeenCalledTimes(1);
  });
});

describe("zod → 422 validation_failed", () => {
  const schema = z.object({
    teeTime: z.string(),
    scores: z.array(z.object({ strokes: z.number().min(1) })),
  });

  test("carries errors[] with path, code and message", () => {
    const result = schema.safeParse({ teeTime: 5, scores: [{ strokes: 0 }] });
    expect(result.success).toBe(false);
    if (result.success) return;

    const problem = validationProblem(result.error);
    expect(problem.code).toBe("validation_failed");
    expect(problem.status).toBe(422);
    expect(problem.errors?.length).toBeGreaterThanOrEqual(2);
    expect(problem.errors?.map((e) => e.path)).toContain("teeTime");
    expect(problem.errors?.map((e) => e.path)).toContain("scores.0.strokes");
    for (const item of problem.errors ?? []) {
      expect(typeof item.code).toBe("string");
      expect(item.code.length).toBeGreaterThan(0);
    }
  });

  test("a ZodError thrown through the mapper lands as validation_failed, unalerted", () => {
    const result = schema.safeParse({});
    if (result.success) throw new Error("expected failure");
    expect(mapErrorToProblem(result.error).code).toBe("validation_failed");
    expect(captureSentryError).not.toHaveBeenCalled();
  });

  test("an explicit params.v1Code wins over zod's issue code", () => {
    const custom = z.string().superRefine((_value, ctx) => {
      ctx.addIssue({
        code: "custom",
        path: ["teeTime"],
        message: "out of window",
        params: { v1Code: "tee_time_out_of_window" },
      });
    });
    const result = custom.safeParse("x");
    if (result.success) throw new Error("expected failure");
    expect(zodIssuesToFieldErrors(result.error)[0]).toEqual({
      path: "teeTime",
      code: "tee_time_out_of_window",
      message: "out of window",
    });
  });

  test("a root-level issue reports path '(root)'", () => {
    const result = z.string().safeParse(1);
    if (result.success) throw new Error("expected failure");
    expect(zodIssuesToFieldErrors(result.error)[0].path).toBe("(root)");
  });
});

describe("fallback and handler-owned 409s", () => {
  test("an unknown error → internal_error + Sentry, leaking nothing", () => {
    const problem = mapErrorToProblem(
      new Error("connect ECONNREFUSED 10.0.0.7:6379")
    );
    expect(problem.code).toBe("internal_error");
    expect(problem.detail).not.toContain("10.0.0.7");
    expect(problem.detail).not.toContain("ECONNREFUSED");
    expect(captureSentryError).toHaveBeenCalledTimes(1);
  });

  test("a non-Error throw is still mapped and alerted", () => {
    expect(mapErrorToProblem("boom").code).toBe("internal_error");
    expect(mapErrorToProblem({ weird: true }).code).toBe("internal_error");
    expect(captureSentryError).toHaveBeenCalledTimes(2);
  });

  test("instance propagates into the problem", () => {
    expect(
      mapErrorToProblem(new SelfSubmissionError(), { instance: "req_9" })
        .instance
    ).toBe("req_9");
  });

  test("duplicateRoundProblem carries existingRoundId; idempotency_conflict does not", () => {
    const duplicate = duplicateRoundProblem(1234);
    expect(duplicate.code).toBe("duplicate_round");
    expect(duplicate.status).toBe(409);
    expect(duplicate.existingRoundId).toBe(1234);

    const conflict = idempotencyConflictProblem();
    expect(conflict.code).toBe("idempotency_conflict");
    expect(conflict.status).toBe(409);
    expect(conflict).not.toHaveProperty("existingRoundId");
  });
});
