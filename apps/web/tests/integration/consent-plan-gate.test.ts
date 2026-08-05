/**
 * Integration proof for the /oauth/consent plan-selection gate (decision D3)
 * against the REAL local Supabase stack:
 *
 *   1. A signed-in but PLAN-LESS user hitting the consent page for a real
 *      pending GoTrue authorization is redirected to /onboarding with the
 *      consent URL in the guarded `?redirect=` resume param — never shown
 *      the approve/deny card.
 *   2. After plan selection the SAME consent URL resumes: the pending
 *      authorization survived server-side and the page now renders consent.
 *   3. The onboarding page honors only guard-passing resume paths: a
 *      malicious `?redirect=https://evil.example` is discarded (falls back
 *      to /billing), while the internal consent path is resumed.
 *
 * The server pages are invoked directly with `@/utils/supabase/server`
 * mocked to hand back a real signed-in supabase-js client (same session
 * semantics as the cookie-based SSR client). `redirect()` throws
 * NEXT_REDIRECT with the destination in the digest.
 *
 * Requires `supabase start` with migrations applied. Skips (like the other
 * suites) when no real local stack is configured.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

const holder = vi.hoisted(() => ({
  client: null as unknown,
}));

vi.mock("@/utils/supabase/server", () => ({
  createServerComponentClient: vi.fn(async () => holder.client),
}));

const { db } = await import("@/db");
const { profile } = await import("@/db/schema");
const { default: OAuthConsentPage } = await import("@/app/oauth/consent/page");
const { default: OnboardingPage } = await import("@/app/onboarding/page");
const { LOGIN_REDIRECT_PARAM, consentPath, safeInternalPath } = await import(
  "@/lib/oauth/consent-flow"
);

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

const USER_EMAIL = "consent-plan-gate@handicappin.local";
const USER_PASSWORD = randomUUID();
const REDIRECT_URI = "http://localhost:9999/consent-gate-test-callback";

let userId: string;
let userClient: SupabaseClient;
let oauthClientId: string;
let authorizationId: string;

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

/** Start a fresh GoTrue authorization; returns its authorization_id. */
async function startAuthorization(): Promise<string> {
  const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", oauthClientId);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("code_challenge", "a".repeat(43));
  authorizeUrl.searchParams.set("code_challenge_method", "plain");
  authorizeUrl.searchParams.set("state", "consent-gate-test");
  const res = await fetch(authorizeUrl, {
    redirect: "manual",
    headers: { apikey: anonKey! },
  });
  const location = res.headers.get("location");
  const id = location
    ? new URL(location).searchParams.get("authorization_id")
    : null;
  if (!id) {
    throw new Error(
      `authorize did not redirect to consent (status ${res.status}, location ${location})`,
    );
  }
  return id;
}

/** Runs a page function and returns the redirect destination, or null. */
async function redirectedTo(
  render: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await render();
    return null;
  } catch (err) {
    const digest = (err as { digest?: string }).digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    return digest.split(";")[2];
  }
}

const renderConsentPage = () =>
  OAuthConsentPage({
    searchParams: Promise.resolve({ authorization_id: authorizationId }),
  });

describeIfLocal("consent plan-selection gate (real local Supabase)", () => {
  beforeAll(async () => {
    const a = admin();
    await deleteUserByEmail(USER_EMAIL);

    // Signed-up user with a profile row but NO plan selected — the exact
    // state the D3 gate exists for.
    const { data: created, error: createErr } = await a.auth.admin.createUser({
      email: USER_EMAIL,
      email_confirm: true,
      password: USER_PASSWORD,
    });
    if (createErr || !created.user) {
      throw new Error(`createUser failed: ${createErr?.message}`);
    }
    userId = created.user.id;
    await db.insert(profile).values({
      id: userId,
      email: USER_EMAIL,
      name: "Consent Gate",
      verified: true,
    });

    userClient = createClient(supabaseUrl!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErr } = await userClient.auth.signInWithPassword({
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });
    if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
    holder.client = userClient;

    const { data: client, error: clientErr } =
      await a.auth.admin.oauth.createClient({
        client_name: "consent-gate-test-client",
        redirect_uris: [REDIRECT_URI],
      });
    if (clientErr || !client) {
      throw new Error(`oauth createClient failed: ${clientErr?.message}`);
    }
    oauthClientId = client.client_id;
    authorizationId = await startAuthorization();
  }, 60_000);

  afterAll(async () => {
    const a = admin();
    if (oauthClientId) {
      await a.auth.admin.oauth.deleteClient(oauthClientId).catch(() => {});
    }
    await deleteUserByEmail(USER_EMAIL);
  }, 30_000);

  test("plan-less user is redirected to onboarding with a guard-passing resume param", async () => {
    const destination = await redirectedTo(renderConsentPage);
    expect(destination).toBe(
      `/onboarding?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(
        consentPath(authorizationId),
      )}`,
    );
    // The nested resume target survives safeInternalPath and points back at
    // this exact pending authorization.
    const nested = new URL(
      `http://localhost${destination}`,
    ).searchParams.get(LOGIN_REDIRECT_PARAM);
    expect(safeInternalPath(nested)).toBe(consentPath(authorizationId));
  });

  test("onboarding discards a malicious ?redirect= but resumes the internal consent path", async () => {
    // Give the user a plan + refreshed JWT so the onboarding page takes its
    // redirect branch (same claims path the real flow uses).
    await db
      .update(profile)
      .set({ planSelected: "free", planSelectedAt: new Date() })
      .where(eq(profile.id, userId));
    const { error: refreshErr } = await userClient.auth.refreshSession();
    expect(refreshErr).toBeNull();

    // Open-redirect attempt: guard rejects it, falls back to /billing.
    const evil = await redirectedTo(() =>
      OnboardingPage({
        searchParams: Promise.resolve({
          redirect: "https://evil.example/phish",
        }),
      }),
    );
    expect(evil).toBe("/billing");

    // Legitimate internal resume path: honored verbatim.
    const resumed = await redirectedTo(() =>
      OnboardingPage({
        searchParams: Promise.resolve({
          redirect: consentPath(authorizationId),
        }),
      }),
    );
    expect(resumed).toBe(consentPath(authorizationId));
  });

  test("after plan selection the SAME consent URL resumes to the approve/deny card", async () => {
    // The pending authorization survived the onboarding detour server-side.
    const result = await renderConsentPage();
    expect(result).toBeTruthy();
    expect((result as { type?: unknown }).type).toBe("main");
  });

  test("revoking the plan re-arms the gate (control for the assertions above)", async () => {
    await db
      .update(profile)
      .set({ planSelected: null, planSelectedAt: null })
      .where(eq(profile.id, userId));

    const destination = await redirectedTo(renderConsentPage);
    expect(destination).toContain("/onboarding?");
  });
});
