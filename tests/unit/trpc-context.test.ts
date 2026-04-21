/**
 * tRPC Context Auth Unit Tests
 *
 * Verifies that `createTRPCContext` accepts two auth sources:
 *   1. Cookie-based Supabase session (existing web behavior)
 *   2. Authorization: Bearer <access_token> header fallback
 *
 * Precedence: cookie session wins when both are present so that `ctx.supabase`
 * and `ctx.user` stay consistent with DB RLS (`auth.uid()`).
 *
 * All external boundaries (Supabase SSR cookie client and `@supabase/supabase-js`
 * `createClient`) are mocked. We exercise the real `createTRPCContext`,
 * `extractBearerToken`, and `getUserFromBearerToken` code paths.
 */

import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  type Mock,
} from "vitest";

const COOKIE_USER_ID = "11111111-1111-4111-8111-111111111111";
const BEARER_USER_ID = "22222222-2222-4222-8222-222222222222";
const VALID_BEARER_TOKEN = "valid.bearer.token";
const INVALID_BEARER_TOKEN = "invalid.bearer.token";

// Mock the cookie-bound SSR client factory.
const mockCookieGetUser = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createServerComponentClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => mockCookieGetUser(...args),
    },
    // Marker so tests can assert the cookie client was passed through.
    __clientType: "cookie",
  })),
}));

// Mock the stateless token-validation client factory.
const mockBearerGetUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: (...args: unknown[]) => mockBearerGetUser(...args),
    },
    __clientType: "bearer",
  })),
}));

// Import after mocks are registered.
const { createTRPCContext, _testables } = await import("@/server/api/trpc");

function buildHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

function mockCookieUser(user: { id: string } | null) {
  mockCookieGetUser.mockResolvedValueOnce({ data: { user } });
}

function mockBearerResponse(
  response: { user: { id: string } | null; error?: { message: string } | null },
) {
  mockBearerGetUser.mockResolvedValueOnce({
    data: { user: response.user },
    error: response.error ?? null,
  });
}

beforeEach(() => {
  // `clearAllMocks` leaves pending `mockResolvedValueOnce` queues intact,
  // which could leak a success response into a later test expecting failure.
  // Reset the implementation stacks explicitly.
  mockCookieGetUser.mockReset();
  mockBearerGetUser.mockReset();
});

describe("extractBearerToken", () => {
  test("returns token for canonical 'Bearer <token>' header", () => {
    const headers = buildHeaders({
      authorization: `Bearer ${VALID_BEARER_TOKEN}`,
    });
    expect(_testables.extractBearerToken(headers)).toBe(VALID_BEARER_TOKEN);
  });

  test("is case-insensitive on the scheme", () => {
    const headers = buildHeaders({
      authorization: `bearer ${VALID_BEARER_TOKEN}`,
    });
    expect(_testables.extractBearerToken(headers)).toBe(VALID_BEARER_TOKEN);
  });

  test("returns null when header is missing", () => {
    expect(_testables.extractBearerToken(buildHeaders())).toBeNull();
  });

  test("returns null for non-Bearer scheme (e.g., Basic)", () => {
    const headers = buildHeaders({ authorization: "Basic abc123" });
    expect(_testables.extractBearerToken(headers)).toBeNull();
  });

  test("returns null when token portion is empty", () => {
    const headers = buildHeaders({ authorization: "Bearer " });
    expect(_testables.extractBearerToken(headers)).toBeNull();
  });

  test("returns null when header has no space separator", () => {
    const headers = buildHeaders({ authorization: "Bearer" });
    expect(_testables.extractBearerToken(headers)).toBeNull();
  });
});

describe("createTRPCContext - cookie-only request", () => {
  test("populates ctx.user from cookie session (existing web behavior)", async () => {
    mockCookieUser({ id: COOKIE_USER_ID });

    const ctx = await createTRPCContext({ headers: buildHeaders() });

    expect(ctx.user).toEqual({ id: COOKIE_USER_ID });
    expect(mockCookieGetUser).toHaveBeenCalledTimes(1);
    // Bearer validation must not run when cookie already yielded a user.
    expect(mockBearerGetUser).not.toHaveBeenCalled();
    // Cookie-bound client is exposed on ctx so RLS uses the cookie session.
    expect((ctx.supabase as unknown as { __clientType: string }).__clientType)
      .toBe("cookie");
  });

  test("returns null user and cookie client when no cookie and no header", async () => {
    mockCookieUser(null);

    const ctx = await createTRPCContext({ headers: buildHeaders() });

    expect(ctx.user).toBeNull();
    expect(mockBearerGetUser).not.toHaveBeenCalled();
    expect((ctx.supabase as unknown as { __clientType: string }).__clientType)
      .toBe("cookie");
  });
});

