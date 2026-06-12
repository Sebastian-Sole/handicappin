# Billing Implementation Log

Running record for the cross-platform billing goal
(docs/billing-implementation-handoff.md): every decision made under the
autonomy protocol (§0b), every waiver, anything deferred. D-numbering
continues from docs/native-implementation-log.md (starts at D22).

## Decisions

### D22 — Shared SKU/plan constants live in a new source-only workspace package (2026-06-12)

**What:** `packages/billing-core` (`@handicappin/billing-core`), modeled 1:1
on `@handicappin/handicap-core` (source-entry TS package, no build step).
Holds the D-products SKU constants (`com.handicappin.premium.yearly`,
`com.handicappin.unlimited.yearly`, `com.handicappin.lifetime`), the
SKU↔plan mapping, RC entitlement identifiers, the subscription-group id,
and the plan tier ranking (lifetime > unlimited > premium > free) used by
the precedence rules.

**Why:** the handoff requires the mapping in ONE module used by webhook
mapping, runbook, and native code. The apps cannot import each other
(native log D1 — colliding `@/*` aliases), so "one module" must be a
workspace package; handicap-core proves the pattern works in both the
Next and Metro bundlers.

**Alternatives rejected:** duplicating constants per app (drift risk —
exactly what the ledger forbids); putting them in `packages/handicap-core`
(wrong domain); putting them web-side only (native can't import).

### D23 — Out-of-order cursor rides webhook_events (provider + event_time_ms) (2026-06-12)

**What:** the per-provider out-of-order guard (DoD #3) needs the timestamp
of the last APPLIED event per (user, provider). Two nullable columns were
added to the existing `webhook_events` table — `provider`
('stripe'|'apple') and `event_time_ms` — plus a partial index
`(user_id, provider, event_time_ms) WHERE status='success'`. The guard
reads `max(event_time_ms)` over success rows; the cursor advances on every
successfully EVALUATED event (even ones that lose precedence and don't
change the projection), because a newer evaluated fact from a provider
makes every older fact from that provider obsolete regardless of who won.

**Why:** the handoff mandates "idempotency via the existing webhook_events
table" and an out-of-order guard, but provides no storage for the cursor.
Extending the table the idempotency already lives in keeps one
system-of-record for webhook processing state. Existing Stripe rows stay
NULL — Stripe handler ordering semantics are explicitly unchanged
(DoD #4 "updated minimally").

**Alternatives rejected:** a dedicated cursor table (more schema surface
for the same data); deriving order from the projection (impossible —
CANCELLATION/UNCANCELLATION don't move period_end, so only event time
orders them); profile-side last_event columns (claims/profile shape is
frozen beyond billing_provider).

**Backfill note:** existing paid profiles were backfilled
`billing_provider='stripe'` (Stripe is the only provider that has ever
billed this app); free/plan-less profiles stay NULL.

### D24 — PRODUCT_CHANGE writes nothing; cursor advances only on evaluated entitlement events (2026-06-12)

**What:** the RC webhook acknowledges PRODUCT_CHANGE without touching the
projection AND without advancing the ordering cursor. Likewise TRANSFER,
TEST, unknown products, non-APP_STORE stores, and unhandled event types
are recorded for idempotency with `event_time_ms = NULL` (no cursor
advance). The cursor moves only on the seven evaluated entitlement events
(INITIAL_PURCHASE, RENEWAL, CANCELLATION, UNCANCELLATION, BILLING_ISSUE,
EXPIRATION, NON_RENEWING_PURCHASE).

**Why:** RevenueCat's event-flows doc (read 2026-06-12) is explicit:
upgrades dispatch PRODUCT_CHANGE *alongside a RENEWAL* that carries the
new product; downgrades dispatch PRODUCT_CHANGE immediately while "the
customer will retain their entitlement based on the original product"
until a later RENEWAL applies it. Writing on PRODUCT_CHANGE would grant
deferred downgrades early; advancing the cursor on it could mark the
sibling RENEWAL stale and lose the actual product switch. The D-status-
mapping table doesn't bind PRODUCT_CHANGE, so this is the faithful
interpretation (verified by integration test: PRODUCT_CHANGE no-op, then
RENEWAL with new product applies the downgrade).

**Also decided here:** the double-contract and TRANSFER alerts are
recorded queryably in the success row's `error_message`
(`double_contract: kept <provider>` / `transfer: ...`) in addition to the
Sentry alert — integration tests assert the recorded note, and operators
can audit alerts without Sentry access.

### D25 — Native seam: lazy-required SDK module, pure selection rule, real lineup prices (2026-06-12)

**What:** `lib/billing/index.ts` selects the provider via
`selectBillingProviderKind(env.revenueCatIosApiKey)` (pure module, unit
tested). The real `RevenueCatBillingProvider` lives in its own module and
is `require`d ONLY inside the key-present branch — a key-less app (CI,
sim verification) never evaluates the SDK module, so the app boots even
if the native module were absent. The SDK is wrapped behind pure
structural mapping (`revenuecat-mapping.ts`, unit tested in node);
`configure()` runs `Purchases.configure({apiKey})` once + `logIn(supabase
userId)` per session (D-rc-scope). Mock offerings now carry the REAL
D-products lineup (premium $19/yr, unlimited $29/yr, lifetime $149 — the
monthly placeholder is gone) with truthful price strings; only the
purchase FLOW is mocked, and it still says so via the labelled dev notice.

**Why:** D-seam requires "the SDK must never be configured without a key"
and a mock-driven app that passes the full Maestro suite key-less. Lazy
evaluation + the constructor throw + factory guard give three layers.
Price strings stopped being labelled "(mock)" because they now state the
real lineup's real prices — the mock label belongs on the FLOW (the dev
notice), not on truthful catalog data.

### D26 — Paywall policy: non-active paid contracts show management, never purchase buttons (2026-06-12)

**What:** `paywallPolicyFor` implements the LOCKED §1 matrix and extends
it to the states the matrix doesn't enumerate: `past_due` and
canceled-in-grace keep their owning provider's affordance (apple → manage
link, no plan change while not active; stripe → neutral copy) and never
show purchase buttons. Legacy paid rows with `billing_provider` NULL are
treated as stripe-billed (every pre-existing paid contract is Stripe's —
same rationale as the migration backfill). Onboarding remains the
plan-null full paywall; paid CTAs purchase through the seam, free-tier
selection and the EARLY100 promo claim keep the dev notice pointing at
the website (web server flows, unreachable from native — D10 carry-over).
Restore is on both surfaces; the auto-renew disclosure + Terms/Privacy
links render wherever purchase buttons can appear (App Store 3.1.2).

**Why:** buying while a contract exists double-bills (the exact failure
D-precedence's double-contract alert exists to catch — the UI shouldn't
manufacture that case); a past-due user's fix is updating payment, which
lives with the owning provider.

**Compliance note (DoD #10):** web HAS a real account-deletion flow
(`apps/web/components/profile/account-deletion-section.tsx` on the
profile settings tab → `server/api/routers/account.ts`: OTP-confirmed,
cancels Stripe subscriptions, deletes auth user + data). The native
Settings tab now has an explicit "Delete Account" entry (App Store
5.1.1(v)) that explains the consequence and opens that surface via
expo-web-browser (`SITE_URL/profile/<uid>`). Not an owner gap.

## Waivers

(none yet)

## Deferred

(none yet)

## Per-state paywall evidence (2026-06-12, DoD #9)

Method: profile driven through each state — SQL in the exact webhook write
shape for the stripe/free/null states (D15 pattern), and REAL RC-shaped
POSTs to the LOCAL webhook (`/api/webhooks/revenuecat`, dev-mode auth
skip) for every apple state, so the on-sim verification exercised the full
pipeline: webhook → applyBillingEvent → projection → tRPC → paywall.
Flows live in `apps/native/.maestro/billing-states/` (kept OUT of
`.maestro/flows/` — they assume driven states, the main suite assumes the
test account's resting state). Captures in /tmp/handicappin-billing-states/.
All judgments in-band (vision) against the §1 matrix + design language.

| State | Driven by | Maestro | Capture(s) | In-band verdict |
|---|---|---|---|---|
| plan NULL → onboarding | SQL + fresh sign-in | state-null-onboarding.yaml PASS (+ the original onboarding.yaml PASS — its plan-less prerequisite finally held) | null-onboarding-{top,mock-notice,disclosure}.png | PASS — full paywall: real pricing cards w/ live promo data (93 slots), paid CTA → labelled dev notice (mock seam), Restore button, full 3.1.2 disclosure + Terms/Privacy links |
| plan free (profile) | SQL | state-free.yaml PASS | free-{paywall,mock-notice,restore}.png | PASS — "Free Plan / 18 rounds remaining", purchasable real lineup ($19/yr, $29/yr, $149 one-time) w/ Subscribe buttons, mock notice on buy, disclosure, Restore; no neutral copy |
| stripe + premium + active | SQL (webhook shape) | state-stripe-active.yaml PASS | stripe-premium-active.png | PASS — "Renews on June 14, 2027", neutral "managed on handicappin.com" as plain muted TEXT (no link — D-policy), NO purchase/plan-change/manage buttons, Restore present |
| apple + unlimited + active | REAL INITIAL_PURCHASE webhook (route correctly flagged double-contract vs the seeded stripe-active and kept max entitlement) | state-apple-active.yaml PASS | apple-unlimited-active.png | PASS — primary "Switch to Premium" (group plan change), "Manage Subscription (App Store)", Restore, renews line |
| apple + cancel_at_period_end | REAL CANCELLATION webhook | state-apple-cap.yaml PASS | apple-cancel-at-period-end.png | PASS — "Cancels on June 14, 2027", plan change + manage remain (still active until period end) |
| apple + past_due | REAL UNCANCELLATION + BILLING_ISSUE webhooks | state-past-due.yaml PASS | apple-past-due.png | PASS — destructive "Payment issue — please update your payment method.", manage + Restore, NO plan change, NO purchase buttons (D26) |
| lifetime (apple) | REAL NON_RENEWING_PURCHASE webhook | state-lifetime.yaml PASS | lifetime.png | PASS — "✓ Lifetime Access", "No subscription management needed", Restore only |

**Restoration:** test account reset to the original
unlimited/active/stripe shape (`current_period_end` NULL,
`cancel_at_period_end` false, billing_version bumped), the sim-verify
webhook_events rows deleted (no stale apple cursor), and re-verified
END-TO-END: sign-out → sign-in (fresh JWT) → the standard profile.yaml
flow PASS ("Unlimited Plan" + mocked-restore notice).
