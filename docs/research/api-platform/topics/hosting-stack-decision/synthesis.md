# Synthesis: hosting-stack-decision

**Topic:** Can the current Next.js 16 + tRPC + Drizzle + Supabase stack on Vercel credibly host the public API long-term, or should the API be a thin separate service from day one? Where does the submitScorecard pipeline get extracted, and what triggers a later split?

**Panel:** white-hat, red-hat, black-hat, yellow-hat, green-hat, blue-hat, pre-mortem
**Verdict: CONSENSUS** (6 agree, 1 mixed; the mixed position's objections survive as binding conditions, not as opposition to the hosting choice itself)

---

## Decision

**Stay on the current stack. Ship `/api/v1` as Next.js route handlers in `apps/web` (Option A). Do not build a separate Hono/Fastify service now.**

The panel converged because the research falsified its own premise with primary evidence: the heavy handicap recalculation does **not** run in the request path. Migration `20251207150152` creates the round trigger that enqueues into `handicap_calculation_queue`, and `supabase/functions/process-handicap-queue` + pg_cron process it off-Vercel. The synchronous submit transaction (~50–300 ms modeled, unmeasured) sits against a 300 s serverless envelope — >100x headroom even if the real number is 1–3 s cross-region. The serverless-timeout argument for a separate service was a false premise. A separate service for one first-party consumer is résumé-driven architecture, and the repo's own `handicap-shared` Deno mirror is standing evidence of what a premature second implementation costs.

**Extraction location:** `apps/web/server/services/scorecard/` now, as `submitScorecard(deps, input)` with injected side-effects, typed domain errors, and zero framework imports. Promote to `packages/scorecard-core` only after `packages/db` exists — do not force a workspace package while the Drizzle schema lives in `apps/web/db`. The tRPC router and any REST handler become thin adapters.

However — and this is where the black hat and pre-mortem reshaped the outcome — the panel unanimously rejected the research's "confidence high" stamp as premature. The recommendation is **conditionally correct**: correct if the conditions below hold, unverified until they do. The conditions are absorbed into the decision as blockers, not suggestions.

---

## Conditions absorbed from the critical reviews

### A. Pre-scoping questions (answer before planning any work)

1. **Does the fitness app share the same Supabase project/auth?** Raised by 5 of 7 perspectives; the blue hat called leaving it as an "open question" a process flaw. If yes: consumer #1 needs zero OAuth work and possibly **no new REST surface at all** — the existing tRPC bearer path (`trpc.ts:141–184`) plus monorepo types already serves a first-party app (green hat's reframe: don't price the fitness integration at the cost of an API platform). If no: user-linking or the beta Supabase OAuth 2.1 server lands on the critical path — weeks of unplanned work. This one owner conversation sizes the entire launch scope.
2. **Confirm the production Vercel plan tier** (Hobby prohibits commercial use — this is a Stripe-billed product) and its timeout/concurrency limits, plus the function region vs the eu-west-2 database.
3. **Confirm the live production `DATABASE_URL`** in the Vercel dashboard is the transaction pooler (`:6543`) — current evidence is a commented-out `.env` line only, and a second (session-pooler) string is known to circulate for migrations.

### B. Launch blockers for any public write endpoint

4. **Cloudflare/Vercel challenge bypass, proven empirically.** Today every cookie-less prod request gets 429 HTML — the first consumer cannot make a single successful call. Create the bypass (prefer the green hat's structural fix: grey-cloud/DNS-only `api.<domain>` straight to Vercel, so the challenge layer never sees API traffic, rather than a dashboard rule that can silently regress), verify with cookie-less `curl`, and add a **scheduled cookie-less probe** alerting on non-JSON responses — the bypass is unversioned dashboard state. If the bypass cannot be scoped, the hosting decision itself reopens.
5. **Kill the delete-on-race compensation before public writes exist.** `round.ts:949–992` (count-then-delete across four tables, post-commit, non-transactional) is trivially raced by concurrent programmatic clients (free-tier billing bypass), leaves orphans on crash, and enqueues phantom recalc work. Replace with a DB-side or in-transaction free-tier constraint. This was "open question #6" in the research; the panel unanimously promotes it to a blocker.
6. **Idempotency as a mechanism, not a header.** Design it at the schema level (natural key or per-user `externalRef` uniqueness constraint) during the extraction, with uniqueness scope, replay window, and response-replay semantics specified — not `Idempotency-Key` middleware bolted on later. Items 5 and 6 must be designed together.
7. **Extraction with teeth.** The extraction PR that removes the inline ~700 lines from `round.ts` lands **before or with** the first `/v1` PR, plus an enforced ESLint import boundary on `server/services/scorecard/` (no `next/*`, no `@/env`, no tRPC/Sentry imports) and a rule forbidding `app/api/v1/**` from importing `server/api/routers/**`. A folder convention without a lint rule will rot exactly the way `handicap-shared` did.

### C. Contract & consistency (separate lightweight design gate)

8. Hold a **contract-design gate for `/v1`** before implementation: versioning, error envelope, idempotency semantics, per-principal (not per-IP) Upstash rate limits — the bypass removes the bot wall from write endpoints. This is the least-reversible decision in the topic (a consumer integrates against it) and got one paragraph where hosting got pages.
9. **State eventual consistency explicitly in the API contract**: POST returns 200 while the handicap is stale until pg_cron fires. Add queue-lag/failure alerting — rounds can accept forever while handicaps silently freeze.

### D. Instrumentation at launch (or the triggers don't exist)

10. Set the **Supavisor client-connection alert** now (unresolved fluid-compute connection-growth pattern, discussion #40671 — the shared pool is the real blast-radius risk: an abusive API client can take down the web app).
11. Set an **explicit postgres-js `max`** (`db/index.ts:7` currently has only `prepare:false`).
12. **Measure the real submitScorecard transaction duration** from the already-100%-sampled Sentry prod traces; pick the p95 SLO number from data, not the 50–300 ms model.

---

## Revised split-trigger list

The research's seven-item list was judged unfalsifiable as written (no per-route Vercel cost attribution on a shared project, no alerts configured, no owner). Compressed to triggers that will actually be noticed, each with a monitor:

| Trigger | Monitor / owner action |
|---|---|
| A true third-party consumer needing an independent SLA or deploy cadence | Fires on the business event itself |
| Supavisor client-connection alert fires recurringly after pool tuning | Alert from condition D.10 |
| Cold-start-driven p95 SLO breach on `/api/v1` | Sentry SLO from condition D.12 |
| WebSocket/streaming or heavy background-job requirement | Fires on the feature request |
| Security incident requiring API-scoped token revocation / isolation (black-hat addition) | Incident process |

Intermediate rung before any new infra (green hat): a **second Vercel project deploying the same monorepo with only the API routes** gives independent deploys and SLA for a config file's worth of work. Several triggers should route there first, not to Hono. The `api.<domain>` host from day one makes either move a DNS change.

---

## Dissent (strongest surviving counter-position)

The black hat did not concede the "high confidence" framing: the recommendation rests on two still-unverified facts (a scopable Cloudflare bypass; a commercially-usable Vercel plan), and even after the conditions are met, **shared blast radius is permanent under Option A** — one connection pool and one deploy pipeline serve both web and the public API, so every web deploy and Next.js major upgrade becomes a public-API risk event, and cost/SLA attribution for the "when to split" triggers can never be fully clean on a shared project. The panel's answer: this is a real, accepted cost of Option A, mitigated by the connection alert, the second-Vercel-project rung, and the `api.<domain>` insurance — not a reason to build a second service for zero third-party consumers.

## What the panel changed vs. the research

- Confidence downgraded from "high" to **conditional on A/B items** (blue hat, black hat).
- Free-tier DB constraint and idempotency design promoted from open questions to **launch blockers** (unanimous among critical reviews).
- Extraction boundary must be **lint-enforced and merge-blocking**, not a convention (black hat, pre-mortem).
- Cloudflare fix should be **structural (grey-cloud API host) + probed**, not a bypass rule alone (green hat, pre-mortem).
- Trigger list compressed from seven aspirational items to five monitored ones, with the second-Vercel-project middle rung added (red hat, green hat, blue hat, pre-mortem).
- Fitness-app-scope question elevated to the **first action**, since a "same project" answer may eliminate most of the proposed launch work (green hat's reframe, endorsed by white, yellow, blue, pre-mortem).
