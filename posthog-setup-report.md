<wizard-report>
# PostHog post-wizard report

The wizard completed a deep integration audit of Handicappin. The project already had a comprehensive PostHog setup (posthog-node singleton, posthog-js client, shared `@handicappin/analytics` event taxonomy, and `identify` + `captureException` wired throughout). This run extended coverage by instrumenting two previously untracked server-side events and writing their env vars.

## Changes made

### Environment variables
Added to `apps/web/.env`:
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

### Event taxonomy (`packages/analytics/src/events.ts`)
Two events added to `AnalyticsEventMap` and `ANALYTICS_EVENTS`:

| Event name | Description | File |
|---|---|---|
| `ai_scorecard_extracted` | User successfully used the AI scorecard photo/PDF extraction feature (premium). | `apps/web/app/api/ai/extract-scorecard/route.ts` |
| `legal_consent_recorded` | User's TOS and privacy-policy consent was persisted server-side. | `apps/web/app/api/legal/record-consent/route.ts` |

### Existing coverage (already instrumented before this run)

| Event name | Description | File |
|---|---|---|
| `signed_up` | OAuth user signed up for the first time. | `apps/web/app/auth/callback/route.ts` |
| `logged_in` | Existing user completed OAuth login. | `apps/web/app/auth/callback/route.ts` |
| `plan_selected` | User picked the free tier on onboarding. | `apps/web/app/onboarding/actions.ts` |
| `checkout_initiated` | User started a Stripe checkout for a paid plan. | `apps/web/server/api/routers/stripe.ts` |
| `subscription_started` | Stripe checkout completed — subscription is live. | `apps/web/lib/stripe-webhook-handlers/checkout-handlers.ts` |
| `subscription_updated` | User changed their subscription plan. | `apps/web/server/api/routers/stripe.ts` |
| `subscription_cancelled` | Stripe subscription was cancelled. | `apps/web/lib/stripe-webhook-handlers/subscription-handlers.ts` |
| `apple_subscription_started` | Apple / RevenueCat subscription started. | `apps/web/app/api/webhooks/revenuecat/route.ts` |
| `apple_subscription_cancelled` | Apple / RevenueCat subscription cancelled. | `apps/web/app/api/webhooks/revenuecat/route.ts` |
| `round_submitted` | User submitted a scored round. | `apps/web/server/api/routers/round.ts` |
| `contact_form_submitted` | User submitted the contact form. | `apps/web/server/api/routers/contact.ts` |
| `account_deleted` | User confirmed and completed account deletion. | `apps/web/server/api/routers/account.ts` |

## Next steps

We've built a dashboard and 5 insights for you to keep an eye on user behavior:

- **Dashboard** — [Analytics basics (wizard)](https://eu.posthog.com/project/101298/dashboard/815865)
- [New signups](https://eu.posthog.com/project/101298/insights/RQXsOa6t) — daily signup trend (30 days)
- [Subscription starts by plan](https://eu.posthog.com/project/101298/insights/1SL5JVJy) — weekly new paid subscriptions broken down by plan (90 days)
- [Round submissions over time](https://eu.posthog.com/project/101298/insights/y2oso2ZR) — daily engagement signal (30 days)
- [Signup to first round funnel](https://eu.posthog.com/project/101298/insights/T50PA21d) — conversion from signup → plan selected → first round submitted (90-day window)
- [AI scorecard extractions](https://eu.posthog.com/project/101298/insights/RaVRnJmv) — daily premium feature usage (30 days)

## Verify before merging

- [ ] Run a full production build (`pnpm build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `apps/web/.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
