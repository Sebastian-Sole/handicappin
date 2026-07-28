/**
 * OAuth 2.1 client-token integration tests (api-platform subplan 004).
 *
 * Runs the REAL Connect flow against the local Supabase stack (OAuth server
 * enabled via `supabase/config.toml` `[auth.oauth_server]`):
 *
 *   1. Hook proof (20260728090000): OAuth-client tokens carry `client_id`
 *      AND the forward-compatible `scope` claim (`rounds:write`); first-party
 *      password-session tokens carry NEITHER.
 *   2. RLS deny-policy proof (20260728091000): a `client_id`-bearing token
 *      used DIRECTLY against PostgREST (the surface the spike proved is
 *      reachable and writable, bypassing tRPC entirely) cannot write profile
 *      state or read/write billing + account tables — while the same user's
 *      first-party token still can (positive controls).
 *
 * Requires `supabase start` with migrations applied (`supabase migration up`).
 * Skips (like the Stripe suites) when no real local stack is configured.
 */
import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
} from "vitest";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

const { db } = await import("@/db");
const {
  profile,
  stripeCustomers,
  pendingLifetimePurchases,
  emailPreferences,
  legalConsents,
  course,
  teeInfo,
  hole,
  round,
  score,
} = await import("@/db/schema");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const isLocalStack =
  !!databaseUrl?.includes("127.0.0.1") || !!databaseUrl?.includes("localhost");
const hasRealSupabase =
  !!supabaseUrl &&
  !supabaseUrl.includes("dummy") &&
  !!anonKey &&
  !anonKey.includes("dummy") &&
  !!serviceRoleKey &&
  !serviceRoleKey.includes("dummy");

const describeIfLocal =
  hasRealSupabase && isLocalStack ? describe : describe.skip;

const OWNER_EMAIL = "oauth-tokens-owner@handicappin.local";
const DECOY_EMAIL = "oauth-tokens-decoy@handicappin.local";
const OWNER_PASSWORD = randomUUID();
const REDIRECT_URI = "http://localhost:9999/oauth-test-callback";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payloadSegment = token.split(".")[1];
  return JSON.parse(
    Buffer.from(payloadSegment, "base64url").toString("utf-8"),
  ) as Record<string, unknown>;
}

/** Direct PostgREST request — the adversarial surface (bypasses tRPC). */
async function postgrest(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // 204 / empty body
  }
  return { status: res.status, json };
}

let ownerId: string;
let decoyId: string;
let oauthClientId: string;
let oauthAccessToken: string;
let firstPartyToken: string;
let courseId: number;
let teeId: number;
let holeId: number;
let roundId: number;
let scoreId: number;

const admin = () =>
  createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function deleteUserByEmail(email: string) {
  const a = admin();
  const { data } = await a.auth.admin.listUsers();
  const existing = data?.users.find((u) => u.email === email);
  if (existing) {
    await db.delete(profile).where(eq(profile.id, existing.id));
    await a.auth.admin.deleteUser(existing.id);
  }
}

