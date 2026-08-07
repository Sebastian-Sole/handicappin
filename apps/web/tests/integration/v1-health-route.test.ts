/**
 * `GET /v1/health` against the REAL rate limiter (T13.1).
 *
 * The unit suite (`tests/unit/api/v1/health-route.test.ts`) mocks
 * `@/lib/rate-limit` so it can drive every branch. This suite mocks NOTHING:
 * it imports the shipped limiter module and proves the two halves of the seam
 * actually compose at runtime — the structural coupling documented in
 * `_lib/rate-limit-seam.ts` is checked by the type system at build time and by
 * exactly this file at run time.
 *
 * It needs no local Supabase stack: health touches no database by design, so
 * unlike the rest of `tests/integration/` this suite always runs, and it
 * never skips.
 *
 * §6's "integration tests must cover both principal classes" requirement does
 * NOT apply here — health is unauthenticated and never constructs a
 * principal, so there is no RLS asymmetry to cover. See the route's header
 * for the authentication decision and its reasoning.
 */
import { describe, expect, test } from "vitest";

import { API_STABILITY_HEADER } from "@/app/api/v1/_lib";
import { GET } from "@/app/api/v1/health/route";

/**
 * The four internal fail-closed reasons. §3 sends them to Sentry and forbids
 * them from the response — this suite checks the REAL limiter's real reason
 * never escapes, which the mocked suite can only simulate.
 */
const LIMITER_REASONS = [
  "disabled",
  "missing-credentials",
  "init-error",
  "runtime-error",
] as const;

/**
 * The shipped limiter reads `RATE_LIMIT_ENABLED` once, at module load, so the
 * branch this process takes is fixed before any test runs and cannot be
 * stubbed afterwards. Test envs leave it unset, so the expected outcome here
 * is the FAIL-CLOSED 503 — which is itself worth pinning, because it is the
 * shape the production canary will see if the flag is ever misconfigured.
 * The `enabled` fork is asserted rather than skipped so this file has no
 * silently-skipping test in either configuration.
 */
const limiterEnabled = process.env.RATE_LIMIT_ENABLED === "true";

function healthRequest(): Request {
  return new Request("https://api.handicappin.com/api/v1/health", {
    method: "GET",
    headers: { "x-forwarded-for": "203.0.113.9" },
  });
}

describe("/v1/health over the real rate limiter", () => {
  test("the seam composes: the real limiter result renders a /v1 response", async () => {
    const response = await GET(healthRequest());

    expect(response.headers.get(API_STABILITY_HEADER)).toBe("internal");

    if (limiterEnabled) {
      // A configured limiter must let the first probe of the window through.
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "application/json; charset=utf-8"
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    } else {
      // Fail-closed: the exact §3 503, built from a real `denyClosed()`
      // result rather than a hand-written fixture.
      expect(response.status).toBe(503);
      expect(response.headers.get("content-type")).toBe(
        "application/problem+json; charset=utf-8"
      );
      expect(response.headers.get("retry-after")).toBe("60");
      // A zeroed budget would misdescribe an outage as a real quota.
      expect(response.headers.get("x-ratelimit-limit")).toBeNull();
      expect(response.headers.get("x-ratelimit-remaining")).toBeNull();
      expect(response.headers.get("x-ratelimit-reset")).toBeNull();
      await expect(response.json()).resolves.toMatchObject({
        code: "service_unavailable",
        status: 503,
      });
    }
  });

  test("the real limiter's internal reason never reaches the wire", async () => {
    const response = await GET(healthRequest());
    const raw = await response.clone().text();
    const headerDump = [...response.headers.entries()]
      .map(([name, value]) => `${name}: ${value}`)
      .join("\n");

    for (const reason of LIMITER_REASONS) {
      expect(raw).not.toContain(reason);
      expect(headerDump).not.toContain(reason);
    }
  });
});
