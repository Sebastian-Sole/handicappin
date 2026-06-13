# Billing runbook — Apple in-app purchases via RevenueCat

The console checklist for going live with cross-platform billing. The code
side is DONE (see `docs/billing-implementation-log.md`): the backend
projects Stripe and Apple events into one entitlement (`profile` table),
the native app has a policy-aware paywall behind a provider seam, and the
RevenueCat webhook is implemented and integration-tested. Everything below
is console/account work only the project owner can do.

**The architecture in two sentences** (full ledger:
`docs/billing-implementation-handoff.md` §1): the DB `profile` row is the
single source of truth for ENTITLEMENT; Stripe and Apple each own only the
contracts they bill, and they never write to each other. RevenueCat is
Apple-side plumbing only (purchasing, receipts, webhooks) — never the
entitlement source of truth.

The product lineup is fixed (D-products, in
`packages/billing-core/src/constants.ts` — the one shared SKU module):

| Plan | Apple product ID | Type | Price |
|---|---|---|---|
| Premium | `com.handicappin.premium.yearly` | Auto-renewable, 1 year | $19/yr |
| Unlimited | `com.handicappin.unlimited.yearly` | Auto-renewable, 1 year | $29/yr |
| Lifetime | `com.handicappin.lifetime` | Non-consumable | $149 |

No monthly products. Both subscriptions live in ONE subscription group so
Apple handles upgrade/downgrade natively.

---

## 1. App Store Connect

Prereq: the app record exists with bundle id `com.handicappin.app`
(Apps → + → New App if not).

### 1a. Agreements & banking (blocker for everything else)

