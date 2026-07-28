# Hosting-stack decision: can the current stack host the public API?

**Topic:** Can Next.js route handlers on Vercel (Next.js 16 + tRPC + Drizzle + Supabase) credibly host the public API long-term, or should the API be a thin separate service from day one? Where must the submitScorecard pipeline be extracted to keep the later-split option open, and what triggers a split?

**Date:** 2026-07-20. External claims are dated inline; distrust anything older than ~12 months without re-verification.

---

## TL;DR

**Yes, the current stack can host the public API — comfortably, and the strongest argument was found in the codebase itself: the heavy handicap recalculation is already asynchronous and already runs off-Vercel.** A DB trigger on `round` enqueues the user into `handicap_calculation_queue`; a pg_cron-scheduled Supabase Edge Function (`process-handicap-queue`) does the full timeline recalculation. The synchronous `submitScorecard` transaction is a bounded sequence of ~20–30 short single-row queries — hundreds of milliseconds against a 300-second serverless envelope (Vercel fluid compute default). The timeout question the topic was framed around is a non-issue.

Recommendation: **ship `/api/v1` as Next.js route handlers in `apps/web`, extract the submit pipeline as a framework-free service module now (`apps/web/server/services/scorecard/`), and promote it to a workspace package (`packages/scorecard-core`) only after `packages/db` exists.** Put the public API behind `api.<domain>` (or at minimum a dedicated path prefix with a Cloudflare/Vercel bypass rule) so the host can be swapped later without breaking a single consumer. A concrete trigger list for "leave Next.js" is at the bottom.

---

## 1. Codebase findings (grounded)

### 1.1 The submit transaction is small; the heavy recalc is already async

`round.submitScorecard` (`apps/web/server/api/routers/round.ts:303–1037`) does, in order:

1. User-match check + billing/plan gating via `getComprehensiveUserAccess` (Supabase REST, outside the DB transaction) — lines 320–349.
2. One `db.transaction` (lines 354–947) containing: profile fetch, course find-or-create, tee resolution (~4 branch paths, each 1–2 queries), optional additional-tee inserts (loop, but bounded by tees on one course — realistically ≤ 6), round-count check, per-round calculations via `getRoundCalculations` (pure function from `@handicappin/handicap-core` — CPU microseconds), round insert, hole fetch, 9–18 score inserts, 0–7 submission-audit inserts. **Total: roughly 15–30 sequential round-trips of single-row work.** At 2–10 ms per round-trip from a same-region function through the pooler, that is ~50–300 ms of DB time.
3. Post-transaction: free-tier recount via Supabase REST + manual compensation deletes on race (lines 949–992), best-effort admin email via Resend (995–1019), PostHog capture + flush (1021–1034).

**What is NOT in the request path:** recalculating the user's handicap timeline across all rounds. `supabase/migrations/20251207150152_replace_handicap_trigger.sql` installs an `AFTER INSERT OR UPDATE OR DELETE ON public.round` trigger that upserts into `handicap_calculation_queue` (one row per user, debounced). `supabase/migrations/20251207213412_add_process_handicap_updates_function.sql` + `20251207150153_schedule_queue_processor.sql` wire a pg_cron job that drives the Deno Edge Function `supabase/functions/process-handicap-queue/index.ts` (384 lines), which uses the duplicated engine in `supabase/functions/handicap-shared/`. The prior assessment's phrase "transactional handicap recalculation" overstated what is synchronous: only the *single new round's* differentials are computed inline; the index update is queue-driven.

Consequence: **the most timeout-sensitive workload in the system already lives on Supabase infrastructure, not Vercel.** Moving the API off Vercel would not move this workload at all.

### 1.2 Connection handling

