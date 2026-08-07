/**
 * The RFC 9457 registry — contract §1 (FROZEN).
 *
 * This suite is the diffable record of the registry. If it needs editing to
 * make a change pass, the change is a contract change: the registry is CLOSED
 * and APPEND-ONLY, and repurposing or removing a code requires `/v2` (§4).
 */
import { describe, expect, test } from "vitest";

import {
  PROBLEM_CODES,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_REGISTRY,
  PROBLEM_TYPE_BASE,
  createProblem,
  problemTypeUri,
  type ProblemCode,
} from "@/lib/api/problem";

/** The frozen table from §1, transcribed. Nothing added, nothing dropped. */
const FROZEN_REGISTRY: Record<string, number> = {
  malformed_request: 400,
  unauthorized: 401,
  forbidden: 403,
  plan_required: 403,
  not_found: 404,
  idempotency_conflict: 409,
  duplicate_round: 409,
  validation_failed: 422,
  course_not_found: 422,
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,
};

describe("the closed /v1 problem code registry", () => {
  test("contains exactly the twelve frozen codes — no more, no fewer", () => {
    expect([...PROBLEM_CODES].sort()).toEqual(
      Object.keys(FROZEN_REGISTRY).sort()
    );
  });

  test("round_limit_reached does NOT exist (over-limit is a 201, not an error)", () => {
    expect(PROBLEM_CODES).not.toContain("round_limit_reached");
    expect(PROBLEM_REGISTRY).not.toHaveProperty("round_limit_reached");
  });

  test.each(Object.entries(FROZEN_REGISTRY))(
    "%s maps to HTTP %i",
    (code, status) => {
      expect(PROBLEM_REGISTRY[code as ProblemCode].status).toBe(status);
    }
  );

  test("plan_required is 403 (not 402) and course_not_found is 422 (not 404)", () => {
    expect(PROBLEM_REGISTRY.plan_required.status).toBe(403);
    expect(PROBLEM_REGISTRY.course_not_found.status).toBe(422);
  });

  test("every code has a non-empty title and a default detail", () => {
    for (const code of PROBLEM_CODES) {
      expect(PROBLEM_REGISTRY[code].title.length).toBeGreaterThan(0);
      expect(PROBLEM_REGISTRY[code].detail.length).toBeGreaterThan(0);
    }
  });
});

describe("problem document construction", () => {
  test("type is the per-code URI; about:blank is never used", () => {
    for (const code of PROBLEM_CODES) {
      const problem = createProblem(
        code === "validation_failed"
          ? { code, errors: [] }
          : code === "duplicate_round"
            ? { code, existingRoundId: 1 }
            : { code }
      );
      expect(problem.type).toBe(`${PROBLEM_TYPE_BASE}/${code}`);
      expect(problem.type).toBe(`https://api.handicappin.com/problems/${code}`);
      expect(problem.type).not.toBe("about:blank");
    }
  });

  test("status member mirrors the registry status", () => {
    for (const code of PROBLEM_CODES) {
      const problem = createProblem(
        code === "validation_failed"
          ? { code, errors: [] }
          : code === "duplicate_round"
            ? { code, existingRoundId: 1 }
            : { code }
      );
      expect(problem.status).toBe(PROBLEM_REGISTRY[code].status);
      expect(problem.code).toBe(code);
    }
  });

  test("code is always present — it is a REQUIRED extension member", () => {
    const problem = createProblem({ code: "internal_error" });
    expect(problem).toHaveProperty("code", "internal_error");
  });

  test("instance is omitted unless supplied", () => {
    expect(createProblem({ code: "not_found" })).not.toHaveProperty("instance");
    expect(
      createProblem({ code: "not_found", instance: "req_123" }).instance
    ).toBe("req_123");
  });

  test("errors[] appears on validation_failed only", () => {
    const validation = createProblem({
      code: "validation_failed",
      errors: [{ path: "teeTime", code: "tee_time_out_of_window", message: "x" }],
    });
    expect(validation.errors).toHaveLength(1);

    for (const code of PROBLEM_CODES) {
      if (code === "validation_failed") continue;
      const problem = createProblem(
        code === "duplicate_round"
          ? { code, existingRoundId: 7 }
          : { code }
      );
      expect(problem).not.toHaveProperty("errors");
    }
  });

  test("existingRoundId appears on duplicate_round only", () => {
    expect(
      createProblem({ code: "duplicate_round", existingRoundId: 42 })
        .existingRoundId
    ).toBe(42);

    for (const code of PROBLEM_CODES) {
      if (code === "duplicate_round") continue;
      const problem = createProblem(
        code === "validation_failed" ? { code, errors: [] } : { code }
      );
      expect(problem).not.toHaveProperty("existingRoundId");
    }
  });

  test("idempotency_conflict deliberately carries no existingRoundId", () => {
    expect(createProblem({ code: "idempotency_conflict" })).not.toHaveProperty(
      "existingRoundId"
    );
  });

  test("detail defaults to the vetted registry string and is overridable", () => {
    expect(createProblem({ code: "not_found" }).detail).toBe(
      PROBLEM_REGISTRY.not_found.detail
    );
    expect(
      createProblem({ code: "not_found", detail: "custom" }).detail
    ).toBe("custom");
  });

  test("no default detail leaks a stack trace, SQLSTATE or infra reason", () => {
    const forbidden = /at\s+\w+\s+\(|SQLSTATE|42501|redis|upstash|postgres|supabase/i;
    for (const code of PROBLEM_CODES) {
      expect(PROBLEM_REGISTRY[code].detail).not.toMatch(forbidden);
    }
  });

  test("media type is application/problem+json", () => {
    expect(PROBLEM_CONTENT_TYPE).toBe("application/problem+json");
  });

  test("problemTypeUri is stable per code", () => {
    expect(problemTypeUri("rate_limited")).toBe(
      "https://api.handicappin.com/problems/rate_limited"
    );
  });
});
