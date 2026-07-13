# Plan 009: Product analytics foundation — event taxonomy + PostHog on web and native

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0432f5f..HEAD -- apps/web/app/layout.tsx apps/web/env.ts apps/native/eas.json packages/ apps/web/app/onboarding apps/web/app/rounds/add`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (prerequisite for judging every growth/monetization change)
- **Effort**: M
- **Risk**: LOW–MED (additive; the risk is privacy hygiene, bounded below)
- **Depends on**: none
- **Category**: direction / dx
- **Planned at**: commit `0432f5f`, 2026-07-11
- **Issue**: https://github.com/Sebastian-Sole/handicappin/issues/139

## Why this matters

The product has zero event instrumentation: `apps/web/app/layout.tsx:8-9` wires only `@vercel/analytics` + `@vercel/speed-insights` (anonymous page views/vitals), and a repo-wide search for posthog/amplitude/mixpanel/segment/track/capture call sites returns nothing in either app. That means nobody can answer: how many signups reach a first logged round (activation), where free users hit the paywall, which surface converts to paid, or what D7/D30 retention looks like. Several queued strategy decisions (pricing repackaging, retention loops, i18n) are explicitly "measure first" questions. This plan defines a canonical event taxonomy in a shared package and wires PostHog into both apps behind a consent-conscious, fail-open wrapper.

## Current state

- `apps/web/app/layout.tsx:8-9` — `import { Analytics } from "@vercel/analytics/next"; import { SpeedInsights } from "@vercel/speed-insights/next";` rendered at the end of `<body>`. Keep these; they're complementary.
- `apps/web/env.ts` — `@t3-oss/env-nextjs` is the single source of truth for env vars (hard rule in `.claude/rules/coding-conventions.md`: never touch `process.env` directly in app code). New public vars go in its `client` section with the `NEXT_PUBLIC_` prefix.
- Native env pattern: `apps/native/eas.json` carries `EXPO_PUBLIC_*` vars per profile (see the `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` placeholder pattern; `development` profile deliberately left unset so CI/simulator use mocks). Match that: leave `development` unset → analytics no-ops in dev builds.
- Key funnel touchpoints (verified):
  - Plan selection/onboarding: `apps/web/app/onboarding/page.tsx` (web) and `apps/native/app/onboarding.tsx` (native) — both are the plan-selection paywall.
  - Round submission: web `apps/web/app/rounds/add/` UI calling the tRPC `round.submitScorecard` mutation (`apps/web/server/api/routers/round.ts:301`); native manual add `apps/native/app/rounds/add.tsx`; native live flow `apps/native/app/rounds/live/{setup,index,review}.tsx`.
  - Free-tier paywall hit: `round.ts:341-346` throws FORBIDDEN "reached your free tier limit of 25 rounds"; upgrade page `apps/web/app/upgrade/`.
  - Stats gate: `apps/web/server/api/routers/stats.ts:37-45` throws FORBIDDEN for non-unlimited/lifetime.
- Monorepo package precedent: `packages/tokens` (`@handicappin/tokens`) and `packages/handicap-core` — copy one of their `package.json`/`tsconfig.json` shapes for the new package.
- Privacy context: GDPR matters (Norwegian users; the app already has `legalConsents` infra and a data-export flow). Sentry is wired via `instrumentation.ts`/`instrumentation-client.ts` — do not break those.

## Design decisions (already made — implement, don't relitigate)

1. **PostHog, EU cloud** (`https://eu.i.posthog.com`) — GDPR-friendlier data residency.
2. **Cookieless-leaning config**: `persistence: "memory"`, `person_profiles: "identified_only"`, autocapture OFF, session recording OFF. Explicit events only. This keeps the integration defensible without new consent UI; adding a cookie banner is out of scope.
3. **Shared taxonomy package** `packages/analytics` (`@handicappin/analytics`): exports ONLY event-name constants + TypeScript payload types + a no-op-able `AnalyticsClient` interface. No SDK dependency in the package — each app wires its own SDK behind the interface. This keeps web/native event names from drifting.
4. **Fail-open**: if the env key is absent, the client is a no-op. No runtime errors, no dev noise.
5. **identify** on login/signup with the Supabase user id only — no email, no name, no PII in properties.

