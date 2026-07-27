# Yellow Hat Review — hosting-stack-decision

**Perspective:** Benefits and value. Why the recommendation works, best realistic outcomes, second-order gains.
**Verdict:** AGREE (high conviction)

## Why this recommendation is genuinely good, not just cheap

### 1. The architecture already did the hard part — the recommendation harvests it
The single strongest fact in this research is that the expensive work (full handicap timeline
recalc) already runs asynchronously off-Vercel via the `handicap_calculation_queue` trigger
(supabase/migrations/20251207150152) and the `process-handicap-queue` edge function. That means
the "serverless can't host the heavy write" fear was never real for this codebase. The
recommendation doesn't paper over a risk — it reveals that a past architectural decision already
bought the headroom. Staying on the stack is not a compromise; it is collecting a dividend on
work already paid for. A ~50-300 ms transaction against a 300 s floor is not "fits, barely" —
it is a >100x envelope that will survive years of feature growth.

### 2. Every launch ingredient exists in-repo, worked-example included
Bearer auth with RLS scoping (trpc.ts:141-184), billing gates, Upstash rate limiting, Sentry,
zod — and crucially `app/api/ai/extract-scorecard/route.ts` is a living template of the exact
route-handler pattern the /v1 surface needs. The realistic best case here is unusually good:
**the first consumer (the fitness app, same developer, plausibly same Supabase project) could
integrate with zero new infrastructure and zero OAuth work** — existing Supabase access tokens
already pass the bearer path. That is a days-not-weeks path from decision to a working
cross-app scorecard save. Few "build a public API" projects start with the auth, rate-limit,
and billing middle tier already deployed and battle-tested.

### 3. The extraction is valuable even if the API never ships
`submitScorecard(deps, input)` with injected side-effects and typed domain errors is a pure win
independent of hosting: a ~700-line router procedure becomes a testable, framework-free service;
the tRPC router shrinks to a ~30-line adapter; unit tests no longer need a tRPC harness. If the
fitness-app integration were cancelled tomorrow, the codebase is still better off. That makes
the plan's main cost item self-justifying — rare in platform work.

### 4. The sequencing discipline compounds
"Service module now, `packages/scorecard-core` only after `packages/db` exists" is the honest
ordering, and the repo itself proves why: `supabase/functions/handicap-shared` is the standing
cost of skipping extraction discipline (a hand-maintained Deno mirror of handicap-core). The
recommendation learns from the codebase's own scar tissue. Second-order benefit: once
`packages/db` exists, it also unblocks other futures (a CLI, a worker service, the native app's
server needs) — the API is merely the first beneficiary of a seam the monorepo wants anyway.

### 5. The split insurance is nearly free and fully load-bearing
- `api.<domain>` alias: one DNS record now; a later re-host becomes a DNS change instead of a
  breaking consumer migration. This converts the biggest con of Option A (coupling to the web
  deploy) into a one-line escape hatch.
- Idempotency-Key on POST /v1/rounds: fixes a real latent defect (the delete-on-race free-tier
  compensation at round.ts:949-992 is not retry-safe) that would bite API clients on day one.
  Again — the "insurance" is actually a correctness improvement on its own merits.
- Explicit pool `max`: a one-line config change that removes the only cited pooling unknown
  from the risk column into the monitoring column.

### 6. The trigger list turns a one-way door into a two-way door
The concrete "leave when X fires" list (third-party SLA, ~$50-100/mo API-attributable cost,
Supavisor exhaustion post-tuning, cold-start p95 breaches, WebSockets/jobs, deploy-cadence
divergence) means Option A is not a bet against ever splitting — it is a decision to split
*with evidence* instead of speculation. Every trigger is observable with tooling already in
place (Vercel analytics, Sentry, Supabase dashboard). Nothing today fires any of them. Deferring
Option B's cost (new infra, duplicated auth/rate-limit/Sentry plumbing for one first-party
consumer) is not procrastination; it is buying information with time.

### 7. What this unlocks later
- A versioned /v1 contract + zod schemas in a shared package is the substrate for a public
  OpenAPI spec, SDKs, and the long-term third-party platform ambition — none of which require
  a different host.
- Supabase's hosted OAuth 2.1 server means "Sign in with Handicappin" for true third parties
  adds no hosting burden to whichever runtime serves /v1 — the hosting decision and the identity
  decision stay decoupled, which is exactly what you want.
- The same extracted service powers web tRPC, native, REST, and any future watch/queue consumer
  — one pipeline, N adapters, ending the era of logic copies.

## Must-address before locking (value-at-risk items, not objections)

1. **Cloudflare challenge bypass** is the one item where the whole value story dies if skipped:
   every non-browser client 429s in prod today. It must be configured and verified with a
   cookie-less curl *before* the fitness app writes a line of integration code — it gates 100%
   of the benefit and costs a dashboard rule.
2. **Confirm the fitness app shares the Supabase project.** If yes, launch scope collapses
   dramatically (no OAuth, no token issuance) — this should be pinned down first because it
   changes the size of the win, not just the plan.
3. **Confirm the Vercel plan (Hobby vs Pro).** The 300 s vs 800 s ceiling doesn't threaten the
   recommendation, but the cost-trigger math (~$50-100/mo) and cron limits should be anchored
   to the real plan before the trigger list is treated as operational.

## Bottom line
This is the rare "do less" recommendation that is also the strategically stronger one: it ships
consumer #1 fastest, improves code quality regardless of outcome, learns from the repo's own
mirror-maintenance scar, and keeps the Hono/Fastify future open for the price of a DNS record
and an idempotency header. Agree, high confidence.
