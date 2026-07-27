# White Hat Review — billing-and-metering

Perspective: facts and information only. Each research claim was checked against the repo on 2026-07-20 (branch `main`, clean tree). Verdicts: VERIFIED (confirmed in source), PARTIAL (true with a correction), UNVERIFIED (external or not checkable from the repo).

## Claim-by-claim verification

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Plan-selected gate throws FORBIDDEN "Please select a plan" at round.ts:334-341 | VERIFIED | `apps/web/server/api/routers/round.ts:334-341` — exact lines, exact message |
| 2 | Free-tier limit is 25 LIFETIME rounds, checked after plan gate | VERIFIED | `round.ts:343-349`; `apps/web/utils/billing/constants.ts:8` (`FREE_TIER_ROUND_LIMIT = 25`) |
| 3 | 10/5 warning thresholds already exist for header reuse | VERIFIED | `constants.ts:13` (`_CRITICAL = 5`), `constants.ts:17` (`_WARNING = 10`) |
| 4 | Metering is a pure round-row COUNT per user; no usage-counter table | VERIFIED | `getComprehensiveUserAccess` counts `round` rows with `count: "exact", head: true` — `apps/web/utils/billing/access-control.ts:39-50`. Note: file is at `utils/billing/`, not `lib/` as the topic brief implied; research file cites it correctly |
| 5 | Post-transaction race re-check re-counts and manually deletes over-limit rounds (round.ts:949-992) | VERIFIED | Exact range. One precision: the rollback deletes go through the Drizzle `db` connection (direct Postgres, RLS-bypassing), not a Supabase service-role client — functionally equivalent for the "must travel with the pipeline" point, but the open-question wording "service-role deletes" is loose |
| 6 | API rounds therefore count against the limit with zero metering changes | VERIFIED (by construction) | Follows from #4/#5: both checks count all rows for the userId regardless of origin |
| 7 | `round_submitted` PostHog event has no platform/source property | VERIFIED | `round.ts:1021-1033` — properties are round_id, holes_played, approval_status, course_is_new, score_differential, total_strokes only |
| 8 | No source/app column on `round`; web and native rounds indistinguishable server-side | VERIFIED | No `submitted_via`/`source`/`platform`/`client` column in the `round` table (`apps/web/db/schema.ts`); repo-wide grep for `submitted_via`/`submittedVia` returns nothing |
| 9 | `plan_selected` is only set by web onboarding action, Stripe webhooks, RevenueCat webhook | VERIFIED (setter inventory) | `app/onboarding/actions.ts:23`, `lib/stripe-webhook-handlers/{subscription,checkout}-handlers.ts` + `profile-billing-write.ts`, `app/api/webhooks/revenuecat/route.ts`. The sub-claim that native's free-plan button is "a mock notice today" was NOT re-verified in this pass |
| 10 | Profile rows created by a signup-invoked edge function, not a DB trigger | PARTIAL | `supabase/functions/create-profile/` exists as claimed; the negative claim (no trigger creates profiles) was not exhaustively re-verified against all migrations. If true, the "no profile row → `.single()` fails → opaque FORBIDDEN" chain is correct: `access-control.ts:33-36` returns `createNoAccessResponse()` on any profile fetch error |
| 11 | RLS insert policy lets any bearer token insert rounds via PostgREST, bypassing plan gating | VERIFIED (policy) / UNVERIFIED (trigger) | `supabase/migrations/20251011094523_parched_shooting_star.sql:120`: `CREATE POLICY "Users can insert their own rounds" ON "round" ... FOR INSERT TO "authenticated" WITH CHECK (auth.uid()::uuid = "userId")` — no plan condition; no later migration found altering it. The claim that the handicap-queue trigger still fires on such inserts was not independently verified |
| 12 | `billing_version` exists to bump during provisioning | VERIFIED | `db/schema.ts:50` (`billingVersion: integer("billing_version").default(1).notNull()`), and it participates in an RLS expression at `schema.ts:87` — so a provisioning write must respect that coupling |
| 13 | Strava per-app attribution, request-based quotas, June-2026 developer fee | UNVERIFIED here | External; not checkable from the repo. The rate-limit numbers (200/15min, 2000/day) match Strava's long-published defaults, but the June-2026 fee tiering should carry a citation in the research file before it is used as pricing precedent |
| 14 | Supabase OAuth 2.1 server in public beta since 2025-11-26; consent-path gap (supabase/auth#2408) open as of March 2026 | UNVERIFIED here | External; dates are specific enough to cite-check. Recommendation correctly avoids depending on it day-one |

## What the evidence establishes

1. The recommendation's core mechanical claim is airtight: because both the access check and the race re-check are unfiltered per-user row counts, Option 1 is literally the zero-code-change option for metering, and Option 2 provably requires touching both counting sites plus the rollback plus a discriminator column.
2. The onboarding failure mode is real and observable in code: a missing or plan-less profile produces the same `createNoAccessResponse()` → FORBIDDEN with a prose message referencing "the onboarding page" — a page that does not exist in the fitness app's context. The two distinct causes (no profile row vs. profile row with null plan) are currently indistinguishable to the caller (`access-control.ts:33-36` collapses both).
3. Attribution is genuinely zero today (claims 7-8). Any forensic question of the form "which app wrote this round" is unanswerable retroactively; the column-now recommendation is the only way to make future data exist.
4. The RLS side door is real at the policy level (claim 11) and is strictly broader than the API question: it exists today for native bearer tokens too.

## Data that is missing but obtainable

- Distribution of round counts among free prod users (prod DB or PostHog): determines how many fitness-app users would hit the 25-round wall and how fast — the recommendation's main con is currently unquantified ("~6 months for a weekly golfer" is an assumption, not a measurement).
- Whether the fitness app will share the Supabase auth project — acknowledged open question, but it is the single fact that decides where the provisioning step can live. Decidable now by the owner; no research needed.
- Whether the handicap-queue trigger fires on direct PostgREST inserts (claim 11's second half): a 10-minute local-stack experiment.
- Whether native's free-plan flow really cannot set `plan_selected` (claim 9 sub-claim): one file read in `apps/native/app/onboarding.tsx`.
- Citations for the Strava June-2026 developer-fee tiers and the Supabase auth#2408 status (claims 13-14) if either is to be load-bearing for pricing or timeline decisions.

## Corrections of record

- Race-rollback deletes use the Drizzle `db` connection, not a service-role Supabase client (open question #5's wording).
- Provisioning writes to `plan_selected`/`billing_version` interact with an RLS expression on `billing_version` (`schema.ts:87`); the implementation note "billing_version bump" is not free-standing — it must match how the Stripe/RevenueCat writers do it (`profile-billing-write.ts`).

## Verdict

Agree. Every codebase-level fact the recommendation depends on checks out against source; the two unverified external claims (Strava fee, Supabase OAuth timeline) are used only as directional precedent, not as dependencies. The recommendation's weakest evidentiary point is the unquantified frequency of the 25-round wall for integrated users — obtainable data that should inform, not block, the decision.
