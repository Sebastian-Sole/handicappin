/**
 * `@/lib/api/bearer-token` — the primitives shared by tRPC and `/v1`.
 *
 * The one that must never regress: **validation is a NETWORK call to
 * `supabase.auth.getUser(token)`.** Local JWKS validation / `getClaims()` is
 * prohibited for external tokens because it silently misses revocation
 * (contract §6, spike criterion iii). This suite pins that the token is
 * handed to Supabase rather than verified in-process.
 *
 * `server/api/trpc.ts` consumed these functions before they moved here; its
 * own coverage (`tests/unit/trpc-context.test.ts`) still exercises them
 * through the tRPC context, so the two suites together cover both callers.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const getUser = vi.fn();
/** `createClient(url, key, options)` — options is what the assertions read. */
const createClient = vi.fn(
  (_url: string, _key: string, _options: Record<string, unknown>) => ({
    auth: { getUser: (token: string) => getUser(token) },
    __marker: "created",
  })
);
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string, options: Record<string, unknown>) =>
    createClient(url, key, options),
}));

const {
  createBearerTokenSupabaseClient,
  decodeJwtPayload,
  extractBearerToken,
  getUserFromBearerToken,
  hasClientIdClaim,
  isExternalOAuthClientToken,
  readClientIdClaim,
} = await import("@/lib/api/bearer-token");

