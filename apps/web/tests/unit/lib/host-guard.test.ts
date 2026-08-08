/**
 * Host allowlist guard unit tests (api-platform subplan 001 / W0, step 6).
 *
 * The middleware host guard is a security boundary — these tests pin the
 * negative space (absent / wrong / ported Host headers) as much as the
 * positive space. See `apps/web/lib/host-guard.ts`.
 */

import { describe, test, expect } from "vitest";
import {
  isAllowedHost,
  isBlockedPublicApiRequest,
  isPublicApiPath,
  ALLOWED_PRODUCTION_HOSTS,
} from "@/lib/host-guard";

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

// ---------------------------------------------------------------------------
// /v1 host scoping (api-platform contract 005-phase0-contract.md §1)
// ---------------------------------------------------------------------------

describe("isPublicApiPath", () => {
  test.each(["/api/v1", "/api/v1/", "/api/v1/health", "/api/v1/rounds/9"])(
    "matches %s",
    (pathname) => {
      expect(isPublicApiPath(pathname)).toBe(true);
    }
  );

  test.each([
    "/",
    "/rounds",
    "/api",
    "/api/trpc/course.getCourseById",
    "/api/v10/health", // prefix must be segment-bounded
    "/api/v1x",
    "/API/v1/health", // Next.js routing is case-sensitive; so is the guard
  ])("does not match %s", (pathname) => {
    expect(isPublicApiPath(pathname)).toBe(false);
  });
});

describe("isBlockedPublicApiRequest — production: only api.handicappin.com serves /v1", () => {
  const production = { vercelEnv: "production", pathname: "/api/v1/rounds" };

  test.each([
    "www.handicappin.com",
    "handicappin.com",
    "handicappin.vercel.app", // production .vercel.app alias is NOT a supported base host
    "evil.com",
    "api.handicappin.com.attacker.net",
    "localhost:3000", // forged local Host reaching the production deployment
  ])("blocks Host: %s", (hostHeader) => {
    expect(isBlockedPublicApiRequest({ ...production, hostHeader })).toBe(true);
  });

  test.each([
    null,
    undefined,
    "",
    "   ",
    "ho st/path", // embedded whitespace + path
    "api.handicappin.com:443x", // malformed port
  ])("blocks absent/garbage Host %j", (hostHeader) => {
    expect(isBlockedPublicApiRequest({ ...production, hostHeader })).toBe(true);
  });

  test.each([
    "api.handicappin.com",
    "API.Handicappin.COM", // Host matching is case-insensitive
    "api.handicappin.com:443",
    "api.handicappin.com:80",
  ])("passes Host: %s", (hostHeader) => {
    expect(isBlockedPublicApiRequest({ ...production, hostHeader })).toBe(
      false
    );
  });

  test("blocks a ported API host (api.handicappin.com:8443)", () => {
    expect(
      isBlockedPublicApiRequest({
        ...production,
        hostHeader: "api.handicappin.com:8443",
      })
    ).toBe(true);
  });

  test("ignores non-/v1 paths entirely (www keeps serving the web app)", () => {
    expect(
      isBlockedPublicApiRequest({
        vercelEnv: "production",
        pathname: "/rounds",
        hostHeader: "www.handicappin.com",
      })
    ).toBe(false);
  });
});

describe("isBlockedPublicApiRequest — inert off the production deployment", () => {
  test.each([
    ["preview", "handicappin-git-feature-x.vercel.app"], // previews keep /v1
    ["development", "localhost:3000"],
    [undefined, "localhost:3000"], // local dev / CI / vitest: VERCEL_ENV unset
    [undefined, "127.0.0.1:54321"],
    ["preview", "www.handicappin.com"], // even a wrong host is not blocked off-prod
  ] as const)(
    "vercelEnv=%j, Host=%s is not blocked",
    (vercelEnv, hostHeader) => {
      expect(
        isBlockedPublicApiRequest({
          vercelEnv,
          pathname: "/api/v1/health",
          hostHeader,
        })
      ).toBe(false);
    }
  );
});
