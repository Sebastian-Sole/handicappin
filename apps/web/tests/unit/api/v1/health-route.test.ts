/**
 * `GET /v1/health` — route-level tests (T13.1).
 *
 * The route is the first real `/v1` endpoint, so these tests pin the whole
 * envelope end-to-end at the handler boundary rather than at the seam:
 * happy path, `X-API-Stability` (§4), the 429 rate-limit rendering (§3), the
 * 503 fail-closed rendering (§3), and the non-leak of the limiter's internal
 * reason.
 *
 * `@/lib/rate-limit` is the only mock. Everything else — the problem
 * registry, the response builders, the rate-limit seam — runs for real, which
 * is the point: this is the proof that the merged scaffolding composes.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  API_STABILITY_HEADER,
  PROBLEM_CONTENT_TYPE,
} from "@/app/api/v1/_lib";

const enforcePublicApiRateLimit = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  enforcePublicApiRateLimit: (...args: unknown[]) =>
    enforcePublicApiRateLimit(...args),
}));

const { GET } = await import("@/app/api/v1/health/route");

const NOW = 1_800_000_000_000;

/** A request shaped like the canary's: cookie-less, no Authorization. */
function healthRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://api.handicappin.com/api/v1/health", {
    method: "GET",
    headers,
  });
}

/** A budget-exhausted result, exactly as the shipped limiter returns one. */
function exhausted(overrides: Record<string, unknown> = {}) {
  return {
    success: false,
    failedClosed: false,
    family: "preauth",
    limit: 300,
    remaining: 0,
    reset: NOW + 30_000,
    ...overrides,
  };
}

/** A fail-closed result, exactly as `denyClosed()` builds one. */
function failedClosed(reason: string) {
  return {
    success: false,
    failedClosed: true,
    reason,
    family: "preauth",
    limit: 0,
    remaining: 0,
    reset: NOW + 60_000,
  };
}

