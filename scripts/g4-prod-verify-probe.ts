/**
 * G4 prod verification probe — credential-less (anon key only).
 *
 * For the OWNER to run AFTER applying
 * supabase/migrations/20260806130000_g4_column_grant_sweep.sql to prod, per
 * plan 010 §T6 / "Verifying DDL without credentials": probe PostgREST with the
 * public anon key alone. No user session, no service-role key.
 *
 * Each revoked write capability must come back DENIED (HTTP 401/403, SQLSTATE
 * 42501 "permission denied"). Alongside each table it fires a CONTROL probe
 * naming a deliberately NON-EXISTENT column: that must come back with a
 * DIFFERENT error (PostgREST PGRST204 / SQLSTATE 42703 "undefined column"),
 * proving the endpoint is live and the check discriminates rather than blanket
 * -denying everything. A revoked probe that returned the control's code would
 * be a false pass.
 *
 * Usage (owner, against prod):
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=<prod anon key> \
 *   pnpm tsx scripts/g4-prod-verify-probe.ts
 *
 * Falls back to the LOCAL apps/web/.env values when SUPABASE_URL is unset, so
 * it can be smoke-tested locally first. The key is never printed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(resolve(process.cwd(), "apps/web/.env"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const local = loadLocalEnv();
const URL = process.env.SUPABASE_URL ?? local.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? local.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY (or run in a tree with apps/web/.env).");
}
console.log(`Target: ${URL} (anon key only; key not printed)`);
const REST = `${URL}/rest/v1`;

type Row = {
  table: string;
  capability: string;
  expect: "denied" | "control-undefined-column";
  status: number;
  code: string | null;
  pass: boolean;
};

async function call(path: string, method: string, body: unknown): Promise<{ status: number; code: string | null }> {
  const res = await fetch(`${REST}${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let code: string | null = null;
  if (!res.ok) {
    try {
      code = ((await res.json()) as { code?: string }).code ?? null;
    } catch {
      code = null;
    }
  }
  return { status: res.status, code };
}

/** A revoked capability: expect a permission denial (42501 / 401 / 403). */
async function revoked(table: string, capability: string, method: string, path: string, body: unknown): Promise<Row> {
  const { status, code } = await call(path, method, body);
  const denied = code === "42501" || status === 401 || status === 403;
  return { table, capability, expect: "denied", status, code, pass: denied };
}

/** Control: naming a non-existent column must fail with a DIFFERENT code. */
async function control(table: string, path: string, method: string, body: unknown): Promise<Row> {
  const { status, code } = await call(path, method, body);
  const undefinedCol = code === "42703" || code === "PGRST204";
  return { table, capability: "control: nonexistent column", expect: "control-undefined-column", status, code, pass: undefinedCol };
}

async function main() {
  const rows: Row[] = [];
  const NX = { __g4_no_such_column__: 1 };

  // profile — no client INSERT of billing cols; no UPDATE of billing/handicap.
  rows.push(await revoked("profile", "INSERT plan_selected", "POST", "/profile", { plan_selected: "lifetime" }));
  rows.push(await revoked("profile", "UPDATE handicapIndex", "PATCH", "/profile?id=eq.00000000-0000-0000-0000-000000000000", { handicapIndex: 1 }));
  rows.push(await revoked("profile", "UPDATE subscription_status", "PATCH", "/profile?id=eq.00000000-0000-0000-0000-000000000000", { subscription_status: "active" }));
  rows.push(await control("profile", "/profile", "POST", NX));

  // course / teeInfo / hole — read-only reference data.
  rows.push(await revoked("course", "INSERT", "POST", "/course", { name: "x" }));
  rows.push(await revoked("course", "UPDATE name", "PATCH", "/course?id=eq.-1", { name: "x" }));
  rows.push(await control("course", "/course", "POST", NX));
  rows.push(await revoked("teeInfo", "UPDATE courseRating18", "PATCH", "/teeInfo?id=eq.-1", { courseRating18: 0 }));
  rows.push(await control("teeInfo", "/teeInfo", "POST", NX));
  rows.push(await revoked("hole", "UPDATE par", "PATCH", "/hole?id=eq.-1", { par: 1 }));
  rows.push(await control("hole", "/hole", "POST", NX));

  // submissions — no client write.
  rows.push(await revoked("submissions", "INSERT", "POST", "/submissions", { submissionType: "course", status: "approved" }));
  rows.push(await control("submissions", "/submissions", "POST", NX));

  // billing / audit — server-only writes.
  rows.push(await revoked("stripe_customers", "INSERT", "POST", "/stripe_customers", { stripe_customer_id: "cus_x" }));
  rows.push(await control("stripe_customers", "/stripe_customers", "POST", NX));
  rows.push(await revoked("pending_lifetime_purchases", "INSERT", "POST", "/pending_lifetime_purchases", { status: "completed" }));
  rows.push(await revoked("legal_consents", "INSERT", "POST", "/legal_consents", { consent_type: "tos", legal_version: "v1" }));
  rows.push(await control("legal_consents", "/legal_consents", "POST", NX));

  // pending_email_changes — no client INSERT (server/edge-fn only).
  rows.push(await revoked("pending_email_changes", "INSERT", "POST", "/pending_email_changes", { new_email: "attacker@evil.com" }));
  rows.push(await control("pending_email_changes", "/pending_email_changes", "POST", NX));

  // server-only tables — no client access at all.
  rows.push(await revoked("otp_verifications", "INSERT", "POST", "/otp_verifications", { email: "x@y.com" }));
  rows.push(await revoked("webhook_events", "INSERT", "POST", "/webhook_events", { event_id: "x" }));
  rows.push(await revoked("handicap_calculation_queue", "INSERT", "POST", "/handicap_calculation_queue", { event_type: "x" }));

  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  console.log(pad("RESULT", 8) + pad("HTTP", 6) + pad("CODE", 9) + pad("TABLE", 28) + "CAPABILITY");
  console.log("-".repeat(100));
  let fails = 0;
  for (const r of rows) {
    if (!r.pass) fails++;
    console.log((r.pass ? "  PASS " : "! FAIL ") + pad("", 1) + pad(String(r.status), 6) + pad(r.code ?? "-", 9) + pad(r.table, 28) + r.capability);
  }
  console.log("-".repeat(100));
  console.log(fails === 0 ? "ALL PASS — sweep verified over PostgREST." : `${fails} FAILING CHECK(S) — sweep NOT verified.`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
