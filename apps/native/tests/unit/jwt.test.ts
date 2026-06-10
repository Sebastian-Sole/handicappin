/** Unit tests — lib/auth/jwt.ts (billing claims off the access token). */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { describe, it } from "node:test";

import { getBillingFromJWT } from "../../lib/auth/jwt";

// Node lacks DOM atob unless on globalThis — the module relies on the
// RN/winter runtime providing it; polyfill for the test environment.
if (typeof globalThis.atob !== "function") {
  (globalThis as Record<string, unknown>)["atob"] = (b64: string) =>
    Buffer.from(b64, "base64").toString("binary");
}

const b64url = (obj: unknown): string =>
  Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const makeToken = (claims: unknown): string =>
  `${b64url({ alg: "HS256" })}.${b64url(claims)}.signature`;

describe("getBillingFromJWT", () => {
  it("reads billing from app_metadata (the custom-claims hook nests it there)", () => {
    const session = {
      access_token: makeToken({
        sub: "user",
        app_metadata: {
          billing: {
            plan: "unlimited",
            status: "active",
            current_period_end: 1750000000,
            cancel_at_period_end: false,
            billing_version: 3,
          },
        },
      }),
    };
    const billing = getBillingFromJWT(session);
    assert.equal(billing?.plan, "unlimited");
    assert.equal(billing?.status, "active");
    assert.equal(billing?.current_period_end, 1750000000);
    assert.equal(billing?.cancel_at_period_end, false);
    assert.equal(billing?.billing_version, 3);
  });

  it("returns null when billing claims are absent", () => {
    const session = {
      access_token: makeToken({ sub: "user", app_metadata: {} }),
    };
    assert.equal(getBillingFromJWT(session), null);
  });

  it("returns null for missing/garbage tokens", () => {
    assert.equal(getBillingFromJWT(null), null);
    assert.equal(getBillingFromJWT({ access_token: "not-a-jwt" }), null);
  });

  it("nulls non-string plan values instead of throwing", () => {
    const session = {
      access_token: makeToken({
        app_metadata: { billing: { plan: 42, billing_version: 1 } },
      }),
    };
    const billing = getBillingFromJWT(session);
    assert.equal(billing?.plan, null);
  });
});
