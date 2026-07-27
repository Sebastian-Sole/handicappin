# Plan gating and attribution for API-submitted rounds

Research date: 2026-07-20. Repo state: `main` @ d06c827.

Decision question: How should plan gating apply to API-submitted rounds — do they count against
`FREE_TIER_ROUND_LIMIT` like web/native rounds; what happens to fitness-app users who never
completed handicappin onboarding; and do we need per-consumer attribution (a `source`/`app_id`
column on rounds) for future API pricing or abuse forensics?

---

## 1. What the codebase actually does today (verified)

### 1.1 The gate order in `submitScorecard`

`apps/web/server/api/routers/round.ts:303-349`:

1. **User match** (line 320): `input.userId !== ctx.user.id` → `FORBIDDEN`.
2. **Plan-selected check** (lines 331-341): `getComprehensiveUserAccess(userId, ctx.supabase)`;
   if `!access.hasAccess` → `FORBIDDEN` `"Please select a plan to continue. Visit the onboarding
   page to get started."` — a human-facing string with a web-only remedy.
3. **Free-tier limit** (lines 343-349): `access.plan === "free" && access.remainingRounds <= 0`
   → `FORBIDDEN` `"You've reached your free tier limit of 25 rounds. Please upgrade to continue
   tracking rounds."`
4. Transaction (course/tee auto-create, round insert, handicap recalc).
5. **Post-transaction race re-check** (lines 949-992): for `plan === "free"` only, re-counts
   `round` rows via Supabase REST; if `count > FREE_TIER_ROUND_LIMIT`, manually deletes the
   round, its submissions, any created tees/holes/course, then throws `FORBIDDEN`.

### 1.2 How the free tier is metered

- `FREE_TIER_ROUND_LIMIT = 25` — **lifetime** rounds, not per-month
  (`apps/web/utils/billing/constants.ts:8`).
- `remainingRounds` is **derived by counting `round` rows** for the user
  (`apps/web/utils/billing/access-control.ts:39-51`). There is no usage counter table.
  Consequence: any round row, regardless of origin, automatically counts against the limit.
  Per-user metering of API rounds therefore requires **zero schema or metering changes** — it
  falls out of the existing count. Conversely, exempting API rounds or metering per-app would
  require a discriminator column plus `WHERE` clauses in *both* the access check and the race
  re-check.

### 1.3 The onboarding gap is worse than "plan not selected"

- `profile.plan_selected` is nullable (`apps/web/db/schema.ts:43`) and is only ever set by:
  - the **web-only server action** `createFreeTierSubscription`
    (`apps/web/app/onboarding/actions.ts`) — sets `planSelected: "free"`, bumps
    `billing_version` to invalidate the JWT billing-claims cache;
  - Stripe webhook handlers (`lib/stripe-webhook-handlers/*`);
  - the RevenueCat webhook → `applyBillingEvent` (native paid plans).
- **Even the native app cannot select the free plan today**: `apps/native/app/onboarding.tsx:69`
  labels free-tier selection a "Web-only server flow"; the Free card's button shows a mock
  notice (`onButtonPress={showMockNotice}`, line 157). There is no tRPC procedure for plan
  selection at all (checked all routers under `apps/web/server/api/routers/`).
- Deeper still: **profile rows are not auto-created by a DB trigger**. They are created by the
  `create-profile` Supabase edge function invoked from handicappin's signup form
  (`apps/web/utils/auth/helpers.ts:49`, `supabase/functions/create-profile/`). A user who
  authenticates via the shared Supabase project from the fitness app but never ran handicappin
  signup has **no profile row**: `getComprehensiveUserAccess` fails the `.single()` and returns
  `createNoAccessResponse()` → same opaque `FORBIDDEN`. So the API-consumer failure mode has
  two layers: missing profile, then missing plan.

### 1.4 Attribution today: none

- The `round` table (`apps/web/db/schema.ts:231-310`) has **no source/app/client column**.
  Only `createdAt` hints at anything.
- The server-side `round_submitted` PostHog event (`round.ts:1022-1033`,
  `packages/analytics/src/events.ts:74-81`) carries round facts but **no platform/source
  property**. tRPC context (`apps/web/server/api/trpc.ts`) captures no client identifier —
  web and native submissions are indistinguishable today, server-side.
- PostHog is best-effort/async and not queryable transactionally — it is **not** a substitute
  for a DB column if attribution ever feeds billing or abuse response.

