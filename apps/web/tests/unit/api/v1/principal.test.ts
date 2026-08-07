/**
 * Bearer-token principal extraction — contract §6.
 *
 * The load-bearing case is the third one: a `client_id` token arriving
 * WITHOUT a `scope` claim must be rejected (401), never promoted to
 * first-party. That inference was a fail-open in an earlier draft of the
 * contract, so it gets adversarial coverage here.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const captureSentryError = vi.fn();
vi.mock("@/lib/sentry-utils", () => ({
  captureSentryError: (...args: unknown[]) => captureSentryError(...args),
}));

/**
 * Spy on the DEFAULT validator without replacing the rest of the module —
 * `extractBearerToken` / `decodeJwtPayload` stay real, because their exact
 * behaviour is what classification depends on.
 */
const networkValidator = vi.fn(
  async (_token: string): Promise<{ id: string } | null> => null
);
vi.mock("@/lib/api/bearer-token", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/bearer-token")>();
  return {
    ...actual,
    getUserFromBearerToken: (token: string) => networkValidator(token),
  };
});

const {
  V1_SCOPES,
  authenticateV1Request,
  hasScope,
  requireScope,
} = await import("@/app/api/v1/_lib/principal");
const { v1RateLimitIdentifier } = await import(
  "@/app/api/v1/_lib/rate-limit-seam"
);

const USER_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "fitbull-client-id";