function allowed() {
  return {
    success: true,
    failedClosed: false,
    family: "preauth",
    limit: 300,
    remaining: 299,
    reset: NOW + 60_000,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  enforcePublicApiRateLimit.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /v1/health — happy path", () => {
  test("200 with the fixed liveness body", async () => {
    enforcePublicApiRateLimit.mockResolvedValue(allowed());

    const response = await GET(healthRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  test("the body carries no data — no timestamp, version, or dependency roll-up", async () => {
    enforcePublicApiRateLimit.mockResolvedValue(allowed());

    const body = (await (await GET(healthRequest())).json()) as Record<
      string,
      unknown
    >;

    // A frozen literal: exactly one key. A future contributor adding
    // `version`/`uptime`/`db: "ok"` turns a liveness probe into an
    // information oracle on an UNAUTHENTICATED endpoint.
    expect(Object.keys(body)).toEqual(["status"]);
  });

  test("Cache-Control: no-store — a cached 200 would make the canary lie", async () => {
    enforcePublicApiRateLimit.mockResolvedValue(allowed());

    const response = await GET(healthRequest());

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("GET /v1/health — §4 stability header", () => {
  test("X-API-Stability: internal on the 200", async () => {
    enforcePublicApiRateLimit.mockResolvedValue(allowed());

    expect((await GET(healthRequest())).headers.get(API_STABILITY_HEADER)).toBe(
      "internal"
    );
  });

  test("X-API-Stability: internal on the 429 and the 503 too", async () => {
    // The status assertions are load-bearing, not decoration. Without them a
    // route that answered 200 to everything — i.e. one with the rate-limit
    // call deleted — satisfies this test, because `X-API-Stability` is on the
    // 200 as well. A test named for the 429 and the 503 must first establish
    // that it is looking at a 429 and a 503.
    enforcePublicApiRateLimit.mockResolvedValue(exhausted());
    const exhaustedResponse = await GET(healthRequest());
    expect(exhaustedResponse.status).toBe(429);
    expect(exhaustedResponse.headers.get(API_STABILITY_HEADER)).toBe(
      "internal"
    );

    enforcePublicApiRateLimit.mockResolvedValue(failedClosed("disabled"));
    const failedClosedResponse = await GET(healthRequest());
    expect(failedClosedResponse.status).toBe(503);
    expect(failedClosedResponse.headers.get(API_STABILITY_HEADER)).toBe(
      "internal"
    );
  });
});

describe("GET /v1/health — §3 rate limiting", () => {
  test("names the D15 `preauth` family and passes NO principal (IP-keyed, per §3)", async () => {
    enforcePublicApiRateLimit.mockResolvedValue(allowed());
    const request = healthRequest();

    await GET(request);

    expect(enforcePublicApiRateLimit).toHaveBeenCalledTimes(1);
    const [passedRequest, principal, family] =
      enforcePublicApiRateLimit.mock.calls[0]!;

    // The family is load-bearing: omitting it falls back silently to the
    // legacy unfamilied bucket. `preauth` (D15) because this route is
    // entirely unauthenticated — all of its traffic is pre-auth traffic.
    expect(family).toBe("preauth");
    expect(passedRequest).toBe(request);

    // The route is unauthenticated, so there is no principal to pass. What it
    // must NEVER pass is a hand-composed key string: the limiter's `string`
    // branch reads it as `{ userId: <string> }`, producing a double-prefixed
    // identifier and collapsing `identifierKind` in every Sentry alert.
    expect(principal).toBeUndefined();
    expect(typeof principal).not.toBe("string");
  });

  test("budget exhausted → 429 rate_limited + Retry-After + the X-RateLimit trio", async () => {
    enforcePublicApiRateLimit.mockResolvedValue(exhausted());

    const response = await GET(healthRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toBe(
      `${PROBLEM_CONTENT_TYPE}; charset=utf-8`
    );
    // reset is 30s out → ceil(30) = 30.
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("x-ratelimit-limit")).toBe("300");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(response.headers.get("x-ratelimit-reset")).toBe(
      String(Math.ceil((NOW + 30_000) / 1000))
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "rate_limited",
      status: 429,
      type: "https://api.handicappin.com/problems/rate_limited",
    });
  });

  test("limiter unavailable → 503 service_unavailable + Retry-After: 60 and NO X-RateLimit-* trio", async () => {
    enforcePublicApiRateLimit.mockResolvedValue(failedClosed("init-error"));

    const response = await GET(healthRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    // A zeroed budget would misdescribe an outage as "your quota is 0".
    expect(response.headers.get("x-ratelimit-limit")).toBeNull();
    expect(response.headers.get("x-ratelimit-remaining")).toBeNull();
    expect(response.headers.get("x-ratelimit-reset")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      code: "service_unavailable",
      status: 503,
    });
  });

  test.each([
    "disabled",
    "missing-credentials",
    "init-error",
    "runtime-error",
  ])(
    "the internal limiter reason %s reaches neither the body nor any header (§3 — Sentry only)",
    async (reason) => {
      enforcePublicApiRateLimit.mockResolvedValue(failedClosed(reason));

      const response = await GET(healthRequest());
      const raw = await response.clone().text();
      const headerDump = [...response.headers.entries()]
        .map(([name, value]) => `${name}: ${value}`)
        .join("\n");

      expect(raw).not.toContain(reason);
      expect(headerDump).not.toContain(reason);

      // And the body is exactly the closed-registry document plus the
      // correlation id — no `reason`, no `family`, no limiter internals
      // smuggled in as extra members.
      const body = (await response.json()) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual([
        "code",
        "detail",
        "instance",
        "status",
        "title",
        "type",
      ]);
      // `detail` is the registry's fixed string, identical for all four
      // reasons — it does not describe WHICH dependency failed.
      expect(body.detail).toBe("A dependency is unavailable. Retry later.");
      expect(body.instance).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    }
  );

  test("the limiter is consulted BEFORE any answer — a denial never returns 200", async () => {
    enforcePublicApiRateLimit.mockResolvedValue(exhausted());

    const response = await GET(healthRequest());

    expect(response.status).not.toBe(200);
    expect(enforcePublicApiRateLimit).toHaveBeenCalledTimes(1);
  });
});

describe("GET /v1/health — failure containment", () => {
  test("a throwing limiter becomes 500 internal_error, leaking nothing", async () => {
    enforcePublicApiRateLimit.mockRejectedValue(
      new Error("redis connection string sk_live_leaky")
    );

    const response = await GET(healthRequest());
    const raw = await response.clone().text();

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe(
      `${PROBLEM_CONTENT_TYPE}; charset=utf-8`
    );
    // §4 applies to the catch-all branch too — the 500 is built by
    // `errorResponse`, a different path from the 429/503 above.
    expect(response.headers.get(API_STABILITY_HEADER)).toBe("internal");
    expect(raw).not.toContain("sk_live_leaky");
    await expect(response.json()).resolves.toMatchObject({
      code: "internal_error",
      status: 500,
    });
  });
});
