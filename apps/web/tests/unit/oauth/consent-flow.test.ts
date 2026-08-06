/**
 * Unit coverage for the /oauth/consent flow logic (subplan 004 review
 * follow-up): the login-resume path, its open-redirect guard, and the
 * display-host derivation used by the consent card.
 *
 * Full-page render coverage is intentionally out of scope — the repo has no
 * DOM-render test infra (vitest runs in the node environment); page behavior
 * belongs to e2e per .claude/rules/coding-conventions.md.
 */
import { describe, expect, test, vi } from "vitest";

import {
  CONNECT_ANALYTICS_DEADLINE_MS,
  LOGIN_REDIRECT_PARAM,
  consentPath,
  deriveHost,
  loginPathForConsent,
  safeInternalPath,
  settleWithin,
} from "@/lib/oauth/consent-flow";

describe("safeInternalPath (open-redirect guard)", () => {
  test("accepts rooted internal paths", () => {
    expect(safeInternalPath("/oauth/consent?authorization_id=abc")).toBe(
      "/oauth/consent?authorization_id=abc",
    );
    expect(safeInternalPath("/rounds")).toBe("/rounds");
    expect(safeInternalPath("/")).toBe("/");
  });

  test("rejects absolute URLs", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBeNull();
    expect(safeInternalPath("http://evil.example")).toBeNull();
    expect(safeInternalPath("javascript:alert(1)")).toBeNull();
  });

  test("rejects protocol-relative and backslash escapes", () => {
    expect(safeInternalPath("//evil.example")).toBeNull();
    expect(safeInternalPath("//evil.example/path")).toBeNull();
    expect(safeInternalPath("/\\evil.example")).toBeNull();
  });

  test("rejects empty and missing values", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath("")).toBeNull();
    expect(safeInternalPath("relative/path")).toBeNull();
  });
});

describe("consent resume paths", () => {
  test("consentPath targets GoTrue's authorization_id param", () => {
    expect(consentPath("abc123")).toBe(
      "/oauth/consent?authorization_id=abc123",
    );
  });

  test("consentPath URL-encodes the authorization id", () => {
    expect(consentPath("a b&c=d")).toBe(
      "/oauth/consent?authorization_id=a%20b%26c%3Dd",
    );
  });

  test("loginPathForConsent nests the consent path in the redirect param", () => {
    const path = loginPathForConsent("xyz789");
    expect(path).toBe(
      `/login?${LOGIN_REDIRECT_PARAM}=%2Foauth%2Fconsent%3Fauthorization_id%3Dxyz789`,
    );
    // Round-trip: the decoded redirect param must survive the guard.
    const url = new URL(`http://localhost${path}`);
    const redirect = url.searchParams.get(LOGIN_REDIRECT_PARAM);
    expect(safeInternalPath(redirect)).toBe(
      "/oauth/consent?authorization_id=xyz789",
    );
  });
});

describe("deriveHost (consent card display)", () => {
  test("extracts the host from absolute URLs", () => {
    expect(deriveHost("https://fitbull.example/callback")).toBe(
      "fitbull.example",
    );
    expect(deriveHost("http://localhost:9999/cb")).toBe("localhost:9999");
  });

  test("returns null for unparseable or hostless values", () => {
    expect(deriveHost("not a url")).toBeNull();
    expect(deriveHost("")).toBeNull();
    expect(deriveHost(null)).toBeNull();
    expect(deriveHost(undefined)).toBeNull();
  });
});

/**
 * The consent card gates its redirect on this helper (T12/D9 review
 * follow-up): the `api_connect_completed` capture is worth waiting for
 * (`window.location.assign` aborts in-flight fetches, so fire-and-forget
 * drops it) but must never hold the user — nothing in the tRPC link chain
 * sets a timeout.
 */
describe("settleWithin (bounded analytics wait before the consent redirect)", () => {
  test("resolves as soon as the work settles, well before the deadline", async () => {
    vi.useFakeTimers();
    try {
      const settled = vi.fn();
      const promise = settleWithin(
        Promise.resolve("captured"),
        CONNECT_ANALYTICS_DEADLINE_MS,
      ).then(settled);
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toHaveBeenCalledTimes(1);
      await promise;
    } finally {
      vi.useRealTimers();
    }
  });

  test("resolves (never rejects) when the work rejects", async () => {
    await expect(
      settleWithin(Promise.reject(new Error("trpc down")), 50),
    ).resolves.toBeUndefined();
  });

  test("resolves at the deadline when the work never settles", async () => {
    vi.useFakeTimers();
    try {
      const settled = vi.fn();
      const promise = settleWithin(new Promise<void>(() => {}), 2_000).then(
        settled,
      );
      await vi.advanceTimersByTimeAsync(1_999);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toHaveBeenCalledTimes(1);
      await promise;
    } finally {
      vi.useRealTimers();
    }
  });

  test("the deadline is a real bound, not an accidental zero", () => {
    expect(CONNECT_ANALYTICS_DEADLINE_MS).toBeGreaterThan(0);
    expect(CONNECT_ANALYTICS_DEADLINE_MS).toBeLessThanOrEqual(5_000);
  });
});
