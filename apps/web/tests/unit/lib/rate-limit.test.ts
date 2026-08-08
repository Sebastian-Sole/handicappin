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

/** Sliding-window descriptor produced by the mocked `Ratelimit.slidingWindow`. */
interface WindowSpec {
  kind: "sliding-window";
  limit: unknown;
  window: unknown;
}

const state = vi.hoisted(() => ({
  redisCtorThrows: false,
  ratelimitCtorThrows: false,
  limit: vi.fn(),
  /** Every Ratelimit constructed at module init, in order. */
  constructed: [] as { prefix?: string; window?: unknown }[],
  /** Every `.limit()` call, tagged with the bucket it landed in. */
  calls: [] as { prefix?: string; identifier?: unknown }[],
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
    prefix?: string;
    constructor(config?: { prefix?: string; limiter?: unknown }) {
      if (state.ratelimitCtorThrows) {
        throw new Error("ratelimit init boom");
      }
      this.prefix = config?.prefix;
      state.constructed.push({
        prefix: config?.prefix,
        window: config?.limiter,
      });
    }
    limit(...args: unknown[]) {
      state.calls.push({ prefix: this.prefix, identifier: args[0] });
      return state.limit(...args);
    }
    // Returns a descriptor rather than an opaque string so tests can assert
    // WHICH budget/window each prefix was built with.
    static slidingWindow = vi.fn((limit: unknown, window: unknown) => ({
      kind: "sliding-window" as const,
      limit,
      window,
    }));
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
 * The `/v1` family budgets (the four frozen route families + D15's preauth
 * stage family). Neutralized on every load so a value leaking from
 * `.env.local` can't move an assertion.
 */
const V1_FAMILY_ENV_VARS = [
  "RATE_LIMIT_ROUNDS_WRITE_PER_MIN",
  "RATE_LIMIT_API_READS_PER_MIN",
  "RATE_LIMIT_COURSE_SUBMIT_PER_HOUR",
  "RATE_LIMIT_PROVISION_PER_HOUR",
  "RATE_LIMIT_PREAUTH_PER_MIN",
] as const;

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
  for (const key of V1_FAMILY_ENV_VARS) {
    vi.stubEnv(key, "");
  }
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
  state.constructed.length = 0;
  state.calls.length = 0;
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

  test("allow when the live limiter throws at request time (transient Upstash blip) and alert Sentry", async () => {
    const { mod, capture, loggerError } = await loadRateLimit(
      ENABLED_WITH_CREDS
    );
    // Simulate `TypeError: fetch failed` (getaddrinfo ENOTFOUND ...upstash.io)
    // out of the @upstash/ratelimit pipeline once the client already exists.
    state.limit.mockRejectedValueOnce(
      new TypeError("fetch failed")
    );

    const result = await mod.checkoutRateLimit.limit("user:abc");

    // Fail OPEN: request allowed through despite the runtime throw.
    expect(result.success).toBe(true);
    // Outage stays visible.
    expect(loggerError).toHaveBeenCalled();
    expect(
      capture.mock.calls.some(
        (call) => call[1]?.eventType === "rate-limit-runtime-error"
      )
    ).toBe(true);
  });

  test("uses the live limiter result on the happy path (does not always bypass)", async () => {
    const { mod, capture } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 999,
    });

    const result = await mod.checkoutRateLimit.limit("user:abc");

    // A genuine over-limit denial from the live limiter is passed through
    // untouched — the runtime wrapper only intercepts throws.
    expect(result.success).toBe(false);
    expect(state.limit).toHaveBeenCalledWith("user:abc");
    expect(capture).not.toHaveBeenCalled();
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

// ---------------------------------------------------------------------------
// /v1 rate-limit principal + per-family buckets (contract 005 §3)
// ---------------------------------------------------------------------------

describe("getIdentifier — the (client_id, user) pair key", () => {
  let getIdentifier: RateLimitModule["getIdentifier"];

  beforeEach(async () => {
    ({
      mod: { getIdentifier },
    } = await loadRateLimit());
  });

  test("OAuth-client principal keys on the PAIR, not on client_id alone", () => {
    // client_id alone would collapse every user of a connected app into one
    // shared bucket — the failure this encoding exists to prevent.
    expect(getIdentifier(publicApiRequest(), "user-1", "fitbull")).toBe(
      "client:fitbull:user:user-1"
    );
    expect(getIdentifier(publicApiRequest(), "user-2", "fitbull")).toBe(
      "client:fitbull:user:user-2"
    );
  });

  test("first-party principal (no client_id claim) keys as user:{sub}, unchanged", () => {
    expect(getIdentifier(publicApiRequest(), "user-1")).toBe("user:user-1");
    expect(getIdentifier(publicApiRequest(), "user-1", undefined)).toBe(
      "user:user-1"
    );
  });

  test("pre-auth / invalid-token request keys per-IP via the trust order", () => {
    expect(
      getIdentifier(
        publicApiRequest({
          "cf-connecting-ip": "198.51.100.1",
          "x-real-ip": "172.71.0.1",
        })
      )
    ).toBe("ip:198.51.100.1");
  });

  test("authenticated traffic is NEVER keyed per-IP, whatever the IP headers say", () => {
    const request = publicApiRequest({
      "cf-connecting-ip": "198.51.100.1",
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "6.6.6.6, 203.0.113.7",
    });

    expect(getIdentifier(request, "user-1", "fitbull")).toBe(
      "client:fitbull:user:user-1"
    );
    expect(getIdentifier(request, "user-1")).toBe("user:user-1");
  });

  test("a client_id with no user falls back to the IP key, not a per-client bucket", () => {
    // Not a real principal (an OAuth token always carries `sub`); minting a
    // client-wide bucket here would be a bucket any caller could claim.
    expect(
      getIdentifier(publicApiRequest({ "x-real-ip": "203.0.113.7" }), undefined, "fitbull")
    ).toBe("ip:203.0.113.7");
  });
});

describe("per-route-family buckets", () => {
  /** Distinct budgets so each prefix's wiring is individually observable. */
  const DISTINCT_BUDGETS = {
    ...ENABLED_WITH_CREDS,
    RATE_LIMIT_ROUNDS_WRITE_PER_MIN: "61",
    RATE_LIMIT_API_READS_PER_MIN: "121",
    RATE_LIMIT_COURSE_SUBMIT_PER_HOUR: "11",
    RATE_LIMIT_PROVISION_PER_HOUR: "6",
    RATE_LIMIT_PREAUTH_PER_MIN: "301",
  };

  function constructedFor(prefix: string) {
    return state.constructed.find((entry) => entry.prefix === prefix);
  }

  test("every family gets its own Redis prefix under ratelimit:public-api:", async () => {
    const { mod } = await loadRateLimit(ENABLED_WITH_CREDS);

    const families = Object.keys(mod.PUBLIC_API_RATE_LIMIT_FAMILIES);
    expect(families.sort()).toEqual([
      "course-submit",
      "preauth",
      "provision",
      "reads",
      "rounds-write",
    ]);

    const prefixes = families.map((family) =>
      mod.publicApiFamilyPrefix(family as keyof typeof mod.PUBLIC_API_RATE_LIMIT_FAMILIES)
    );
    expect(prefixes.sort()).toEqual([
      "ratelimit:public-api:course-submit",
      "ratelimit:public-api:preauth",
      "ratelimit:public-api:provision",
      "ratelimit:public-api:reads",
      "ratelimit:public-api:rounds-write",
    ]);
    // Every prefix distinct, and none equal to the legacy global bucket.
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(prefixes).not.toContain("ratelimit:public-api");

    for (const prefix of prefixes) {
      expect(constructedFor(prefix)).toBeDefined();
    }
  });

  test("each family is driven by its own env var and window", async () => {
    await loadRateLimit(DISTINCT_BUDGETS);

    // SKIP_ENV_VALIDATION passes raw strings through @t3-oss/env (no zod
    // coercion), so compare stringified — the point is WHICH var reached
    // WHICH prefix, which the numeric defaults are asserted for separately
    // in env-rate-limit-assert.test.ts.
    const expectations: [string, string, string][] = [
      ["ratelimit:public-api:rounds-write", "61", "1 m"],
      ["ratelimit:public-api:reads", "121", "1 m"],
      ["ratelimit:public-api:course-submit", "11", "1 h"],
      ["ratelimit:public-api:provision", "6", "1 h"],
      ["ratelimit:public-api:preauth", "301", "1 m"],
    ];

    for (const [prefix, limit, window] of expectations) {
      const spec = constructedFor(prefix)?.window as WindowSpec | undefined;
      expect(spec?.kind).toBe("sliding-window");
      expect(String(spec?.limit)).toBe(limit);
      expect(spec?.window).toBe(window);
    }
  });

  test("two families do NOT share a bucket for the same principal", async () => {
    const { mod } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 1234,
    });
    const principal = { userId: "user-1", clientId: "fitbull" };

    const write = await mod.enforcePublicApiRateLimit(
      publicApiRequest(),
      principal,
      "rounds-write"
    );
    const read = await mod.enforcePublicApiRateLimit(
      publicApiRequest(),
      principal,
      "reads"
    );

    expect(write.family).toBe("rounds-write");
    expect(read.family).toBe("reads");
    expect(state.calls).toEqual([
      {
        prefix: "ratelimit:public-api:rounds-write",
        identifier: "client:fitbull:user:user-1",
      },
      {
        prefix: "ratelimit:public-api:reads",
        identifier: "client:fitbull:user:user-1",
      },
    ]);
  });

  test("omitting the family falls back to the legacy global bucket", async () => {
    const { mod } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 1234,
    });

    const result = await mod.enforcePublicApiRateLimit(
      publicApiRequest(),
      "user-1"
    );

    expect(result.family).toBeUndefined();
    expect(state.calls).toEqual([
      { prefix: "ratelimit:public-api", identifier: "user:user-1" },
    ]);
  });

  test("family limiters fail CLOSED when the limiter is unavailable", async () => {
    // RATE_LIMIT_ENABLED unset — the trap that denies 100% of /v1 traffic.
    const { mod, capture } = await loadRateLimit();

    for (const family of ["rounds-write", "reads", "course-submit", "provision"] as const) {
      // preauth is exercised separately below — its identifierKind is "ip".
      capture.mockClear();
      const result = await mod.enforcePublicApiRateLimit(
        publicApiRequest(),
        { userId: "user-1", clientId: "fitbull" },
        family
      );

      expect(result.success).toBe(false);
      expect(result.failedClosed).toBe(true);
      expect(result.reason).toBe("disabled");
      expect(result.family).toBe(family);
      expect(capture.mock.calls[0]?.[1]).toMatchObject({
        eventType: "rate-limit-fail-closed",
        tags: { reason: "disabled", family },
      });
      // Never the raw principal — only its kind.
      expect(capture.mock.calls[0]?.[1].extra).toEqual({
        identifierKind: "client",
      });
    }
    // No live bucket was consulted.
    expect(state.calls).toEqual([]);
  });

  test("family limiters fail CLOSED when the limiter throws at request time", async () => {
    const { mod, capture } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockRejectedValueOnce(new Error("upstash down"));

    const result = await mod.enforcePublicApiRateLimit(
      publicApiRequest(),
      { userId: "user-1" },
      "rounds-write"
    );

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(true);
    expect(result.reason).toBe("runtime-error");
    expect(capture.mock.calls[0]?.[1]).toMatchObject({
      eventType: "rate-limit-fail-closed",
      tags: { reason: "runtime-error", family: "rounds-write" },
    });
  });

  test("family limiters fail CLOSED when Redis init throws (no bucket exists)", async () => {
    state.redisCtorThrows = true;
    const { mod } = await loadRateLimit(ENABLED_WITH_CREDS);

    const result = await mod.enforcePublicApiRateLimit(
      publicApiRequest(),
      { userId: "user-1" },
      "reads"
    );

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(true);
    expect(result.reason).toBe("init-error");
  });

  test("a genuine over-limit denial on a family is not a fail-closed denial", async () => {
    const { mod, capture } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      reset: 1234,
    });

    const result = await mod.enforcePublicApiRateLimit(
      publicApiRequest(),
      { userId: "user-1", clientId: "fitbull" },
      "rounds-write"
    );

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("the D15 preauth family — dedicated pre-auth budget", () => {
  const OK = { success: true, limit: 300, remaining: 299, reset: 1234 };

  test("a pre-auth call (no principal) lands in ratelimit:public-api:preauth, keyed ip:{ip}", async () => {
    const { mod } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValue(OK);

    const result = await mod.enforcePublicApiRateLimit(
      publicApiRequest({ "cf-connecting-ip": "203.0.113.9" }),
      undefined,
      "preauth"
    );

    expect(result.success).toBe(true);
    expect(result.family).toBe("preauth");
    expect(state.calls).toEqual([
      { prefix: "ratelimit:public-api:preauth", identifier: "ip:203.0.113.9" },
    ]);
  });

  test("the preauth bucket is DISJOINT from every route family: an authenticated request never touches it, and a pre-auth request never touches a route family", async () => {
    const { mod } = await loadRateLimit(ENABLED_WITH_CREDS);
    state.limit.mockResolvedValue(OK);
    const request = publicApiRequest({ "cf-connecting-ip": "203.0.113.9" });

    // The two calls a /v1 route actually makes, in order.
    await mod.enforcePublicApiRateLimit(request, undefined, "preauth");
    await mod.enforcePublicApiRateLimit(
      request,
      { userId: "user-1", clientId: "fitbull" },
      "rounds-write"
    );

    expect(state.calls).toEqual([
      { prefix: "ratelimit:public-api:preauth", identifier: "ip:203.0.113.9" },
      {
        prefix: "ratelimit:public-api:rounds-write",
        identifier: "client:fitbull:user:user-1",
      },
    ]);
    // No cross-contamination in either direction.
    const preauthCalls = state.calls.filter(
      (call) => call.prefix === "ratelimit:public-api:preauth"
    );
    expect(preauthCalls).toHaveLength(1);
    expect(preauthCalls[0]?.identifier).toBe("ip:203.0.113.9");
  });

  test("RATE_LIMIT_PREAUTH_PER_MIN is the env var that drives the preauth window", async () => {
    // Which VAR reaches which PREFIX. The 300 default itself is asserted
    // against the real zod schema in env-rate-limit-assert.test.ts —
    // SKIP_ENV_VALIDATION (used by loadRateLimit) bypasses zod defaults, so
    // this suite pins the wiring with a distinct sentinel value instead.
    await loadRateLimit({
      ...ENABLED_WITH_CREDS,
      RATE_LIMIT_PREAUTH_PER_MIN: "301",
    });

    const spec = state.constructed.find(
      (entry) => entry.prefix === "ratelimit:public-api:preauth"
    )?.window as WindowSpec | undefined;
    expect(spec?.kind).toBe("sliding-window");
    expect(String(spec?.limit)).toBe("301");
    expect(spec?.window).toBe("1 m");
  });

  test("the preauth family fails CLOSED like every other family, with identifierKind 'ip'", async () => {
    // RATE_LIMIT_ENABLED unset — limiter unavailable.
    const { mod, capture } = await loadRateLimit();

    const result = await mod.enforcePublicApiRateLimit(
      publicApiRequest({ "x-real-ip": "203.0.113.9" }),
      undefined,
      "preauth"
    );

    expect(result.success).toBe(false);
    expect(result.failedClosed).toBe(true);
    expect(result.reason).toBe("disabled");
    expect(result.family).toBe("preauth");
    expect(capture.mock.calls[0]?.[1]).toMatchObject({
      eventType: "rate-limit-fail-closed",
      tags: { reason: "disabled", family: "preauth" },
    });
    expect(capture.mock.calls[0]?.[1].extra).toEqual({
      identifierKind: "ip",
    });
  });
});

describe("response seam for the /v1 error mapper", () => {
  let mod: RateLimitModule;

  beforeEach(async () => {
    ({ mod } = await loadRateLimit(ENABLED_WITH_CREDS));
  });

  test("an allowed request maps to no status and the X-RateLimit trio only", () => {
    const result = {
      success: true,
      failedClosed: false,
      limit: 60,
      remaining: 59,
      // 2026-01-01T00:00:30.500Z — proves ms→s conversion, not a passthrough.
      reset: 1_767_225_630_500,
    };

    expect(mod.rateLimitDenialStatus(result)).toBeNull();
    expect(mod.rateLimitHeaders(result)).toEqual({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "59",
      "X-RateLimit-Reset": "1767225631",
    });
  });

  test("budget exhausted maps to 429 with Retry-After derived from reset", () => {
    const now = 1_767_225_600_000;
    const result = {
      success: false,
      failedClosed: false,
      limit: 60,
      remaining: 0,
      reset: now + 30_000,
    };

    expect(mod.rateLimitDenialStatus(result)).toBe(429);
    expect(mod.rateLimitHeaders(result, now)).toEqual({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1767225630",
      "Retry-After": "30",
    });
  });

  test("Retry-After is never 0 or negative for an already-elapsed window", () => {
    const now = 1_767_225_600_000;
    const headers = mod.rateLimitHeaders(
      { success: false, failedClosed: false, limit: 60, remaining: 0, reset: now - 5_000 },
      now
    );

    expect(headers["Retry-After"]).toBe("1");
  });

  test("fail-closed maps to 503 with Retry-After: 60 and no budget headers", async () => {
    const { mod: disabled } = await loadRateLimit();
    const result = await disabled.enforcePublicApiRateLimit(
      publicApiRequest(),
      { userId: "user-1", clientId: "fitbull" },
      "rounds-write"
    );

    expect(disabled.rateLimitDenialStatus(result)).toBe(503);
    // Only Retry-After: a zeroed budget on a 503 would describe the outage,
    // and the internal reason must never leave via a header either.
    expect(disabled.rateLimitHeaders(result)).toEqual({ "Retry-After": "60" });
    expect(JSON.stringify(disabled.rateLimitHeaders(result))).not.toContain(
      "disabled"
    );
  });
});