## Event taxonomy (v1 — implement exactly these)

| Event | Properties | Fired from |
|---|---|---|
| `signed_up` | `method: "email" \| "google"` | after successful signup verification (web + native) |
| `logged_in` | `method` | after successful login |
| `plan_selected` | `plan: "free" \| "premium" \| "unlimited" \| "lifetime"` | onboarding plan pick (web + native) |
| `paywall_viewed` | `surface: "onboarding" \| "upgrade_page" \| "round_limit" \| "stats_gate" \| "native_paywall"` | each paywall render |
| `upgrade_clicked` | `plan`, `surface` | upgrade CTA press |
| `checkout_completed` | `plan`, `provider: "stripe" \| "revenuecat"` | web: Stripe success return path; native: purchase success callback |
| `round_add_started` | `method: "manual" \| "live"` | add-round form open / live setup start |
| `round_submitted` | `method: "manual" \| "live"`, `holes: 9 \| 18` | after successful `submitScorecard` mutation resolution (client-side) |
| `round_limit_hit` | — | when the 25-round FORBIDDEN error is surfaced to the user |
| `stats_viewed` | `tab?: string` | statistics screens (web + native) |
| `calculator_used` | `calculator: string` | calculator interactions (use the id from `apps/web/lib/calculator-registry.ts`) |
| `live_round_started` / `live_round_submitted` | `holes` | native live flow |

Naming rule for future events: snake_case, past-tense verb, object first ("round_submitted" not "submit_round").

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Typecheck+lint web | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Native bundle sanity | `cd apps/native && npx expo export -p ios` | bundles without error (see memory: this catches NativeWind/bundler breaks) |
| Parity styles | `pnpm parity:styles` | exit 0 |

## Scope

**In scope**:
- `packages/analytics/**` (create: package.json, tsconfig.json, src/events.ts, src/client.ts, src/index.ts)
- `apps/web/env.ts` (add `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` as optional)
- `apps/web/lib/analytics.ts` (create: posthog-js wrapper implementing the interface) + a client provider component + mount in `apps/web/app/layout.tsx`
- Call sites listed in the taxonomy table (web pages/components + native screens)
- `apps/native/lib/analytics.ts` (create: posthog-react-native wrapper), provider in `apps/native/app/_layout.tsx`, `apps/native/eas.json` (add `EXPO_PUBLIC_POSTHOG_API_KEY` placeholder `SET-ME` to preview/production only), `apps/native/package.json` (add `posthog-react-native` + peer deps it requires)
- `pnpm-workspace.yaml` only if new package isn't auto-included (check `packages/*` glob first)

**Out of scope** (do NOT touch):
- Server-side/webhook event capture (Stripe/RevenueCat webhooks) — v2; keep v1 client-side only
- Cookie/consent banner UI — the cookieless config above is the mitigation; if you conclude a banner is legally required, STOP and report instead of building one
- Sentry instrumentation files (`instrumentation.ts`, `instrumentation-client.ts`, `sentry.*.config.ts`)
- `@vercel/analytics` wiring — keep it
- The tRPC routers — events fire from the client around mutations, not inside procedures

## Git workflow

- Branch: `advisor/009-product-analytics-foundation`
- Conventional commits per step, e.g. `feat(analytics): shared event taxonomy package`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `packages/analytics`

Copy the `package.json`/`tsconfig.json` shape from `packages/handicap-core`. `src/events.ts`: an `AnalyticsEvents` map of event-name constants → payload types (exactly the taxonomy table). `src/client.ts`: `interface AnalyticsClient { capture<E extends EventName>(event: E, props: EventProps<E>): void; identify(userId: string): void; reset(): void; }` plus `createNoopClient()`. Unit-test the type mapping compiles (a `.test-d.ts` or a tiny vitest asserting event names).

