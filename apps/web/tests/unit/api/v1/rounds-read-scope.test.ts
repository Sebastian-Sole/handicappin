/**
 * D11 — the scope gates on `/v1/rounds`, exercised through the real handlers.
 *
 * The hook stamps `rounds:read rounds:write` on every OAuth-client token
 * (20260808090000), the GET gates on read-OR-write, and POST stays
 * `rounds:write`-only. Four cases pin the decision:
 *
 *   1. a `rounds:write`-only token passes the GET gate — THE load-bearing
 *      case. Every token minted before 20260808090000 carries exactly this
 *      scope, so if this fails, shipping D11 breaks every live client;
 *   2. a `rounds:read`-only token passes the GET gate — the capability D11
 *      exists to make representable (no such token is minted today);
 *   3. a `rounds:read`-only token is 403 `forbidden` on POST — reads must not
 *      quietly imply writes, or the read-only client D11 enables is a fiction;
 *   4. a token with NEITHER scope is 403 `forbidden` on GET — the gate
 *      relaxed to read-or-write, not to nothing.
 *
 * "Passes the gate" is asserted as a 200 from the full GET pipeline (with the
 * per-principal limiter consulted), never as the mere absence of a 403 — a
 * handler that crashed after the gate would fail these tests, as it should.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const limiter = vi.hoisted(() => ({
  calls: [] as { principal: unknown; family: unknown }[],
}));

vi.mock("@/lib/rate-limit", () => ({
  enforcePublicApiRateLimit: async (
    _request: Request,
    principal: unknown,
    family: unknown
  ) => {
    limiter.calls.push({ principal, family });
    return { success: true, failedClosed: false, limit: 120, remaining: 119, reset: 0 };
  },
}));

const USER_ID = "00000000-0000-4000-8000-000000000042";

/**
 * A PostgREST builder stub: every chained call returns itself, and awaiting
 * it yields zero rows. Enough for `listV1Rounds` to produce an empty page.
 */
function emptyBuilder(): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range"]) {
    builder[method] = () => builder;
  }
  builder.then = (
    resolve: (value: { data: unknown[]; error: null; count: number }) => unknown
  ) => resolve({ data: [], error: null, count: 0 });
  return builder;
}

vi.mock("@/lib/api/bearer-token", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/bearer-token")>();
  return {
    ...actual,
    // Stands in for the GoTrue round trip: every token in this file is valid.
    getUserFromBearerToken: async () => ({ id: USER_ID }),
    // Stands in for the RLS-scoped PostgREST client: a provisioned,
    // unlimited entitlement and an empty rounds table.
    createBearerTokenSupabaseClient: () => ({
      rpc: async () => ({
        data: [
          {
            is_provisioned: true,
            has_unlimited_rounds: true,
            rounds_limit: null,
            rounds_used: 0,
          },
        ],
        error: null,
      }),
      from: () => emptyBuilder(),
    }),
  };
});

// Never reached (every POST here is denied at the scope gate), but importing
// the route module must not open a real connection.
vi.mock("@/db", () => ({ db: {} }));

const { GET, POST } = await import("@/app/api/v1/rounds/route");

/** An unsigned JWT-shaped token; only the payload is ever decoded. */
function tokenWithScope(scope: string): string {
  const segment = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${segment({ alg: "HS256", typ: "JWT" })}.${segment({
    sub: USER_ID,
    client_id: "fitbull-test",
    scope,
  })}.sig`;
}

function get(scope: string): Request {
  return new Request("https://api.handicappin.com/api/v1/rounds", {
    headers: {
      authorization: `Bearer ${tokenWithScope(scope)}`,
      "cf-connecting-ip": "203.0.113.11",
    },
  });
}

function post(scope: string): Request {
  return new Request("https://api.handicappin.com/api/v1/rounds", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${tokenWithScope(scope)}`,
      "cf-connecting-ip": "203.0.113.11",
    },
    body: JSON.stringify({}),
  });
}

beforeEach(() => {
  limiter.calls.length = 0;
});

describe("GET /v1/rounds — read-OR-write scope gate (D11)", () => {
  test("BACKWARD COMPAT: a rounds:write-only token still passes the GET gate", async () => {
    // Every OAuth token minted before 20260808090000 carries exactly
    // `rounds:write`. D11 is a pure relaxation only if this holds.
    const response = await GET(get("rounds:write"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [] });
    // Pre-auth + per-principal: the gate sits between them, and both ran.
    expect(limiter.calls).toHaveLength(2);
  });

  test("a rounds:read-only token passes the GET gate", async () => {
    const response = await GET(get("rounds:read"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [] });
    expect(limiter.calls).toHaveLength(2);
  });

  test("a token with NEITHER rounds scope is 403 forbidden", async () => {
    const response = await GET(get("profile:read"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "forbidden" });
    // Denied at the gate: the per-principal limiter was never consulted.
    expect(limiter.calls).toHaveLength(1);
  });
});

describe("POST /v1/rounds — rounds:write only (D11 leaves the write gate alone)", () => {
  test("a rounds:read-only token is 403 forbidden — read does not imply write", async () => {
    const response = await POST(post("rounds:read"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "forbidden" });
    expect(limiter.calls).toHaveLength(1);
  });

  test("POSITIVE CONTROL: the same request with rounds:write clears the gate", async () => {
    // Body `{}` fails schema validation AFTER the gate and the per-principal
    // limiter — a 422, not a 403, is what proves the gate let it through.
    const response = await POST(post("rounds:write"));

    expect(response.status).toBe(422);
    expect(limiter.calls).toHaveLength(2);
  });
});