describe("createTRPCContext - bearer token fallback", () => {
  test("populates ctx.user from a valid bearer token when cookie is absent", async () => {
    mockCookieUser(null);
    mockBearerResponse({ user: { id: BEARER_USER_ID } });

    const ctx = await createTRPCContext({
      headers: buildHeaders({
        authorization: `Bearer ${VALID_BEARER_TOKEN}`,
      }),
    });

    expect(ctx.user).toEqual({ id: BEARER_USER_ID });
    // Supabase was asked to validate the exact token via getUser(token).
    expect(mockBearerGetUser).toHaveBeenCalledWith(VALID_BEARER_TOKEN);
    // ctx.supabase swapped to a bearer-scoped client so RLS uses the token.
    expect((ctx.supabase as unknown as { __clientType: string }).__clientType)
      .toBe("bearer");
  });

  test("leaves ctx.user null when bearer token is invalid/expired", async () => {
    mockCookieUser(null);
    mockBearerResponse({
      user: null,
      error: { message: "invalid JWT" },
    });

    const ctx = await createTRPCContext({
      headers: buildHeaders({
        authorization: `Bearer ${INVALID_BEARER_TOKEN}`,
      }),
    });

    expect(ctx.user).toBeNull();
    expect(mockBearerGetUser).toHaveBeenCalledWith(INVALID_BEARER_TOKEN);
    // On failure we do NOT swap the client — cookie client remains so that
    // unauthenticated requests behave the same as the no-header path.
    expect((ctx.supabase as unknown as { __clientType: string }).__clientType)
      .toBe("cookie");
  });

  test("leaves ctx.user null when bearer validation throws (network error)", async () => {
    mockCookieUser(null);
    mockBearerGetUser.mockRejectedValueOnce(new Error("network down"));

    const ctx = await createTRPCContext({
      headers: buildHeaders({
        authorization: `Bearer ${VALID_BEARER_TOKEN}`,
      }),
    });

    expect(ctx.user).toBeNull();
    expect((ctx.supabase as unknown as { __clientType: string }).__clientType)
      .toBe("cookie");
  });

  test("ignores malformed Authorization header", async () => {
    mockCookieUser(null);

    const ctx = await createTRPCContext({
      headers: buildHeaders({ authorization: "Basic some-creds" }),
    });

    expect(ctx.user).toBeNull();
    // Because the header was not a Bearer header, Supabase is never asked
    // to validate it.
    expect(mockBearerGetUser).not.toHaveBeenCalled();
  });
});

describe("createTRPCContext - precedence when both auth sources present", () => {
  test("cookie wins when both a cookie user and a bearer token are present", async () => {
    mockCookieUser({ id: COOKIE_USER_ID });
    // Prime a bearer response that would have resolved to a DIFFERENT user.
    // It must never be consulted because the cookie short-circuits first.
    mockBearerResponse({ user: { id: BEARER_USER_ID } });

    const ctx = await createTRPCContext({
      headers: buildHeaders({
        authorization: `Bearer ${VALID_BEARER_TOKEN}`,
      }),
    });

    expect(ctx.user).toEqual({ id: COOKIE_USER_ID });
    expect(mockBearerGetUser).not.toHaveBeenCalled();
    // Cookie-bound client stays active so ctx.user.id === auth.uid() in RLS.
    expect((ctx.supabase as unknown as { __clientType: string }).__clientType)
      .toBe("cookie");
  });
});

describe("getUserFromBearerToken direct unit coverage", () => {
  test("returns the Supabase user on success", async () => {
    mockBearerResponse({ user: { id: BEARER_USER_ID } });

    const result = await _testables.getUserFromBearerToken(VALID_BEARER_TOKEN);

    expect(result).toEqual({ id: BEARER_USER_ID });
    expect(mockBearerGetUser).toHaveBeenCalledWith(VALID_BEARER_TOKEN);
  });

  test("returns null when Supabase reports an error", async () => {
    mockBearerResponse({
      user: null,
      error: { message: "JWT expired" },
    });

    const result = await _testables.getUserFromBearerToken(INVALID_BEARER_TOKEN);

    expect(result).toBeNull();
  });

  test("returns null when the underlying call throws", async () => {
    mockBearerGetUser.mockRejectedValueOnce(new Error("boom"));

    const result = await _testables.getUserFromBearerToken(VALID_BEARER_TOKEN);

    expect(result).toBeNull();
  });
});