**Verify**: `pnpm install` → exit 0; `pnpm test:unit` → pass.

### Step 2: Wire web

Add optional env vars to `apps/web/env.ts` (client section). Create `apps/web/lib/analytics.ts` exporting a singleton built from `posthog-js` when `env.NEXT_PUBLIC_POSTHOG_KEY` is set, else the no-op client; init options exactly: `{ api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com", persistence: "memory", person_profiles: "identified_only", autocapture: false, capture_pageview: false, disable_session_recording: true }`. Create a `"use client"` provider that calls `identify` on auth-session presence and `reset` on logout (find where the app already observes the Supabase session client-side and hook there — do not create a second session listener if one exists). Mount alongside `<Analytics />` in `layout.tsx`.

**Verify**: `pnpm lint` → exit 0; `pnpm build` → succeeds with the env vars unset (fail-open proven).

### Step 3: Instrument web call sites

Add `capture` calls per the taxonomy table at: onboarding plan select, upgrade page CTA + view, rounds/add open + successful submit + round-limit error branch, statistics page view, calculator usage, auth success paths, Stripe success return (`apps/web/app/api/stripe/portal-return/` is portal; find the checkout success redirect target — likely `/billing` or a success param — and fire `checkout_completed` there client-side).

**Verify**: `pnpm lint` → exit 0; `grep -rn "capture(" apps/web --include='*.tsx' --include='*.ts' | grep -v node_modules | wc -l` → ≥ 10 call sites.

### Step 4: Wire native

Add `posthog-react-native` (+ its required peers, e.g. `expo-file-system`/`expo-application` if the SDK asks). `apps/native/lib/analytics.ts` mirrors the web wrapper reading `process.env.EXPO_PUBLIC_POSTHOG_API_KEY` (Expo inlines these at build time — see memory note: expoConfig values are build-time-embedded). Provider in `app/_layout.tsx`. Instrument: onboarding plan select, native paywall view, manual add submit, live_round_started/submitted (fire from the live flow screens, NOT from the watch bridge), stats tab view. `eas.json`: add `EXPO_PUBLIC_POSTHOG_API_KEY: "SET-ME"` to `preview` and `production` profiles only.

**Verify**: `cd apps/native && npx expo export -p ios` → bundles; `pnpm parity:styles` → exit 0.

### Step 5: Document

