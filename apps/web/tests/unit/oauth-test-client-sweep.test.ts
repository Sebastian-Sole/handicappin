/**
 * Unit coverage for the parallel-run safety of the OAuth test-client sweep
 * (`tests/integration/helpers/v1-principals.ts`).
 *
 * The hazard this pins down: `sweepStaleOAuthTestClients` used to delete
 * EVERY client matching a name prefix, so two integration runs overlapping
 * in time deleted each other's live clients mid-run. The fix is (a) names
 * that embed their minted-at time and (b) an age gate — a sweep collects
 * garbage, never live objects. These tests exercise the pure decision logic
 * with no Supabase stack.
 */
import { describe, expect, it } from "vitest";
import {
  OAUTH_TEST_CLIENT_PREFIX,
  OAUTH_TEST_CLIENT_STALE_MS,
  isStaleOAuthTestClient,
  oauthTestClientMintedAt,
  oauthTestClientName,
} from "../integration/helpers/v1-principals";

const NOW = Date.parse("2026-08-08T12:00:00.000Z");
const MINUTE = 60 * 1000;

describe("oauthTestClientName / oauthTestClientMintedAt", () => {
  it("round-trips the minted-at timestamp through the name", () => {
    const name = oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, NOW);
    expect(name.startsWith(OAUTH_TEST_CLIENT_PREFIX)).toBe(true);
    expect(oauthTestClientMintedAt(name)).toBe(NOW);
  });

  it("produces unique names for the same instant", () => {
    const a = oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, NOW);
    const b = oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, NOW);
    expect(a).not.toBe(b);
  });

  it("supports per-suite prefixes", () => {
    const prefix = "v1-catalog-test-client-";
    const name = oauthTestClientName(prefix, NOW);
    expect(oauthTestClientMintedAt(name, prefix)).toBe(NOW);
    // Wrong prefix must not parse.
    expect(oauthTestClientMintedAt(name)).toBeNull();
  });

  it("returns null for names without a parseable timestamp token", () => {
    expect(oauthTestClientMintedAt("unrelated-client")).toBeNull();
    expect(oauthTestClientMintedAt(`${OAUTH_TEST_CLIENT_PREFIX}`)).toBeNull();
    expect(
      oauthTestClientMintedAt(`${OAUTH_TEST_CLIENT_PREFIX}NOT_BASE36!`)
    ).toBeNull();
  });
});

describe("isStaleOAuthTestClient", () => {
  it("never touches clients outside the prefix family", () => {
    expect(
      isStaleOAuthTestClient(
        {
          client_name: "someone-elses-integration-client",
          created_at: new Date(NOW - 24 * 60 * MINUTE).toISOString(),
        },
        { now: NOW }
      )
    ).toBe(false);
  });

  it("keeps a live client from a concurrent run (young, under threshold)", () => {
    const name = oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, NOW - 5 * MINUTE);
    expect(
      isStaleOAuthTestClient(
        {
          client_name: name,
          created_at: new Date(NOW - 5 * MINUTE).toISOString(),
        },
        { now: NOW }
      )
    ).toBe(false);
  });

  it("collects genuinely stale wreckage (older than threshold)", () => {
    const mintedAt = NOW - OAUTH_TEST_CLIENT_STALE_MS - MINUTE;
    const name = oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, mintedAt);
    expect(
      isStaleOAuthTestClient(
        { client_name: name, created_at: new Date(mintedAt).toISOString() },
        { now: NOW }
      )
    ).toBe(true);
  });

  it("is exclusive at the threshold boundary (exactly threshold-old is kept)", () => {
    const mintedAt = NOW - OAUTH_TEST_CLIENT_STALE_MS;
    expect(
      isStaleOAuthTestClient(
        {
          client_name: oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, mintedAt),
          created_at: new Date(mintedAt).toISOString(),
        },
        { now: NOW }
      )
    ).toBe(false);
  });

  it("prefers the API's created_at over the name token", () => {
    // Name claims ancient, created_at says young — created_at wins, kept.
    const name = oauthTestClientName(
      OAUTH_TEST_CLIENT_PREFIX,
      NOW - 10 * OAUTH_TEST_CLIENT_STALE_MS
    );
    expect(
      isStaleOAuthTestClient(
        { client_name: name, created_at: new Date(NOW - MINUTE).toISOString() },
        { now: NOW }
      )
    ).toBe(false);
  });

  it("falls back to the name token when created_at is absent", () => {
    const mintedAt = NOW - 2 * OAUTH_TEST_CLIENT_STALE_MS;
    const name = oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, mintedAt);
    expect(
      isStaleOAuthTestClient({ client_name: name }, { now: NOW })
    ).toBe(true);
    expect(
      isStaleOAuthTestClient(
        {
          client_name: oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, NOW),
        },
        { now: NOW }
      )
    ).toBe(false);
  });

  it("never deletes a prefixed client whose age is unknowable", () => {
    expect(
      isStaleOAuthTestClient(
        { client_name: `${OAUTH_TEST_CLIENT_PREFIX}NOT_BASE36!` },
        { now: NOW }
      )
    ).toBe(false);
    expect(
      isStaleOAuthTestClient(
        {
          client_name: `${OAUTH_TEST_CLIENT_PREFIX}NOT_BASE36!`,
          created_at: "not-a-date",
        },
        { now: NOW }
      )
    ).toBe(false);
  });

  it("respects a custom threshold", () => {
    const mintedAt = NOW - 2 * MINUTE;
    const client = {
      client_name: oauthTestClientName(OAUTH_TEST_CLIENT_PREFIX, mintedAt),
      created_at: new Date(mintedAt).toISOString(),
    };
    expect(isStaleOAuthTestClient(client, { now: NOW, staleMs: MINUTE })).toBe(
      true
    );
    expect(
      isStaleOAuthTestClient(client, { now: NOW, staleMs: 5 * MINUTE })
    ).toBe(false);
  });
});
