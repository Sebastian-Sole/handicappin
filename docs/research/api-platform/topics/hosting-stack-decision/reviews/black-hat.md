# Black Hat Review — hosting-stack-decision

Verdict: **mixed**. Option A is probably still the least-bad choice (B front-loads cost, C/D are self-evidently worse), but the recommendation's "high confidence" is not earned: two load-bearing facts are unverified, several risks are relabeled as "insurance" or "open questions" when they are launch-gating, and the extraction plan has no enforcement mechanism — this repo's own history says the deferred promotion step will not happen.

## 1. "High confidence" on unverified load-bearing facts

- **The Vercel plan is unknown.** The timeout-margin argument (">100x") depends on it, but worse: Hobby prohibits commercial use, and this is a Stripe-billing commercial product exposing a paid API surface. If prod is on Hobby, the hosting question isn't "300s vs 800s", it's "you must change plan before launch" — a cost fact that belongs in the decision, not the appendix.
- **The Cloudflare/Vercel challenge bypass is asserted as configurable but not demonstrated.** Today, *every* cookie-less request to prod gets 429 HTML. The entire recommendation is inoperable until a dashboard rule is proven with a cookie-less curl. A recommendation whose first consumer cannot make a single successful request in the current production configuration should not carry "high confidence" without that verification.

## 2. The bypass rule is itself a new attack surface

Scoping a challenge bypass to `api.<domain>` or `/api/v1/*` removes the bot wall from exactly the endpoints that accept programmatic writes. After that, Upstash rate limiting is the *only* shield — and it must be per-principal, not per-IP, or one NATed office/one botnet trivially starves or floods it. Also: the bypass lives in a dashboard, unversioned, invisible to CI. Someone re-enables challenge mode during an attack and the API breaks with 429 HTML that clients can't parse — and no test catches it. If you ship Option A, synthetic cookie-less monitoring against prod is mandatory, not optional.

## 3. Shared blast radius is the real serverless risk, not timeouts

The research correctly kills the timeout strawman, then under-weights what actually breaks shared-hosting setups:

- **One Supavisor pool, two audiences.** An abusive or buggy API client bursts fluid-compute instances, each holding up to `max: 10` postgres-js connections; the unresolved Supavisor connection-growth report (#40671) is exactly this shape. When the pool exhausts, it takes down the *web app* too. "Monitoring trigger, not a blocker" is a fine sentence until the first incident where a third-party script kills your consumer product.
- **One deploy pipeline, two contracts.** Every web UI deploy redeploys the public API. A broken web build blocks an API hotfix; a Next.js 16→17 migration becomes a public-API risk event. The trigger "deploy cadence diverging >~monthly" is a lagging indicator — you notice it *after* an integration partner has been burned.

## 4. The compensation logic is a correctness hole today, not an "open question"

`round.ts:949-992` is worse than "not retry-safe":

- The over-limit check is a count-then-delete race. Browser users hit it rarely; a programmatic client retrying on timeout, or two concurrent POSTs from the fitness app, hits it routinely. Free-tier bypass via concurrent API writes is a *billing* bug, exposed on day one of public writes.
- The cleanup deletes run outside any transaction; a crash mid-cleanup leaves orphaned tees/courses/submissions. And the DB trigger has already enqueued a handicap recalc for a round that is then deleted — the async queue processes phantom work.
- Idempotency-Key is waved through as "cheap insurance" but requires a keyed table, unique constraint, response replay semantics, and a decision about replays *after* a compensated delete. That's a small design project, and it interacts with moving the limit into a DB constraint. Sequencing: DB-side limit constraint and idempotency design are **pre-launch blockers** for public writes, not open questions.

## 5. "Already async" cuts both ways

The heavy recalc being off-request-path is the strongest pro-A fact — and also a consumer-facing liability the summary doesn't price in. The fitness app's promise is "fill in a scorecard, your handicap updates." With the queue: POST returns 200, the handicap index is stale until pg_cron fires, and if the Edge Function is broken (it's a hand-maintained Deno mirror of handicap-core — the repo's *documented* drift hazard) rounds accept forever while handicaps silently freeze. An API contract needs to state this eventual consistency explicitly, and queue-lag/failure alerting becomes part of the API's SLA whether you like it or not. Nothing in the trigger list covers "queue processor drifted/broke."

## 6. The extraction plan has no teeth

`apps/web/server/services/scorecard/` with injected deps and zero framework imports is the right shape — but nothing enforces it. Inside apps/web, imports of `env.ts`, `next/headers`, Sentry, or the tRPC error types will creep back in within months, because the boundary is a convention, not a compiler error. The repo already contains the proof that "promote to a package later" doesn't happen under pressure: `supabase/functions/handicap-shared` is the hand-maintained mirror everyone agreed was temporary. If Option A ships without (a) an ESLint boundary rule (no `next/*`, no `@/env`, no tRPC imports under `server/services/scorecard/`) and (b) a dated commitment or trigger for the `packages/db` extraction, assume the split option quietly dies and the "later re-host is a DNS change" claim becomes fiction — DNS moves the host, not the 700 lines re-fused to Next.js.

## 7. Trigger list: lagging, unmeasurable, and incomplete

- "API-attributable Vercel cost > $50-100/mo" is unmeasurable when API and web share one project and one bill — the trigger can never cleanly fire.
- "Third-party consumer needing an independent SLA" fires *after* you've signed them — the split then happens under contract pressure, the worst time.
- Missing triggers: security incident requiring token revocation/audit at the API layer (no API-key/PAT story exists; Supabase access tokens are short-lived and awkward for server-to-server use); Supabase OAuth server beta regressing or changing before GA; the queue processor drift incident above.

## 8. Smaller sharp edges

- `sendAdminSubmissionNotification` is **awaited** in the request path (round.ts:997). A slow Resend call adds seconds to every submission that creates a pending course/tee — fine for a browser, ugly for an API p95 SLO the triggers claim to care about.
- "If the fitness app shares the same Supabase project, no OAuth work is needed" is a lock-in decision dressed as a shortcut: it permanently entangles two products' auth, user tables, and RLS. Cheap for consumer #1, expensive to unwind before consumer #2. Decide it explicitly.

## Must address before locking the decision

1. Prove the challenge bypass with a cookie-less curl against prod, and stand up synthetic monitoring for it.
2. Confirm the Vercel plan and its commercial-use/limit implications.
3. Reclassify DB-side free-tier constraint + idempotency design as launch blockers for public writes (the delete-on-race path is exploitable and non-atomic).
4. Add an enforced import boundary (lint rule) on the extracted service, or the later-split option is theater.
5. Price eventual consistency into the API contract and add queue-lag/failure alerting to the launch checklist.
