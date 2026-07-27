# Pre-mortem review — hosting-stack-decision

**Perspective:** It is January 2027. The integration effort shipped in August 2026 and has badly underdelivered. This is the incident narrative, traced back to weaknesses in the recommendation, followed by the preconditions that would have prevented it.

**Verdict: agree** — with the hosting call itself. When I replay the failure, the stack was never the villain. Vercel route handlers did not time out; the recalc queue kept humming on Supabase exactly as the research said it would. What failed was everything the recommendation listed as a side note, checkbox, or open question. The failure modes below are all reachable from the recommendation *as written*.

---

## What went wrong (the narrative)

### Week 1–3: the 429 that wasn't fixed by the bypass rule

The team read "known launch blocker: Cloudflare challenge, fix is a dashboard bypass rule" as a 15-minute task and scheduled it for launch week. Reality: `api.<domain>` was created as a Vercel alias on the same project, which sits behind the same Cloudflare orange-cloud zone. The bypass rule was written against the *path* `/api/v1/*` — but Cloudflare's challenge is evaluated at the zone edge and the first rule attempt was scoped to the wrong hostname, then a later Cloudflare config change (unrelated, made for a bot wave hitting the web app) silently re-enabled managed challenge on the API host. The fitness app got intermittent `429` HTML — the exact "Unexpected token '<'" class of failure already in the project's memory from the tRPC incident (see the `vercel-challenge-mode-breaks-trpc` note) — for two weeks, in production, only on cellular networks that Cloudflare scored as bot-like. Nobody had put the cookie-less curl check into CI or a scheduled probe, so the regression was discovered by the fitness app's users.

Compounding it: once the bypass rule *did* work, the API host was now exempt from Cloudflare's bot mitigation entirely, and the team had wired Upstash rate limiting into `POST /v1/rounds` but not the two read endpoints added in a follow-up PR. A scraper found them. The recommendation said "reuse existing rate limiting" but never made per-route rate limiting a structural requirement of the v1 surface (e.g., a shared handler wrapper), so it was applied route-by-route and missed.

### Month 2: the extraction that became a mirror

The recommendation's step (1) — extract to `apps/web/server/services/scorecard/` with injected deps, typed domain errors, zero framework imports — was the right design. But it was sequenced as a *prerequisite the recommendation assumed would happen*, not a gate anything enforced. Under deadline pressure ("the fitness app demo is Thursday"), the first REST handler shipped by copy-pasting the transaction body out of `round.ts` and trimming the tRPC bits. The team said "we'll unify next sprint."

This repo *already contained the proof that this is how it goes*: `supabase/functions/handicap-shared` is a hand-maintained Deno mirror of `packages/handicap-core`, still sitting there in `supabase/functions/`. The research cited it as a cautionary tale and then relied on good intentions to avoid repeating it. By November there were two submit pipelines. A billing-gate fix (free-tier limit check moved earlier) landed in the tRPC path only. Fitness-app users on free plans submitted round #21, #22, #23 without gating; the reconciliation and refund-adjacent support mess consumed most of December.

### Month 3–4: retries meet delete-on-race

The recommendation correctly flagged that the post-transaction compensation (`round.ts:949–992`) is not retry-safe and prescribed an `Idempotency-Key` header. But it specified a *header*, not a *mechanism* — no storage table, no scope (per-user? per-key TTL?), no defined replay semantics, no interaction with the compensation path. What shipped was a key that deduplicated only while the original request was in flight.

The fitness app is a mobile client on flaky networks. Its HTTP layer retried on timeout. Sequence observed in Sentry:

1. `POST /v1/rounds` — transaction commits (round inserted, `AFTER INSERT` trigger enqueues recalc), response lost on the network.
2. Client retries with the same scorecard; idempotency window already expired → second round inserted.
3. User is free-tier at the limit → compensation fires on the retry, deleting the *second* round via a sequence of **non-atomic, post-commit deletes** across `submissions`/`round`/`hole`/`teeInfo`/`course`. One of these partial-failed once (pooled connection dropped mid-sequence), leaving orphaned pending tees that the admin console had no way to attribute.
4. Because the trigger also fires `AFTER DELETE`, handicaps self-healed — which *masked* the data mess for weeks, since the number users watch stayed correct while the underlying rows drifted.

