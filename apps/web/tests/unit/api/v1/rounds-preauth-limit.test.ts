/**
 * `GET /v1/rounds` — the PRE-AUTH rate limit, and the property it exists for.
 *
 * `authenticateV1Request` → `extractBearerToken` short-circuits to 401 with no
 * network call only when the `Authorization` header is absent, has no space,
 * carries the wrong scheme, or has an empty token. **Any non-empty
 * `Bearer <anything>` reaches `supabase.auth.getUser(token)` — an HTTP call to
 * GoTrue.** GoTrue is shared with web sign-in, native, the watch bridge and the
 * OAuth token exchange, so an unlimited 1:1 amplifier on this route degrades
 * login product-wide. Contract §3 requires the bucket: "Pre-auth /
 * invalid-token requests (which still cost validation work and must be
 * limited): keyed `ip:{ip}` via the existing `CLIENT_IP_HEADERS` trust order."
 *
 * The assertion that pins the fix is therefore not "a 429 comes back" — it is
 * **that token validation is never reached** once the pre-auth budget is
 * exhausted. A 429 emitted after `auth.getUser` would still be a 429 and would
 * still amplify. Both halves are asserted below, with a positive control
 * proving validation IS reached when the pre-auth budget allows.
 *
 * The limiter is the only mock. Token validation is a real-module spy, so the
 * "not called" assertion is about the actual function the handler would hit.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

/** A syntactically valid Bearer token that no validator would accept. */
const REJECTED_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJub2JvZHkifQ.not-a-signature";

interface Outcome {
  success: boolean;
  failedClosed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const ALLOW: Outcome = {
  success: true,
  failedClosed: false,
  limit: 120,
  remaining: 119,
  reset: 0,
};

/**
 * `vi.hoisted` because `vi.mock`'s factory is lifted above every import and
 * cannot close over ordinary module-scope bindings.
 */
const limiter = vi.hoisted(() => ({
  calls: [] as { principal: unknown; family: unknown }[],
  /** Outcomes served in order; exhausted ⇒ allow. */
  queue: [] as unknown[],
}));

vi.mock("@/lib/rate-limit", () => ({
  enforcePublicApiRateLimit: async (
    _request: Request,
    principal: unknown,
    family: unknown
  ) => {
    limiter.calls.push({ principal, family });
    return limiter.queue.shift() ?? ALLOW;
  },
}));

/**
 * The network token validation, spied on the REAL module. `principal.ts`
 * resolves `getUserFromBearerToken` through this binding, so a call here is a
 * call to GoTrue in production.
 */
const validateToken = vi.hoisted(() => vi.fn(async () => null));

vi.mock("@/lib/api/bearer-token", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/bearer-token")>();
  return { ...actual, getUserFromBearerToken: validateToken };
});

const { GET } = await import("@/app/api/v1/rounds/route");

function request(token: string | null = REJECTED_TOKEN): Request {
  return new Request("https://api.handicappin.com/api/v1/rounds", {
    headers: {
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      "cf-connecting-ip": "203.0.113.7",
    },
  });
}

const exhausted: Outcome = {
  success: false,
  failedClosed: false,
  limit: 120,
  remaining: 0,
  reset: Date.now() + 30_000,
};

describe("GET /v1/rounds — pre-auth limit runs BEFORE token validation", () => {
  beforeEach(() => {
    limiter.calls.length = 0;
    limiter.queue.length = 0;
    validateToken.mockClear();
  });

  test("pre-auth budget exhausted → 429 and token validation is NEVER called", async () => {
    limiter.queue.push(exhausted);

    const response = await GET(request());

    expect(response.status).toBe(429);
    // THE assertion. A 429 emitted after `auth.getUser` would still be a 429
    // and would still amplify against GoTrue — the point is that the network
    // validation is not reached at all.
    expect(validateToken).not.toHaveBeenCalled();
    // And exactly one limiter call: the pre-auth one. The per-principal call
    // is downstream of an authentication that never happened.
    expect(limiter.calls).toHaveLength(1);
  });

  test("POSITIVE CONTROL: with budget available, the same token DOES reach validation", async () => {
    const response = await GET(request());

    // Proves the 429 above came from the pre-auth gate short-circuiting the
    // handler, not from a path that never validates anyway.
    expect(validateToken).toHaveBeenCalledTimes(1);
    expect(validateToken).toHaveBeenCalledWith(REJECTED_TOKEN);
    expect(response.status).toBe(401);
    // Still one limiter call — authentication failed before the
    // per-principal bucket is consulted.
    expect(limiter.calls).toHaveLength(1);
  });

  test("the pre-auth call is IP-keyed: no principal argument, D15 'preauth' family", async () => {
    await GET(request());

    const preAuth = limiter.calls[0]!;
    // `undefined` is what selects `ip:{ip}` — `getIdentifier` falls through to
    // the IP headers only when there is no `userId`. A hand-composed string
    // would take the limiter's `string` branch (`{ userId: <that string> }`)
    // and mis-key the bucket.
    expect(preAuth.principal).toBeUndefined();
    // `preauth` (D15), not `reads`: the pre-auth stage has its own family so
    // 401 bursts from shared egress IPs cannot consume the reads budget.
    expect(preAuth.family).toBe("preauth");
  });

  test("a fail-closed pre-auth limiter → 503, still without touching validation", async () => {
    limiter.queue.push({
      success: false,
      failedClosed: true,
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60_000,
      reason: "missing-credentials",
    });

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(validateToken).not.toHaveBeenCalled();
  });

  test("a request with NO Authorization header is limited too", async () => {
    // The header-absent case already 401s without a network call, so the
    // limiter is not what protects GoTrue here — but it is still spent, which
    // is what keeps one anonymous IP from probing the surface for free.
    limiter.queue.push(exhausted);

    const response = await GET(request(null));

    expect(response.status).toBe(429);
    expect(limiter.calls).toHaveLength(1);
    expect(limiter.calls[0]!.principal).toBeUndefined();
  });
});
