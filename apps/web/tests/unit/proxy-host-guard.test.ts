/**
 * Middleware host-guard negative tests (api-platform subplan 001 / W0, step 6).
 *
 * `apps/web/proxy.ts` is the Next.js middleware — a security boundary
 * (CVE-2025-29927-class middleware bypass history). These tests verify the
 * guard rejects requests with absent / wrong / ported Host headers BEFORE any
 * session work runs (`updateSession` must never be reached), and that
 * legitimate web/native traffic passes through untouched.
 *
 * `updateSession` (Supabase session handling) is mocked; the real `proxy`
 * and `isAllowedHost` code paths are exercised.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { V1_UNSUPPORTED_HOST_REWRITE_PATH } from "@/lib/host-guard";

const mockUpdateSession = vi.fn();
vi.mock("@/utils/supabase/middleware", () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

// Import after mocks are registered.
const { proxy } = await import("@/proxy");

const SESSION_RESPONSE = { __sentinel: "supabase-session-response" };

/**
 * Build a NextRequest whose Host header is fully controlled. `host: null`
 * builds a request with NO Host header (HTTP/1.0-style client).
 */
function buildRequest(host: string | null, path = "/rounds"): NextRequest {
  const headers = new Headers();
  if (host !== null) {
    headers.set("host", host);
  }
  return new NextRequest(`https://www.handicappin.com${path}`, { headers });
}

beforeEach(() => {
  mockUpdateSession.mockReset();
  mockUpdateSession.mockResolvedValue(SESSION_RESPONSE);
});

describe("proxy host guard — negative: absent Host header", () => {
  test("returns 400 and never reaches the session layer", async () => {
    const request = buildRequest(null);
    // Precondition: the request really carries no Host header.
    expect(request.headers.get("host")).toBeNull();

    const response = await proxy(request);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });
});

describe("proxy host guard — negative: wrong Host header", () => {
  test.each([
    "evil.com",
    "handicappin.com.evil.com",
    "evilhandicappin.com",
    "api.handicappin.com.attacker.net",
  ])("returns 400 for Host: %s and never reaches the session layer", async (host) => {
    const response = await proxy(buildRequest(host));

    expect((response as Response).status).toBe(400);
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });
});

describe("proxy host guard — negative: ported Host header", () => {
  test.each([
    "handicappin.com:8080",
    "www.handicappin.com:3000",
    "api.handicappin.com:8443",
  ])("returns 400 for Host: %s and never reaches the session layer", async (host) => {
    const response = await proxy(buildRequest(host));

    expect((response as Response).status).toBe(400);
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });
});

describe("proxy host guard — positive: legitimate traffic is untouched", () => {
  test.each([
    "www.handicappin.com", // web
    "handicappin.com", // native app's pinned host
    "api.handicappin.com", // grey-clouded API host
    "localhost:3000", // local dev
  ])("passes Host: %s through to the session layer", async (host) => {
    const request = buildRequest(host);

    const response = await proxy(request);

    expect(mockUpdateSession).toHaveBeenCalledTimes(1);
    expect(mockUpdateSession).toHaveBeenCalledWith(request);
    // The session layer's response is returned unmodified.
    expect(response).toBe(SESSION_RESPONSE);
  });

  test("a forged x-forwarded-host does not bypass the guard (Host is what is checked)", async () => {
    const headers = new Headers();
    headers.set("host", "evil.com");
    headers.set("x-forwarded-host", "www.handicappin.com");
    const request = new NextRequest("https://www.handicappin.com/rounds", {
      headers,
    });

    const response = await proxy(request);

    expect((response as Response).status).toBe(400);
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// /v1 host scoping (api-platform contract 005-phase0-contract.md §1):
// on the PRODUCTION deployment, `api.handicappin.com` is the only host that
// serves `/api/v1`. Unsupported hosts get a middleware rewrite to a path no
// route matches, so the framework itself renders its ordinary unmatched-path
// 404 — deliberately NOT a 403, which would confirm the host serves /v1.
// ---------------------------------------------------------------------------

/** Assert the response is the framework-404 rewrite (not a handled response). */
function expectV1NotFoundRewrite(response: unknown) {
  expect(response).toBeInstanceOf(Response);
  const rewriteTarget = (response as Response).headers.get(
    "x-middleware-rewrite"
  );
  expect(rewriteTarget).not.toBeNull();
  expect(new URL(rewriteTarget as string).pathname).toBe(
    V1_UNSUPPORTED_HOST_REWRITE_PATH
  );
  // The rewrite must never be answered by the session layer.
  expect(mockUpdateSession).not.toHaveBeenCalled();
}

describe("proxy /v1 host scoping — production deployment", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test.each([
    "www.handicappin.com",
    "handicappin.com",
    "handicappin.vercel.app", // production alias — allowed generally, not for /v1
  ])(
    "Host: %s on /api/v1/rounds is rewritten to the framework 404",
    async (host) => {
      const response = await proxy(buildRequest(host, "/api/v1/rounds"));

      expectV1NotFoundRewrite(response);
    }
  );

  test("absent Host on a /v1 path gets the 404 rewrite, not the 400", async () => {
    const request = buildRequest(null, "/api/v1/rounds");
    expect(request.headers.get("host")).toBeNull();

    const response = await proxy(request);

    expectV1NotFoundRewrite(response);
  });

  test("garbage Host on a /v1 path gets the 404 rewrite, not the 400", async () => {
    const response = await proxy(
      buildRequest("api.handicappin.com/evil", "/api/v1/health")
    );

    expectV1NotFoundRewrite(response);
  });

  test("Host: api.handicappin.com passes /api/v1/health through untouched (ingress canary path)", async () => {
    const request = buildRequest("api.handicappin.com", "/api/v1/health");

    const response = await proxy(request);

    expect(mockUpdateSession).toHaveBeenCalledTimes(1);
    expect(mockUpdateSession).toHaveBeenCalledWith(request);
    expect(response).toBe(SESSION_RESPONSE);
  });

  test("non-/v1 paths on www are untouched (guard does not leak onto the web app)", async () => {
    const request = buildRequest("www.handicappin.com", "/rounds");

    const response = await proxy(request);

    expect(mockUpdateSession).toHaveBeenCalledTimes(1);
    expect(response).toBe(SESSION_RESPONSE);
  });
});

describe("proxy /v1 host scoping — inert off the production deployment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test.each([
    "localhost:3000",
    "127.0.0.1:54321",
  ])(
    "VERCEL_ENV unset (local dev/CI): Host %s serves /api/v1/health normally",
    async (host) => {
      vi.stubEnv("VERCEL_ENV", "");
      const request = buildRequest(host, "/api/v1/health");

      const response = await proxy(request);

      expect(mockUpdateSession).toHaveBeenCalledTimes(1);
      expect(response).toBe(SESSION_RESPONSE);
    }
  );

  test("preview deployments keep serving /v1 (documented stance)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const request = buildRequest(
      "handicappin-git-feature-x.vercel.app",
      "/api/v1/rounds"
    );

    const response = await proxy(request);

    expect(mockUpdateSession).toHaveBeenCalledTimes(1);
    expect(response).toBe(SESSION_RESPONSE);
  });
});