const USER = { id: "33333333-3333-4333-8333-333333333333" };

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.sig`;
}

const headers = (value?: string) =>
  new Headers(value ? { authorization: value } : {});

beforeEach(() => {
  getUser.mockReset();
  createClient.mockClear();
});

describe("extractBearerToken", () => {
  test.each([
    ["Bearer abc", "abc"],
    ["bearer abc", "abc"],
    ["BEARER abc", "abc"],
    ["Bearer  abc  ", "abc"],
  ])("%s → %s", (header, expected) => {
    expect(extractBearerToken(headers(header))).toBe(expected);
  });

  test.each([
    ["missing header", undefined],
    ["no space", "Bearerabc"],
    ["wrong scheme", "Basic abc"],
    ["empty token", "Bearer "],
  ])("%s → null", (_label, header) => {
    expect(extractBearerToken(headers(header))).toBeNull();
  });
});

describe("decodeJwtPayload / isExternalOAuthClientToken", () => {
  test("decodes a three-segment token's payload", () => {
    expect(decodeJwtPayload(jwt({ sub: "u", client_id: "c" }))).toEqual({
      sub: "u",
      client_id: "c",
    });
  });

  test.each([
    ["two segments", "a.b"],
    ["not base64url json", "a.%%%.c"],
    ["array payload", `a.${Buffer.from("[]").toString("base64url")}.c`],
  ])("%s → null", (_label, token) => {
    expect(decodeJwtPayload(token)).toBeNull();
  });

  test("client_id presence is the OAuth discriminator", () => {
    expect(isExternalOAuthClientToken(jwt({ client_id: "c" }))).toBe(true);
    expect(isExternalOAuthClientToken(jwt({ sub: "u" }))).toBe(false);
    expect(isExternalOAuthClientToken("not-a-jwt")).toBe(false);
  });
});

/**
 * The shared provenance predicate.
 *
 * Both surfaces that accept a bearer token classify it by whether it carries
 * `client_id`, and they used to answer that question with two different
 * expressions — `payload.client_id != null` here, a non-empty-trimmed-string
 * test in `/v1`. The values where those disagree (`0`, `false`, `""`, `[]`,
 * `{}`) were rejected by tRPC as external AND granted unscoped first-party
 * authority by `/v1`. This suite pins the single reading; `principal.test.ts`
 * pins that `/v1` consumes it.
 */
describe("readClientIdClaim / hasClientIdClaim", () => {
  test.each([
    ["undecodable claims (null)", null],
    ["claim omitted", {}],
    ["explicit null", { client_id: null }],
    ["explicit undefined", { client_id: undefined }],
  ])("%s → absent (⇒ first-party is a legitimate reading)", (_label, claims) => {
    expect(readClientIdClaim(claims)).toEqual({ kind: "absent" });
    expect(hasClientIdClaim(claims)).toBe(false);
  });

  test.each([
    ["a plain id", "fitbull", "fitbull"],
    ["surrounding whitespace is trimmed", "  fitbull  ", "fitbull"],
  ])("%s → oauth-client", (_label, value, expected) => {
    expect(readClientIdClaim({ client_id: value })).toEqual({
      kind: "oauth-client",
      clientId: expected,
    });
    expect(hasClientIdClaim({ client_id: value })).toBe(true);
  });

  test.each([
    ["number 0", 0],
    ["number 1", 1],
    ["boolean false", false],
    ["boolean true", true],
    ["empty string", ""],
    ["whitespace-only string", "   "],
    ["empty array", []],
    ["array of ids", ["fitbull"]],
    ["empty object", {}],
  ])(
    "%s → malformed, and counts as PRESENT — never evidence of first-party provenance",
    (_label, value) => {
      const claims = { sub: "u", client_id: value };
      expect(readClientIdClaim(claims)).toEqual({ kind: "malformed" });
      expect(hasClientIdClaim(claims)).toBe(true);
    }
  );

  test("isExternalOAuthClientToken is exactly hasClientIdClaim ∘ decodeJwtPayload", () => {
    // The tRPC surface has no second reading of its own — this is the
    // structural half of the agreement `/v1` relies on.
    const payloads: Array<Record<string, unknown>> = [
      { sub: "u" },
      { sub: "u", client_id: null },
      { sub: "u", client_id: "fitbull" },
      { sub: "u", client_id: 0 },
      { sub: "u", client_id: false },
      { sub: "u", client_id: "" },
      { sub: "u", client_id: "   " },
      { sub: "u", client_id: [] },
      { sub: "u", client_id: {} },
    ];
    for (const payload of payloads) {
      const token = jwt(payload);
      expect(isExternalOAuthClientToken(token)).toBe(
        hasClientIdClaim(decodeJwtPayload(token))
      );
    }
  });

  test("the pre-existing tRPC verdicts are unchanged by the refactor", () => {
    // `payload.client_id != null` accepted exactly this set as "external".
    // If the shared predicate had narrowed it, tRPC would have started
    // ADMITTING type-confused OAuth tokens — the opposite fail-open.
    for (const value of [0, 1, false, true, "", "   ", [], {}, "fitbull"]) {
      expect(isExternalOAuthClientToken(jwt({ client_id: value }))).toBe(true);
    }
    for (const payload of [{ sub: "u" }, { sub: "u", client_id: null }]) {
      expect(isExternalOAuthClientToken(jwt(payload))).toBe(false);
    }
  });
});

describe("getUserFromBearerToken — the NETWORK validation path", () => {
  test("hands the token to supabase.auth.getUser", async () => {
    getUser.mockResolvedValue({ data: { user: USER }, error: null });

    await expect(getUserFromBearerToken("tok")).resolves.toEqual(USER);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledWith("tok");
  });

  test("builds a stateless client — no cookie or storage involvement", async () => {
    getUser.mockResolvedValue({ data: { user: USER }, error: null });
    await getUserFromBearerToken("tok");

    const options = createClient.mock.calls[0][2] as unknown as {
      auth: Record<string, boolean>;
    };
    expect(options.auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });

  test("a rejected token (expired/invalid/REVOKED) returns null", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT" },
    });
    await expect(getUserFromBearerToken("tok")).resolves.toBeNull();
  });

  test("a thrown network error returns null rather than propagating", async () => {
    getUser.mockRejectedValue(new Error("ECONNRESET"));
    await expect(getUserFromBearerToken("tok")).resolves.toBeNull();
  });

  test("the module exposes no local-verification helper to reach for", async () => {
    // If a `getClaims`/JWKS helper ever lands here, `/v1` would be one
    // import away from the revocation-blind path §6 prohibits.
    const bearerModule = await import("@/lib/api/bearer-token");
    expect(bearerModule).not.toHaveProperty("getClaims");
    expect(bearerModule).not.toHaveProperty("verifyJwtLocally");
  });
});

describe("createBearerTokenSupabaseClient", () => {
  test("forwards the token so RLS resolves auth.uid() to the caller", () => {
    createBearerTokenSupabaseClient("tok");
    const options = createClient.mock.calls[0][2] as unknown as {
      global: { headers: Record<string, string> };
    };
    expect(options.global.headers.Authorization).toBe("Bearer tok");
  });
});
