# @handicappin/analytics

Canonical product-analytics event taxonomy for web, native, and the
server-side capture layer. **SDK-free by design** — this package exports
only event names, payload types, and the `AnalyticsClient` interface; each
app wires its own PostHog SDK behind it:

- Web client: `apps/web/lib/analytics.ts` (posthog-js)
- Native client: `apps/native/lib/analytics.ts` (posthog-react-native)
- Server: `apps/web/lib/posthog.ts` (posthog-node) — imports
  `ANALYTICS_EVENTS` constants for event names

All three are **fail-open**: no API key configured → silent no-op. No
runtime errors, no dev noise, no events from CI or simulators.

## Naming rule

`snake_case`, past-tense verb, object first — `round_submitted`, not
`submit_round`. **Add new events to `src/events.ts` first**; reviewers
should reject `capture("some_string")` literals at call sites.

## Ownership rule

No event fires from both sides. Server-captured events (webhooks, tRPC
procedures, route handlers) are revenue/lifecycle truth and must not be
duplicated client-side. Client events are UI truth (views, clicks, funnel
entries).

## Taxonomy (v1)

| Event | Properties | Fired from |
|---|---|---|
| `signed_up` | `provider` | server — OAuth callback |
| `logged_in` | `provider`, `plan?` | server — OAuth callback |
| `plan_selected` | `plan` | server (free pick, onboarding action) + client (paid picks, web + native onboarding) |
| `paywall_viewed` | `surface` | client — onboarding / upgrade page / round-limit wall / native paywall |
| `upgrade_clicked` | `plan?`, `surface` | client — upgrade CTAs (web + native) |
| `checkout_initiated` | `plan`, `checkout_session_id` | server — Stripe createCheckout |
| `subscription_started` | `plan`, `billing_provider`, `is_first_subscription`, `checkout_session_id` | server — Stripe checkout webhooks |
| `subscription_updated` | `new_plan`, `change_type` | server — Stripe updateSubscription |
| `subscription_cancelled` | `plan`, `billing_provider`, `cancel_at_period_end` | server — Stripe subscription webhooks |
| `apple_subscription_started` | `plan`, `billing_provider`, `event_type` | server — RevenueCat webhook |
| `apple_subscription_cancelled` | `plan`, `billing_provider` | server — RevenueCat webhook |
| `round_add_started` | `method: "manual" \| "live"` | client — add-round form open / live setup open (web + native) |
| `round_submitted` | `round_id`, `holes_played`, `approval_status`, `course_is_new`, `score_differential`, `total_strokes` | server — round.submitScorecard |
| `round_limit_hit` | — | client — 25-round FORBIDDEN error surfaced |
| `live_round_started` | `holes` | native — live setup start |
| `live_round_submitted` | `holes` | native — live review submit success |
| `stats_viewed` | `tab?` | client — statistics screens (web + native) |
| `calculator_used` | `calculator` (id from `apps/web/lib/calculator-registry.ts`) | client — calculator context chokepoint |
| `contact_form_submitted` | `subject` | server — contact router |
| `account_deleted` | `subscriptions_cancelled` | server — account router |

## Privacy

- `identify(userId)` — Supabase user id **only**. Never email, name, or any
  PII in identify or capture properties.
- Cookieless-leaning client config: `persistence: "memory"`,
  `person_profiles: "identified_only"`, autocapture OFF, session recording
  OFF, automatic pageviews OFF. Explicit events only.
- EU data residency: default host `https://eu.i.posthog.com`.

## Owner setup

1. Create a PostHog project on **EU Cloud** (eu.posthog.com).
2. Web (Vercel): set `NEXT_PUBLIC_POSTHOG_KEY` (project API key, `phc_...`).
   `NEXT_PUBLIC_POSTHOG_HOST` is optional (defaults to the EU host). Both
   are optional everywhere — builds and dev work without them.
3. Native (EAS): replace the `EXPO_PUBLIC_POSTHOG_API_KEY` `SET-ME`
   placeholder in `apps/native/eas.json` (`preview` and `production`
   profiles only; `development` deliberately stays unset so dev builds and
   CI no-op). Remember `EXPO_PUBLIC_*` values are inlined at build time — a
   new key needs a rebuild.
