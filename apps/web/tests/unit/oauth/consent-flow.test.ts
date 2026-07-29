/**
 * Unit coverage for the /oauth/consent flow logic (subplan 004 review
 * follow-up): the login-resume path, its open-redirect guard, and the
 * display-host derivation used by the consent card.
 *
 * Full-page render coverage is intentionally out of scope — the repo has no
 * DOM-render test infra (vitest runs in the node environment); page behavior
 * belongs to e2e per .claude/rules/coding-conventions.md.
 */
import { describe, expect, test } from "vitest";

import {
  LOGIN_REDIRECT_PARAM,
  consentPath,
  deriveHost,
  loginPathForConsent,
  safeInternalPath,
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
