# White Hat Review — hosting-stack-decision

**Perspective:** facts and information only. What does the evidence establish, what is assumed, what is still obtainable.
**Verdict:** agree (the recommendation rests on claims that check out; remaining gaps are obtainable data, and none of them, at their worst plausible value, reverses the conclusion — except the latency estimate, which must be measured, not modeled).

## Claims verified directly in the repo (this review re-checked each)

| Claim | Evidence | Status |
|---|---|---|
| Heavy handicap recalc is already async, off-Vercel | `supabase/migrations/20251207150152_replace_handicap_trigger.sql` creates `AFTER INSERT OR UPDATE OR DELETE ON public.round` trigger inserting into `handicap_calculation_queue`; `supabase/functions/process-handicap-queue/` exists; companion migrations `…150153_schedule_queue_processor.sql`, `…194500_update_cron_setup.sql` wire pg_cron | VERIFIED |
| `submitScorecard` at round.ts:303, file is 1117 lines | `apps/web/server/api/routers/round.ts:303`; `wc -l` = 1117 | VERIFIED |
| Delete-on-race free-tier compensation exists post-transaction | round.ts ~949+: re-checks count for `access.plan === "free"`, logs "Race condition detected: rolling back over-limit round", deletes | VERIFIED — and it is indeed not retry-safe as stated |
| Bearer auth with RLS scoping exists | `apps/web/server/api/trpc.ts`: `extractBearerToken`, `getUserFromBearerToken`, `createBearerTokenSupabaseClient`; cookie-first, bearer fallback | VERIFIED |
| A worked route-handler example exists (auth + billing gate + rate limit + zod) | `apps/web/app/api/ai/extract-scorecard/route.ts`: `getComprehensiveUserAccess`, `aiExtractionRateLimit`, `extractionResponseSchema.parse` | VERIFIED |
| Pooling config: `prepare: false`, implicit `max` | `apps/web/db/index.ts:7` — `postgres(process.env.DATABASE_URL!, { prepare: false })`; no `max:` anywhere in the file | VERIFIED (the "set max explicitly" gap is real) |
| Deno mirror cautionary tale | `supabase/functions/handicap-shared/` exists alongside `packages/handicap-core` | VERIFIED |
| `packages/db` does not exist; Drizzle schema is app-local | `packages/` = analytics, billing-core, handicap-core, tokens; schema under `apps/web/db/` | VERIFIED — the seam-sequencing premise (service first, package after `packages/db`) is factually grounded |
| Cloudflare/Vercel 429-HTML challenge on cookie-less prod requests | Established in a prior session (memory: vercel-challenge-mode-breaks-trpc); not re-tested in this review | PREVIOUSLY OBSERVED, not re-verified today |

## External claims: cited, not independently re-fetched

The research file dates its external claims and links primary sources (Vercel changelog 2025-06-25 + fluid docs retrieved 2026-07-20; Drizzle/Supabase pooling guides; Supabase OAuth 2.1 beta blog 2025-11-26; discussion #40671; trpc-to-openapi provenance). This is the correct evidentiary form. This review did not re-fetch them; they are recent (retrieved on the research date) and none is load-bearing enough to flip the verdict if slightly stale — the timeout conclusion survives even at the lowest plan ceiling (300 s).

## What is assumed, not established

1. **The ~50–300 ms transaction figure is a model, not a measurement.** research.md line 24 derives it: 15–30 round-trips × 2–10 ms, *assuming a same-region function*. Two facts undermine the assumption's verifiability:
   - `apps/web/vercel.json` contains **no region config** (only install/build commands and one cron). Vercel's default function region is US-East unless set in the dashboard.
   - The pooler host cited is `aws-0-eu-west-2.pooler.supabase.com`. If functions run in the default US region against an eu-west-2 database, per-round-trip latency is ~70–90 ms, and 15–30 sequential round-trips becomes **~1–3 s**, not 50–300 ms. Still 100x inside a 300 s window (the timeout conclusion is safe), but the latency characterization and any p95 SLO reasoning would be materially different.
   - **Obtainable:** Sentry traces are sampled at 100% in prod (commit e6632f8). The real `submitScorecard` duration distribution can be read today, and the function region from the Vercel dashboard. No new instrumentation needed.
2. **Prod runtime `DATABASE_URL` = transaction pooler :6543** rests on a *commented-out line in `apps/web/.env`* (research.md line 33). The live value is a Vercel env var, not in the repo. Consistent with `prepare: false`, so probably true — but "probably" is the right word. Obtainable from the Vercel dashboard in one minute. (Note: project memory records that *migrations* deliberately use the session pooler due to IPv6 — evidence that more than one connection string is in circulation for this project, so the assumption deserves the check.)
3. **Vercel plan (Hobby vs Pro)** — acknowledged open question. The presence of a daily cron in vercel.json doesn't discriminate (Hobby allows daily crons). The recommendation is insensitive to this (300 s floor suffices), but the trigger list's cost figures presume Pro-style pricing.
4. **Fitness app shares the same Supabase project** — unknown, yet it is the single largest determinant of launch scope (zero OAuth work vs OAuth beta dependency). The developer is the same person; this is a one-question data point, not research.
5. **Cloudflare bypass scoping feasibility** — asserted as dashboard-fixable, never demonstrated. The claim is testable in minutes (create rule, cookie-less `curl`), and it is a launch blocker, so it should move from assumed to observed before any consumer work is scheduled.
6. **`50–300 ms` aside, the "15–30 queries" count itself** was derived by reading round.ts:354–947 branch paths — this review spot-checked the structure (single transaction, single-row operations, bounded loops) and found the characterization consistent with the code.

## Information still obtainable that would close every gap

- Sentry p50/p95 for `round.submitScorecard` in prod (exists today, 100% sampling).
- Vercel dashboard: plan tier, function region, live `DATABASE_URL`, challenge-mode bypass rule capability.
- Supabase dashboard: compute tier → Supavisor client-connection ceiling (for the alert the research proposes).
- One question to the owner: does the fitness app use the same Supabase project?

## Net factual position

The decisive claim — "the heavy recalc is already asynchronous and off-Vercel, so the serverless-timeout framing was a false premise" — is verified in the migrations and functions directories, not inferred. The seam-placement reasoning rests on verified repo facts (no `packages/db`, app-coupled imports at round.ts:1–32, the handicap-shared mirror). The identified weaknesses are all in *quantitative* claims (transaction latency, pooler identity, plan ceiling), all of which are obtainable from existing dashboards/telemetry without further research, and only the latency figure could change any downstream decision (SLO framing, not hosting choice).