### 1.5 Pre-existing side door (relevant to abuse forensics)

The `round` RLS insert policy allows any authenticated user to insert their own rounds
(`db/schema.ts:292-297`). Plan gating lives **only in the tRPC layer**; a bearer token (which
the native app already uses, and any API consumer would use) can `POST` to PostgREST
`/rest/v1/round` directly, bypassing the 25-round limit and the whole submission pipeline
(the DB trigger `enqueue_handicap_calculation`,
`supabase/migrations/20251207150152_replace_handicap_trigger.sql`, would still enqueue a
handicap recalc on such rows). This hole predates the API project, but an API program that
hands out tokens to third parties widens the audience that can find it. Worth a follow-up
(restrict direct insert, or accept and monitor) regardless of the option chosen here.

### 1.6 Adjacent facts

- `round_limit_hit` analytics event already exists for the client-side surfacing of the
  25-round FORBIDDEN (`packages/analytics/src/events.ts:83`).
- Upgrade surface is `/upgrade` (web). Fitness-app users can be deep-linked there.
- Error contract today is tRPC `FORBIDDEN` + prose message. Nothing machine-readable
  distinguishes "no plan" from "limit reached" except string matching.

---

## 2. External prior art (checked July 2026)

### Strava — the canonical "other app writes to my fitness profile" precedent

