# Blue Hat Review — hosting-stack-decision

Perspective: process control. Was this the right question, was the method sound, and what should the decision process be?

Verdict: **agree**, with process conditions that must be resolved before the decision is locked.

## 1. The research corrected its own question — that is the strongest thing about it

The topic as posed was loaded: "serverless timeout limits vs the transactional handicap-recalc write" presupposes the recalc runs in the request path. The research went to the codebase, found the recalc is already asynchronous (DB trigger in `supabase/migrations/20251207150152_replace_handicap_trigger.sql` → `handicap_calculation_queue` → pg_cron-driven `process-handicap-queue` edge function), and answered the *corrected* question instead of the one asked. Falsifying your own premise with primary evidence is exactly the right move, and it collapses the hardest-sounding part of the topic to a non-issue.

I independently spot-checked the load-bearing repo claims and all held:

- Migration `20251207150152` exists; `supabase/functions/process-handicap-queue` exists.
- `supabase/functions/handicap-shared` exists — the cautionary Deno-mirror tale is real, not rhetorical.
- `apps/web/db/index.ts:7` is `postgres(url, { prepare: false })` with **no explicit `max`** — the implicit-default gap is accurately reported.
- `submitScorecard` starts at `apps/web/server/api/routers/round.ts:303`; the delete-on-race compensation is at ~949 and (worth noting) re-checks the count via the Supabase REST API *outside* the Drizzle transaction — the "not retry-safe" claim is if anything understated.
- `apps/web/app/api/ai/extract-scorecard/route.ts` exists as the claimed worked example.

Sources are dated and primary (Vercel changelog dates, Supabase OAuth beta 2025-11-26, discussion #40671 Mar 2026). Method quality: high.

## 2. Process flaw: "confidence high" while decision-changing inputs sit in Open Questions

Two open questions are not footnotes — they are inputs that change the shape of the decision, and the process should force them to be answered *before* the recommendation is locked, not after:

1. **Does the fitness app share the Supabase project/auth?** If yes, consumer #1 needs zero OAuth work and the launch surface shrinks dramatically; if no, an auth-issuance workstream appears that this research explicitly did not scope. This is the single highest-leverage unknown and it costs the owner one minute to answer. It should have been asked before research, not left open after.
2. **Can the Cloudflare/Vercel challenge be bypassed for the API host/path?** This is a hard external gate on *every* option (A through D all serve non-browser clients through the same front door). It is verifiable today with a dashboard check plus a cookie-less curl. Until verified, "stay on the current stack" is conditionally correct at best.

The Vercel plan question (Hobby vs Pro) is lower stakes given the >100x margin, but should be recorded with the decision.

Recommendation-level confidence should be stated as: high *conditional on* bypass feasibility; the recommendation itself does not change with the fitness-app answer, but the launch plan does.

## 3. The topic bundles three decisions with very different reversibility — rigor was spent on the most reversible one

- **(a) Where the code runs** — cheaply reversible, *especially* after the research's own insurance (api.<domain>, extracted service). Most of the research's depth went here.
- **(b) Where the seam lives** — moderately reversible; the services-now/package-later sequencing is sound and honest about the packages/db prerequisite.
- **(c) The public /v1 contract** — versioning, error shapes, Idempotency-Key semantics, auth token model. This is the *least* reversible decision (a consumer integration freezes it) and it got one paragraph.

The process implication: hosting was arguably never the highest-stakes question. Before any consumer integrates, the contract deserves its own decision gate (even a lightweight one) — otherwise the team will design /v1 ad hoc inside an implementation PR, which is exactly where irreversible mistakes get made casually.

## 4. The trigger list is good governance only if it is instrumented

"Stay until X happens" is the right pattern — it converts a prediction into a monitoring process. But as written, several triggers have no measurement plumbing:

- "API-attributable Vercel cost > $50-100/mo" — Vercel does not break out cost per route by default; this needs a proxy (invocation counts on /api/v1/* or a tagged project) defined now.
- "p95 latency SLO broken" — no SLO exists yet; pick the number when /v1 ships or the trigger is unfalsifiable.
- "recurring Supavisor client-connection exhaustion" — needs the Supabase alert set up (the research itself flags this in open questions; it should be a launch-checklist item, not a question).

A trigger list nobody owns or measures is a comfort blanket. Assign each trigger a metric, a threshold, and a review moment (e.g., revisit at first third-party inquiry and quarterly).

## 5. Options analysis: fair field, honest kills

B, C, and D were rejected for reasons grounded in verifiable facts (extraction prerequisite for B, the existing handicap-shared mirror tax for C, the archived-upstream lineage for D) rather than strawmen. No missing option of consequence — "do nothing / keep tRPC-only and have the fitness app link out" was implicitly excluded by the goal statement, which is legitimate.

## Required before locking the decision

1. Answer the fitness-app Supabase-project question (owner, one minute). It sets the entire launch scope for consumer #1.
2. Verify the Cloudflare/Vercel bypass with a cookie-less curl against a scoped rule — before any implementation work is scheduled, since every option depends on it.
3. Schedule a contract-design gate for /v1 (versioning, error envelope, Idempotency-Key semantics, free-tier limit enforcement server-side) separate from the hosting decision.
4. Instrument the trigger list: metric + threshold + owner per trigger; set the Supavisor connection alert and explicit `max` on postgres-js at launch.

With those conditions attached, the recommendation is sound and the process that produced it was better than the question it was given.
