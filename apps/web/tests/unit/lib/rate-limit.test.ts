/**
 * Rate-limit fail-closed unit tests (api-platform subplan 001 / W0, step 5).
 *
 * Pins the ingress hardening contract:
 *  - the PUBLIC API surface (`/api/v1`, `api.handicappin.com`) FAILS CLOSED
 *    for every infrastructure failure mode (RATE_LIMIT_ENABLED unset, KV
 *    creds missing, Redis init throws, limiter throws at request time) and
 *    each denial is Sentry-alerted;
 *  - first-party limiters keep their historical FAIL-OPEN behavior;
 *  - `getIdentifier()` resolves the REAL client IP (cf-connecting-ip when
 *    the request traversed Cloudflare, x-real-ip for direct-to-Vercel) and
 *    prefers the authenticated principal.
 *
 * The module wires everything at import time, so each scenario re-imports it
 * with `vi.resetModules()` + `vi.stubEnv()` (env is read via `@/env`, with
 * SKIP_ENV_VALIDATION so only the vars under test matter).
 */

import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

const state = vi.hoisted(() => ({
  redisCtorThrows: false,
  ratelimitCtorThrows: false,
  limit: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(function () {
    if (state.redisCtorThrows) {
      throw new Error("redis init boom");
    }
  }),
}));

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    constructor() {
      if (state.ratelimitCtorThrows) {
        throw new Error("ratelimit init boom");
      }
    }
    limit(...args: unknown[]) {
      return state.limit(...args);
    }
    static slidingWindow = vi.fn(() => "sliding-window");
  }
  return { Ratelimit: MockRatelimit };
});

vi.mock("@/lib/sentry-utils", () => ({
  captureSentryError: vi.fn(),
}));