The open question the research itself raised — "should the free-tier limit become a DB-side constraint before public writes exist?" — was the actual fix, and it was left as an open question rather than a precondition.

### Month 5: the trigger list that never fired

The "leave Next.js when X" list was well-constructed and completely uninstrumented. "Sustained API-attributable Vercel cost > $50–100/mo" is unmeasurable when the API and the web app share one Vercel project — there is no per-route cost attribution, so the trigger was unfalsifiable by construction. No alert was ever created for Supavisor client connections (the research explicitly called discussion #40671 "a monitoring trigger, not a blocker" — but a monitoring trigger with no monitor is a vibe). The explicit `max` on the postgres-js pool — a one-line fix the research identified — was still not set in January 2027 (`apps/web/db/index.ts:7` still reads `{ prepare: false }` alone), and a fluid-compute connection pileup during a December traffic spike produced an evening of "Max client connections reached" that got misdiagnosed as a Supabase outage for four hours because nobody owned the signal.

Meanwhile the coupling con listed for Option A quietly bit: a web-app hotfix deploy (a broken Sentry release, rolled back after 20 minutes) took the API down with it during the fitness app's Sunday-morning peak. Not trigger-list-worthy on its own — but there was no status page, no SLO, and no way to even *know* the API's availability was 20 minutes worse than the web app's, because they were the same deployment.

### The scope assumption that set the schedule

Launch scope was estimated on "if the fitness app shares the same Supabase project, no OAuth work is needed at all." That was an *open question* in the research, but it was the happy path, so the schedule was built on it. When it turned out the fitness app had its own Supabase project (its own auth, its own user table), consumer #1 suddenly needed either a user-linking flow or the Supabase OAuth 2.1 server — public beta, maturity unverified — on the critical path. Six weeks of unplanned work, discovered after the API surface was already built.

---

## What the recommendation got right (why this is still "agree")

- The core hosting analysis held. No timeout ever fired; the async-queue architecture (verified: `20251207150152_replace_handicap_trigger.sql`, `process-handicap-queue`) meant the request path stayed light exactly as claimed.
- Option B (separate Hono service day one) would have made the failure *worse*: every one of the above failures — bypass misconfiguration, pipeline duplication, idempotency underspecification, unowned monitoring — would have happened *plus* new infra, duplicated auth/rate-limit/Sentry plumbing, and the packages-don't-exist-yet extraction tax. The failure was never "wrong stack."
- The seam design (deps-injected service, typed domain errors, package promotion only after `packages/db`) is correct. The failure was that it was a recommendation, not a gate.

## Preconditions that must hold (extracted from the wreckage)

1. **The extraction is a merge-blocker, not a step.** No REST handler for round submission may merge unless it and the tRPC procedure both call the same `submitScorecard(deps, input)` service — enforce structurally (the router PR that *removes* the inline 700 lines lands **before or with** the first `/v1` PR, and a lint/CI rule forbids `app/api/v1/**` from importing anything under `server/api/routers/`). The repo's own `handicap-shared` mirror is the empirical prior for what happens otherwise.
2. **Public writes require transactional correctness, not compensation.** Before `/v1/rounds` accepts its first external POST: (a) the free-tier limit becomes a DB-side constraint or an in-transaction check with a serializable/advisory-lock guard, retiring the post-commit delete cascade; (b) `Idempotency-Key` is specified as a mechanism — persistence table, uniqueness scope, replay window, response replay — not a header name. These two interact and must be designed together (the research's own open question #6, promoted to a blocker).
3. **The gates and triggers get owners and probes at launch, or they don't exist.** A scheduled cookie-less curl against `https://api.<domain>/v1/health` (alerting on any non-JSON response) so a Cloudflare config change can't silently re-break clients; a Supavisor client-connection alert plus the explicit postgres-js `max`; and each "leave Next.js when X" trigger either measurable today (name the dashboard/metric) or rewritten until it is. An unfalsifiable trigger list is how you stay on a platform past its expiry without ever deciding to.
4. **Resolve the fitness-app auth question before scoping the launch.** Same-Supabase-project vs. separate project is the difference between "zero OAuth work" and "beta OAuth server on the critical path." It is a one-conversation question; answer it before the schedule is built, not after.
