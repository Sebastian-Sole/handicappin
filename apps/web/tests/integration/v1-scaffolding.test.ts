/**
 * `/v1` shared scaffolding against a REAL local Supabase stack.
 *
 * This suite is pre-routes. It proves the two things the unit tests cannot,
 * because both depend on Supabase actually behaving as the contract assumes:
 *
 *   1. **Principal extraction against genuine tokens.** A signed-in session
 *      token really carries no `client_id`; a token from the OAuth 2.1
 *      authorization-code + PKCE flow really carries `client_id` AND `scope`.
 *      Classification is asserted against real claims, not hand-built JWTs.
 *
 *   2. **The entitlement adapter over the real RPC, for BOTH principal
 *      classes** — the requirement in contract §6 ("integration tests must
 *      cover both principal classes per route"). The OAuth path is the one
 *      that matters: a `client_id` token gets ZERO rows from `profile` under
 *      the restrictive deny policy, which is exactly why
 *      `getComprehensiveUserAccess` would 403 a fully provisioned user and
 *      why this adapter exists.
 *
 * It also exercises `tests/integration/helpers/v1-principals.ts`, the helper
 * module Wave 2's route suites build their two-class coverage on.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import {
  createV1UserAccess,
  fetchV1Entitlement,
  v1EntitlementProblem,
  v1EntitlementRpcFromSupabase,
} from "@/app/api/v1/_lib/entitlement";
import {
  authenticateV1Request,
  hasScope,
  requireScope,
} from "@/app/api/v1/_lib/principal";
import { v1RateLimitIdentifier } from "@/app/api/v1/_lib/rate-limit-seam";
import { createBearerTokenSupabaseClient } from "@/lib/api/bearer-token";
import {
  OAUTH_TEST_CLIENT_PREFIX,
  adminClient,
  decodeTokenClaims,
  deleteAuthUserByEmail,
  hasLocalStack,
  mintFirstPartyPrincipal,
  mintOAuthPrincipal,
  sweepStaleOAuthTestClients,
  v1Request,
  type TestPrincipal,
} from "./helpers/v1-principals";

const { db } = await import("@/db");
const { profile } = await import("@/db/schema");

const describeIfLocal = hasLocalStack ? describe : describe.skip;

const EMAILS = {
  free: "v1-scaffolding-free@handicappin.local",
  noProfile: "v1-scaffolding-no-profile@handicappin.local",
} as const;

let firstParty: TestPrincipal;
let oauth: TestPrincipal;
let noProfile: TestPrincipal;

/** The adapter as a `/v1` handler wires it: RLS-scoped client → RPC → deps. */
function userAccessFor(principal: TestPrincipal) {
  return createV1UserAccess(
    v1EntitlementRpcFromSupabase(createBearerTokenSupabaseClient(principal.token)),
    { userId: principal.userId }
  );
}

function entitlementFor(principal: TestPrincipal) {
  return fetchV1Entitlement(
    v1EntitlementRpcFromSupabase(createBearerTokenSupabaseClient(principal.token))
  );
}