/** Build an unsigned JWT-shaped token; only the payload is ever decoded. */
function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.sig`;
}

function requestWith(token: string | null): Request {
  return new Request("https://api.handicappin.com/api/v1/rounds", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

/** Stands in for the NETWORK validator; the real default is auth.getUser. */
const accepts = vi.fn(async () => ({ id: USER_ID }));
const rejects = vi.fn(async () => null);

beforeEach(() => {
  captureSentryError.mockClear();
  accepts.mockClear();
  rejects.mockClear();
  networkValidator.mockClear();
});

describe("shape 1 — no client_id ⇒ first-party principal", () => {
  test("classified first-party, with no scopes", async () => {
    const result = await authenticateV1Request(
      requestWith(jwt({ sub: USER_ID })),
      { validateToken: accepts }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.class).toBe("first-party");
    expect(result.principal.clientId).toBeNull();
    expect(result.principal.scopes).toBeNull();
    expect(result.principal.userId).toBe(USER_ID);
  });

  test("no scope check applies — every scope is held", async () => {
    const result = await authenticateV1Request(
      requestWith(jwt({ sub: USER_ID })),
      { validateToken: accepts }
    );
    if (!result.ok) throw new Error("expected ok");
    expect(hasScope(result.principal, V1_SCOPES.roundsWrite)).toBe(true);
    expect(hasScope(result.principal, "anything:at:all")).toBe(true);
    expect(requireScope(result.principal, "anything:at:all")).toBeNull();
  });

  test("a token carrying scope but NO client_id is still first-party", async () => {
    // Class keys on client_id PRESENCE — never on the presence/absence of
    // any other claim.
    const result = await authenticateV1Request(
      requestWith(jwt({ sub: USER_ID, scope: "rounds:write" })),
      { validateToken: accepts }
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.principal.class).toBe("first-party");
  });

  test("keys the rate limiter as user:{sub}", async () => {
    const result = await authenticateV1Request(
      requestWith(jwt({ sub: USER_ID })),
      { validateToken: accepts }
    );
    if (!result.ok) throw new Error("expected ok");
    expect(v1RateLimitIdentifier(result.principal)).toBe(`user:${USER_ID}`);
  });
});

describe("shape 2 — client_id AND scope ⇒ OAuth principal", () => {
  const oauthToken = jwt({
    sub: USER_ID,
    client_id: CLIENT_ID,
    scope: "rounds:write profile:read",
  });

  test("classified oauth, with the scope list parsed", async () => {
    const result = await authenticateV1Request(requestWith(oauthToken), {
      validateToken: accepts,
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.principal.class).toBe("oauth");
    expect(result.principal.clientId).toBe(CLIENT_ID);
    expect(result.principal.scopes).toEqual(["rounds:write", "profile:read"]);
    expect(captureSentryError).not.toHaveBeenCalled();
  });

  test("an in-scope operation is allowed", async () => {
    const result = await authenticateV1Request(requestWith(oauthToken), {
      validateToken: accepts,
    });
    if (!result.ok) throw new Error("expected ok");
    expect(requireScope(result.principal, V1_SCOPES.roundsWrite)).toBeNull();
  });

  test("an out-of-scope operation is 403 forbidden — not 401", async () => {
    const result = await authenticateV1Request(requestWith(oauthToken), {
      validateToken: accepts,
    });
    if (!result.ok) throw new Error("expected ok");

    const problem = requireScope(result.principal, "courses:write", {
      instance: "req_1",
    });
    expect(problem?.code).toBe("forbidden");
    expect(problem?.status).toBe(403);
    expect(problem?.instance).toBe("req_1");
  });

  test("keys the rate limiter as the (client_id, user) PAIR", async () => {
    const result = await authenticateV1Request(requestWith(oauthToken), {
      validateToken: accepts,
    });
    if (!result.ok) throw new Error("expected ok");
    expect(v1RateLimitIdentifier(result.principal)).toBe(
      `client:${CLIENT_ID}:user:${USER_ID}`
    );
  });
});

describe("shape 3 — client_id present, scope ABSENT ⇒ 401 + alert", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["scope claim missing", { sub: USER_ID, client_id: CLIENT_ID }],
    ["scope null", { sub: USER_ID, client_id: CLIENT_ID, scope: null }],
    ["scope empty string", { sub: USER_ID, client_id: CLIENT_ID, scope: "" }],
    ["scope whitespace", { sub: USER_ID, client_id: CLIENT_ID, scope: "   " }],
    ["scope non-string", { sub: USER_ID, client_id: CLIENT_ID, scope: 42 }],
    ["scope array", { sub: USER_ID, client_id: CLIENT_ID, scope: ["a"] }],
  ];

  test.each(cases)("%s → 401 unauthorized, never first-party", async (_label, payload) => {
    const result = await authenticateV1Request(requestWith(jwt(payload)), {
      validateToken: accepts,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe("unauthorized");
    expect(result.problem.status).toBe(401);
  });

  test("raises a Sentry alert naming the client", async () => {
    await authenticateV1Request(
      requestWith(jwt({ sub: USER_ID, client_id: CLIENT_ID })),
      { validateToken: accepts }
    );
    expect(captureSentryError).toHaveBeenCalledTimes(1);
    const [error, context] = captureSentryError.mock.calls[0] as [
      Error,
      { eventType?: string; tags?: Record<string, string> },
    ];
    expect(error.message).toMatch(/scope/i);
    expect(context.eventType).toBe("v1-auth-missing-scope");
    expect(context.tags?.client_id).toBe(CLIENT_ID);
  });

  test("the result is a 401, NOT a 403 — it is not an in-band scope failure", async () => {
    const result = await authenticateV1Request(
      requestWith(jwt({ sub: USER_ID, client_id: CLIENT_ID })),
      { validateToken: accepts }
    );
    if (result.ok) throw new Error("expected rejection");
    expect(result.problem.status).not.toBe(403);
  });
});

describe("token validation", () => {
  test("no Authorization header → 401 without any network call", async () => {
    const result = await authenticateV1Request(requestWith(null), {
      validateToken: accepts,
    });
    expect(result.ok).toBe(false);
    expect(accepts).not.toHaveBeenCalled();
  });

  test.each([
    ["wrong scheme", "Basic abc"],
    ["no space", "Bearerabc"],
    ["empty token", "Bearer   "],
  ])("%s → 401", async (_label, header) => {
    const request = new Request("https://api.handicappin.com/api/v1/rounds", {
      headers: { authorization: header },
    });
    const result = await authenticateV1Request(request, {
      validateToken: accepts,
    });
    expect(result.ok).toBe(false);
  });

  test("an invalid/expired/revoked token → 401 (the validator's verdict is final)", async () => {
    const result = await authenticateV1Request(
      requestWith(jwt({ sub: USER_ID, client_id: CLIENT_ID, scope: "rounds:write" })),
      { validateToken: rejects }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe("unauthorized");
  });

  test("validation runs BEFORE classification, so a forged client_id cannot mint alerts", async () => {
    await authenticateV1Request(
      requestWith(jwt({ sub: "attacker", client_id: "forged" })),
      { validateToken: rejects }
    );
    expect(rejects).toHaveBeenCalledTimes(1);
    expect(captureSentryError).not.toHaveBeenCalled();
  });

  test.each([
    ["an opaque (non-JWS) token", "opaque-token"],
    ["a two-segment token", "header.payload"],
    ["a JWS with an undecodable payload", "aaa.%%%.ccc"],
    [
      "a JWS whose payload is an array, not an object",
      `aaa.${Buffer.from("[1,2]").toString("base64url")}.ccc`,
    ],
  ])(
    "%s → 401, NOT a first-party promotion (unclassifiable ⇒ fail closed)",
    async (_label, token) => {
      // Even though the validator ACCEPTS these, no client_id can be read —
      // and "no readable claims" must never be mistaken for "no client_id,
      // therefore first-party". Unreachable while Supabase issues JWTs;
      // closed anyway, because that is where the format-change fail-open
      // would live.
      const result = await authenticateV1Request(requestWith(token), {
        validateToken: accepts,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.problem.code).toBe("unauthorized");
      expect(result.problem.status).toBe(401);
    }
  );

  test("the userId always comes from the validator, never from the sub claim", async () => {
    const result = await authenticateV1Request(
      requestWith(jwt({ sub: "claimed-different-user" })),
      { validateToken: accepts }
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.principal.userId).toBe(USER_ID);
  });
});

describe("the default validator is the NETWORK path", () => {
  test("authenticateV1Request defaults to getUserFromBearerToken", async () => {
    // Local JWKS / getClaims() validation is PROHIBITED (§6, spike iii): it
    // silently misses revocation. That `getUserFromBearerToken` is itself an
    // `auth.getUser(token)` network call is pinned in bearer-token.test.ts.
    const token = jwt({ sub: USER_ID });
    const result = await authenticateV1Request(requestWith(token));

    expect(networkValidator).toHaveBeenCalledTimes(1);
    expect(networkValidator).toHaveBeenCalledWith(token);
    expect(result.ok).toBe(false); // the spy denies by default
  });
});
