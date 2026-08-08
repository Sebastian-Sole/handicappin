/**
 * The PRE-AUTH rate limit on `POST /v1/rounds`, and the ordering it depends
 * on.
 *
 * ── The defect this pins ──────────────────────────────────────────────────
 * `authenticateV1Request` returns 401 without a network call ONLY when the
 * `Authorization` header is absent entirely. Any token-shaped string reaches
 * `getUserFromBearerToken` → `supabase.auth.getUser(token)`, a network round
 * trip to GoTrue — and §6 forbids replacing it with local JWKS validation,
 * because that would silently miss revocation. So authenticating BEFORE
 * limiting makes `Authorization: Bearer <anything>` an unmetered upstream
 * amplification vector.
 *
 * Contract §3 (~:197) already requires the fix: "Pre-auth / invalid-token
 * requests (WHICH STILL COST VALIDATION WORK and must be limited): keyed
 * `ip:{ip}`".
 *
 * The load-bearing assertion is `validateCalls`: it is the only thing that
 * distinguishes "limited" from "limited AFTER paying the cost", and a
 * status-code-only test passes in both worlds.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const limiter = vi.hoisted(() => ({
  calls: [] as { principal: unknown; family: unknown }[],
  outcomes: [] as unknown[],
}));

const ALLOW = {
  success: true,
  failedClosed: false,
  limit: 60,
  remaining: 59,
  reset: 0,
};

vi.mock("@/lib/rate-limit", () => ({
  enforcePublicApiRateLimit: async (
    _request: Request,
    principal: unknown,
    family: unknown
  ) => {
    limiter.calls.push({ principal, family });
    return limiter.outcomes.shift() ?? ALLOW;
  },
}));

const auth = vi.hoisted(() => ({
  validateCalls: 0,
  /** When set, validation SUCCEEDS and yields this user id. */
  user: null as { id: string } | null,
}));

vi.mock("@/lib/api/bearer-token", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/bearer-token")>();
  return {
    ...actual,
    // Stands in for the GoTrue round trip. Counting it is the whole point.
    getUserFromBearerToken: async () => {
      auth.validateCalls += 1;
      return auth.user;
    },
    createBearerTokenSupabaseClient: () => ({
      rpc: async () => ({ data: [], error: null }),
    }),
  };
});

// The DB handle is never reached in these cases; stubbing it keeps the unit
// suite off a real connection string.
vi.mock("@/db", () => ({ db: {} }));

const { POST } = await import("@/app/api/v1/rounds/route");

function request(token?: string): Request {
  return new Request("https://api.handicappin.com/api/v1/rounds", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "cf-connecting-ip": "203.0.113.9",
    },
    body: JSON.stringify({}),
  });
}

