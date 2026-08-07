/**
 * OAuth detect-and-revoke integration tests (api-platform subplan 009).
 *
 * Exercises `public.detect_and_revoke_oauth_grants()` — the every-minute
 * detective control that collapses the accepted updateUser residual (a leaked
 * OAuth-client token can change the password/email within 24h of consent) to
 * minutes-to-detection. Runs the REAL Connect flow + the REAL detector SQL
 * against the local Supabase stack (GoTrue v2.183.0, OAuth server enabled in
 * config.toml). The DB is never mocked.
 *
 * Includes the MANDATORY revert-the-fix test: with the detector stubbed to a
 * no-op the simulated attack goes UNDETECTED (grant stays live); with the real
 * function restored, detection + revocation fire.
 *
 * Requires `supabase start` with migrations applied. Skips (like the OAuth
 * token suite) when no real local stack is configured.
 */
import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
} from "vitest";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

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

const REDIRECT_URI = "http://localhost:9999/oauth-detect-callback";
const EMAIL_PREFIX = "oauth-detect-";

const sql = postgres(databaseUrl ?? "", { prepare: false });

const admin = () =>
  createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

interface OAuthSession {
  userId: string;
  email: string;
  clientId: string;
  clientSecret: string;
  oauthAccessToken: string;
  firstPartyToken: string;
  userClient: SupabaseClient;
}

