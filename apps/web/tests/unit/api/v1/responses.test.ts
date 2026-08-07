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
  UNKNOWN_RESET_RETRY_AFTER_SECONDS,
  rateLimitHeaders,
  rateLimitProblem,
  rateLimitResponse,
  retryAfterSeconds,
  v1RateLimitIdentifier,
  v1RateLimitPrincipal,
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

  describe("the two mandatory headers are NOT overridable", () => {
    // §1's media type and §4's stability marker are contract requirements,
    // not defaults. A header contributor — `rateLimitHeaders()` today, any
    // future one — must not be able to displace them, and the failure would
    // be silent: a problem document served as `text/html`, or a surface
    // advertising itself as stable before a second consumer exists.
    const hostile: Record<string, string> = {
      // Both casings, because header names are case-insensitive: an
      // object-spread merge would keep `content-type` alongside
      // `Content-Type` and the Response constructor COMBINES them.
      "Content-Type": "text/html",
      "content-type": "text/html",
      [API_STABILITY_HEADER]: "stable",
      "x-api-stability": "stable",
      "Retry-After": "30",
    };

    test("problemResponse pins application/problem+json and internal", () => {
      const response = problemResponse(createProblem({ code: "rate_limited" }), {
        headers: hostile,
      });
      expect(response.headers.get("content-type")).toBe(
        "application/problem+json; charset=utf-8"
      );
      expect(response.headers.get(API_STABILITY_HEADER)).toBe(
        API_STABILITY_VALUE
      );
      // Non-mandatory extras still merge — this is a floor, not a filter.
      expect(response.headers.get("Retry-After")).toBe("30");
    });

    test("problemResponseFor and errorResponse pin them too", () => {
      for (const response of [
        problemResponseFor({ code: "not_found" }, { headers: hostile }),
        errorResponse(new Error("boom"), {}, { headers: hostile }),
      ]) {
        expect(response.headers.get("content-type")).toBe(
          "application/problem+json; charset=utf-8"
        );
        expect(response.headers.get(API_STABILITY_HEADER)).toBe(
          API_STABILITY_VALUE
        );
      }
    });

    test("jsonResponse pins application/json and internal", () => {
      const response = jsonResponse({ ok: true }, 201, { headers: hostile });
      expect(response.headers.get("content-type")).toBe(
        "application/json; charset=utf-8"
      );
      expect(response.headers.get(API_STABILITY_HEADER)).toBe(
        API_STABILITY_VALUE
      );
    });

    test("a clobber attempt leaves no trace of the caller's value", () => {
      // Guards the case-insensitive combining trap specifically: a merged
      // `text/html, application/problem+json` would satisfy a naive
      // `toContain` assertion but is not the contract's media type.
      const response = problemResponse(createProblem({ code: "forbidden" }), {
        headers: hostile,
      });
      expect(response.headers.get("content-type")).not.toContain("text/html");
      expect(response.headers.get(API_STABILITY_HEADER)).not.toContain(
        "stable"
      );
    });
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

  test("the limiter composes §3's exact key from v1RateLimitPrincipal's parts", () => {
    // Pins the seam from BOTH sides: `v1RateLimitIdentifier` states the
    // frozen encoding, and this reproduces `getIdentifier`'s composition
    // (`lib/rate-limit.ts`, T13.0a) from the parts a handler actually passes.
    // If either side drifts, this fails.
    const getIdentifier = (userId?: string, clientId?: string) =>
      userId
        ? clientId
          ? `client:${clientId}:user:${userId}`
          : `user:${userId}`
        : "ip:unknown";

    const oauth = {
      class: "oauth" as const,
      userId: "u1",
      token: "t",
      clientId: "c1",
      scopes: ["rounds:write"],
    };
    const firstParty = {
      class: "first-party" as const,
      userId: "u1",
      token: "t",
      clientId: null,
      scopes: null,
    };

    for (const principal of [oauth, firstParty]) {
      const parts = v1RateLimitPrincipal(principal);
      expect(getIdentifier(parts.userId, parts.clientId)).toBe(
        v1RateLimitIdentifier(principal)
      );
    }

    expect(v1RateLimitIdentifier(oauth)).toBe("client:c1:user:u1");
    expect(v1RateLimitIdentifier(firstParty)).toBe("user:u1");
  });

  test("passing the COMPOSED key instead of the parts double-prefixes it", () => {
    // Documents the trap `v1RateLimitPrincipal` exists to prevent: the
    // limiter's string branch means `{ userId: <string> }`, so a composed key
    // becomes `user:client:…:user:…` and `identifierKind` (split on ":")
    // reports "user" for OAuth traffic — losing principal-class attribution
    // in every fail-closed Sentry alert.
    const oauth = {
      class: "oauth" as const,
      userId: "u1",
      token: "t",
      clientId: "c1",
      scopes: [],
    };
    const asString = `user:${v1RateLimitIdentifier(oauth)}`;
    expect(asString).toBe("user:client:c1:user:u1");
    expect(asString.split(":")[0]).toBe("user");

    const parts = v1RateLimitPrincipal(oauth);
    expect(`client:${parts.clientId}:user:${parts.userId}`.split(":")[0]).toBe(
      "client"
    );
  });

  describe("a malformed outcome never puts NaN on the wire", () => {
    // The seam is coupled STRUCTURALLY, not statically (see the module
    // header), so nothing type-checks T13.0a's numbers on the way in. An
    // undefined-derived `reset` would render as the literal string "NaN" —
    // not a valid `Retry-After`, and free to be read as "retry immediately".
    test.each([
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
    ])("reset = %s → Retry-After falls back to the known-nothing value", (_label, reset) => {
      expect(retryAfterSeconds({ ...exhausted, reset }, NOW)).toBe(
        UNKNOWN_RESET_RETRY_AFTER_SECONDS
      );
      expect(rateLimitHeaders({ ...exhausted, reset }, NOW)["Retry-After"]).toBe(
        String(UNKNOWN_RESET_RETRY_AFTER_SECONDS)
      );
    });

    test.each([
      ["reset", { reset: Number.NaN }],
      ["limit", { limit: Number.NaN }],
      ["remaining", { remaining: Number.NaN }],
    ])(
      "a non-finite %s omits the whole trio — a budget we cannot state is not stated",
      (_label, override) => {
        const headers = rateLimitHeaders({ ...exhausted, ...override }, NOW);
        expect(headers).not.toHaveProperty("X-RateLimit-Limit");
        expect(headers).not.toHaveProperty("X-RateLimit-Remaining");
        expect(headers).not.toHaveProperty("X-RateLimit-Reset");
        // Retry-After survives: the client still gets a backoff instruction.
        expect(headers["Retry-After"]).toBeDefined();
      }
    );

    test("no header on a malformed 429 response is ever the text NaN", async () => {
      const response = rateLimitResponse(
        {
          success: false,
          failedClosed: false,
          limit: Number.NaN,
          remaining: Number.NaN,
          reset: Number.NaN,
        },
        { now: NOW }
      );
      expect(response.status).toBe(429);
      for (const [, value] of response.headers) {
        expect(value).not.toContain("NaN");
        expect(value).not.toContain("Infinity");
      }
      await expect(response.json()).resolves.toMatchObject({
        code: "rate_limited",
      });
    });

    test("a well-formed outcome is unaffected by the guard", () => {
      expect(rateLimitHeaders(exhausted, NOW)).toEqual({
        "Retry-After": "45",
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil((NOW + 45_000) / 1000)),
      });
    });
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
