# Plan 005: Billing lifecycle emails from the webhook chokepoint — no more silent payment failures

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 469a53f..HEAD -- apps/web/lib/stripe-webhook-handlers/ apps/web/server/api/routers/stripe.ts apps/web/app/api/webhooks/revenuecat/route.ts apps/web/emails/ apps/web/lib/email-service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (double-send and mis-classified change emails are the failure modes; money-path files)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `469a53f`, 2026-07-02

## Why this matters

The app is about to charge real money on two platforms, and the billing email wiring only covers changes users make *inside the app*. A failed Stripe renewal silently flips the user to `past_due` — no email, no recovery prompt — which is involuntary churn by design. A cancellation made through the Stripe Customer Portal notifies nobody, because the upgrade/downgrade/cancel emails are wired to the in-app tRPC mutation rather than to the webhook where *all* Stripe truth arrives. And the RevenueCat/Apple webhook sends zero emails of any kind. The templates already exist (`subscription-upgraded/downgraded/cancelled.tsx`); the senders already exist (`apps/web/lib/email-service.ts`); they are just attached to the wrong layer. This plan moves lifecycle notification to the webhook chokepoint (single source of truth, covers portal/dunning/Apple events) and adds the missing payment-failure email.

## Current state

Files and facts (verified at commit `469a53f`):

