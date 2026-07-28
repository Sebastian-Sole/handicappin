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

import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