/** Run one authorize -> consent -> token exchange, return the access token. */
async function consentAndExchange(
  userClient: SupabaseClient,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const u = new URL(`${supabaseUrl}/auth/v1/oauth/authorize`);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", "detect-test");
  const authorizeRes = await fetch(u, {
    redirect: "manual",
    headers: { apikey: anonKey! },
  });
  const loc = authorizeRes.headers.get("location");
  const authorizationId = loc
    ? new URL(loc).searchParams.get("authorization_id")
    : null;
  if (!authorizationId) {
    throw new Error(`authorize did not redirect to consent (${authorizeRes.status})`);
  }
  const { error: dErr } =
    await userClient.auth.oauth.getAuthorizationDetails(authorizationId);
  if (dErr) throw new Error(`getAuthorizationDetails: ${dErr.message}`);
  const { data: approval, error: aErr } =
    await userClient.auth.oauth.approveAuthorization(authorizationId, {
      skipBrowserRedirect: true,
    });
  if (aErr || !approval) throw new Error(`approve: ${aErr?.message}`);
  const code = new URL(approval.redirect_url).searchParams.get("code");
  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/oauth/token`, {
    method: "POST",
    headers: {
      apikey: anonKey!,
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error(`token exchange failed: ${JSON.stringify(tokenJson)}`);
  }
  return tokenJson.access_token;
}

/** Create a user with a first-party session AND a live OAuth grant. */
async function mintOAuthSession(email: string): Promise<OAuthSession> {
  const a = admin();
  const password = randomUUID();
  const { data: created, error: cErr } = await a.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (cErr || !created.user) throw new Error(`createUser: ${cErr?.message}`);
  const userId = created.user.id;

  const userClient = createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signIn, error: sErr } =
    await userClient.auth.signInWithPassword({ email, password });
  if (sErr || !signIn.session) throw new Error(`signIn: ${sErr?.message}`);

  const { data: client, error: clErr } =
    await a.auth.admin.oauth.createClient({
      client_name: `detect-client-${randomUUID().slice(0, 8)}`,
      redirect_uris: [REDIRECT_URI],
    });
  if (clErr || !client?.client_secret) {
    throw new Error(`createClient: ${clErr?.message}`);
  }
  const oauthAccessToken = await consentAndExchange(
    userClient,
    client.client_id,
    client.client_secret,
  );

  return {
    userId,
    email,
    clientId: client.client_id,
    clientSecret: client.client_secret,
    oauthAccessToken,
    firstPartyToken: signIn.session.access_token,
    userClient,
  };
}

/** Drive a raw PUT /auth/v1/user with the given bearer token. */
async function putUser(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function runDetector() {
  await sql`SELECT public.detect_and_revoke_oauth_grants()`;
}

async function ledgerRows(userId: string) {
  return sql<
    {
      signal: string;
      audit_entry_id: string | null;
      oauth_client_id: string;
      sessions_deleted: number;
    }[]
  >`SELECT signal, audit_entry_id, oauth_client_id, sessions_deleted
    FROM public.oauth_auto_revocations WHERE user_id = ${userId}`;
}

async function consentRow(userId: string, clientId: string) {
  const rows = await sql<{ id: string; revoked_at: string | null }[]>`
    SELECT id, revoked_at FROM auth.oauth_consents
    WHERE user_id = ${userId} AND client_id = ${clientId}`;
  return rows[0];
}

async function oauthSessions(userId: string) {
  return sql<{ id: string }[]>`
    SELECT id FROM auth.sessions
    WHERE user_id = ${userId} AND oauth_client_id IS NOT NULL`;
}

async function firstPartySessions(userId: string) {
  return sql<{ id: string }[]>`
    SELECT id FROM auth.sessions
    WHERE user_id = ${userId} AND oauth_client_id IS NULL`;
}

async function oauthTokenAlive(token: string): Promise<boolean> {
  const verifier = createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await verifier.auth.getUser(token);
  return error === null;
}

async function deleteTestUsers() {
  const a = admin();
  const { data } = await a.auth.admin.listUsers({ perPage: 1000 });
  const targets = (data?.users ?? []).filter((u) =>
    u.email?.startsWith(EMAIL_PREFIX),
  );
  for (const u of targets) {
    await sql`DELETE FROM public.oauth_watch_email_state WHERE user_id = ${u.id}`;
    await sql`DELETE FROM public.oauth_auto_revocations WHERE user_id = ${u.id}`;
    await a.auth.admin.deleteUser(u.id).catch(() => {});
  }
}

describeIfLocal("OAuth detect-and-revoke (real local Supabase)", () => {
  beforeAll(async () => {
    await deleteTestUsers();
  }, 60_000);

  afterAll(async () => {
    await deleteTestUsers();
    await sql.end();
  }, 60_000);

  // ── MANDATORY revert-the-fix ────────────────────────────────────────────
  test("revert-the-fix: stubbed detector leaves the attack UNDETECTED; restored detector revokes", async () => {
    const s = await mintOAuthSession(`${EMAIL_PREFIX}revert-${randomUUID().slice(0, 8)}@handicappin.local`);

    // Capture the real definition so we can restore it no matter what.
    const [{ def }] = await sql<{ def: string }[]>`
      SELECT pg_get_functiondef('public.detect_and_revoke_oauth_grants()'::regprocedure) AS def`;

    try {
      // --- Break the control: replace the body with a no-op. ---
      await sql.unsafe(
        `CREATE OR REPLACE FUNCTION public.detect_and_revoke_oauth_grants()
         RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
         AS $stub$ BEGIN NULL; END; $stub$;`,
      );

      // Attack: change the password via the OAuth bearer token.
      expect(await putUser(s.oauthAccessToken, { password: randomUUID() })).toBe(200);
      await runDetector(); // the stub — does nothing

      // With the fix reverted, the expected assertions FAIL: the grant is live.
      expect(await ledgerRows(s.userId)).toHaveLength(0);
      expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(true);
      expect((await consentRow(s.userId, s.clientId)).revoked_at).toBeNull();
      expect(await oauthSessions(s.userId)).toHaveLength(1);
    } finally {
      // --- Restore the real control. ---
      await sql.unsafe(def);
    }

    // Now the real detector runs against the same still-live attack state.
    await runDetector();

    const ledger = await ledgerRows(s.userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].signal).toBe("audit:user_updated_password");
    expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(false);
    expect((await consentRow(s.userId, s.clientId)).revoked_at).not.toBeNull();
    expect(await oauthSessions(s.userId)).toHaveLength(0);
  }, 90_000);

  // ── Password signal (attack via OAuth bearer) ───────────────────────────
  test("password change via the OAuth bearer token is detected and the grant revoked", async () => {
    const s = await mintOAuthSession(`${EMAIL_PREFIX}pass-${randomUUID().slice(0, 8)}@handicappin.local`);

    expect(await putUser(s.oauthAccessToken, { password: randomUUID() })).toBe(200);
    await runDetector();

    const ledger = await ledgerRows(s.userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].signal).toBe("audit:user_updated_password");
    expect(ledger[0].audit_entry_id).not.toBeNull();
    expect(ledger[0].sessions_deleted).toBe(1);

    // Grant fully dead: getUser fails, consent revoked, session gone.
    expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(false);
    expect((await consentRow(s.userId, s.clientId)).revoked_at).not.toBeNull();
    expect(await oauthSessions(s.userId)).toHaveLength(0);

    // Parity token_revoked audit entry written with the pinned payload shape.
    const parity = await sql<{ traits_action: string; top_action: string }[]>`
      SELECT payload->>'action' AS top_action,
             payload->'traits'->>'action' AS traits_action
      FROM auth.audit_log_entries
      WHERE (payload->>'actor_id')::uuid = ${s.userId}
        AND payload->'traits'->>'oauth_client_id' = ${s.clientId}
        AND payload->'traits'->>'action' = 'revoke_oauth_grant'`;
    expect(parity).toHaveLength(1);
    expect(parity[0].top_action).toBe("token_revoked");
    expect(parity[0].traits_action).toBe("revoke_oauth_grant");

    // Idempotence: a second run adds nothing (ledger pre-check + ordering).
    await runDetector();
    expect(await ledgerRows(s.userId)).toHaveLength(1);
  }, 90_000);

  // ── First-party password change: expected ZERO ─────────────────────────
  test("first-party password change yields ZERO revocations (LogoutAllExceptMe already killed the OAuth session)", async () => {
    const s = await mintOAuthSession(`${EMAIL_PREFIX}fp-${randomUUID().slice(0, 8)}@handicappin.local`);

    // Change the password with the FIRST-PARTY token — GoTrue's
    // LogoutAllExceptMe kills the OAuth session before the job runs.
    expect(await putUser(s.firstPartyToken, { password: randomUUID() })).toBe(200);
    // OAuth session already gone by cascade.
    expect(await oauthSessions(s.userId)).toHaveLength(0);

    await runDetector();
    expect(await ledgerRows(s.userId)).toHaveLength(0);
    // Documented, accepted scope gap: consent row stays NULL.
    expect((await consentRow(s.userId, s.clientId)).revoked_at).toBeNull();
  }, 90_000);

  // ── Email signal (snapshot-compare) + first-party-session survival ──────
  test("email-change request under a live OAuth grant is detected on the next tick; the first-party session survives", async () => {
    const email = `${EMAIL_PREFIX}email-${randomUUID().slice(0, 8)}@handicappin.local`;
    const s = await mintOAuthSession(email);

    // Tick 1: seed the email snapshot (no action).
    await runDetector();
    expect(await ledgerRows(s.userId)).toHaveLength(0);

    // Request an email change (columns move without the mailer via generateLink).
    const a = admin();
    const { error: lErr } = await a.auth.admin.generateLink({
      type: "email_change_new",
      email,
      newEmail: `${EMAIL_PREFIX}new-${randomUUID().slice(0, 8)}@handicappin.local`,
    });
    expect(lErr).toBeNull();

    // Tick 2: detect + revoke.
    await runDetector();
    const ledger = await ledgerRows(s.userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].signal).toBe("email_snapshot");
    expect(ledger[0].audit_entry_id).toBeNull();

    expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(false);
    expect((await consentRow(s.userId, s.clientId)).revoked_at).not.toBeNull();
    expect(await oauthSessions(s.userId)).toHaveLength(0);
    // Scoping: only oauth_client_id sessions were deleted.
    expect(await firstPartySessions(s.userId)).toHaveLength(1);

    // Idempotence: snapshot upserted -> no re-trigger.
    await runDetector();
    expect(await ledgerRows(s.userId)).toHaveLength(1);
  }, 90_000);

  // ── No-self-trigger (a): OAuth metadata write (MERGE-BLOCKING) ──────────
  test("no-self-trigger: OAuth-client metadata write (updateUser data) causes ZERO revocations", async () => {
    const s = await mintOAuthSession(`${EMAIL_PREFIX}meta-${randomUUID().slice(0, 8)}@handicappin.local`);
    await runDetector(); // seed snapshot

    // The exact op spike criterion vi proved works: a metadata write via the
    // OAuth token. Emits only `user_modified` (never `user_updated_password`).
    expect(
      await putUser(s.oauthAccessToken, { data: { note: "benign-metadata" } }),
    ).toBe(200);

    await runDetector();
    expect(await ledgerRows(s.userId)).toHaveLength(0);
    expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(true);
    expect(await oauthSessions(s.userId)).toHaveLength(1);
  }, 90_000);

  // ── No-self-trigger (b): refresh-claims write (MERGE-BLOCKING) ──────────
  test("no-self-trigger: refresh-claims write (last_claims_refresh) causes ZERO revocations", async () => {
    const s = await mintOAuthSession(`${EMAIL_PREFIX}refresh-${randomUUID().slice(0, 8)}@handicappin.local`);
    await runDetector(); // seed snapshot

    // Exactly what apps/web/app/api/auth/refresh-claims/route.ts:46 performs.
    expect(
      await putUser(s.oauthAccessToken, {
        data: { last_claims_refresh: new Date().toISOString() },
      }),
    ).toBe(200);

    await runDetector();
    expect(await ledgerRows(s.userId)).toHaveLength(0);
    expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(true);
  }, 90_000);

  // ── No-loop / re-consent un-revoke semantics ────────────────────────────
  test("re-consent immediately after revocation un-revokes the SAME row and is not re-revoked", async () => {
    const s = await mintOAuthSession(`${EMAIL_PREFIX}reconsent-${randomUUID().slice(0, 8)}@handicappin.local`);

    const newPassword = randomUUID();
    expect(await putUser(s.oauthAccessToken, { password: newPassword })).toBe(200);
    await runDetector();
    const before = await consentRow(s.userId, s.clientId);
    expect(before.revoked_at).not.toBeNull();

    // The attack's password change killed the first-party session
    // (LogoutAllExceptMe). Re-establish a live user session to drive the
    // re-consent — the user still owns the account.
    const { error: reSignInErr } = await s.userClient.auth.signInWithPassword({
      email: s.email,
      password: newPassword,
    });
    expect(reSignInErr).toBeNull();

    // Re-consent immediately — inside the 2-minute overlap window, while the
    // triggering audit entry is still in scan range.
    const newToken = await consentAndExchange(
      s.userClient,
      s.clientId,
      s.clientSecret,
    );
    const after = await consentRow(s.userId, s.clientId);
    // Same row id, now un-revoked (GoTrue oauth_consent.go:158).
    expect(after.id).toBe(before.id);
    expect(after.revoked_at).toBeNull();
    expect(await oauthSessions(s.userId)).toHaveLength(1);

    // A further detector run leaves the re-consented grant untouched: the new
    // session's created_at is AFTER the audit entry, so the ordering predicate
    // excludes it (and the ledger pre-check backs it up).
    await runDetector();
    expect((await consentRow(s.userId, s.clientId)).revoked_at).toBeNull();
    expect(await oauthTokenAlive(newToken)).toBe(true);
    expect(await ledgerRows(s.userId)).toHaveLength(1); // still just the original
  }, 90_000);

  // ── Scoping negative: no OAuth session ──────────────────────────────────
  test("password change by a user with NO OAuth session is a no-op", async () => {
    const a = admin();
    const email = `${EMAIL_PREFIX}noauth-${randomUUID().slice(0, 8)}@handicappin.local`;
    const password = randomUUID();
    const { data: created, error } = await a.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    });
    expect(error).toBeNull();
    const userId = created!.user!.id;

    const userClient = createClient(supabaseUrl!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    expect(await putUser(signIn!.session!.access_token, { password: randomUUID() })).toBe(200);

    await runDetector();
    expect(await ledgerRows(userId)).toHaveLength(0);
  }, 90_000);

  // ── Alert path degrades safely when the Vault secret is absent ──────────
  test("alerting_slack_webhook absent: the detector still revokes without throwing", async () => {
    // No `alerting_slack_webhook` secret exists in local Vault, yet every
    // revoking test above completed without error — this asserts that fact
    // explicitly against the current Vault state.
    const present = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM vault.secrets WHERE name = 'alerting_slack_webhook'`;
    expect(present[0].n).toBe(0);

    const s = await mintOAuthSession(`${EMAIL_PREFIX}noalert-${randomUUID().slice(0, 8)}@handicappin.local`);
    expect(await putUser(s.oauthAccessToken, { password: randomUUID() })).toBe(200);
    await expect(runDetector()).resolves.not.toThrow();
    expect(await ledgerRows(s.userId)).toHaveLength(1);
  }, 90_000);

  // ── False negative: the grant -> first-tick window (review #187) ────────
  //
  // Signal B seeds a snapshot the first time it sees a user and takes no
  // action. A grant created between two ticks is therefore first seen with
  // whatever the email columns ALREADY say — so an email change driven in
  // that sub-minute window is baked into the seed and never fires. The
  // audit signal does not cover it either: GoTrue v2.183.0 emits no
  // email-change audit action (that is the whole reason Signal B exists).
  test("email change BEFORE the first tick after consent is still detected (no seed-swallow)", async () => {
    const email = `${EMAIL_PREFIX}seedgap-${randomUUID().slice(0, 8)}@handicappin.local`;
    const s = await mintOAuthSession(email);

    // Deliberately NO seeding tick here — this is the gap under test.
    const a = admin();
    const { error: lErr } = await a.auth.admin.generateLink({
      type: "email_change_new",
      email,
      newEmail: `${EMAIL_PREFIX}seedgap-new-${randomUUID().slice(0, 8)}@handicappin.local`,
    });
    expect(lErr).toBeNull();

    await runDetector();

    const ledger = await ledgerRows(s.userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].signal).toBe("email_snapshot");
    expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(false);
    expect(await oauthSessions(s.userId)).toHaveLength(0);

    // Idempotent: the grant is gone, so the next tick finds nothing.
    await runDetector();
    expect(await ledgerRows(s.userId)).toHaveLength(1);
  }, 90_000);

  // A change REQUESTED BEFORE the grant existed is outside the threat model
  // (the token cannot have driven it) and must NOT fire on first sight —
  // the guard above must not become a blanket "any pending change revokes".
  test("pre-existing pending email change does NOT fire when the grant is created afterwards", async () => {
    const a = admin();
    const email = `${EMAIL_PREFIX}pre-${randomUUID().slice(0, 8)}@handicappin.local`;
    const password = randomUUID();
    const { data: created, error: cErr } = await a.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    });
    expect(cErr).toBeNull();
    const userId = created!.user!.id;

    // Pending email change FIRST...
    const { error: lErr } = await a.auth.admin.generateLink({
      type: "email_change_new",
      email,
      newEmail: `${EMAIL_PREFIX}pre-new-${randomUUID().slice(0, 8)}@handicappin.local`,
    });
    expect(lErr).toBeNull();

    // ...then the OAuth grant.
    const userClient = createClient(supabaseUrl!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: sErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    expect(sErr).toBeNull();
    const { data: client, error: clErr } = await a.auth.admin.oauth.createClient({
      client_name: `detect-client-${randomUUID().slice(0, 8)}`,
      redirect_uris: [REDIRECT_URI],
    });
    expect(clErr).toBeNull();
    const oauthAccessToken = await consentAndExchange(
      userClient,
      client!.client_id,
      client!.client_secret!,
    );

    await runDetector();

    expect(await ledgerRows(userId)).toHaveLength(0);
    expect(await oauthTokenAlive(oauthAccessToken)).toBe(true);
  }, 90_000);

  // ── The audit scan must survive a malformed actor_id (review #187) ──────
  //
  // `(payload->>'actor_id')::uuid` sits in the JOIN, so it is only reached by
  // rows that already passed the action filter at the scan node — a `login`
  // row with a junk actor_id cannot reach it. A `user_updated_password` row
  // with one CAN, and because the whole function is one transaction the throw
  // rolls back the watermark advance too: every later tick re-reads the same
  // window and fails identically. That is a silent, permanent wedge of the
  // control, so the cast must never see a non-uuid.
  test("a malformed actor_id on a watched audit action does not wedge the scan", async () => {
    const s = await mintOAuthSession(`${EMAIL_PREFIX}badactor-${randomUUID().slice(0, 8)}@handicappin.local`);

    // Poison rows: the watched action, unparseable actor_id, inside the scan
    // window. Written directly because GoTrue will not emit one. ALWAYS
    // removed again — the every-minute cron job runs against this same shared
    // stack, and a surviving poison row is exactly the wedge under test.
    const poisonTag = `poison-${randomUUID()}`;
    try {
      for (const actor of ["", "not-a-uuid"]) {
        await sql`
          INSERT INTO auth.audit_log_entries (id, instance_id, payload, created_at)
          VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
                  json_build_object('action', 'user_updated_password',
                                    'actor_id', ${actor}::text,
                                    'probe_tag', ${poisonTag}::text),
                  now())`;
      }

      // The real attack, in the same window as the poison rows.
      expect(await putUser(s.oauthAccessToken, { password: randomUUID() })).toBe(200);

      // Must not throw, and must still catch the real hit.
      await expect(runDetector()).resolves.not.toThrow();
      const ledger = await ledgerRows(s.userId);
      expect(ledger).toHaveLength(1);
      expect(ledger[0].signal).toBe("audit:user_updated_password");
      expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(false);

      // The watermark advanced, i.e. the transaction committed.
      const wm = await sql<{ behind_seconds: number }[]>`
        SELECT extract(epoch FROM now() - last_processed_at)::int AS behind_seconds
        FROM public.oauth_watch_state WHERE k = 'audit'`;
      expect(wm[0].behind_seconds).toBeLessThan(30);
    } finally {
      await sql`
        DELETE FROM auth.audit_log_entries
        WHERE payload->>'probe_tag' = ${poisonTag}`;
    }
  }, 90_000);

  // ── What actually happens with MULTIPLE live grants (review #187) ───────
  //
  // Review read Signal A's join (it matches on user_id alone, so one hit row
  // per client) as "revokes every live grant". It does not, because GoTrue
  // gets there first: PUT /user {password} runs LogoutAllExceptMe, which
  // deletes every session EXCEPT the acting one before the detector ever
  // scans. So the detector sees — and revokes — exactly the acting grant.
  // The bystander's ACCESS is already dead (session gone -> refresh tokens
  // cascade), but its consent row stays revoked_at NULL: the same documented
  // scope gap as the first-party-password-change test above. Pinning it.
  test("a password change: GoTrue kills bystander sessions, the detector revokes the acting grant", async () => {
    const email = `${EMAIL_PREFIX}multi-${randomUUID().slice(0, 8)}@handicappin.local`;
    const s = await mintOAuthSession(email);

    // A second, independent OAuth client consented by the same user.
    const a = admin();
    const { data: client2, error: cl2Err } = await a.auth.admin.oauth.createClient({
      client_name: `detect-client-${randomUUID().slice(0, 8)}`,
      redirect_uris: [REDIRECT_URI],
    });
    expect(cl2Err).toBeNull();
    const token2 = await consentAndExchange(
      s.userClient,
      client2!.client_id,
      client2!.client_secret!,
    );
    expect(await oauthSessions(s.userId)).toHaveLength(2);

    // Attack drives through client 1 only.
    expect(await putUser(s.oauthAccessToken, { password: randomUUID() })).toBe(200);

    // GoTrue already removed the bystander session; only the acting one is
    // left for the detector to find.
    const survivors = await oauthSessions(s.userId);
    expect(survivors).toHaveLength(1);
    expect(await oauthTokenAlive(token2)).toBe(false);

    await runDetector();

    const ledger = await ledgerRows(s.userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].oauth_client_id).toBe(s.clientId);
    expect(await oauthSessions(s.userId)).toHaveLength(0);
    expect(await oauthTokenAlive(s.oauthAccessToken)).toBe(false);
    expect((await consentRow(s.userId, s.clientId)).revoked_at).not.toBeNull();
    // Accepted scope gap (same as the first-party case): the bystander's
    // access is dead but its consent row is not marked revoked.
    expect((await consentRow(s.userId, client2!.client_id)).revoked_at).toBeNull();
  }, 120_000);
});