1. **Business → Agreements**: accept the **Paid Applications** agreement.
2. Complete **banking** and **tax** forms (payouts won't flow and IAPs
   won't be testable in TestFlight without them).
3. **Small Business Program** (15% commission instead of 30% under $1M/yr):
   enroll at <https://developer.apple.com/app-store/small-business-program/>
   — do this BEFORE launch; it is not retroactive for past sales.

### 1b. Subscription group + the two auto-renewables

1. App page → **Monetization → Subscriptions** → **Create** a subscription
   group. Reference name: `handicappin_plans` (must match
   `APPLE_SUBSCRIPTION_GROUP` in `packages/billing-core` for documentation
   purposes; Apple never sees the code constant).
2. In the group, create subscription #1:
   - Reference name: `Premium Yearly`
   - **Product ID: `com.handicappin.premium.yearly`** (EXACT — the webhook
     maps product id → plan; a typo here means purchases grant nothing).
   - Duration: **1 year**. Price: **$19 USD** tier.
   - Localization (en-US): display name "Premium", description e.g. "For
     golf enthusiasts — unlimited round logging."
3. Create subscription #2 in the SAME group:
   - Reference name: `Unlimited Yearly`
   - **Product ID: `com.handicappin.unlimited.yearly`**
   - Duration: **1 year**. Price: **$29 USD** tier.
   - Localization: "Unlimited" / "Unlimited rounds, statistics, and
     calculators."
4. **Group ranking**: put Unlimited ABOVE Premium (rank 1 = Unlimited,
   rank 2 = Premium) — this is how Apple decides upgrade (immediate,
   prorated) vs downgrade (at next renewal). The app's "Switch to
   Unlimited/Premium" buttons rely on it.
5. Each subscription needs a **review screenshot** (any paywall screenshot
   at submission time) and the group needs at least one localization.

### 1c. The non-consumable

1. **Monetization → In-App Purchases** → **Create**:
   - Type: **Non-Consumable**
   - Reference name: `Lifetime`
   - **Product ID: `com.handicappin.lifetime`**
   - Price: **$149 USD** tier.
   - Localization: "Lifetime" / "Unlimited access, forever."

### 1d. Sandbox tester

**Users and Access → Sandbox → Testers** → create a sandbox Apple
account (use a +alias email you control). You'll sign into it on the
TestFlight device under Settings → App Store → Sandbox Account.

---

## 2. RevenueCat console (app.revenuecat.com)

1. **Create a project** (e.g. "Handicappin").
2. **Add the iOS app**: Project settings → Apps → + New → App Store.
   Bundle ID `com.handicappin.app`.
3. **App Store Connect credentials** (so RC can validate receipts and read
   products): follow RC's prompts to upload an **In-App Purchase Key**
   (App Store Connect → Users and Access → Integrations → In-App Purchase)
   and the **App-Specific Shared Secret** (legacy receipt validation).
4. **Products**: Project → Product catalog → + New → import / add the three
   product ids EXACTLY as in §1b/§1c.
5. **Entitlements** — create three, names EXACTLY (`RC_ENTITLEMENT_IDS` in
   `packages/billing-core`):
   - `premium`  ← attach `com.handicappin.premium.yearly`
   - `unlimited` ← attach `com.handicappin.unlimited.yearly`
   - `lifetime` ← attach `com.handicappin.lifetime`
6. **Offering**: create the `default` offering with three packages:
   - package `premium_yearly` (custom) → premium yearly product
   - package `unlimited_yearly` (custom) → unlimited yearly product
   - `$rc_lifetime` (standard Lifetime package) → lifetime product
   The native paywall reads `offerings.current` — make this offering
   **current**.
7. **API keys** (Project settings → API keys):
   - **Public Apple SDK key** (`appl_...`) → the native app
     (`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`).
   - **Secret key** (`sk_...`) → the web backend (`REVENUECAT_API_KEY`,
     used only by `scripts/reconcile-billing.mjs`).
8. **Webhook** (Project settings → Integrations → Webhooks → + New):
   - URL: `https://handicappin.com/api/webhooks/revenuecat`
   - **Authorization header value**: generate a long random secret, e.g.
     `Bearer <openssl rand -hex 32>` — RevenueCat sends the value VERBATIM
     in the `Authorization` header; the route compares the whole string
     timing-safe. Whatever exact string you paste here must equal
     `REVENUECAT_WEBHOOK_AUTH_TOKEN` on the server.
   - Environment: send **both** sandbox + production (the route logs the
     environment; sandbox events against prod data are filtered by app
     user id anyway).
   - Event types: leave "all" (unhandled types are acknowledged and
     ignored by design).

**Do NOT** enable RevenueCat's Stripe integration or Web Billing
(D-rc-scope: RC is Apple-side plumbing only — the existing Stripe webhook
keeps owning Stripe).

---

## 3. Environment variables

### Web (Vercel project / `apps/web/.env.local` for local testing)

| Var | Value | Notes |
|---|---|---|
| `REVENUECAT_WEBHOOK_AUTH_TOKEN` | the exact Authorization value from §2.8 | Webhook 401s without it in prod (fails closed; optional in dev). |
| `REVENUECAT_API_KEY` | RC **secret** key (`sk_...`) | Only the reconcile script reads it; without it apple-side reconciliation is skipped gracefully. |

Both are declared in `apps/web/env.ts` (optional, so missing values never
break dev/CI).

### Native (`apps/native/eas.json` — placeholders already in place)

| Profile | Var | Value |
|---|---|---|
| `preview`, `production` | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RC **public** Apple SDK key (`appl_...`) — replaces `appl_SET-ME`. |
| `development` | (leave UNSET) | Key-less builds run the mock provider — that's the D-seam switch, also used by CI and the sim test suite. |

Also still pending from the native goal: real `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY` in preview/production.

---

## 4. TestFlight / sandbox test plan

Build: `eas build --profile preview --platform ios` (the preview profile
now carries the RC key → the app uses the REAL SDK; StoreKit capability is
added automatically by EAS for IAP-enabled apps). Submit to TestFlight
(`eas submit`), install, sign the DEVICE into the sandbox tester account
(Settings → App Store → Sandbox Account), then walk this matrix with a
fresh app account (sign up in-app):

1. **Purchase premium** (onboarding paywall → Premium → Apple sheet):
   - App: plan flips to premium after the webhook lands (pull to refresh /
     reopen). Check `profile`: `plan_selected=premium`,
     `subscription_status=active`, `billing_provider=apple`,
     `current_period_end` ≈ +1h (sandbox year = 1 hour).
   - RC dashboard: customer (id = the Supabase user id) shows the
     `premium` entitlement; webhook log shows `INITIAL_PURCHASE` → 200.
2. **Upgrade to unlimited** (Profile → Billing → "Switch to Unlimited"):
   immediate (Apple upgrade), webhook `RENEWAL`/`PRODUCT_CHANGE` pair,
   projection flips to unlimited.
3. **Downgrade to premium**: takes effect at the (1-hour sandbox) renewal
   — projection stays unlimited until the deferred `RENEWAL` lands.
4. **Cancel** (sandbox: Settings → App Store → Sandbox Account → Manage):
   webhook `CANCELLATION` → `cancel_at_period_end=true`, access continues;
   paywall shows "Cancels on ...".
5. **Let it expire** (sandbox renews a few times then expires ~6 renewals,
   or cancel + wait an hour): webhook `EXPIRATION` → plan `free`,
   `billing_provider` NULL, paywall purchasable again.
6. **Lifetime**: buy on a fresh account → `NON_RENEWING_PURCHASE` →
   `plan_selected=lifetime`; paywall shows no purchase buttons.
7. **Restore Purchases** on a reinstall/second device with the same
   sandbox Apple account: entitlement comes back without a charge.
8. **Stripe sanity**: an existing web-subscribed (stripe) account in the
   app shows the neutral "managed on handicappin.com" copy and NO purchase
   buttons.
9. **Reconcile**: `node scripts/reconcile-billing.mjs` (dry run) — apple
   users now diff against RC; expect "in sync".

Webhook logs: Vercel function logs for
`/api/webhooks/revenuecat`; every event also lands in the `webhook_events`
table (`event_type LIKE 'revenuecat.%'`).

## 5. Go-live order

1. §1 App Store Connect (agreements FIRST — products can't be tested
   without banking/tax done).
2. §2 RevenueCat project + products + entitlements + offering + keys +
   webhook (point it at production from day one).
3. §3 env vars: Vercel (`REVENUECAT_WEBHOOK_AUTH_TOKEN`,
   `REVENUECAT_API_KEY`) → redeploy web BEFORE any purchase can happen.
4. §4 TestFlight pass (sandbox) — the full matrix above.
5. Submit the app for review WITH the in-app purchases attached to the
   version (App Review reviews them together; the paywall's auto-renew
   disclosure + Terms/Privacy links and the in-app delete-account entry
   are already in place — 3.1.2 / 5.1.1(v)).
6. After approval: spot-check one real purchase + refund it, run the
   reconcile dry-run, enroll in the Small Business Program if not done.

## 6. Known edges (by design — see the implementation log)

- **Apple lifetime refunds do NOT auto-revoke**: D-precedence makes
  lifetime absorbing; RC sends CANCELLATION/EXPIRATION on refund of the
  non-consumable but the projection keeps lifetime. If you refund a
  lifetime purchase, revoke manually (set the profile to free) — the
  reconcile dry-run will flag the mismatch.
- **Double contracts alert, never auto-cancel**: if a user ends up actively
  paying BOTH Stripe and Apple, the webhook keeps max entitlement, raises
  a Sentry alert (`billing.double_contract`) and records it on the
  `webhook_events` row — refund/cancel one side manually.
- **Free-tier selection and the EARLY100 lifetime promo stay web flows**;
  the native paywall says so on those CTAs.
