/**
 * get_connected_entitlement() integration tests (api-platform plan 010 §T3;
 * spec: 005-phase0-contract.md §1 "Entitlement determination").
 *
 * Pins the SECURITY DEFINER entitlement RPC
 * (20260805120000_get_connected_entitlement.sql) against the local stack:
 *
 *   1. Zero rows (not a row of NULLs) when the caller has no profile row.
 *   2. `is_provisioned = false` when `plan_selected` IS NULL.
 *   3. Free plan: `rounds_used` counts NON-QUARANTINED rounds only;
 *      `rounds_limit` = 25.
 *   4. Unlimited plans (lifetime AND premium — plan-derived, no
 *      subscription_status read): `has_unlimited_rounds = true`,
 *      `rounds_limit` NULL.
 *   5. `anon` cannot execute (EXECUTE revoked → 42501).
 *   6. An OAuth `client_id`-bearing token CAN execute and gets only its own
 *      user's row — even though the RESTRICTIVE profile SELECT deny
 *      (20260728091000) hides the underlying table from it. That is the whole
 *      point of the RPC.
 *   7. The response carries ONLY the four derived facts — never plan name,
 *      subscription status, period, or payment identifiers.
 *
 * Requires `supabase start` with migrations applied. Skips (like the other
 * local-stack suites) when no real local stack is configured.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq, inArray } from "drizzle-orm";

const { db } = await import("@/db");
const { profile, course, teeInfo, hole, round } = await import("@/db/schema");

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

const REDIRECT_URI = "http://localhost:9999/entitlement-test-callback";
const EMAILS = {
  noProfile: "entitlement-no-profile@handicappin.local",
  nullPlan: "entitlement-null-plan@handicappin.local",
  free: "entitlement-free@handicappin.local",
  lifetime: "entitlement-lifetime@handicappin.local",
  premium: "entitlement-premium@handicappin.local",
} as const;
const FREE_PASSWORD = randomUUID();

interface EntitlementRow {
  is_provisioned: boolean;
  has_unlimited_rounds: boolean;
  rounds_limit: number | null;
  rounds_used: number;
}

/** Direct PostgREST RPC call — the surface /v1 (and fitbull) will use. */
async function callEntitlement(token: string | null) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_connected_entitlement`, {
    method: "POST",
    headers: {
      apikey: anonKey!,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // empty body
  }
  return { status: res.status, json };
}

const admin = () =>
  createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function deleteUserByEmail(email: string) {
  const a = admin();
  const { data } = await a.auth.admin.listUsers();
  const existing = data?.users.find((u) => u.email === email);
  if (existing) {
    await db.delete(round).where(eq(round.userId, existing.id));
    await db.delete(profile).where(eq(profile.id, existing.id));
    await a.auth.admin.deleteUser(existing.id);
  }
}

async function createUserWithToken(email: string, password: string) {
  const a = admin();
  const { data, error } = await a.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (error || !data.user) {
    throw new Error(`createUser(${email}) failed: ${error?.message}`);
  }
  const userClient = createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signIn, error: signInErr } =
    await userClient.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) {
    throw new Error(`sign-in(${email}) failed: ${signInErr?.message}`);
  }
  return { id: data.user.id, token: signIn.session.access_token, userClient };
}

const ids: Record<keyof typeof EMAILS, string> = {
  noProfile: "",
  nullPlan: "",
  free: "",
  lifetime: "",
  premium: "",
};
const tokens: Record<keyof typeof EMAILS, string> = { ...ids };
let freeUserClient: ReturnType<typeof createClient>;
let oauthClientId: string;
let oauthAccessToken: string;
let courseId: number;
let teeId: number;
let holeId: number;
const roundIds: number[] = [];

describeIfLocal("get_connected_entitlement (real local Supabase)", () => {
  beforeAll(async () => {
    for (const email of Object.values(EMAILS)) {
      await deleteUserByEmail(email);
    }

    // ── Users + tokens ───────────────────────────────────────────────────
    for (const key of Object.keys(EMAILS) as Array<keyof typeof EMAILS>) {
      const password = key === "free" ? FREE_PASSWORD : randomUUID();
      const created = await createUserWithToken(EMAILS[key], password);
      ids[key] = created.id;
      tokens[key] = created.token;
      if (key === "free") freeUserClient = created.userClient;
    }

    // ── Profiles (noProfile deliberately gets NONE) ──────────────────────
    await db.insert(profile).values([
      {
        id: ids.nullPlan,
        email: EMAILS.nullPlan,
        name: "Null Plan",
        verified: true,
        // planSelected omitted → NULL
      },
      {
        id: ids.free,
        email: EMAILS.free,
        name: "Free Plan",
        verified: true,
        planSelected: "free",
      },
      {
        id: ids.lifetime,
        email: EMAILS.lifetime,
        name: "Lifetime Plan",
        verified: true,
        planSelected: "lifetime",
      },
      {
        id: ids.premium,
        email: EMAILS.premium,
        name: "Premium Plan",
        verified: true,
        planSelected: "premium",
      },
    ]);

    // ── Course/tee/hole scaffolding for rounds ───────────────────────────
    const [courseRow] = await db
      .insert(course)
      .values({
        name: `Entitlement Test Course ${ids.free.slice(0, 8)}`,
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

    // Free user: 3 active + 2 quarantined rounds. Distinct teeTimes so the
    // natural-key unique constraint never collides.
    const baseTime = Date.parse("2026-07-01T10:00:00Z");
    const roundValues = [false, false, false, true, true].map(
      (quarantined, i) => ({
        userId: ids.free,
        courseId,
        teeId,
        teeTime: new Date(baseTime + i * 86_400_000),
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
        quarantined,
      }),
    );
    const inserted = await db
      .insert(round)
      .values(roundValues)
      .returning({ id: round.id });
    roundIds.push(...inserted.map((r) => r.id));

    // ── OAuth 2.1 Connect flow for the free user (auth-code + PKCE) ──────
    const a = admin();
    const { data: client, error: clientErr } =
      await a.auth.admin.oauth.createClient({
        client_name: "entitlement-test-client",
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
    authorizeUrl.searchParams.set("state", "entitlement-test");
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
        `authorize did not redirect to consent (status ${authorizeRes.status})`,
      );
    }
    const { data: details, error: detailsErr } =
      await freeUserClient.auth.oauth.getAuthorizationDetails(authorizationId);
    if (detailsErr || !details || !("authorization_id" in details)) {
      throw new Error(
        `getAuthorizationDetails failed: ${detailsErr?.message ?? "already-consented redirect"}`,
      );
    }
    const { data: approval, error: approveErr } =
      await freeUserClient.auth.oauth.approveAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      });
    if (approveErr || !approval) {
      throw new Error(`approveAuthorization failed: ${approveErr?.message}`);
    }
    const code = new URL(approval.redirect_url).searchParams.get("code");
    if (!code) {
      throw new Error(`no code in redirect_url: ${approval.redirect_url}`);
    }
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
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(`token exchange failed (${tokenRes.status})`);
    }
    oauthAccessToken = tokenJson.access_token;
  }, 60_000);

  afterAll(async () => {
    const a = admin();
    if (oauthClientId) {
      await a.auth.admin.oauth.deleteClient(oauthClientId).catch(() => {});
    }
    if (roundIds.length) {
      await db.delete(round).where(inArray(round.id, roundIds));
    }
    if (holeId) await db.delete(hole).where(eq(hole.id, holeId));
    if (teeId) await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    if (courseId) await db.delete(course).where(eq(course.id, courseId));
    for (const email of Object.values(EMAILS)) {
      await deleteUserByEmail(email);
    }
  }, 30_000);

  // ── 1. Zero-row and null-plan provisioning states ────────────────────────

  test("no profile row → ZERO rows (not a row of nulls)", async () => {
    const { status, json } = await callEntitlement(tokens.noProfile);
    expect(status).toBe(200);
    expect(json).toEqual([]);
  });

  test("profile with plan_selected NULL → is_provisioned = false", async () => {
    const { status, json } = await callEntitlement(tokens.nullPlan);
    expect(status).toBe(200);
    const rows = json as EntitlementRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      is_provisioned: false,
      has_unlimited_rounds: false,
      rounds_limit: 25,
      rounds_used: 0,
    });
  });

  // ── 2. Free tier: quarantine-blind round counting ────────────────────────

  test("free plan: rounds_used counts NON-quarantined rounds only", async () => {
    const { status, json } = await callEntitlement(tokens.free);
    expect(status).toBe(200);
    const rows = json as EntitlementRow[];
    expect(rows).toHaveLength(1);
    // 5 rounds exist (3 active + 2 quarantined) — only the 3 active count.
    expect(rows[0]).toEqual({
      is_provisioned: true,
      has_unlimited_rounds: false,
      rounds_limit: 25,
      rounds_used: 3,
    });
  });

  // ── 3. Unlimited plans: plan-derived, plan-blind ─────────────────────────

  test("lifetime plan → has_unlimited_rounds = true, rounds_limit NULL", async () => {
    const { status, json } = await callEntitlement(tokens.lifetime);
    expect(status).toBe(200);
    const rows = json as EntitlementRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      is_provisioned: true,
      has_unlimited_rounds: true,
      rounds_limit: null,
      rounds_used: 0,
    });
  });

  test("premium plan → also unlimited (plan-derived; no subscription_status read)", async () => {
    const { status, json } = await callEntitlement(tokens.premium);
    expect(status).toBe(200);
    const rows = json as EntitlementRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      is_provisioned: true,
      has_unlimited_rounds: true,
      rounds_limit: null,
      rounds_used: 0,
    });
  });

  // ── 4. Grants: anon denied, authenticated allowed ────────────────────────

  test("anon cannot execute the RPC (EXECUTE revoked → 42501)", async () => {
    const { status, json } = await callEntitlement(null);
    expect(status).toBeGreaterThanOrEqual(400);
    expect((json as { code?: string }).code).toBe("42501");
  });

  // ── 5. OAuth client_id principal: the reason this RPC exists ─────────────

  test("OAuth client_id token CAN execute and gets only its own user's row", async () => {
    // Negative control first: the same token sees NOTHING via the table —
    // the RESTRICTIVE profile SELECT deny (20260728091000) is active.
    const tableRes = await fetch(
      `${supabaseUrl}/rest/v1/profile?select=plan_selected`,
      {
        headers: {
          apikey: anonKey!,
          Authorization: `Bearer ${oauthAccessToken}`,
        },
      },
    );
    expect(tableRes.status).toBe(200);
    expect(await tableRes.json()).toEqual([]);

    // The RPC still answers — SECURITY DEFINER bypasses the deny, with the
    // row filter hard-coded to auth.uid() (the free user who consented).
    const { status, json } = await callEntitlement(oauthAccessToken);
    expect(status).toBe(200);
    const rows = json as EntitlementRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      is_provisioned: true,
      has_unlimited_rounds: false,
      rounds_limit: 25,
      rounds_used: 3,
    });
  });

  // ── 6. Plan-blindness: only the four derived facts, ever ─────────────────

  test("response carries ONLY the four derived facts — no billing identity leaks", async () => {
    const { json } = await callEntitlement(oauthAccessToken);
    const rows = json as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "has_unlimited_rounds",
      "is_provisioned",
      "rounds_limit",
      "rounds_used",
    ]);
    const keys = Object.keys(rows[0]).join(",");
    for (const forbidden of [
      "plan_selected",
      "subscription",
      "period",
      "cancel",
      "billing",
      "stripe",
      "customer",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
