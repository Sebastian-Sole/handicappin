/**
 * G4 column-grant sweep probe (plan 010 §T6, ADR §5.1).
 *
 * Re-runnable evidence generator for the column-grant sweep in
 * supabase/migrations/20260806130000_g4_column_grant_sweep.sql.
 *
 * For each hardened table it runs, over the LOCAL PostgREST endpoint as the
 * `authenticated` role (a real signed-in probe user):
 *   - ATTACK probes: the excess write the sweep is meant to close. BEFORE the
 *     migration these succeed (the hole); AFTER they must fail with Postgres
 *     42501 (permission denied for column / for table).
 *   - POSITIVE probes: a legitimate first-party query that MUST keep working
 *     after the sweep, so we prove we did not over-revoke.
 *
 * Usage:
 *   pnpm tsx scripts/g4-grant-sweep-probe.ts            # run all
 *   pnpm tsx scripts/g4-grant-sweep-probe.ts --json     # machine output
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
 * SUPABASE_SERVICE_ROLE_KEY from apps/web/.env (LOCAL stack only — the script
 * refuses to run against a non-loopback URL). Never prints a key.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), "apps/web/.env");
  const out: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !/127\.0\.0\.1|localhost/.test(URL)) {
  throw new Error(`Refusing to run: URL is not local (${URL ?? "unset"})`);
}

const REST = `${URL}/rest/v1`;
const AUTH = `${URL}/auth/v1`;

type ProbeResult = {
  table: string;
  kind: "attack" | "positive";
  label: string;
  status: number;
  code: string | null;
  verdict: "denied" | "succeeded" | "other";
};

async function serviceFetch(path: string, init: RequestInit) {
  return fetch(`${REST}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

/** Create (or reuse) a confirmed probe user and return an access token. */
async function getProbeToken(): Promise<{ token: string; userId: string }> {
  const email = "g4-probe@handicappin.test";
  const password = "g4-probe-password-123456";

  // Try to create; ignore "already registered".
  const created = await fetch(`${AUTH}/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  let userId: string | null = null;
  if (created.ok) {
    userId = ((await created.json()) as { id: string }).id;
  }

  const signin = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!signin.ok) {
    throw new Error(`probe sign-in failed: ${signin.status} ${await signin.text()}`);
  }
  const session = (await signin.json()) as { access_token: string; user: { id: string } };
  userId = userId ?? session.user.id;

  // Ensure a profile row exists for the probe user (service_role bypasses the
  // grants under test). Idempotent upsert.
  await serviceFetch("/profile?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id: userId,
      email,
      name: "G4 Probe",
      verified: true,
      handicapIndex: 54,
    }),
  });
  // Ensure an email_preferences row exists.
  await serviceFetch("/email_preferences?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: userId, feature_updates: true }),
  });

  return { token: session.access_token, userId };
}

/**
 * A brand-new confirmed user with NO profile row, so the first-party OAuth
 * signup INSERT can be probed as a real insert rather than a no-op conflict.
 * Returns a disposer that removes the user again (this stack is shared).
 */
async function getFreshSignupToken(): Promise<{
  token: string;
  userId: string;
  dispose: () => Promise<void>;
}> {
  const email = `g4-signup-${Date.now()}-${Math.floor(Math.random() * 1e6)}@handicappin.test`;
  const password = "g4-probe-password-123456";

  const created = await fetch(`${AUTH}/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) {
    throw new Error(`fresh probe user create failed: ${created.status}`);
  }
  const { id: userId } = (await created.json()) as { id: string };

  const signin = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!signin.ok) {
    throw new Error(`fresh probe sign-in failed: ${signin.status}`);
  }
  const session = (await signin.json()) as { access_token: string };

  const dispose = async () => {
    await serviceFetch(`/profile?id=eq.${userId}`, { method: "DELETE" });
    await fetch(`${AUTH}/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
  };

  return { token: session.access_token, userId, dispose };
}

async function probe(
  token: string,
  table: string,
  kind: "attack" | "positive",
  label: string,
  init: RequestInit
): Promise<ProbeResult> {
  const res = await fetch(`${REST}${table}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  let code: string | null = null;
  if (!res.ok) {
    try {
      code = ((await res.json()) as { code?: string }).code ?? null;
    } catch {
      code = null;
    }
  }
  const denied = res.status === 401 || res.status === 403 || code === "42501";
  const succeeded = res.status >= 200 && res.status < 300;
  return {
    table: table.replace(/^\//, "").split("?")[0],
    kind,
    label,
    status: res.status,
    code,
    verdict: denied ? "denied" : succeeded ? "succeeded" : "other",
  };
}

async function main() {
  const { token, userId } = await getProbeToken();
  const results: ProbeResult[] = [];
  const q = (t: string) => `/${t}`;

  // ── profile: billing/handicap self-edit is the headline hole ──
  results.push(
    await probe(token, `/profile?id=eq.${userId}`, "attack", "PATCH profile.subscription_status='active'", {
      method: "PATCH",
      body: JSON.stringify({ subscription_status: "active" }),
    })
  );
  results.push(
    await probe(token, `/profile?id=eq.${userId}`, "attack", "PATCH profile.billing_version=999", {
      method: "PATCH",
      body: JSON.stringify({ billing_version: 999 }),
    })
  );
  results.push(
    await probe(token, `/profile?id=eq.${userId}`, "attack", "PATCH profile.handicapIndex=1.0", {
      method: "PATCH",
      body: JSON.stringify({ handicapIndex: 1.0 }),
    })
  );
  results.push(
    await probe(token, q("profile"), "attack", "INSERT profile with plan_selected", {
      method: "POST",
      body: JSON.stringify({ id: userId, plan_selected: "lifetime" }),
    })
  );
  results.push(
    await probe(token, `/profile?id=eq.${userId}`, "positive", "PATCH profile.name (legit)", {
      method: "PATCH",
      body: JSON.stringify({ name: "G4 Probe Renamed" }),
    })
  );
  results.push(
    await probe(token, `/profile?id=eq.${userId}&select=id,name,handicapIndex`, "positive", "SELECT own profile", {
      method: "GET",
    })
  );

  results.push(
    await probe(token, `/profile?id=eq.${userId}`, "positive", "PATCH profile.verified (verify-email flow)", {
      method: "PATCH",
      body: JSON.stringify({ verified: true }),
    })
  );

  // The OAuth signup upsert (app/auth/callback/route.ts,
  // components/auth/google-sign-in-button.tsx): the exact payload, as a real
  // INSERT on a user that has no profile row yet. If any of the five granted
  // columns were missing, first sign-in would break with 42501.
  const fresh = await getFreshSignupToken();
  try {
    results.push(
      await probe(
        fresh.token,
        "/profile?on_conflict=id",
        "positive",
        "INSERT profile — first-party OAuth signup payload",
        {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify({
            id: fresh.userId,
            email: `g4-signup-${fresh.userId}@handicappin.test`,
            name: "G4 Signup Probe",
            verified: true,
            handicapIndex: 54,
          }),
        }
      )
    );
  } finally {
    await fresh.dispose();
  }

  // ── email_preferences: legit upsert must still work ──
  results.push(
    await probe(token, `/email_preferences?user_id=eq.${userId}`, "positive", "PATCH email_preferences.feature_updates", {
      method: "PATCH",
      body: JSON.stringify({ feature_updates: false }),
    })
  );
  // The real shape the auth router uses: POST + merge-duplicates, which
  // PostgREST compiles to INSERT ... ON CONFLICT DO UPDATE — so it needs the
  // three columns on BOTH verbs, not just UPDATE.
  results.push(
    await probe(token, "/email_preferences?on_conflict=user_id", "positive", "UPSERT email_preferences (auth router)", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: userId,
        feature_updates: true,
        updated_at: new Date().toISOString(),
      }),
    })
  );

  // ── pending_email_changes: no client INSERT; UPDATE only attempts col ──
  // Seed a row as service_role (clients legitimately cannot create one) so the
  // OTP verifier's own two client operations are probed against a real row.
  await serviceFetch("/pending_email_changes?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      old_email: "g4-probe@handicappin.test",
      new_email: "g4-probe-new@handicappin.test",
      token_hash: "probe",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    }),
  });
  results.push(
    await probe(token, `/pending_email_changes?user_id=eq.${userId}`, "positive", "PATCH pending_email_changes.verification_attempts", {
      method: "PATCH",
      body: JSON.stringify({ verification_attempts: 1 }),
    })
  );
  results.push(
    await probe(token, `/pending_email_changes?user_id=eq.${userId}&select=verification_attempts`, "positive", "SELECT own pending_email_changes", {
      method: "GET",
    })
  );
  results.push(
    await probe(token, `/pending_email_changes?user_id=eq.${userId}`, "positive", "DELETE own pending_email_changes (expiry cleanup)", {
      method: "DELETE",
    })
  );

  results.push(
    await probe(token, q("pending_email_changes"), "attack", "INSERT pending_email_changes (server-only)", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        old_email: "a@b.com",
        new_email: "attacker@evil.com",
        token_hash: "x",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      }),
    })
  );

  // ── billing / reference / audit tables: writes must all be denied ──
  results.push(
    await probe(token, q("stripe_customers"), "attack", "INSERT stripe_customers", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, stripe_customer_id: "cus_hacked" }),
    })
  );
  results.push(
    await probe(token, q("pending_lifetime_purchases"), "attack", "INSERT pending_lifetime_purchases", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, status: "completed", plan: "lifetime" }),
    })
  );
  results.push(
    await probe(token, q("legal_consents"), "attack", "INSERT legal_consents (audit forge)", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, consent_type: "tos", legal_version: "v1" }),
    })
  );
  results.push(
    await probe(token, q("course"), "attack", "INSERT course", {
      method: "POST",
      body: JSON.stringify({ name: "Fake Course" }),
    })
  );
  results.push(
    await probe(token, `/course?id=eq.1`, "attack", "PATCH course.name", {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed by attacker" }),
    })
  );
  results.push(
    await probe(token, `/teeInfo?id=eq.1`, "attack", "PATCH teeInfo.courseRating18 (rating forge)", {
      method: "PATCH",
      body: JSON.stringify({ courseRating18: 0 }),
    })
  );
  results.push(
    await probe(token, `/hole?id=eq.1`, "attack", "PATCH hole.par", {
      method: "PATCH",
      body: JSON.stringify({ par: 1 }),
    })
  );
  results.push(
    await probe(token, q("submissions"), "attack", "INSERT submissions (self-approve path)", {
      method: "POST",
      body: JSON.stringify({ submittedBy: userId, submissionType: "course", status: "approved" }),
    })
  );

  // ── positive reads on reference tables ──
  results.push(
    await probe(token, `/course?select=id,name&limit=1`, "positive", "SELECT course (catalogue read)", {
      method: "GET",
    })
  );
  results.push(
    await probe(token, `/teeInfo?select=id,name&limit=1`, "positive", "SELECT teeInfo", { method: "GET" })
  );
  results.push(
    await probe(token, `/hole?select=id,par&limit=1`, "positive", "SELECT hole", { method: "GET" })
  );

  // ── reads on the tables that lost every write verb must survive ──
  results.push(
    await probe(token, `/submissions?select=id,status&limit=1`, "positive", "SELECT submissions (own, round router)", {
      method: "GET",
    })
  );
  results.push(
    await probe(token, `/stripe_customers?select=stripe_customer_id&limit=1`, "positive", "SELECT stripe_customers (stripe router)", {
      method: "GET",
    })
  );
  results.push(
    await probe(token, `/pending_lifetime_purchases?select=id&limit=1`, "positive", "SELECT pending_lifetime_purchases", {
      method: "GET",
    })
  );
  results.push(
    await probe(token, `/legal_consents?select=consent_type&limit=1`, "positive", "SELECT legal_consents", {
      method: "GET",
    })
  );
  results.push(
    await probe(token, `/email_preferences?user_id=eq.${userId}&select=feature_updates`, "positive", "SELECT own email_preferences", {
      method: "GET",
    })
  );

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  console.log(pad("KIND", 9) + pad("VERDICT", 11) + pad("HTTP", 6) + pad("CODE", 8) + "PROBE");
  console.log("-".repeat(90));
  let attackFailures = 0;
  let positiveFailures = 0;
  for (const r of results) {
    const ok =
      (r.kind === "attack" && r.verdict === "denied") ||
      (r.kind === "positive" && r.verdict === "succeeded");
    if (!ok && r.kind === "attack") attackFailures++;
    if (!ok && r.kind === "positive") positiveFailures++;
    const flag = ok ? "  " : "!!";
    console.log(
      flag +
        " " +
        pad(r.kind, 8) +
        pad(r.verdict, 11) +
        pad(String(r.status), 6) +
        pad(r.code ?? "-", 8) +
        r.label
    );
  }
  console.log("-".repeat(90));
  console.log(
    `attacks still open: ${attackFailures} | positives broken: ${positiveFailures}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
