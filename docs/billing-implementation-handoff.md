# Billing implementation handoff — cross-platform entitlements (Stripe + Apple)

You are implementing cross-platform billing: Apple in-app purchases on iOS
feeding the SAME entitlement state the existing Stripe web billing feeds.
The architecture was decided with the owner (2026-06-11/12, recorded in the
PR #129 conversation); the decision ledger in §1 is LOCKED — do not
relitigate it. Read `docs/native-implementation-handoff.md` §7b (dev-env
ownership) and the gotchas in `docs/native-implementation-log.md` — they
all still apply (dev-client rebuilds, Maestro patterns, the test account).

## 0. Mission and Definition of Done

**Mission:** everything for cross-platform billing that does NOT require
the owner's Apple/RevenueCat consoles, implemented and verified locally —
backend projection + webhook, native provider seam + policy-aware paywall,
compliance surfaces, and a runbook that reduces the owner's remaining work
to a console checklist.

**Definition of Done — all machine-checkable, none require owner consoles:**

1. **Schema:** `profile.billing_provider` (`"stripe" | "apple" | null`)
   added via a Supabase migration applied to the LOCAL stack; Drizzle
   schema + generated types in sync (`pnpm check:schema-sync`,
   `pnpm gen:local`); RLS posture for the new column matches the existing
   billing columns (user cannot self-modify; webhook/service paths only).
2. **Merge chokepoint:** a pure module `apps/web/utils/billing/apply-billing-event.ts`
   exporting `applyBillingEvent(current, incoming)` implementing the §1
   precedence rules over a normalized `BillingFact` shape
   (`{provider, plan, status, currentPeriodEnd, cancelAtPeriodEnd, eventTimeMs, eventId}`).
   Exhaustively unit-tested (full precedence matrix, out-of-order guard,
   idempotence: applying the same fact twice is a no-op).
3. **RevenueCat webhook:** `apps/web/app/api/webhooks/revenuecat/route.ts` —
   shared-secret `Authorization` header check (env: `REVENUECAT_WEBHOOK_AUTH_TOKEN`,
   optional in dev), zod trust-boundary parse of the RC payload (derive the
   shape from RevenueCat's official webhook docs at implementation time),
   idempotency via the existing `webhook_events` table, per-provider
   out-of-order guard, event mapping per §2, writes through
   `applyBillingEvent`, `billing_version` increment, admin alert on the
   double-contract case (incoming apple-active while stripe-active, or
   vice versa) WITHOUT auto-cancelling anything.
4. **Stripe handlers updated minimally:** stamp `billing_provider: "stripe"`
   on their writes and route final profile writes through the same
   precedence guards (never overwrite lifetime; never clobber an
   apple-active contract). The existing web test suite (506+) stays green;
   new tests cover the guard paths.
5. **Integration tests** (vitest, real local Supabase like the existing
   integration suite): POST RC-shaped payloads to the webhook route
   covering INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, CANCELLATION,
   UNCANCELLATION, BILLING_ISSUE, EXPIRATION, NON_RENEWING_PURCHASE
   (lifetime), TRANSFER (alert-only), plus: bad auth → 401, duplicate
   event id → idempotent 200, stale event → ignored, double-contract →
   state preserved + alert recorded.
6. **Reconciliation:** `scripts/reconcile-billing.mjs` with a `--dry-run`
   default: for stripe-provider users diff Stripe (test key) vs projection;
   for apple-provider users diff the RevenueCat REST API vs projection,
   skipping gracefully with a clear message when `REVENUECAT_API_KEY` is
   absent. Diff logic unit-tested; dry-run executes cleanly on the local
   stack.
7. **Native provider seam:** `react-native-purchases` installed (dev
   client rebuilt — same routine as the datetimepicker, D19), a
   `RevenueCatBillingProvider` implementing the existing `BillingProvider`
   interface (`configure` → `Purchases.configure` + `logIn(supabaseUserId)`,
   offerings, purchase, restore, `managementURL`), selected by a factory:
   real provider iff `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` is set, else the
   existing mock. With NO key set (the verifiable state), the app boots and
   the FULL existing Maestro suite passes — that proves the flag.
8. **Policy-aware paywall** (the §1 matrix) on the native onboarding and
   profile billing surfaces: purchase buttons only when entitled-to-buy;
   "managed on handicappin.com" copy (no link — §1) for stripe-sourced
   subs; Apple manage-subscriptions affordance for apple-sourced;
   Restore always visible; auto-renew disclosure copy + Terms/Privacy
   links on the paywall. Mock offerings updated to the REAL lineup
   (premium yearly, unlimited yearly, lifetime — no monthly).
9. **Per-state on-sim verification:** using the existing test account and
   webhook-shaped SQL (the D15 pattern), drive `profile` through each
   paywall state — `null/free`, stripe+premium+active, apple+unlimited+active,
   apple+cancel_at_period_end, lifetime, past_due — and for each: Maestro
   assertions + capture + in-band rubric judgment recorded in the log.
   RESTORE the test account to unlimited/active/stripe when done.
10. **Compliance surfaces:** an in-app account-deletion entry point on the
    native profile screen (App Store 5.1.1(v)) — investigate web's
    deletion flow first; link out via expo-web-browser to the closest real
    web surface and record what exists; if web has NO deletion flow, ship
    the entry point pointing at the profile/contact surface and FLAG it
    prominently in the log + runbook as an owner gap.
11. **Owner runbook:** `docs/billing-runbook.md` — exact App Store Connect
    steps (subscription group, the three §1 SKUs, Small Business Program
    pointer), RevenueCat console steps (project, products→entitlements
    mapping, webhook URL + auth header, API keys), env vars to set
    (web + native + eas.json placeholders), TestFlight/sandbox test plan,
    and the go-live order. Someone who has never seen this repo's billing
    should be able to execute it top to bottom.
12. **Process:** work on a new branch stacked on `feat/native-screens`;
    per-cluster commits; pre-commit never bypassed; all existing gates
    green at the end (parity, check:tokens, web lint/tsc/tests/build,
    tokens tests, native tsc/lint/unit/harness, expo export -p ios); a PR
    opened against `feat/native-screens` with a DoD checklist table; all
    decisions/waivers/deferrals recorded in
    `docs/billing-implementation-log.md` (D-numbering continues from the
    native log: start at D22).

### 0b. Autonomy protocol

Same as the native handoff: run unattended, don't stop to ask. On
ambiguity, choose the option that preserves the §1 ledger and existing
test semantics, log it, continue. Halt only for: missing secrets that no
fallback covers, irreversible external actions, or a provably impossible
DoD item (finish everything else first, then report). Fix-forward twice
per failure, then waive with rationale in the log.

## 1. Decision ledger (LOCKED — do not relitigate)

- **D-arch:** the DB (`profile`) is the single source of truth for
  ENTITLEMENT; Stripe and Apple are each the source of truth for the
  CONTRACTS they bill. Providers NEVER write to each other — no
  Stripe→Apple or Apple→Stripe calls anywhere, ever.
- **D-policy (Policy A):** plan changes happen where the subscription
  lives. Stripe-sourced subs show neutral "managed on handicappin.com"
  copy in-app with NO tappable link (US link-out is legally fluid —
  explicitly out of v1). Apple-sourced subs upgrade/downgrade natively
  within one subscription group. No cross-provider switching flow in v1.
- **D-paywall matrix:**
  | Projection state | Native paywall |
  |---|---|
  | plan null/free | full paywall (purchasable) |
  | active + provider apple | native plan change + Apple manage link |
  | active + provider stripe | no purchase buttons; neutral copy |
  | lifetime (any provider) | no purchase buttons |
  | always | Restore Purchases |
- **D-precedence (applyBillingEvent):** lifetime is never overwritten by
  any event; active beats non-active; between actives, higher tier wins
  (lifetime > unlimited > premium > free), then later expiry. Per-provider
  event ordering: ignore events older than the last applied event from
  the same provider. Double-contract: keep max entitlement, alert admin,
  never auto-cancel the other provider.
- **D-products:** Apple SKUs are `com.handicappin.premium.yearly` and
  `com.handicappin.unlimited.yearly` (auto-renewable, ONE subscription
  group) and `com.handicappin.lifetime` (non-consumable). Yearly only —
  the mock's monthly placeholders are dropped. SKU↔plan mapping lives in
  ONE shared constants module used by webhook mapping, runbook, and
  native code.
- **D-claims-frozen:** the JWT claim shape (`app_metadata.billing`) does
  NOT change. `billing_provider` is read via tRPC profile fetches, not
  claims. The Supabase auth hook is untouched.
- **D-status-mapping:** RC events map into the EXISTING
  `SubscriptionStatus` semantics — BILLING_ISSUE → `past_due` (denies
  access immediately, same as Stripe; grace-period nuance is NOT ported),
  CANCELLATION (auto-renew off) → `cancel_at_period_end: true` (existing
  grace-until-period-end logic applies unchanged), UNCANCELLATION →
  `cancel_at_period_end: false`, EXPIRATION → revert to free/canceled
  (mirror of `customer.subscription.deleted`), NON_RENEWING_PURCHASE of
  the lifetime SKU → lifetime (mirror of `payment_intent.succeeded`),
  TRANSFER → no entitlement write, admin alert only.
- **D-rc-scope:** RevenueCat is Apple-side plumbing only — purchasing,
  receipt validation, webhooks, `app_user_id = supabase user id` via
  `logIn()` after auth. RC's Stripe integration / Web Billing are NOT
  used. RC is never the entitlement source of truth.
- **D-seam:** the native provider factory keys off
  `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` — absent (CI, sim verification,
  this goal) → mock provider; present (owner, later) → real SDK. The SDK
  must never be configured without a key.

## 2. What exists (read before writing)

- Webhook reference implementation: `apps/web/app/api/stripe/webhook/route.ts`
  + `apps/web/lib/stripe-webhook-handlers/*` (signature check, `webhook_events`
  idempotency, customer-ownership verification, amount verification,
  retry + admin alerts). Mirror its structure and security posture.
- Entitlement reads: `apps/web/utils/billing/access-control.ts` and
  `apps/web/utils/billing/access.ts` — semantics are FROZEN.
- Claims hook: `supabase/migrations/20251025154500_fix_jwt_hook_null_handling.sql`
  — untouched.
- Native seam: `apps/native/lib/billing/{types,mock-provider,index}.ts` —
  the interface to implement; `getCustomerInfo` already reads real state
  via tRPC. Native profile zod: `apps/native/lib/api/schemas/profile.ts`
  (add `billing_provider`, coercive like the rest — Drizzle serialization
  gotchas in the log).
- Test account + SQL state pattern: `docs/native-implementation-log.md`
  D15; creds in §7 of the native handoff (local-only).
- Env plumbing: `apps/web/env.ts` (t3-env — new vars go here, optional in
  dev), `apps/native/lib/env.ts`, `apps/native/eas.json` placeholders.

## 3. Constraints (hard)

- Stripe TEST mode only; never touch live keys. No real emails (the
  Resend incident in the log), no real charges, no `eas build`/`submit`,
  no App Store Connect / RevenueCat console actions — console work is the
  owner's, via the runbook.
- Do not modify: JWT claim shape, access-control semantics, the 506+
  existing web tests' expectations (additive changes only), generated
  files (`packages/tokens/generated/`, `apps/native/global.css`,
  `apps/web/types/supabase.ts` except via `pnpm gen:local`).
- Migrations: local stack only (`supabase migration new` + `db reset` or
  `migration up`); never run against a remote.
- Web↔native parity rules and all existing gates stay green throughout;
  never `--no-verify`.
- RC payload shapes: derive from RevenueCat's official docs (WebFetch) at
  implementation time — do not invent fields; validate with zod at the
  boundary.

## 4. Suggested execution order

1. Read the §2 files + RC webhook docs; write the SKU/plan constants
   module + `BillingFact` types.
2. Migration + schema sync + regenerated types + native profile schema.
3. `applyBillingEvent` + exhaustive unit tests (pure, fast — do this
   before any I/O code).
4. Webhook route + handlers + integration tests against the local stack.
5. Stripe handler stamping + guards; full web suite green.
6. Reconcile script + tests.
7. Native: dependency + rebuild; factory + real provider implementation
   (compiles and is exercised only for nullability/config-guard paths in
   tests); paywall policy + compliance surfaces; mock offerings → real
   lineup.
8. Per-state sim verification (§0 DoD 9) with captures + log entries;
   restore test-account state.
9. Runbook + log finalization; full gate sweep; PR.