// Captured so tests can assert what reaches Vercel logs (PII redaction).
vi.mock("@/lib/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

type RateLimitModule = typeof import("@/lib/rate-limit");

/**
 * Re-import the module under a controlled env. Returns the fresh module and
 * the `captureSentryError` mock belonging to the same module registry.
 */
async function loadRateLimit(
  overrides: Record<string, string> = {}
): Promise<{ mod: RateLimitModule; capture: Mock; loggerError: Mock }> {
  vi.resetModules();
  vi.stubEnv("SKIP_ENV_VALIDATION", "1");
  // Neutralize anything leaked from .env.local (empty string = unset,
  // matching env.ts's emptyStringAsUndefined behavior).
  vi.stubEnv("RATE_LIMIT_ENABLED", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
  // The mocked sentry/logging module instances survive vi.resetModules()
  // (mock factories are cached), so clear their call history BEFORE the
  // module under test runs its init-time code.
  const sentry = await import("@/lib/sentry-utils");
  const capture = sentry.captureSentryError as unknown as Mock;
  capture.mockClear();
  const logging = await import("@/lib/logging");
  const loggerMocks = logging.logger as unknown as Record<string, Mock>;
  for (const fn of Object.values(loggerMocks)) {
    fn.mockClear();
  }
  const mod = await import("@/lib/rate-limit");
  return { mod, capture, loggerError: loggerMocks.error };
}

const ENABLED_WITH_CREDS = {
  RATE_LIMIT_ENABLED: "true",
  UPSTASH_REDIS_REST_URL: "https://dummy-kv.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "dummy-token",
};

function publicApiRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://api.handicappin.com/api/v1/rounds", { headers });
}

beforeEach(() => {
  state.redisCtorThrows = false;
  state.ratelimitCtorThrows = false;
  state.limit.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("enforcePublicApiRateLimit — fail-closed failure modes", () => {
  test("denies when RATE_LIMIT_ENABLED is unset and alerts Sentry", async () => {
    const { mod, capture } = await loadRateLimit();

    const result = await mod.enforcePublicApiRateLimit(publicApiRequest());

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(true);
    expect(result.reason).toBe("disabled");
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[1]).toMatchObject({
      eventType: "rate-limit-fail-closed",
      tags: { reason: "disabled" },
    });
  });

  test("denies when RATE_LIMIT_ENABLED is explicitly 'false'", async () => {
    const { mod } = await loadRateLimit({ RATE_LIMIT_ENABLED: "false" });

    const result = await mod.enforcePublicApiRateLimit(publicApiRequest());

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(true);
    expect(result.reason).toBe("disabled");
  });

  test("denies when Redis credentials are missing and alerts Sentry at init + request", async () => {
    const { mod, capture } = await loadRateLimit({
      RATE_LIMIT_ENABLED: "true",
      // UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN left unset
    });

    // Module init already alerted (rate limiting requested but unavailable).
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[1]).toMatchObject({
      eventType: "rate-limit-unavailable",
      tags: { reason: "missing-credentials" },
    });

    const result = await mod.enforcePublicApiRateLimit(publicApiRequest());

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(true);
    expect(result.reason).toBe("missing-credentials");
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[1]?.[1]).toMatchObject({
      eventType: "rate-limit-fail-closed",
      tags: { reason: "missing-credentials" },
    });
  });

  test("denies when Redis client init throws and alerts Sentry", async () => {
    state.redisCtorThrows = true;
    const { mod, capture } = await loadRateLimit(ENABLED_WITH_CREDS);

    const result = await mod.enforcePublicApiRateLimit(publicApiRequest());

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(true);
    expect(result.reason).toBe("init-error");
    expect(
      capture.mock.calls.some(
        (call) => call[1]?.eventType === "rate-limit-fail-closed"
      )
    ).toBe(true);
  });

  test("denies when the limiter throws at request time (runtime-error)", async () => {
    const { mod, capture } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockRejectedValueOnce(new Error("upstash down"));

    const result = await mod.enforcePublicApiRateLimit(publicApiRequest());

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(true);
    expect(result.reason).toBe("runtime-error");
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[1]).toMatchObject({
      eventType: "rate-limit-fail-closed",
      tags: { reason: "runtime-error" },
    });
  });

  test("never sends the raw identifier (IP) to Sentry or the logger, only its kind", async () => {
    const { mod, capture, loggerError } = await loadRateLimit();

    await mod.enforcePublicApiRateLimit(
      publicApiRequest({ "x-real-ip": "203.0.113.7" })
    );

    const context = capture.mock.calls[0]?.[1];
    expect(context.extra).toEqual({ identifierKind: "ip" });
    expect(JSON.stringify(context)).not.toContain("203.0.113.7");

    // The logger path (Vercel logs) must also never see the raw IP —
    // only the identifier kind.
    expect(loggerError).toHaveBeenCalled();
    const loggedPayloads = JSON.stringify(loggerError.mock.calls);
    expect(loggedPayloads).not.toContain("203.0.113.7");
    expect(loggedPayloads).toContain('"identifierKind":"ip"');
  });
});

describe("enforcePublicApiRateLimit — healthy limiter", () => {
  test("allows when under the limit and passes the identifier through", async () => {
    const { mod, capture } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 1234,
    });

    const result = await mod.enforcePublicApiRateLimit(
      publicApiRequest({ "x-real-ip": "203.0.113.7" })
    );

    expect(result).toEqual({
      success: true,
      failedClosed: false,
      limit: 60,
      remaining: 59,
      reset: 1234,
    });
    expect(state.limit).toHaveBeenCalledWith("ip:203.0.113.7");
    expect(capture).not.toHaveBeenCalled();
  });

  test("prefers the authenticated principal over the IP", async () => {
    const { mod } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 1234,
    });

    await mod.enforcePublicApiRateLimit(
      publicApiRequest({ "x-real-ip": "203.0.113.7" }),
      "user-123"
    );

    expect(state.limit).toHaveBeenCalledWith("user:user-123");
  });

  test("a genuine over-limit denial is NOT a fail-closed denial and not alerted", async () => {
    const { mod, capture } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      reset: 1234,
    });

    const result = await mod.enforcePublicApiRateLimit(publicApiRequest());

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("first-party limiters keep fail-open behavior", () => {
  test("allow when rate limiting is disabled", async () => {
    const { mod } = await loadRateLimit();

    const result = await mod.checkoutRateLimit.limit("user:abc");

    expect(result.success).toBe(true);
  });

  test("allow when KV credentials are missing (fail-open, but Sentry-alerted at init)", async () => {
    const { mod, capture } = await loadRateLimit({
      RATE_LIMIT_ENABLED: "true",
    });

    const checkout = await mod.checkoutRateLimit.limit("user:abc");
    const deletion = await mod.deletionRateLimit.limit("user:abc");

    expect(checkout.success).toBe(true);
    expect(deletion.success).toBe(true);
    expect(capture.mock.calls[0]?.[1]).toMatchObject({
      eventType: "rate-limit-unavailable",
    });
  });

  test("allow when Redis init throws (fail-open preserved)", async () => {
    state.redisCtorThrows = true;
    const { mod } = await loadRateLimit(ENABLED_WITH_CREDS);

    const result = await mod.contactRateLimit.limit("ip:1.2.3.4");

    expect(result.success).toBe(true);
  });
});

