/**
 * Host allowlist guard unit tests (api-platform subplan 001 / W0, step 6).
 *
 * The middleware host guard is a security boundary — these tests pin the
 * negative space (absent / wrong / ported Host headers) as much as the
 * positive space. See `apps/web/lib/host-guard.ts`.
 */

import { describe, test, expect } from "vitest";
import { isAllowedHost, ALLOWED_PRODUCTION_HOSTS } from "@/lib/host-guard";

describe("isAllowedHost — allowed hosts", () => {
  test.each([...ALLOWED_PRODUCTION_HOSTS])(
    "allows production host %s",
    (host) => {
      expect(isAllowedHost(host)).toBe(true);
    }
  );

  test("allows the grey-clouded API host explicitly", () => {
    // Pinned separately from the array so removing it from the allowlist
    // fails a named test, not just a parameterized one.
    expect(isAllowedHost("api.handicappin.com")).toBe(true);
  });

  test("is case-insensitive and whitespace-tolerant", () => {
    expect(isAllowedHost("WWW.Handicappin.COM")).toBe(true);
    expect(isAllowedHost(" handicappin.com ")).toBe(true);
  });

  test("allows default ports on production hosts", () => {
    expect(isAllowedHost("handicappin.com:443")).toBe(true);
    expect(isAllowedHost("handicappin.com:80")).toBe(true);
  });

  test.each([
    "localhost",
    "localhost:3000",
    "localhost:3001",
    "127.0.0.1:3000",
    "0.0.0.0:3000",
    "[::1]:3000",
    "[::1]",
  ])("allows local dev host %s on any port", (host) => {
    expect(isAllowedHost(host)).toBe(true);
  });

  test("allows Vercel deployment/preview URLs", () => {
    expect(isAllowedHost("handicappin.vercel.app")).toBe(true);
    expect(
      isAllowedHost("handicappin-git-feature-sebastiansoles-projects.vercel.app")
    ).toBe(true);
  });
});

describe("isAllowedHost — absent Host", () => {
  test.each([null, undefined, "", "   "])("rejects %j", (host) => {
    expect(isAllowedHost(host)).toBe(false);
  });
});

describe("isAllowedHost — wrong Host", () => {
  test.each([
    "evil.com",
    "handicappin.com.evil.com", // suffix-forgery
    "evilhandicappin.com", // substring-forgery
    "api.handicappin.com.attacker.net",
    "handicappin.co",
    "vercel.app", // bare suffix is not a deployment URL
    ".vercel.app",
    "handicappin.com.", // trailing-dot FQDN trick — exact match only
    "handicappin.com evil.com", // embedded whitespace
    "handicappin.com/evil", // embedded path
    "user@handicappin.com", // userinfo smuggling
    "handicappin.com\\evil", // backslash smuggling
  ])("rejects %s", (host) => {
    expect(isAllowedHost(host)).toBe(false);
  });
});

describe("isAllowedHost — ported Host", () => {
  test.each([
    "handicappin.com:8080",
    "www.handicappin.com:3000",
    "api.handicappin.com:8443",
    "handicappin.vercel.app:8080",
    "handicappin.com:443443", // >5 digits, malformed
    "handicappin.com:443x", // non-numeric port
    "handicappin.com:", // empty port
    "handicappin.com:443:80", // double port
    "[::1", // unclosed IPv6 bracket
    "[::1]3000", // missing colon after bracket
  ])("rejects %s", (host) => {
    expect(isAllowedHost(host)).toBe(false);
  });
});
