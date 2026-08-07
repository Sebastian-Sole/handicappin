/**
 * Response construction: the problem envelope on the wire, the JSON-intake
 * rules, and the rate-limit seam with T13.0a.
 */
import { describe, expect, test } from "vitest";

import { createProblem } from "@/lib/api/problem";
import {
  API_STABILITY_HEADER,
  API_STABILITY_VALUE,
  errorResponse,
  jsonResponse,
  problemResponse,
  problemResponseFor,
} from "@/app/api/v1/_lib/problem-response";
import {
  isAcceptedJsonContentType,
  readJsonBody,
} from "@/app/api/v1/_lib/request";
import {
  SERVICE_UNAVAILABLE_RETRY_AFTER_SECONDS,
  rateLimitHeaders,
  rateLimitProblem,
  rateLimitResponse,
  retryAfterSeconds,
  type V1RateLimitOutcome,
} from "@/app/api/v1/_lib/rate-limit-seam";

const NOW = 1_800_000_000_000;

describe("problem responses", () => {
  test("media type is application/problem+json and status mirrors the body", async () => {
    const response = problemResponse(createProblem({ code: "not_found" }));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8"
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "not_found",
      status: 404,
      type: "https://api.handicappin.com/problems/not_found",
    });
  });

  test("every /v1 response carries X-API-Stability: internal (§4)", () => {
    expect(
      problemResponseFor({ code: "internal_error" }).headers.get(
        API_STABILITY_HEADER
      )
    ).toBe(API_STABILITY_VALUE);
    expect(jsonResponse({ ok: true }, 201).headers.get(API_STABILITY_HEADER)).toBe(
      "internal"
    );
  });

  test("errorResponse routes through the central mapper and leaks nothing", async () => {
    const response = errorResponse(new Error("secret internal detail"), {
      route: "POST /v1/rounds",
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { detail?: string; code: string };
    expect(body.code).toBe("internal_error");
    expect(body.detail).not.toContain("secret internal detail");
  });

  test("extra headers merge without displacing the base headers", () => {
    const response = problemResponseFor(
      { code: "rate_limited" },
      { headers: { "Retry-After": "30" } }
    );
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get(API_STABILITY_HEADER)).toBe("internal");
  });
});

describe("JSON intake — wrong content type is 400, deliberately not 415", () => {
  test.each([
    ["application/json", true],
    ["application/json; charset=utf-8", true],
    ["application/merge-patch+json", true],
    ["APPLICATION/JSON", true],
    ["text/plain", false],
    ["application/x-www-form-urlencoded", false],
    [null, false],
  ])("%s → accepted: %s", (contentType, accepted) => {
    expect(isAcceptedJsonContentType(contentType)).toBe(accepted);
  });

  test("a wrong content type yields malformed_request (400), never 415", async () => {
    const request = new Request("https://api.handicappin.com/api/v1/rounds", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe("malformed_request");
    expect(result.problem.status).toBe(400);
    expect(result.problem.status).not.toBe(415);
  });

  test("unparseable JSON also yields malformed_request", async () => {
    const request = new Request("https://api.handicappin.com/api/v1/rounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe("malformed_request");
  });

  test("a well-formed body parses through", async () => {
    const request = new Request("https://api.handicappin.com/api/v1/rounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ externalId: "abc" }),
    });
    const result = await readJsonBody(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ externalId: "abc" });
  });
});

describe("rate-limit seam (§3)", () => {
  const exhausted: V1RateLimitOutcome = {
    success: false,
    failedClosed: false,
    limit: 60,
    remaining: 0,
    reset: NOW + 45_000,
  };
  const failedClosed: V1RateLimitOutcome = {
    success: false,
    failedClosed: true,
    limit: 0,
    remaining: 0,
    reset: NOW + 60_000,
  };

  test("budget exhausted → 429 rate_limited with Retry-After and the trio", async () => {
    const response = rateLimitResponse(exhausted, { now: NOW });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    // Reset is unix SECONDS while the outcome carries milliseconds.
    expect(response.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil((NOW + 45_000) / 1000))
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  });

  test("fail-closed → 503 service_unavailable with Retry-After: 60", async () => {
    const response = rateLimitResponse(failedClosed, { now: NOW });
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe(
      String(SERVICE_UNAVAILABLE_RETRY_AFTER_SECONDS)
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "service_unavailable",
      status: 503,
    });
  });

  test("fail-closed omits the X-RateLimit trio — the limiter never ran", () => {
    const headers = rateLimitHeaders(failedClosed, NOW);
    expect(headers).not.toHaveProperty("X-RateLimit-Limit");
    expect(headers).not.toHaveProperty("X-RateLimit-Reset");
  });

  test("the internal fail-closed reason never reaches the body", async () => {
    const withReason = {
      ...failedClosed,
      reason: "missing-credentials",
    } as V1RateLimitOutcome;
    const body = await rateLimitResponse(withReason, { now: NOW }).text();
    for (const leak of [
      "missing-credentials",
      "init-error",
      "runtime-error",
      "disabled",
      "redis",
      "upstash",
    ]) {
      expect(body.toLowerCase()).not.toContain(leak);
    }
  });

  test("Retry-After never advertises 0 seconds", () => {
    expect(retryAfterSeconds({ ...exhausted, reset: NOW - 5_000 }, NOW)).toBe(1);
    expect(retryAfterSeconds({ ...exhausted, reset: NOW }, NOW)).toBe(1);
  });

  test("only rate_limited and service_unavailable are reachable from the seam", () => {
    expect(rateLimitProblem(exhausted).code).toBe("rate_limited");
    expect(rateLimitProblem(failedClosed).code).toBe("service_unavailable");
  });

  test("a shipped PublicApiRateLimitResult satisfies the seam structurally", () => {
    // The seam is defined structurally so this PR needs no import from
    // `lib/rate-limit.ts` (T13.0a owns it). This is that assignment.
    const fromLimiter: {
      success: boolean;
      failedClosed: boolean;
      reason?: string;
      limit: number;
      remaining: number;
      reset: number;
    } = {
      success: false,
      failedClosed: false,
      reason: undefined,
      limit: 120,
      remaining: 0,
      reset: NOW + 1_000,
    };
    const outcome: V1RateLimitOutcome = fromLimiter;
    expect(rateLimitProblem(outcome).status).toBe(429);
  });
});