describe("isPublicApiRequest", () => {
  test("matches /api/v1 paths on any host", async () => {
    const { mod } = await loadRateLimit();

    expect(
      mod.isPublicApiRequest(
        new Request("https://www.handicappin.com/api/v1/rounds")
      )
    ).toBe(true);
    expect(
      mod.isPublicApiRequest(new Request("https://www.handicappin.com/api/v1"))
    ).toBe(true);
  });

  test("matches the api.handicappin.com host on any path", async () => {
    const { mod } = await loadRateLimit();

    expect(
      mod.isPublicApiRequest(
        new Request("https://api.handicappin.com/api/trpc/course.getCourseById")
      )
    ).toBe(true);
  });

  test("respects the Host header over the URL host", async () => {
    const { mod } = await loadRateLimit();

    expect(
      mod.isPublicApiRequest(
        new Request("https://www.handicappin.com/health", {
          headers: { host: "api.handicappin.com" },
        })
      )
    ).toBe(true);
  });

  test("does not match first-party paths or lookalike prefixes", async () => {
    const { mod } = await loadRateLimit();

    expect(
      mod.isPublicApiRequest(
        new Request("https://www.handicappin.com/api/trpc/course.getCourseById")
      )
    ).toBe(false);
    expect(
      mod.isPublicApiRequest(
        new Request("https://www.handicappin.com/api/v10/rounds")
      )
    ).toBe(false);
  });
});

describe("getIdentifier — real client IP resolution", () => {
  let getIdentifier: RateLimitModule["getIdentifier"];

  beforeEach(async () => {
    ({
      mod: { getIdentifier },
    } = await loadRateLimit());
  });

  test("prefers the authenticated user over any IP header", () => {
    const request = publicApiRequest({
      "cf-connecting-ip": "198.51.100.1",
      "x-real-ip": "203.0.113.7",
    });

    expect(getIdentifier(request, "user-1")).toBe("user:user-1");
  });

  test("orange-cloud web host: cf-connecting-ip (real client) wins over x-real-ip (Cloudflare edge IP)", () => {
    const request = publicApiRequest({
      "cf-connecting-ip": "198.51.100.1",
      // Behind orange-cloud this is a Cloudflare edge IP — the old bug
      // bucketed ALL anonymous traffic into a handful of these.
      "x-real-ip": "172.71.0.1",
      "x-forwarded-for": "198.51.100.1, 172.71.0.1",
    });

    expect(getIdentifier(request)).toBe("ip:198.51.100.1");
  });

  test("grey-clouded api host (direct to Vercel): x-real-ip is the real client IP", () => {
    const request = publicApiRequest({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "203.0.113.7",
    });

    expect(getIdentifier(request)).toBe("ip:203.0.113.7");
  });

  test("falls back to the LAST x-forwarded-for hop (never the attacker-chosen leftmost)", () => {
    const request = publicApiRequest({
      "x-forwarded-for": "6.6.6.6, 203.0.113.7",
    });

    expect(getIdentifier(request)).toBe("ip:203.0.113.7");
  });

  test("returns ip:unknown when no IP information exists", () => {
    expect(getIdentifier(publicApiRequest())).toBe("ip:unknown");
  });
});