Add a short `packages/analytics/README.md`: the naming rule, the taxonomy table, "add new events in events.ts first", and the owner setup note (create EU PostHog project; set Vercel + EAS env vars — mirror the style of BACKLOG's env sections).

**Verify**: file exists; `pnpm test:unit` → all pass.

## Test plan

- `packages/analytics`: compile-time test that every event name maps to a payload type; runtime test that `createNoopClient()` methods don't throw.
- Web wrapper: vitest with `NEXT_PUBLIC_POSTHOG_KEY` unset asserting the no-op path is chosen (model test setup on an existing `apps/web/tests/unit/` file).
- Manual smoke (document in report, don't automate): run web dev with a real key, click through onboarding → confirm events in PostHog live view. Skip silently if the owner hasn't created the project yet.

## Done criteria

- [ ] `packages/analytics` exists and both apps import event names from it (grep `@handicappin/analytics` → ≥ 2 app-side imports)
- [ ] `pnpm build` succeeds with PostHog env vars unset
- [ ] ≥ 10 web capture call sites; native onboarding/paywall/add/live instrumented
- [ ] No PII (email/name) in any `capture`/`identify` property (`grep -rn "identify(" apps | grep -v node_modules` — user id only)
- [ ] `npx expo export -p ios` bundles
- [ ] `plans/README.md` status row updated

## STOP conditions

- You conclude a consent banner is legally required for this config — report, don't build.
- `posthog-react-native` demands native module changes beyond `expo install` (config-plugin edits to ios project files) — report first; the RN project has patched deps (`patches/`, pinned lockfile — see the pnpm/corepack hazard note in `plans/README.md` context: always run pnpm via the pinned version, never let pnpm 11 rewrite the lockfile).
- The Supabase session hook for identify doesn't exist in an obvious single place on web — report where auth state actually lives rather than adding a duplicate listener.

## Revision 1 (2026-07-13, issued by reviewer before dispatch — reconciles PR #137 drift)

PR #137 ("posthog setup", merged 2026-07-12, the owner's PostHog wizard run) landed AFTER this plan was written. It added **server-side** capture via `posthog-node`: `apps/web/lib/posthog.ts` (singleton) plus 14 `capture(` call sites in `app/auth/callback/route.ts`, `app/onboarding/actions.ts`, `app/api/webhooks/revenuecat/route.ts`, `server/api/routers/{account,contact,round,stripe}.ts`, and `lib/stripe-webhook-handlers/{checkout,subscription}-handlers.ts`. Event names are space-separated lowercase (`"round submitted"`, `"user signed up"`, `"checkout initiated"`, `"subscription started"`, one truncated artifact `"requested"` in account.ts). `layout.tsx` is otherwise unchanged (its diff vs `0432f5f` is PR #155's wording only) — the client side is still uninstrumented. Amendments now in force:

1. **The wizard's server-side capture layer STAYS** — it is the plan's "v2 server-side revenue truth" delivered early. The out-of-scope bullet "Server-side/webhook event capture" is amended to: do not ADD new server-side capture sites, but the existing ones are IN scope for normalization (points 2–4). The drift-check STOP on these files is resolved by this revision.
2. **One vocabulary, taxonomy package wins**: register the wizard's events in `packages/analytics/src/events.ts` under canonical snake_case names (`signed_up`, `logged_in`, `round_submitted`, `checkout_initiated`, `subscription_started`, `subscription_cancelled`, `subscription_updated`, `apple_subscription_started`, `apple_subscription_cancelled`, `free_plan_selected` → fold into `plan_selected {plan:"free"}`, `contact_form_submitted`, `account_deleted`, and rename the `"requested"` artifact to what it actually captures — inspect `account.ts:384` and name it per the naming rule). Refactor the server call sites to import these constants from `@handicappin/analytics`. NOTE prominently in your final report: this renames live event names the owner may already see in PostHog (1 day old) — flagged for owner veto at review; do not silently keep double vocabularies.
3. **No event fires from both sides.** Where the taxonomy table's client event is already covered server-side, the server capture is authoritative and the client capture is SKIPPED: `signed_up`, `logged_in`, `round_submitted`, `checkout_completed` (superseded by server `subscription_started`/`checkout_initiated` — drop `checkout_completed` from the taxonomy). Client-side v1 therefore instruments only UI-truth events: `plan_selected` (paid picks; free is server-captured), `paywall_viewed`, `upgrade_clicked`, `round_add_started`, `round_limit_hit`, `stats_viewed`, `calculator_used`, `live_round_started`/`live_round_submitted` (native). Step 3's `≥ 10 call sites` verify becomes: ≥ 8 CLIENT-side capture call sites (grep for the client wrapper's import, not bare `capture(`).
4. **`apps/web/lib/posthog.ts` (server singleton) is in scope for convention fixes**: read the key/host via `apps/web/env.ts` (never bare `process.env` — hard rule), and make it fail-open like the client wrapper — key absent → no-op client (today `process.env.NEXT_PUBLIC_POSTHOG_KEY!` inits posthog-node with `undefined`). Keep `enableExceptionAutocapture`, `flushAt: 1`, `flushInterval: 0`, EU host default.
5. `.claude/skills/integration-javascript_node/**` (the wizard's skill files) — out of scope, don't touch.

## Maintenance notes

- Every future feature plan should add its events to `packages/analytics/src/events.ts` first — reviewers should reject `capture("some_string")` literals.
- v2 candidates (deliberately deferred): server-side capture at the Stripe/RevenueCat webhook chokepoint for revenue truth; funnels/dashboards in PostHog itself (owner task); linking `round_limit_hit` → upgrade conversion into a dashboard.
- If the EU host adds noticeable latency to first paint, move init to `requestIdleCallback` — but measure first.