/** A JWS whose payload carries the given claims. Signature is never checked. */
function tokenWithClaims(claims: Record<string, unknown>): string {
  const segment = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${segment({ alg: "HS256", typ: "JWT" })}.${segment(claims)}.sig`;
}

describe("POST /v1/rounds pre-auth rate limit", () => {
  beforeEach(() => {
    limiter.calls.length = 0;
    limiter.outcomes.length = 0;
    auth.validateCalls = 0;
    auth.user = null;
  });

  test("the FIRST limiter call is IP-keyed (no principal) on the D15 preauth family", async () => {
    await POST(request("a-syntactically-valid-looking.token.value"));

    expect(limiter.calls.length).toBeGreaterThan(0);
    const first = limiter.calls[0]!;
    // No principal → the shipped limiter falls back to `ip:{ip}` via the
    // CLIENT_IP_HEADERS trust order. That is the §3 pre-auth key.
    expect(first.principal).toBeUndefined();
    // `preauth` (D15), not `rounds-write`: pre-auth traffic has its own
    // fail-closed family (`ratelimit:public-api:preauth`, own env-tunable
    // budget) so a burst of token-expiry 401s from a consumer's few egress
    // IPs (fitbull on Convex) cannot cap the route family fleet-wide.
    expect(first.family).toBe("preauth");
  });

  test("the per-principal call stays on rounds-write — authenticated traffic never draws from preauth", async () => {
    auth.user = { id: "00000000-0000-4000-8000-000000000002" };
    const token = tokenWithClaims({
      sub: "00000000-0000-4000-8000-000000000002",
      client_id: "fitbull-test",
      scope: "profile:read rounds:write",
    });

    await POST(request(token));

    expect(limiter.calls).toHaveLength(2);
    // Pre-auth stage: preauth family, no principal.
    expect(limiter.calls[0]).toEqual({ principal: undefined, family: "preauth" });
    // Authenticated stage: same family, budget and key shape as before D15.
    const second = limiter.calls[1]!;
    expect(second.family).toBe("rounds-write");
    expect(second.principal).toEqual({
      userId: "00000000-0000-4000-8000-000000000002",
      clientId: "fitbull-test",
    });
    // Exactly one preauth draw per request — authenticated traffic does not
    // touch the preauth family a second time.
    expect(
      limiter.calls.filter((call) => call.family === "preauth")
    ).toHaveLength(1);
  });

  test("budget exhausted → 429 WITHOUT ever validating the token", async () => {
    limiter.outcomes.push({
      success: false,
      failedClosed: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const response = await POST(request("forged.but.well-formed"));

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "rate_limited" });
    // THE assertion. A handler that authenticates first would report 429 too
    // — having already paid for the GoTrue call it was supposed to prevent.
    expect(auth.validateCalls).toBe(0);
    // And it stopped there: no per-principal call was made.
    expect(limiter.calls).toHaveLength(1);
  });

  test("limiter unavailable → 503 WITHOUT ever validating the token", async () => {
    limiter.outcomes.push({
      success: false,
      failedClosed: true,
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const response = await POST(request("forged.but.well-formed"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "service_unavailable",
    });
    expect(auth.validateCalls).toBe(0);
  });

  test("within budget, an invalid token reaches validation exactly once and 401s", async () => {
    const response = await POST(request("forged.but.well-formed"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
    expect(auth.validateCalls).toBe(1);
    // Pre-auth only: the per-principal limiter needs a principal.
    expect(limiter.calls).toHaveLength(1);
  });

  test("an OAuth token whose scope does not permit writes → 403 forbidden, before any body parse", async () => {
    // No real token is denied today — the access-token hook stamps
    // `rounds:read rounds:write` unconditionally (D11) — so this is the ONLY
    // place the scope guard is exercised. Without it, the day a token is
    // minted with a narrower scope, that token writes rounds anyway.
    auth.user = { id: "00000000-0000-4000-8000-000000000001" };
    const token = tokenWithClaims({
      sub: "00000000-0000-4000-8000-000000000001",
      client_id: "fitbull-test",
      scope: "profile:read",
    });

    const response = await POST(request(token));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "forbidden" });
    // Denied before the per-principal limiter and before the body is read.
    expect(limiter.calls).toHaveLength(1);
  });

  test("an OAuth token carrying rounds:write passes the scope guard", async () => {
    auth.user = { id: "00000000-0000-4000-8000-000000000002" };
    const token = tokenWithClaims({
      sub: "00000000-0000-4000-8000-000000000002",
      client_id: "fitbull-test",
      scope: "profile:read rounds:write",
    });

    // Body is `{}` → it gets past the scope guard and the limiter and fails
    // at schema validation instead, which is what proves the guard let it by.
    const response = await POST(request(token));

    expect(response.status).toBe(422);
    expect(limiter.calls).toHaveLength(2);
  });

  test("a request with NO Authorization header still spends the pre-auth budget", async () => {
    // It costs the edge a request either way, and §3 names "pre-auth" traffic
    // — not "traffic that happens to carry a token" — as the thing to limit.
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(limiter.calls).toHaveLength(1);
    expect(auth.validateCalls).toBe(0);
  });
});