- `apps/web/lib/stripe-webhook-handlers/invoice-handlers.ts:~100-150` — `handleInvoicePaymentFailed`: builds a `BillingFact` with `status: "past_due"`, writes via `guardedStripeProfileWrite` (precedence-guarded, returns `{ written }`), logs success or "blocked by precedence guard", and logs a warning when `attemptCount >= 3`. **No email is sent anywhere in the failure path.**
- `apps/web/server/api/routers/stripe.ts:310-352` — inside the `updateSubscription` mutation: `result.changeType === "upgrade" | "downgrade" | "cancel"` branches call `sendSubscriptionUpgradedEmail` / `sendSubscriptionDowngradedEmail` / `sendSubscriptionCancelledEmail` with plan names, proration/period-end data, and `billingUrl`. This is the ONLY place these are sent — a portal cancel or Stripe-side change never triggers them.
- `apps/web/app/api/webhooks/revenuecat/route.ts` — no Resend/email imports at all (`grep -riE "resend|sendemail|@react-email" ...` → no hits). It applies Apple billing facts through an optimistic-locked write (`billingVersionAtRead` compare-and-set).
- Senders live in `apps/web/lib/email-service.ts` (`sendSubscriptionUpgradedEmail` etc. — read it for the exact export list and signature shapes). Templates in `apps/web/emails/`: `subscription-upgraded/downgraded/cancelled.tsx`, `welcome.tsx`, `round-approved/rejected.tsx`, etc. **There is no payment-failure template.**
- A webhook-side email already exists as the exemplar: the welcome email is sent from the checkout webhook handler (`apps/web/lib/stripe-webhook-handlers/checkout-handlers.ts`, around line 240 — read it; match its import style, error handling, and how it gets the user's email address server-side).
- Webhook idempotency: incoming Stripe events are deduped by event ID via the `webhook_events` table (`apps/web/db/schema.ts:438` + the webhook route). Emails sent *inside the deduped handler path* inherit redelivery-safety. Confirm the RevenueCat route has equivalent dedupe before relying on it there.
- `email_preferences` (`apps/web/db/schema.ts:~565`) has a single `featureUpdates` flag. **Decision, made here**: billing lifecycle emails are transactional (payment failed, plan changed, subscription cancelled) — they are NOT gated on marketing preferences and this plan must not add such gating. The table is out of scope.
- Repo email/observability rules: send via Resend from server code only; never log full event payloads or PII; no `console.log` (Sentry breadcrumbs/structured logging — see how the webhook handlers already log via `logWebhookSuccess`/`logWebhookInfo`/`logWebhookWarning`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck (web) | `pnpm --filter web exec tsc --noEmit` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Email preview | `pnpm email` | templates render locally |
| Stripe event replay (if CLI configured) | `stripe trigger invoice.payment_failed` | webhook fires locally |

## Scope

**In scope**:
- `apps/web/emails/payment-failed.tsx` (create)
- `apps/web/lib/email-service.ts` (add `sendPaymentFailedEmail`; no changes to existing senders' signatures)
- `apps/web/lib/stripe-webhook-handlers/invoice-handlers.ts`
- `apps/web/lib/stripe-webhook-handlers/subscription-handlers.ts`
- `apps/web/server/api/routers/stripe.ts` (remove the three in-app send branches)
- `apps/web/app/api/webhooks/revenuecat/route.ts` (minimal Apple-side sends)
- `apps/web/tests/unit/` (new tests)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `email_preferences` schema or gating — transactional emails bypass it by decision (above).
- `guardedStripeProfileWrite` / `applyBillingEvent` / any precedence or optimistic-lock logic — issue #134 owns Stripe-side locking; do not entangle it here.
- The welcome-email flow in `checkout-handlers.ts` — it already works; it's your exemplar, not your patient.
- Dunning sequences, retry-my-payment buttons, invoice history UI — future-features territory; this plan is notification only.
- `apps/native/` — emails are platform-neutral.

## Git workflow

- Branch: `advisor/005-billing-lifecycle-emails`
- Commit style: conventional commits (e.g. `feat(billing): payment-failure and webhook-driven lifecycle emails`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the wiring before touching it

Read, in order: `checkout-handlers.ts` (the welcome-email exemplar — how it resolves the user's email address and calls the sender), `email-service.ts` (sender signatures, from-address conventions), `subscription-handlers.ts` (where `customer.subscription.updated`/`deleted` facts are applied — note what prior-state it reads; `readBillingProjection` gives pre-write state in `invoice-handlers.ts:~103`), and the `updateSubscription` mutation in `stripe.ts` (what `result.changeType` is derived from). Record where each send must move to.

**Verify**: you can name the handler function for `customer.subscription.updated` and `customer.subscription.deleted`, and where in each the post-write success branch is (`written === true`).

### Step 2: Payment-failed template + sender

- Create `apps/web/emails/payment-failed.tsx` modeled structurally on `subscription-cancelled.tsx` (same components, same Tailwind usage, same footer/support conventions). Props: `name?: string | null`, `plan: string | null`, `billingUrl: string`, `isFinalAttempt: boolean`. Copy: payment failed, we'll retry automatically (Stripe Smart Retries), update your payment method at `billingUrl`; when `isFinalAttempt`, say the subscription will be cancelled if the last retry fails. No amounts, no card details, no invoice IDs in the email (PII/data-minimization rule).
- Add `sendPaymentFailedEmail` to `email-service.ts` matching the existing senders' shape exactly.

**Verify**: `pnpm email` → `payment-failed` renders in both `isFinalAttempt` states; `pnpm lint` → exit 0.

### Step 3: Send on payment failure

In `handleInvoicePaymentFailed`, in the `if (written)` branch (send only when the fact was actually applied — the precedence guard blocking the write means an Apple/lifetime user shouldn't get a Stripe dunning email), resolve the user's email the same way `checkout-handlers.ts` does, and call `sendPaymentFailedEmail` with `isFinalAttempt: attemptCount >= 3` (the existing final-attempt threshold in this file). Wrap the send in the same try/catch style the welcome-email send uses — an email failure must never fail the webhook (Stripe would retry the whole event).

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0. If the Stripe CLI is configured locally: `stripe trigger invoice.payment_failed` → handler logs the send. Otherwise the unit test in Step 6 is the gate.

### Step 4: Move change/cancel emails to the subscription webhook handlers

- In the handler for `customer.subscription.updated`: before the profile write, read the prior projection (`readBillingProjection`, as `invoice-handlers.ts` does); after a successful write, classify: prior plan ≠ new plan → upgrade or downgrade (the plan-ranking helper the mutation's `changeType` already relies on — find it and reuse it; do not write a second ranking); `cancel_at_period_end` transitioning false→true → cancelled email with period-end date. Send the matching existing email.
- In the handler for `customer.subscription.deleted`: if the prior projection was an active paid plan, send the cancelled email (immediate end date).
- Remove the three send branches from `updateSubscription` in `stripe.ts:310-352` (the in-app change flows through the Stripe API → the webhook now covers it; keeping both double-sends). Leave the rest of the mutation untouched.
- Guard against no-op events: only send when the classification found an actual transition (Stripe emits `subscription.updated` for many non-plan changes — renewal, metadata; those must not email).

**Verify**: `grep -n "sendSubscription" apps/web/server/api/routers/stripe.ts` → no matches; `grep -rn "sendSubscription" apps/web/lib/stripe-webhook-handlers/` → the new call sites. Typecheck + lint green. If Stripe CLI available: an in-app upgrade in the dev app produces exactly ONE upgrade email (via webhook), not two.

### Step 5: Minimal Apple-side notifications

In the RevenueCat route, after its optimistic-locked write succeeds (find the post-write success point; respect its 409-redelivery contract): map exactly two event families — `CANCELLATION` (auto-renew turned off) → `sendSubscriptionCancelledEmail` with the expiration date the event carries; `BILLING_ISSUE` → `sendPaymentFailedEmail` with `isFinalAttempt: false` and copy that already fits ("update your payment method" resolves to Apple subscription settings — set `billingUrl` to the billing page, which explains Apple-managed subscriptions). Confirm the route has event-level dedupe before sending (see Current state); if it does not, sends must be keyed on the event id via the same `webhook_events` mechanism — and if that's absent for RC, STOP.

**Verify**: typecheck + lint green; unit test in Step 6 covers the mapping.

### Step 6: Tests

See Test plan. **Verify**: `pnpm test:unit` → all pass including new tests.

## Test plan

- New unit tests (model on the closest existing tests — check `apps/web/tests/unit/` for existing webhook-handler tests first and extend their patterns):
  - payment-failed: `written=true` → sender called with `isFinalAttempt` false/true around the `attemptCount >= 3` boundary; `written=false` → sender NOT called.
  - subscription-updated classification: plan A→B up/down sends the right email; same-plan/no-op event sends nothing; `cancel_at_period_end` false→true sends cancelled.
  - `updateSubscription` mutation no longer sends (mock the email service; assert zero calls).
  - RC mapping: `CANCELLATION` → cancelled sender; `BILLING_ISSUE` → payment-failed sender; any other event type → no send.
- Template render test only if the repo already render-tests emails (check; don't introduce a new harness for it).

## Done criteria

ALL must hold:

- [ ] `pnpm --filter web exec tsc --noEmit`, `pnpm lint`, `pnpm test:unit` all green, new tests included
- [ ] `apps/web/emails/payment-failed.tsx` exists and renders via `pnpm email`
- [ ] `grep -n "sendSubscription" apps/web/server/api/routers/stripe.ts` → no matches
- [ ] `grep -rln "sendPaymentFailedEmail" apps/web/lib/stripe-webhook-handlers/ apps/web/app/api/webhooks/revenuecat/` → both surfaces wired
- [ ] Email sends are inside `written === true` / post-lock-success branches only, wrapped so a send failure cannot fail the webhook response
- [ ] No changes to `guardedStripeProfileWrite`, `applyBillingEvent`, or any locking/precedence code (`git diff` review)
- [ ] No full event payloads or PII added to any log line
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `changeType` classification in the mutation comes from Stripe API response data that the webhook event doesn't carry (you'd need a new plan-ranking source — report what's available on the event instead).
- The RevenueCat route has no event-level idempotency/dedupe mechanism — adding one is #134-adjacent locking work that must not be improvised inside this plan.
- `checkout-handlers.ts`'s welcome-email exemplar doesn't exist at/near line 240 (the wiring drifted — re-locate it; if webhook-side email sending has been removed entirely, the architecture changed and this plan needs re-grounding).
- Resolving the user's email in webhook context requires a new service-role access path that doesn't already exist in the handlers.
- You find an email already being sent for any of these events from a place this plan doesn't list (double-send risk — map it first).

## Maintenance notes

- This plan makes the webhook layer the single source of billing notifications. Any future billing email (trial ending, renewal receipt) belongs in the handlers, not in tRPC mutations — reviewers should reject new mutation-side sends.
- Issue #134 (optimistic lock for Stripe write closures) touches the same handler files; whichever lands second rebases carefully around the `written` branches — the send-only-when-written invariant must survive.
- The Apple mapping is deliberately minimal (CANCELLATION, BILLING_ISSUE). EXPIRATION, PRODUCT_CHANGE, and UNCANCELLATION are known omissions — add them only with real user demand.
- Watch Resend deliverability after launch: dunning emails have elevated spam-flag risk; if open rates crater, revisit copy/from-address, not the wiring.