describeIfLocal("/v1 scaffolding (real local Supabase)", () => {
  beforeAll(async () => {
    // Reclaim anything a previous run leaked. `mintOAuthPrincipal`'s cleanup
    // is an in-process closure, so a crash or a timeout kill strands its
    // OAuth client in the local GoTrue; sweeping on the way IN is the only
    // teardown that survives the process dying.
    await sweepStaleOAuthTestClients();

    for (const email of Object.values(EMAILS)) {
      await deleteAuthUserByEmail(email);
    }

    const freeUser = await mintFirstPartyPrincipal(EMAILS.free);
    firstParty = freeUser;
    await db.insert(profile).values({
      id: freeUser.userId,
      email: EMAILS.free,
      name: "V1 Scaffolding Free",
      verified: true,
      planSelected: "free",
    });

    // Same human, second token: the OAuth class. This is the whole point —
    // one user, two principal classes, asymmetric RLS treatment.
    oauth = await mintOAuthPrincipal({
      userClient: freeUser.userClient,
      userId: freeUser.userId,
    });

    // A valid token with NO profile row — the zero-row case.
    noProfile = await mintFirstPartyPrincipal(EMAILS.noProfile);
  }, 90_000);

  afterAll(async () => {
    await oauth?.cleanup();
    for (const id of [firstParty?.userId, noProfile?.userId]) {
      if (id) await db.delete(profile).where(eq(profile.id, id));
    }
    for (const email of Object.values(EMAILS)) {
      await deleteAuthUserByEmail(email);
    }
  }, 60_000);

  // ── 1. Principal extraction against genuine tokens ──────────────────────

  test("a real signed-in session token carries no client_id → first-party", async () => {
    expect(decodeTokenClaims(firstParty.token).client_id).toBeUndefined();

    const result = await authenticateV1Request(v1Request(firstParty, "/rounds"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.class).toBe("first-party");
    expect(result.principal.userId).toBe(firstParty.userId);
    expect(hasScope(result.principal, "rounds:write")).toBe(true);
    expect(v1RateLimitIdentifier(result.principal)).toBe(
      `user:${firstParty.userId}`
    );
  }, 30_000);

  test("a real OAuth token carries client_id AND scope → oauth principal", async () => {
    const claims = decodeTokenClaims(oauth.token);
    expect(claims.client_id).toBe(oauth.clientId);
    // The custom_access_token_hook stamps `scope` unconditionally — the fact
    // §6's third case exists to survive a regression of.
    expect(typeof claims.scope).toBe("string");

    const result = await authenticateV1Request(v1Request(oauth, "/rounds"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.class).toBe("oauth");
    expect(result.principal.userId).toBe(firstParty.userId);
    expect(hasScope(result.principal, "rounds:write")).toBe(true);
    expect(v1RateLimitIdentifier(result.principal)).toBe(
      `client:${oauth.clientId}:user:${firstParty.userId}`
    );
  }, 30_000);

  test("an out-of-scope operation on a real OAuth token is 403 forbidden", async () => {
    const result = await authenticateV1Request(v1Request(oauth, "/rounds"));
    if (!result.ok) throw new Error("expected ok");
    expect(requireScope(result.principal, "scope:nobody:grants")?.status).toBe(403);
  }, 30_000);

  test("a garbage token is 401 through the real network validation path", async () => {
    const result = await authenticateV1Request(
      new Request("https://api.handicappin.com/api/v1/rounds", {
        headers: { authorization: "Bearer not.a.real-token" },
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe("unauthorized");
  }, 30_000);

  // ── 2. The entitlement adapter, per principal class ─────────────────────

  test("first-party principal: the adapter reports the free plan", async () => {
    await expect(userAccessFor(firstParty)(firstParty.userId)).resolves.toMatchObject(
      { hasAccess: true, plan: "free", hasUnlimitedRounds: false }
    );
  }, 30_000);

  test("OAUTH principal: the adapter reports the SAME entitlement", async () => {
    // The path that would 403 a provisioned user under
    // getComprehensiveUserAccess, because `profile` returns zero rows for a
    // client_id principal. The RPC is what makes it work.
    await expect(userAccessFor(oauth)(oauth.userId)).resolves.toMatchObject({
      hasAccess: true,
      plan: "free",
      hasUnlimitedRounds: false,
    });
  }, 30_000);

  test("both classes agree — the entitlement is a property of the USER", async () => {
    const [asFirstParty, asOAuth] = await Promise.all([
      userAccessFor(firstParty)(firstParty.userId),
      userAccessFor(oauth)(oauth.userId),
    ]);
    expect(asOAuth).toEqual(asFirstParty);
  }, 30_000);

  test("the OAuth principal is genuinely denied direct profile reads", async () => {
    // Proves the deny policy is live, so the test above is not passing by
    // accident on a permissive database.
    const client = createBearerTokenSupabaseClient(oauth.token);
    const { data } = await client.from("profile").select("id");
    expect(data ?? []).toHaveLength(0);
  }, 30_000);

  test("zero rows → the 403 plan_required record, for both classes", async () => {
    await expect(entitlementFor(noProfile)).resolves.toBeNull();
    expect(v1EntitlementProblem(await entitlementFor(noProfile))?.code).toBe(
      "plan_required"
    );

    const access = await userAccessFor(noProfile)(noProfile.userId);
    // hasAccess:false is what the 002 service turns into
    // PlanNotSelectedError → 403 plan_required.
    expect(access.hasAccess).toBe(false);
  }, 30_000);

  test("every minted OAuth client is name-prefixed, so the sweep can reclaim it", async () => {
    // `mintOAuthPrincipal`'s `cleanup` is an in-process closure and dies with
    // the process. `sweepStaleOAuthTestClients` is the crash-proof teardown,
    // and it matches on `client_name` — so this prefix is load-bearing, not
    // cosmetic. Drop it and leaked clients accumulate invisibly forever.
    const { data, error } = await adminClient().auth.admin.oauth.getClient(
      oauth.clientId!
    );
    expect(error).toBeNull();
    expect(data?.client_name.startsWith(OAUTH_TEST_CLIENT_PREFIX)).toBe(true);
  }, 30_000);

  test("the RPC exposes only the four derived facts — no billing identity", async () => {
    const row = await entitlementFor(oauth);
    expect(row).not.toBeNull();
    expect(Object.keys(row!).sort()).toEqual([
      "has_unlimited_rounds",
      "is_provisioned",
      "rounds_limit",
      "rounds_used",
    ]);
  }, 30_000);
});