`apps/web/db/index.ts` (8 lines): `postgres(process.env.DATABASE_URL!, { prepare: false })` + `drizzle({ client })`, module-scope singleton. Production `DATABASE_URL` (per the commented-out line in `apps/web/.env`) is the **Supavisor transaction-mode pooler on port 6543** (`aws-0-eu-west-2.pooler.supabase.com:6543`). This matches Drizzle's and Supabase's documented serverless guidance exactly (`prepare: false` is mandatory in transaction mode — [Drizzle Supabase docs](https://orm.drizzle.team/docs/connect-supabase), [Supabase connection docs](https://supabase.com/docs/guides/database/connecting-to-postgres), retrieved 2026-07-20).

Two gaps worth noting:

- No explicit `max` on the postgres-js client — the default is **10 connections per function instance**. Under fluid compute's instance reuse this is usually fine (fewer instances), but it should be set deliberately (e.g. `max: 5, idle_timeout: 20`) before adding a second traffic source.
- A known, **unresolved** field report (Supabase discussion [#40671](https://github.com/orgs/supabase/discussions/40671), latest activity March 2026): Supavisor *client*-connection counts growing under Vercel Fluid + `attachDatabasePool` until "Max client connections reached", with no staff resolution as of March 2026. The repo does not use `attachDatabasePool`, and actual backend connections stayed flat in that report — but "Supavisor client-connection exhaustion recurs despite pool tuning" belongs on the split-trigger list rather than being a reason to avoid Vercel today.

### 1.3 The API-hosting building blocks already exist in `apps/web`

- **Bearer auth with RLS scoping**: `apps/web/server/api/trpc.ts:141–184` — cookie first, then `Authorization: Bearer <supabase access token>` with a bearer-scoped Supabase client so `auth.uid()` resolves correctly. Reusable verbatim from a route handler.
- **A worked example of a non-tRPC authenticated route handler**: `apps/web/app/api/ai/extract-scorecard/route.ts` already composes auth → premium gating (`getComprehensiveUserAccess`) → Upstash rate limiting (`@/lib/rate-limit`, with `X-RateLimit-*` headers) → zod validation (`@/lib/api-validation`) → structured error responses. The `/api/v1` surface is this pattern plus versioning.
- **Rate limiting** (`@upstash/ratelimit`), Sentry, structured logging, PostHog are all wired.
- Coding conventions explicitly reserve `app/api/` route handlers for "cases tRPC can't serve" — a public REST surface qualifies (`.claude/rules/coding-conventions.md`).

### 1.4 Extraction constraints discovered

- `pnpm-workspace.yaml` covers `packages/*`; precedent packages exist: `handicap-core` (pure TS, only a zod peer dep — the model extraction), `billing-core`, `analytics`, `tokens`.
- **The Drizzle schema lives in `apps/web/db/`**, not in a package. A true workspace package for the submit pipeline cannot exist until the schema (or a query interface) is packaged — otherwise the package would import from an app, inverting the dependency.
- The current pipeline's app-coupled imports (round.ts:1–32): `TRPCError`, `@/lib/email-service`, `@/lib/posthog`, `@/utils/billing/access-control`, `@sentry/nextjs`, `@/db`. These are the seams to invert.
- **Cautionary tale already in-repo**: `supabase/functions/handicap-shared/` is a hand-maintained Deno mirror of `packages/handicap-core` (same function names, parallel `timeline.ts`/`constants.ts`). Import-diffing confirms full duplication. Any architecture that puts domain logic on a second runtime without a shared package pays this tax forever.
- `vercel.json` is minimal (install/build + one daily cron). No `maxDuration` exports anywhere in `apps/web` — fluid defaults apply.

### 1.5 Known production gotcha (unchanged)

Production serves a Cloudflare/Vercel "Security Checkpoint" 429 HTML challenge on cookie-less requests (see memory: *Vercel challenge mode breaks tRPC*). **Any API consumer hits this regardless of hosting choice as long as it shares the challenged hostname.** Fix is dashboard-side (WAF/challenge bypass for the API path or a separate `api.` subdomain). This is a launch blocker to schedule, not an architecture input.

---

## 2. External facts (all retrieved 2026-07-20)

### 2.1 Vercel function limits (fluid compute)

Source: [Vercel changelog, 2025-06-25](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute) and [fluid compute docs](https://vercel.com/docs/fluid-compute) (doc `last_updated: 2026-07-01`):

| Plan | Default duration | Max duration | Memory (Standard) |
|---|---|---|---|
| Hobby | 300 s | 300 s | 1 vCPU / 2 GB |
| Pro | 300 s | 800 s (1800 s beta opt-in) | 1 vCPU / 2 GB (Performance: 2 vCPU / 4 GB) |

- Fluid compute is default-on for new projects since 2025-04-23; features in-function concurrency (multiple invocations share an instance → fewer DB connections), bytecode caching + production pre-warming (cold-start mitigation), `waitUntil` for post-response work, Active-CPU pricing.
- **Envelope math**: submit transaction ≈ 0.05–0.3 s DB time + ~0.2–0.8 s for access check/email/PostHog. Even a pathological 10× slowdown sits > 100× inside the 300 s floor. Timeout is not a constraint on any plan.
- `waitUntil` is the correct home for the email + PostHog flush tail (currently awaited inline, adding latency to every submit).

### 2.2 Supabase OAuth 2.1 server

Sources: [Supabase blog "Build Sign in with Your App"](https://supabase.com/blog/oauth2-provider) (public beta announced 2025-11-26), [OAuth server docs](https://supabase.com/docs/guides/auth/oauth-server) (retrieved 2026-07-20), Supabase release notes noting a 2026 OAuth-2.1-compliance tweak (token endpoint 201→200):

- Supabase Auth can now act as an OAuth 2.1 + OIDC identity provider: authorization-code + PKCE, dynamic client registration, consent UI, and — critically — **RLS policies automatically apply to OAuth-issued tokens** (`client_id` claim available for policy granularity).
- Docs no longer prominently flag beta status as of mid-2026; the feature shipped as public beta 2025-11-26. Verify GA/dashboard availability on the project's plan before committing.
- **Hosting-decision impact: neutral-to-positive for staying.** The authorize/token endpoints are hosted by Supabase, not by the API host. Tokens it issues are Supabase access tokens — the existing bearer path in `trpc.ts` (and any route handler using the same helper) validates them with zero new infrastructure. No API-key service needs to be built for the fitness-app integration; longer-term third-party access can ride the same rails.

### 2.3 tRPC→OpenAPI bridges (rejected)

The original `trpc/trpc-openapi` is archived/unmaintained; the successor [`trpc-to-openapi`](https://github.com/benox3/trpc-to-openapi) is a community fork-of-a-fork (supports tRPC ^11.1, zod v4) whose own README notes the original author abandoned it ([npm](https://www.npmjs.com/package/trpc-to-openapi), retrieved 2026-07-20). tRPC's official OpenAPI story remains alpha. A public contract should not be generated from an internal RPC router through a maintenance-fragile bridge — and the public API's shape (idempotent submit, coarse resources) shouldn't mirror internal procedures anyway.

---

## 3. Options

### Option A — Public REST `/v1` in Next.js route handlers, service extracted (RECOMMENDED)

`apps/web/app/api/v1/rounds/route.ts` (+ `courses`, `profile/handicap`) calling an extracted, framework-free `submitScorecard` service. Bearer auth via the existing helpers; Upstash rate limits; zod boundary schemas that live in a package so the fitness app can import them.

- **Pros:** zero new infrastructure/deploy targets; reuses auth, RLS scoping, billing gates, rate limiting, Sentry, logging as-is; timeout envelope has ~1000× margin (§2.1); heavy work already off-path (§1.1); one PR away from shippable; conventions already sanction it.
- **Cons:** API availability/deploy cadence coupled to the web app; Vercel Active-CPU pricing at high volume vs a flat VM; Cloudflare challenge must be bypassed for the API host/path; two surfaces (tRPC internal + REST public) to keep consistent — mitigated by both calling the same service module.

### Option B — Separate thin service (Hono/Fastify) from day one

- **Pros:** independent deploys/scaling/SLA; persistent DB connections (could use session pooler); clean-room versioned contract; no Vercel pricing exposure.
- **Cons:** the packages it would consume don't exist yet — `submitScorecard` is inline in the router and the Drizzle schema is app-local, so day-one means doing the full extraction *plus* new infra, auth middleware duplication, second Sentry/rate-limit/env setup, for exactly one first-party consumer. Premature: it front-loads all the cost the trigger list is designed to defer.

### Option C — Host the API on Supabase Edge Functions

- **Pros:** adjacent to the DB; precedent exists (queue processor); Supabase-native auth.
- **Cons:** Deno runtime cannot consume the pnpm workspace packages directly — the repo already demonstrates the failure mode (`handicap-shared` hand-mirror, §1.4); weaker Drizzle/transaction ergonomics; per-request CPU limits tighter than fluid compute; would *add* a third copy of domain logic. Rejected.

### Option D — Expose existing tRPC procedures via `trpc-to-openapi`

- **Pros:** least code; auto-generated OpenAPI.
- **Cons:** maintenance-fragile fork-of-fork (§2.3); superjson/transformer friction; freezes the internal procedure shape into a public contract; doesn't solve extraction (the 700 lines stay in the router). Rejected as the *public* surface; fine to keep tRPC internal.

---

## 4. Seam placement for the submitScorecard extraction

**Target end-state:** `packages/scorecard-core` alongside `handicap-core`/`billing-core`. **But that package is only honest after the Drizzle schema is packaged** (`packages/db`), because the pipeline is inseparable from schema-typed transactional queries (§1.4). Forcing a package now would either drag `apps/web/db` into it (app→package dependency inversion) or turn every query into an injected callback (interface obesity).

**Recommended sequence:**

1. **Now (with the first API endpoint):** extract to `apps/web/server/services/scorecard/submit-scorecard.ts` with hard discipline:
   - Signature ≈ `submitScorecard(deps: SubmitScorecardDeps, input: ScorecardSubmission): Promise<SubmitResult>`.
   - `deps` = `{ db /* Drizzle */, checkAccess, notifyAdmins, capture /* analytics */, logger }` — the tRPC router and the REST handler each assemble deps from their context.
   - **No imports of** `next/*`, `@trpc/*`, `TRPCError`, `@sentry/nextjs`, `@/lib/email-service`, `@/lib/posthog` inside the service. Throw typed domain errors (`RoundLimitExceededError`, `TeeNotFoundError`, …); each caller maps them (TRPCError vs HTTP status).
   - Input/output zod schemas move to `packages/handicap-core/src/round-schemas.ts` territory or a new `packages/api-contracts` so the fitness app can share them.
   - `round.submitScorecard` becomes a ~30-line adapter; behavior identical (existing integration tests must pass unchanged).
2. **Before (or with) any second runtime** — a separate service, a worker, or the fitness app's own backend calling in-process: extract `packages/db` (schema + client factory taking a connection string), then move the service to `packages/scorecard-core`. This step is mechanical *if and only if* step 1's import discipline held.
3. **Never:** copy the pipeline into Deno (`handicap-shared` is the cautionary tale) or fork it per-surface.

**Contract-level split insurance (cheap, do at launch):**
- Serve the public API at **`api.<domain>`** (can be a domain alias/rewrite to the same Vercel project). Consumers bind to the subdomain + OpenAPI contract, so a later re-host is a DNS/deploy change, not a breaking change. This also gives the Cloudflare challenge bypass a clean scope.
- Add an **`Idempotency-Key`** requirement on `POST /v1/rounds` from day one. The current post-transaction free-tier compensation logic (round.ts:949–992) deletes rows on a race — under API-client retries (which WILL happen) the submit path is not retry-safe without idempotency. This is the other half of the scorecard-service-seam topic; the seam extraction is where the key check belongs (unique index on `(userId, idempotencyKey)` checked inside the transaction).

---

## 5. Trigger list: stay in Next.js until any of these fire

Re-evaluate hosting (Option B: thin Hono/Fastify service consuming `packages/scorecard-core` + `packages/db`) when the **first** of these occurs:

1. **A true third-party consumer** (not the same developer) needs an SLA, uptime, or deprecation policy independent of web-app deploys — i.e., you'd be embarrassed to 503 their integration because a CSS PR broke the web build.
2. **Sustained API traffic makes Vercel pricing worse than a box**: as a rule of thumb, when API-attributable Active CPU + invocations on the Pro plan exceed ~$50–100/mo sustained (≈ millions of submits/month at these execution times), a $20 VM/Fly machine with persistent connections wins on cost.
3. **Connection-pool exhaustion recurs**: `FATAL: Max client connections reached` from Supavisor under fluid concurrency, after already setting explicit `max`/`idle_timeout` and considering the dedicated pooler (cf. unresolved discussion [#40671](https://github.com/orgs/supabase/discussions/40671), Mar 2026).
4. **Latency SLO breach from cold starts**: p95 for authenticated API reads exceeds budget (say 500 ms) attributable to cold starts/instance churn that fluid's pre-warming doesn't fix.
5. **Workload shape changes**: the API needs WebSockets/long-lived streams, or background jobs outgrow the pg_cron + Edge Function queue (e.g. multi-minute batch imports) — Vercel's model stops fitting.
6. **Release-cadence divergence**: API versioning/deploys need to ship on a different rhythm than the web app more than ~once a month (constant `vercel.json`/routing contortions are the smell).
7. **Plan-limit collision**: anything needing > 800 s synchronous (none foreseeable here), > the plan's cron granularity, or region placement Vercel can't give next to the eu-west-2 database.

Until then, every unit of effort goes into the **contract and the seam** (Sections 4's steps 1–2), which are exactly the assets a later split re-uses.

---

## 6. Open questions

1. **Which Vercel plan is production on (Hobby vs Pro)?** Determines the 300 s vs 800 s ceiling and cron/limit headroom. Check the dashboard; the daily cron in `vercel.json` is Hobby-compatible, so the repo doesn't disambiguate.
2. **Cloudflare/Vercel challenge bypass**: confirm a WAF/bypass rule can scope to `api.<domain>` or `/api/v1/*`, and verify with a cookie-less `curl` against production before any consumer integrates (known blocker; memory: *Vercel challenge mode breaks tRPC*).
3. **Does the fitness app share the same Supabase project/auth?** If yes, its users' existing access tokens already pass the bearer path and **no OAuth work at all** is needed for consumer #1; the OAuth 2.1 server is only needed for genuinely third-party apps. This materially changes the launch scope.
4. **Supabase OAuth 2.1 server maturity on this project**: public beta since 2025-11-26; confirm dashboard availability, client-registration flow, and whether it's GA before promising third-party "Sign in with Handicappin".
5. **Supavisor client-connection ceiling** on the current compute tier (limits scale with compute size) — establish the number and add a dashboard alert before launch.
6. **Free-tier race compensation** (round.ts:949–992): should the round limit become a DB-side constraint/trigger before public writes exist, instead of delete-after-the-fact compensation? Related to the idempotency design in §4.

---

## Sources

- Codebase (read 2026-07-20): `apps/web/server/api/routers/round.ts`, `apps/web/server/api/trpc.ts`, `apps/web/db/index.ts`, `apps/web/app/api/ai/extract-scorecard/route.ts`, `apps/web/vercel.json`, `apps/web/.env` (pooler URL comment), `packages/handicap-core/*`, `supabase/migrations/20251207150152_replace_handicap_trigger.sql`, `supabase/migrations/20251207213412_add_process_handicap_updates_function.sql`, `supabase/functions/process-handicap-queue/`, `supabase/functions/handicap-shared/`, `pnpm-workspace.yaml`.
- [Vercel changelog: higher defaults and limits for fluid compute](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute) (2025-06-25).
- [Vercel fluid compute docs](https://vercel.com/docs/fluid-compute) (last_updated 2026-07-01, retrieved 2026-07-20).
- [Drizzle ORM — Supabase connection guide](https://orm.drizzle.team/docs/connect-supabase) (retrieved 2026-07-20).
- [Supabase — connecting to Postgres / pooling](https://supabase.com/docs/guides/database/connecting-to-postgres) (retrieved 2026-07-20).
- [Supabase discussion #40671 — Supavisor client connections growing under Vercel Fluid](https://github.com/orgs/supabase/discussions/40671) (unresolved as of Mar 2026).
- [Supabase blog — OAuth 2.1 provider public beta](https://supabase.com/blog/oauth2-provider) (2025-11-26); [OAuth 2.1 server docs](https://supabase.com/docs/guides/auth/oauth-server) (retrieved 2026-07-20).
- [trpc-to-openapi (npm)](https://www.npmjs.com/package/trpc-to-openapi) and [repo](https://github.com/benox3/trpc-to-openapi) (retrieved 2026-07-20); original [trpc/trpc-openapi](https://github.com/trpc/trpc-openapi) archived.