describeIfLocal("OAuth client tokens (real local Supabase)", () => {
  beforeAll(async () => {
    const a = admin();

    await deleteUserByEmail(OWNER_EMAIL);
    await deleteUserByEmail(DECOY_EMAIL);

    // ── Seed users + profiles ────────────────────────────────────────────
    const { data: owner, error: ownerErr } = await a.auth.admin.createUser({
      email: OWNER_EMAIL,
      email_confirm: true,
      password: OWNER_PASSWORD,
    });
    if (ownerErr || !owner.user) {
      throw new Error(`owner createUser failed: ${ownerErr?.message}`);
    }
    ownerId = owner.user.id;

    const { data: decoy, error: decoyErr } = await a.auth.admin.createUser({
      email: DECOY_EMAIL,
      email_confirm: true,
      password: randomUUID(),
    });
    if (decoyErr || !decoy.user) {
      throw new Error(`decoy createUser failed: ${decoyErr?.message}`);
    }
    decoyId = decoy.user.id;

    await db.insert(profile).values([
      { id: ownerId, email: OWNER_EMAIL, name: "OAuth Owner", verified: true },
      { id: decoyId, email: DECOY_EMAIL, name: "OAuth Decoy", verified: true },
    ]);

    // Billing/account state the OAuth token must NOT be able to see.
    await db.insert(stripeCustomers).values({
      userId: ownerId,
      stripeCustomerId: `cus_oauth_test_${ownerId.slice(0, 8)}`,
    });
    await db.insert(pendingLifetimePurchases).values({
      userId: ownerId,
      checkoutSessionId: `cs_oauth_test_${ownerId.slice(0, 8)}`,
      priceId: "price_test",
      plan: "lifetime",
      status: "pending",
    });
    await db.insert(legalConsents).values({
      userId: ownerId,
      consentType: "terms_of_service",
      legalVersion: "test-1",
      acceptedAt: new Date(),
      acceptanceMethod: "signup",
    });

    // A round + score for the delete-deny (write-only) posture tests.
    const [courseRow] = await db
      .insert(course)
      .values({
        name: `OAuth Test Course ${ownerId.slice(0, 8)}`,
        approvalStatus: "approved",
        country: "Norway",
        city: "Testville",
        source: "user",
      })
      .returning({ id: course.id });
    courseId = courseRow.id;
    const [teeRow] = await db
      .insert(teeInfo)
      .values({
        courseId,
        name: "White",
        gender: "mens",
        courseRating18: 72.0,
        slopeRating18: 113,
        courseRatingFront9: 36.0,
        slopeRatingFront9: 113,
        courseRatingBack9: 36.0,
        slopeRatingBack9: 113,
        outPar: 36,
        inPar: 36,
        totalPar: 72,
        outDistance: 3000,
        inDistance: 3000,
        totalDistance: 6000,
        approvalStatus: "approved",
      })
      .returning({ id: teeInfo.id });
    teeId = teeRow.id;
    const [holeRow] = await db
      .insert(hole)
      .values({ teeId, holeNumber: 1, par: 4, distance: 350, hcp: 1 })
      .returning({ id: hole.id });
    holeId = holeRow.id;
    const [roundRow] = await db
      .insert(round)
      .values({
        userId: ownerId,
        courseId,
        teeId,
        teeTime: new Date(),
        totalStrokes: 90,
        parPlayed: 72,
        adjustedGrossScore: 90,
        adjustedPlayedScore: 90,
        courseHandicap: 18,
        scoreDifferential: 18.0,
        existingHandicapIndex: 18.0,
        updatedHandicapIndex: 18.0,
        courseRatingUsed: 72.0,
        slopeRatingUsed: 113,
        holesPlayed: 18,
      })
      .returning({ id: round.id });
    roundId = roundRow.id;
    const [scoreRow] = await db
      .insert(score)
      .values({
        userId: ownerId,
        roundId,
        holeId,
        strokes: 5,
        hcpStrokes: 1,
      })
      .returning({ id: score.id });
    scoreId = scoreRow.id;

    // ── First-party session (password sign-in — no client_id expected) ───
    const userClient = createClient(supabaseUrl!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInErr } =
      await userClient.auth.signInWithPassword({
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD,
      });
    if (signInErr || !signIn.session) {
      throw new Error(`password sign-in failed: ${signInErr?.message}`);
    }
    firstPartyToken = signIn.session.access_token;

    // ── OAuth 2.1 Connect flow (auth-code + PKCE S256, confidential) ─────
    const { data: client, error: clientErr } =
      await a.auth.admin.oauth.createClient({
        client_name: "oauth-tokens-test-client",
        redirect_uris: [REDIRECT_URI],
      });
    if (clientErr || !client?.client_secret) {
      throw new Error(`oauth createClient failed: ${clientErr?.message}`);
    }
    oauthClientId = client.client_id;

    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/oauth/authorize`);
    authorizeUrl.searchParams.set("client_id", oauthClientId);
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", "integration-test");
    const authorizeRes = await fetch(authorizeUrl, {
      redirect: "manual",
      headers: { apikey: anonKey! },
    });
    const consentLocation = authorizeRes.headers.get("location");
    const authorizationId = consentLocation
      ? new URL(consentLocation).searchParams.get("authorization_id")
      : null;
    if (!authorizationId) {
      throw new Error(
        `authorize did not redirect to consent (status ${authorizeRes.status}, location ${consentLocation})`,
      );
    }

    // Resolve the authorization as the signed-in user, then approve — the
    // same two helpers the consent page uses, in the same order. (GoTrue
    // requires the details fetch to bind the session before consent:
    // approving without it returns "authorization not found".)
    const { data: details, error: detailsErr } =
      await userClient.auth.oauth.getAuthorizationDetails(authorizationId);
    if (detailsErr || !details || !("authorization_id" in details)) {
      throw new Error(
        `getAuthorizationDetails failed: ${detailsErr?.message ?? "already-consented redirect"}`,
      );
    }
    if (details.user.id !== ownerId) {
      throw new Error("authorization details bound to the wrong user");
    }
    const { data: approval, error: approveErr } =
      await userClient.auth.oauth.approveAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      });
    if (approveErr || !approval) {
      throw new Error(`approveAuthorization failed: ${approveErr?.message}`);
    }
    const code = new URL(approval.redirect_url).searchParams.get("code");
    if (!code) {
      throw new Error(`no code in redirect_url: ${approval.redirect_url}`);
    }

    // Token exchange with confidential-client auth (Basic).
    const tokenRes = await fetch(`${supabaseUrl}/auth/v1/oauth/token`, {
      method: "POST",
      headers: {
        apikey: anonKey!,
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${oauthClientId}:${client.client_secret}`,
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(
        `token exchange failed (${tokenRes.status}): ${JSON.stringify(tokenJson)}`,
      );
    }
    oauthAccessToken = tokenJson.access_token;
  }, 60_000);

  afterAll(async () => {
    const a = admin();
    if (oauthClientId) {
      await a.auth.admin.oauth.deleteClient(oauthClientId).catch(() => {});
    }
    if (scoreId) await db.delete(score).where(eq(score.id, scoreId));
    if (roundId) await db.delete(round).where(eq(round.id, roundId));
    if (holeId) await db.delete(hole).where(eq(hole.id, holeId));
    if (teeId) await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    if (courseId) await db.delete(course).where(eq(course.id, courseId));
    if (ownerId) {
      await db
        .delete(emailPreferences)
        .where(eq(emailPreferences.userId, ownerId));
      await db.delete(legalConsents).where(eq(legalConsents.userId, ownerId));
      await db
        .delete(pendingLifetimePurchases)
        .where(eq(pendingLifetimePurchases.userId, ownerId));
      await db
        .delete(stripeCustomers)
        .where(eq(stripeCustomers.userId, ownerId));
    }
    await deleteUserByEmail(OWNER_EMAIL);
    await deleteUserByEmail(DECOY_EMAIL);
  }, 30_000);

  // ── 1. Custom access token hook: claims contract ───────────────────────

  test("OAuth token carries client_id and the rounds:write scope claim — and NO billing claims", () => {
    const claims = decodeJwtPayload(oauthAccessToken);
    expect(claims.client_id).toBe(oauthClientId);
    expect(String(claims.scope ?? "")).toContain("rounds:write");
    // `ref` is deliberately NOT asserted: local GoTrue never stamps it
    // (hosted-platform claim — verified empirically against this stack), so
    // only its passthrough is coded in the hook (same FOREACH array as
    // client_id, which IS asserted above).
    // A connected app must not learn the billing tier by decoding its own
    // token: the hook skips billing stamping for client_id tokens.
    const appMetadata = (claims.app_metadata ?? {}) as Record<string, unknown>;
    expect(appMetadata.billing).toBeUndefined();
  });

  test("first-party session token carries NEITHER client_id nor scope — and KEEPS billing claims", () => {
    const claims = decodeJwtPayload(firstPartyToken);
    expect(claims.client_id).toBeUndefined();
    expect(claims.scope).toBeUndefined();
    expect(claims.sub).toBe(ownerId);
    // First-party billing claims unchanged by the OAuth branch of the hook.
    expect(claims.app_metadata).toMatchObject({
      billing: expect.objectContaining({ plan: expect.any(String) }),
    });
  });

  test("auth.getUser accepts the OAuth token and resolves the linked user", async () => {
    const verifier = createClient(supabaseUrl!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await verifier.auth.getUser(oauthAccessToken);
    expect(error).toBeNull();
    expect(data.user?.id).toBe(ownerId);
  });

  // ── 2. RLS deny-policies against direct PostgREST access ───────────────

  test("OAuth token cannot SELECT profile at all (billing columns live there)", async () => {
    // The whole row — including plan_selected/subscription_status/... — is
    // off-limits; basics come from get_connected_profile() instead.
    const { status, json } = await postgrest(oauthAccessToken, "profile");
    expect(status).toBe(200);
    expect(json as unknown[]).toEqual([]);

    // Positive control: the same user's first-party token still reads it.
    const firstParty = await postgrest(
      firstPartyToken,
      "profile?select=id,name",
    );
    expect(firstParty.status).toBe(200);
    expect((firstParty.json as Array<{ id: string }>).map((r) => r.id)).toEqual(
      [ownerId],
    );
  });

  test("get_connected_profile() serves the non-billing basics to the OAuth token", async () => {
    const { status, json } = await postgrest(
      oauthAccessToken,
      "rpc/get_connected_profile",
      { method: "POST", body: {} },
    );
    expect(status).toBe(200);
    const rows = json as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: ownerId,
      name: "OAuth Owner",
      verified: true,
    });
    expect(rows[0].handicap_index).toBeDefined();
    // No billing column escapes by any spelling.
    const keys = Object.keys(rows[0]).join(",");
    for (const forbidden of [
      "plan",
      "subscription",
      "period",
      "cancel",
      "billing",
      "email",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  test("OAuth token cannot UPDATE profile (spike criterion vi now denied)", async () => {
    const { json } = await postgrest(
      oauthAccessToken,
      `profile?id=eq.${ownerId}`,
      { method: "PATCH", body: { name: "hacked-by-oauth-client" } },
    );
    expect(Array.isArray(json) ? json : []).toEqual([]);
    const [row] = await db
      .select({ name: profile.name })
      .from(profile)
      .where(eq(profile.id, ownerId));
    expect(row.name).toBe("OAuth Owner");
  });

  test("first-party token CAN still update profile (deny targets client_id only)", async () => {
    const { status, json } = await postgrest(
      firstPartyToken,
      `profile?id=eq.${ownerId}`,
      { method: "PATCH", body: { name: "First Party Update" } },
    );
    expect(status).toBe(200);
    expect(json as Array<{ name: string }>).toHaveLength(1);
    // restore
    await db
      .update(profile)
      .set({ name: "OAuth Owner" })
      .where(eq(profile.id, ownerId));
  });

  test("OAuth token cannot INSERT profile (RLS with-check, 403)", async () => {
    // 403 comes from the RESTRICTIVE INSERT deny (checked before the unique
    // constraint — verified empirically, not a 409 masquerading as a pass).
    const { status } = await postgrest(oauthAccessToken, "profile", {
      method: "POST",
      body: { id: ownerId, email: OWNER_EMAIL, name: "inserted-by-oauth" },
    });
    expect(status).toBe(403);
  });

  test("OAuth token cannot DELETE profile", async () => {
    const { json } = await postgrest(
      oauthAccessToken,
      `profile?id=eq.${ownerId}`,
      { method: "DELETE" },
    );
    expect(Array.isArray(json) ? json : []).toEqual([]);
    const rows = await db
      .select({ id: profile.id })
      .from(profile)
      .where(eq(profile.id, ownerId));
    expect(rows).toHaveLength(1);
  });

  test("billing state (stripe_customers) is invisible to the OAuth token", async () => {
    const firstParty = await postgrest(
      firstPartyToken,
      "stripe_customers?select=stripe_customer_id",
    );
    expect(firstParty.status).toBe(200);
    expect(firstParty.json as unknown[]).toHaveLength(1); // positive control

    const oauth = await postgrest(
      oauthAccessToken,
      "stripe_customers?select=stripe_customer_id",
    );
    expect(oauth.status).toBe(200);
    expect(oauth.json as unknown[]).toEqual([]);
  });

  test("billing state (pending_lifetime_purchases) is invisible to the OAuth token", async () => {
    const firstParty = await postgrest(
      firstPartyToken,
      "pending_lifetime_purchases?select=checkout_session_id",
    );
    expect(firstParty.json as unknown[]).toHaveLength(1);

    const oauth = await postgrest(
      oauthAccessToken,
      "pending_lifetime_purchases?select=checkout_session_id",
    );
    expect(oauth.json as unknown[]).toEqual([]);
  });

  test("legal_consents audit trail is invisible to the OAuth token", async () => {
    const firstParty = await postgrest(
      firstPartyToken,
      "legal_consents?select=consent_type",
    );
    expect(firstParty.json as unknown[]).toHaveLength(1);

    const oauth = await postgrest(
      oauthAccessToken,
      "legal_consents?select=consent_type",
    );
    expect(oauth.json as unknown[]).toEqual([]);
  });

  test("OAuth token cannot write email_preferences; first-party can", async () => {
    const oauthInsert = await postgrest(oauthAccessToken, "email_preferences", {
      method: "POST",
      body: { user_id: ownerId, feature_updates: false },
    });
    expect(oauthInsert.status).toBe(403); // RLS with-check violation

    const firstPartyInsert = await postgrest(
      firstPartyToken,
      "email_preferences",
      { method: "POST", body: { user_id: ownerId, feature_updates: false } },
    );
    expect(firstPartyInsert.status).toBe(201);

    const oauthRead = await postgrest(
      oauthAccessToken,
      "email_preferences?select=feature_updates",
    );
    expect(oauthRead.json as unknown[]).toEqual([]);
  });

  test("OAuth token cannot write pending_email_changes (account-takeover surface)", async () => {
    const { status } = await postgrest(
      oauthAccessToken,
      "pending_email_changes",
      {
        method: "POST",
        body: {
          user_id: ownerId,
          old_email: OWNER_EMAIL,
          new_email: "attacker@evil.example",
          token_hash: "deadbeef",
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
      },
    );
    expect(status).toBe(403);
  });

  // ── 3. Rounds: write-only-by-default (log/update yes, destroy no) ──────

  test("OAuth token can read, log and update rounds/scores", async () => {
    const read = await postgrest(
      oauthAccessToken,
      `round?id=eq.${roundId}&select=id`,
    );
    expect(read.status).toBe(200);
    expect(read.json as unknown[]).toHaveLength(1);

    const patch = await postgrest(oauthAccessToken, `round?id=eq.${roundId}`, {
      method: "PATCH",
      body: { notes: "updated by connected app" },
    });
    expect(patch.status).toBe(200);
    expect(patch.json as unknown[]).toHaveLength(1);

    const insert = await postgrest(oauthAccessToken, "score", {
      method: "POST",
      body: {
        userId: ownerId,
        roundId,
        holeId,
        strokes: 4,
        hcpStrokes: 0,
      },
    });
    expect(insert.status).toBe(201);
    // Remove the extra score so the delete-deny assertions below stay exact.
    const [inserted] = insert.json as Array<{ id: number }>;
    await db.delete(score).where(eq(score.id, inserted.id));
  });

  test("OAuth token cannot DELETE rounds or scores; first-party still can", async () => {
    const delScore = await postgrest(
      oauthAccessToken,
      `score?id=eq.${scoreId}`,
      { method: "DELETE" },
    );
    expect(Array.isArray(delScore.json) ? delScore.json : []).toEqual([]);
    expect(
      await db.select({ id: score.id }).from(score).where(eq(score.id, scoreId)),
    ).toHaveLength(1);

    const delRound = await postgrest(
      oauthAccessToken,
      `round?id=eq.${roundId}`,
      { method: "DELETE" },
    );
    expect(Array.isArray(delRound.json) ? delRound.json : []).toEqual([]);
    expect(
      await db.select({ id: round.id }).from(round).where(eq(round.id, roundId)),
    ).toHaveLength(1);

    // Positive controls: the user's first-party token retains full delete
    // capability (destructive — this is the last test touching these rows).
    const fpScore = await postgrest(
      firstPartyToken,
      `score?id=eq.${scoreId}`,
      { method: "DELETE" },
    );
    expect(fpScore.status).toBe(200);
    expect(fpScore.json as unknown[]).toHaveLength(1);

    const fpRound = await postgrest(
      firstPartyToken,
      `round?id=eq.${roundId}`,
      { method: "DELETE" },
    );
    expect(fpRound.status).toBe(200);
    expect(fpRound.json as unknown[]).toHaveLength(1);
  });
});