- Uploads via the API are written to the **athlete's own account** and are subject to the
  athlete's account rules; metering of the *API* is per-app request quotas (default 200 req/15
  min, 2 000/day), not per-athlete content quotas. As of **June 2026** Strava runs a tiered
  developer program (Standard tier ≤10 athletes self-serve; Extended Access with higher
  limits) and introduced a **monthly developer fee** — i.e., they monetize the *consumer app*,
  not the athlete's uploads. Sources: [Strava rate limits](https://developers.strava.com/docs/rate-limits/),
  [Strava API policy (updated 2026-06-01)](https://www.strava.com/legal/api_policy),
  [developer guide noting 2026 tier/fee changes](https://appsforstrava.com/developers/).
- Attribution: activities carry `external_id` / `device_name`, and Strava surfaces "via
  {app}" from the OAuth client; Garmin attribution is contractually required. I.e., **the
  platform records which client wrote each activity** — the exact `source` column question.
  Sources: [uploads doc](https://developers.strava.com/docs/uploads/),
  [community threads on device_name/external_id](https://communityhub.strava.com/developers-api-7/add-device-name-to-athlete-activities-list-to-comply-with-garmin-attribution-11812).
- Onboarding: an upload can only happen after OAuth consent by an **existing, fully
  provisioned** Strava account. The consent flow is what guarantees onboarding — there is no
  "user exists but never picked a plan" state reachable via the API.

### Supabase OAuth 2.1 server (the likely consent mechanism)

- Public **beta since 2025-11-26**, free during beta, all plans; full OAuth 2.1 + OIDC
  authorization-code+PKCE, refresh tokens. Sources:
  [docs](https://supabase.com/docs/guides/auth/oauth-server),
  [feature page](https://supabase.com/features/oauth2-1-server).
- **Still rough on hosted projects**: as of March 2026 the authorization flow redirects to
  `{SITE_URL}/oauth/consent`, which nothing serves by default, and the authorization-path
  setting isn't exposed in the dashboard — you must build/host your own consent page
  ([supabase/auth#2408](https://github.com/supabase/auth/issues/2408), open at research time,
  linked PR #2417 unmerged as far as the issue page shows). Not GA; do not bet day-one
  integration timelines on it, but it is the natural long-term issuer of per-app `client_id`s.
- Relevant here because an OAuth `client_id` is the natural value for a `source` column, and
  the consent screen is the natural place to hang "this will create/activate your free
  handicappin plan".

### Error-contract practice

- Machine-readable error codes + a documented remedy URL is the norm (Stripe error `code`s,
  GitHub API error objects); RFC 9457 `application/problem+json` is the current standard for
  REST problem details. The fitness app must be able to branch on `plan_required` vs
  `round_limit_reached` without parsing English prose.

---

## 3. Options

### Option 1 — Per-user metering, identical to web/native (status quo) + provisioning fix + `source` column

API rounds count against the same lifetime-25 free-tier counter. Fix the onboarding gap by
making provisioning explicit at integration time (see below). Add a nullable
`source` (e.g. `submitted_via: 'web' | 'native' | 'api:<client_id>'`) column on `round` +
property on `round_submitted`.

Onboarding-gap sub-decision (pick one):
- **(a) Provision at link/consent time (recommended)**: when the fitness app links a user
  (OAuth consent or first-party token exchange), it calls an idempotent
  `ensureProfile`/`selectFreePlan` endpoint that creates the profile row (reusing the
  `create-profile` edge function logic) and sets `plan_selected='free'` if null — mirroring
  `createFreeTierSubscription` including the `billing_version` bump. The consent/link screen
  states that a free handicappin plan is being activated. Web onboarding funnel untouched.
- (b) Silent default inside `submitScorecard` (null plan → treat as free): smallest code
  change but violates the project's "no silent defaults" precedent, skews onboarding
  analytics (`PLAN_SELECTED` never fires), and changes behavior for web/native too unless
  gated on source.
- (c) Pure error contract: return `plan_required` + onboarding deep-link, make the user finish
  onboarding in handicappin. Zero risk, but day-one UX for the first integration is "leave the
  fitness app, do a web flow" — exactly the friction the integration exists to remove.

Pros:
- Zero changes to metering math or the race-rollback logic — the count-based check and the
  lines 949-992 rollback already include API rounds automatically.
- No free-product leak: the 25-round limit is the product's core conversion lever; API rounds
  consuming it preserves the upgrade funnel (fitness app shows upgrade CTA → `/upgrade`).
- Matches Strava's model (writes belong to the user's account and its rules).
- `source` column is cheap now (one nullable text column + one insert value + one analytics
  property), and is the prerequisite for *any* future per-app pricing, per-app rate limits,
  per-app kill switch, or forensic query ("delete/flag all rounds from client X").

Cons:
- Free fitness-app users hit the lifetime 25-round wall (weekly golfer: ~6 months), and the
  upgrade remedy lives in another product — needs the machine-readable error contract plus
  remaining-quota response headers (e.g. `X-Round-Limit-Remaining`) so the fitness app can
  warn early (mirror `FREE_TIER_ROUND_LIMIT_WARNING/CRITICAL` at 10/5).
- `source` on `round` only covers rounds; future resources (profiles-read, stats) would need
  their own attribution (fine — request-log level attribution can come later with API keys).

### Option 2 — Per-consumer-app metering (API rounds don't count against user's 25; app has its own quota)

Add `source` discriminator; change `getComprehensiveUserAccess` round count and the race
re-check to `WHERE source NOT LIKE 'api:%'`; introduce per-app quotas (new table + counters).

Pros:
- First integration never bricks on the user's free-tier wall; app-level quota is how Strava
  meters *requests*.

Cons:
- **Leaks the product through the side door**: unlimited round tracking (the paid feature) for
  free via any API client — the fitness app would be a strictly better free handicappin.
- Touches the metering math in two places (access check + rollback), adds a quota subsystem,
  and creates two classes of rounds with different billing semantics inside one handicap
  record — confusing to explain and to support.
- Strava's per-app quotas meter API *traffic*, not user *content*; content always counts
  against the athlete's account rules. Option 2 misreads the precedent.

### Option 3 — Paid API tier from day one (API access requires user premium, or a partner contract per consumer app)

Pros:
- Zero free-product leak; clean story if the platform were launching to real third parties;
  Strava's June-2026 developer fee shows per-app monetization is viable *eventually*.

Cons:
- Kills the first integration: the fitness app is first-party and its users are largely free
  users; requiring premium to sync a scorecard guarantees the feature is dead on arrival.
- Requires the API-key/contract infra that (per the platform assessment) doesn't exist yet.
- Premature: there is exactly one consumer, owned by the same developer.

---

## 4. Recommendation

**Option 1**, with sub-option (a) provisioning, plus the `source` column now and per-app
infrastructure deferred. Concretely:

1. **Metering**: API rounds count against `FREE_TIER_ROUND_LIMIT` identically. No change to
   `getComprehensiveUserAccess`, no change to the race-rollback block (it already covers API
   rounds because both are pure `round`-row counts). When the submission pipeline is extracted
   out of the tRPC router (per the platform assessment), the rollback must travel with it.
2. **Onboarding**: an explicit, idempotent provisioning step at account-link time — create
   profile row if missing (reuse `create-profile` edge-function logic server-side) and set
   `plan_selected='free'` if null, with the `billing_version` bump and `PLAN_SELECTED`
   analytics event, surfaced on the consent/link screen. This also finally gives native a
   real free-plan path (today it's a mock notice), killing two birds.
3. **Error contract**: the REST surface must return machine-readable codes —
   `plan_required` (should become rare once provisioning exists) and `round_limit_reached`
   (→ HTTP 403 with RFC 9457 body, `upgrade_url: https://…/upgrade`, `limit`, `used`) — plus
   `X-Round-Limit-Remaining`-style headers on successful submits so the consumer can warn at
   the existing 10/5 thresholds. Never make integrators parse the current prose strings.
4. **Attribution**: add nullable `round.submitted_via` (text; values `web`, `native`,
   `api:<client_id>`; null = legacy) populated by the extracted pipeline, and add
   `submitted_via` to the `round_submitted` PostHog event. This is the minimum that keeps
   future doors open (per-app pricing à la Strava's 2026 developer fee, per-app kill switch,
   forensics). Defer the `api_clients` table / API-key registry until there is a second,
   genuinely third-party consumer; if Supabase's OAuth 2.1 server (beta since 2025-11-26,
   consent-page gap on hosted projects still open as of March 2026) reaches GA first, its
   `client_id` slots straight into the same column.
5. **Follow-up (out of scope but flagged)**: the `round` RLS insert policy lets any bearer
   token bypass plan gating via PostgREST today; decide whether to restrict direct inserts
   before handing tokens to anyone outside the two first-party apps.

**Confidence: high** on metering + attribution (grounded in code that already meters by row
count, and in Strava as directly-analogous prior art). **Medium** on the provisioning
mechanism choice, because it depends on the auth/consent design chosen by the adjacent
auth-topic research (first-party token exchange vs Supabase OAuth 2.1 vs API keys).

## 5. Open questions

1. Does the fitness app share the same Supabase auth project (bearer tokens just work, users
   may lack profiles), or separate auth (then account-linking design owns where provisioning
   hooks in)? This is the auth topic's decision; provisioning sub-option (a) must attach to
   whatever consent/link step that design produces.
2. Is lifetime-25 the free-tier semantics the owner wants for auto-synced rounds, or should
   API-originated volume prompt revisiting the limit shape (e.g., per-year) *product-wide*?
   (Changing it only for API rounds is Option 2 in disguise — avoid.)
3. Should provisioning-on-link also fire the EARLY100/promo logic that web onboarding has, or
   deliberately skip promos for API-originated activations?
4. Backfill: should existing rounds get `submitted_via` backfilled (`web` for pre-native
   rounds by date, else null/unknown), or is null-as-legacy acceptable for forensics?
5. When the pipeline is extracted, does the race-rollback survive as-is (manual deletes via
   service-role drizzle), or is it worth replacing with an in-transaction advisory lock /
   serializable count check so the API path can't observe half-rolled-back state?

## Sources

- Code: `apps/web/server/api/routers/round.ts` (303-349, 949-992, 1022-1033),
  `apps/web/utils/billing/{constants,access-helpers,access-control,access}.ts`,
  `apps/web/db/schema.ts` (43, 231-310), `apps/web/app/onboarding/actions.ts`,
  `apps/native/app/onboarding.tsx` (60-160), `apps/web/utils/auth/helpers.ts` (49),
  `supabase/functions/create-profile/`, `packages/analytics/src/events.ts` (74-85),
  `supabase/migrations/20251207150152_replace_handicap_trigger.sql`.
- [Strava API rate limits](https://developers.strava.com/docs/rate-limits/) (accessed 2026-07-20)
- [Strava API policy, updated 2026-06-01](https://www.strava.com/legal/api_policy)
- [Apps for Strava developer guide — 2026 tier/fee changes](https://appsforstrava.com/developers/)
- [Strava uploads documentation](https://developers.strava.com/docs/uploads/)
- [Strava community: device_name / Garmin attribution](https://communityhub.strava.com/developers-api-7/add-device-name-to-athlete-activities-list-to-comply-with-garmin-attribution-11812)
- [Supabase OAuth 2.1 Server docs](https://supabase.com/docs/guides/auth/oauth-server) (beta since 2025-11-26)
- [Supabase OAuth 2.1 feature page](https://supabase.com/features/oauth2-1-server)
- [supabase/auth#2408 — hosted consent path broken](https://github.com/supabase/auth/issues/2408) (open, March 2026)
