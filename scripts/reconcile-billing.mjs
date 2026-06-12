/**
 * Billing reconciliation (handoff DoD #6): diff the DB entitlement
 * projection against each provider's contract truth.
 *
 *   - stripe-provider users → Stripe REST API (TEST key)
 *   - apple-provider users  → RevenueCat REST API (skips gracefully when
 *     REVENUECAT_API_KEY is absent)
 *
 * DRY-RUN BY DEFAULT: prints diffs and exits 0. `--apply` writes
 * conservative same-provider corrections only (never lifetime, never
 * "provider has no record" cases) — see scripts/lib/reconcile-billing-core.mjs.
 *
 * Usage:
 *   node scripts/reconcile-billing.mjs [--apply] [--user <uuid>]
 *
 * Reads env from apps/web/.env.local + apps/web/.env (first hit wins):
 * DATABASE_URL is NOT used — profiles are read via the Supabase REST API
 * with the service-role key, matching the repo's dependency-free script
 * pattern (see scripts/seed-native-test-rounds.mjs).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeStripeSubscriptions,
  normalizeRevenueCatSubscriber,
  diffBillingState,
  decideApply,
} from "./lib/reconcile-billing-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  for (const file of ["apps/web/.env.local", "apps/web/.env"]) {
    try {
      const content = readFileSync(join(ROOT, file), "utf8");
      for (const line of content.split("\n")) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && env[match[1]] === undefined) {
          env[match[1]] = match[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // file absent — fine
    }
  }
  return env;
}

const env = loadEnv();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const userFilter = args.includes("--user")
  ? args[args.indexOf("--user") + 1]
  : null;

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY = env.STRIPE_SECRET_KEY;
const RC_KEY = env.REVENUECAT_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (apps/web/.env*)",
  );
  process.exit(1);
}
if (STRIPE_KEY && !STRIPE_KEY.startsWith("sk_test_")) {
  console.error(
    "Refusing to run: STRIPE_SECRET_KEY is not a TEST key (sk_test_...). " +
      "This script is test-mode only.",
  );
  process.exit(1);
}

async function supabaseRest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase REST ${path}: ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function stripeRest(path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Stripe REST ${path}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function revenueCatSubscriber(appUserId) {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${RC_KEY}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`RevenueCat REST: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.subscriber ?? null;
}

function projectionOf(row) {
  return {
    plan: row.plan_selected,
    status: row.subscription_status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    provider: row.billing_provider,
  };
}

function fmtState(state) {
  if (state === null) return "(no record)";
  return `${state.plan}/${state.status} periodEnd=${state.currentPeriodEnd ?? "-"} cap=${state.cancelAtPeriodEnd}`;
}

async function applyCorrection(userId, providerState) {
  // PostgREST can't increment in place — read the version, write everything
  // in one PATCH (bumped version refreshes clients' claims).
  const rows = await supabaseRest(
    `profile?id=eq.${userId}&select=billing_version`,
  );
  await supabaseRest(`profile?id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      plan_selected: providerState.plan,
      subscription_status: providerState.status,
      current_period_end: providerState.currentPeriodEnd,
      cancel_at_period_end: providerState.cancelAtPeriodEnd,
      billing_version: rows[0].billing_version + 1,
    }),
  });
}

const PRICE_TO_PLAN = {};
if (env.STRIPE_PREMIUM_PRICE_ID) PRICE_TO_PLAN[env.STRIPE_PREMIUM_PRICE_ID] = "premium";
if (env.STRIPE_UNLIMITED_PRICE_ID) PRICE_TO_PLAN[env.STRIPE_UNLIMITED_PRICE_ID] = "unlimited";
if (env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID) PRICE_TO_PLAN[env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID] = "lifetime";

async function reconcileStripeUser(row) {
  const projection = projectionOf(row);

  if (projection.plan === "lifetime") {
    // One-time payment: no subscription to diff. Verified via the refund
    // webhook path; reported informationally.
    return { userId: row.id, side: "stripe", info: "lifetime (one-time) — no subscription to diff", diffs: [] };
  }

  const customers = await supabaseRest(
    `stripe_customers?user_id=eq.${row.id}&select=stripe_customer_id`,
  );
  if (!customers.length) {
    return {
      userId: row.id,
      side: "stripe",
      diffs: diffBillingState(projection, null),
      providerState: null,
      projection,
      note: "no stripe_customers row (SQL-bootstrapped local user or env mismatch)",
    };
  }

  const subs = await stripeRest(
    `subscriptions?customer=${customers[0].stripe_customer_id}&status=all&limit=10`,
  );
  const providerState = normalizeStripeSubscriptions(subs.data, PRICE_TO_PLAN);
  const diffs = diffBillingState(projection, providerState);
  return { userId: row.id, side: "stripe", diffs, providerState, projection };
}

async function reconcileAppleUser(row) {
  const projection = projectionOf(row);
  const subscriber = await revenueCatSubscriber(row.id);
  const providerState = subscriber
    ? normalizeRevenueCatSubscriber(subscriber, Date.now())
    : null;
  const diffs = diffBillingState(projection, providerState);
  return { userId: row.id, side: "apple", diffs, providerState, projection };
}

async function main() {
  console.log(
    `reconcile-billing ${APPLY ? "--apply (conservative)" : "(dry run)"} — ${new Date().toISOString()}`,
  );

  let query =
    "profile?select=id,email,plan_selected,subscription_status,current_period_end,cancel_at_period_end,billing_provider,billing_version&billing_provider=not.is.null&order=email";
  if (userFilter) {
    query += `&id=eq.${userFilter}`;
  }
  const rows = await supabaseRest(query);

  const stripeRows = rows.filter((r) => r.billing_provider === "stripe");
  const appleRows = rows.filter((r) => r.billing_provider === "apple");
  console.log(
    `${rows.length} attributed profiles (${stripeRows.length} stripe, ${appleRows.length} apple)\n`,
  );

  const results = [];

  if (stripeRows.length > 0) {
    if (!STRIPE_KEY) {
      console.log(`! STRIPE_SECRET_KEY absent — skipping ${stripeRows.length} stripe-provider users\n`);
    } else {
      for (const row of stripeRows) {
        try {
          results.push({ email: row.email, ...(await reconcileStripeUser(row)) });
        } catch (error) {
          results.push({ email: row.email, userId: row.id, side: "stripe", error: String(error.message ?? error), diffs: [] });
        }
      }
    }
  }

  if (appleRows.length > 0) {
    if (!RC_KEY) {
      console.log(
        `! REVENUECAT_API_KEY absent — skipping ${appleRows.length} apple-provider user(s). ` +
          `Set it (RC dashboard → API keys, secret) to reconcile Apple-side contracts.\n`,
      );
    } else {
      for (const row of appleRows) {
        try {
          results.push({ email: row.email, ...(await reconcileAppleUser(row)) });
        } catch (error) {
          results.push({ email: row.email, userId: row.id, side: "apple", error: String(error.message ?? error), diffs: [] });
        }
      }
    }
  }

  let inSync = 0;
  let diffCount = 0;
  let applied = 0;
  let errors = 0;

  for (const r of results) {
    if (r.error) {
      errors += 1;
      console.log(`✗ ${r.email} [${r.side}] ERROR: ${r.error}`);
      continue;
    }
    if (r.info) {
      console.log(`• ${r.email} [${r.side}] ${r.info}`);
      inSync += 1;
      continue;
    }
    if (r.diffs.length === 0) {
      inSync += 1;
      console.log(`✓ ${r.email} [${r.side}] in sync (${fmtState(r.projection)})`);
      continue;
    }

    diffCount += 1;
    console.log(`≠ ${r.email} [${r.side}] DIFF${r.note ? ` (${r.note})` : ""}`);
    console.log(`    projection: ${fmtState(r.projection)}`);
    console.log(`    provider:   ${fmtState(r.providerState ?? null)}`);
    for (const d of r.diffs) {
      console.log(`    - ${d.field}: db=${d.projection} provider=${d.provider}`);
    }

    const verdict = decideApply(r.projection, r.providerState ?? null, r.diffs, r.side);
    if (APPLY && verdict.apply) {
      await applyCorrection(r.userId, r.providerState);
      applied += 1;
      console.log(`    → APPLIED provider state`);
    } else if (verdict.apply) {
      console.log(`    → would apply with --apply (${verdict.reason})`);
    } else {
      console.log(`    → not auto-correctable: ${verdict.reason}`);
    }
  }

  console.log(
    `\nSummary: ${inSync} in sync, ${diffCount} diff(s), ${applied} applied, ${errors} error(s)` +
      (!RC_KEY && appleRows.length > 0 ? `, ${appleRows.length} apple skipped (no key)` : ""),
  );
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("reconcile-billing failed:", error);
  process.exit(1);
});
