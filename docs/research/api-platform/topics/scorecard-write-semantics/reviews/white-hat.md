# White Hat Review — scorecard-write-semantics

Role: facts and information only. Each claim in the research was checked against the repo where checkable. No opinions on the recommendation beyond whether the evidence supports it.

## Claims VERIFIED in the codebase

| Claim | Verified at | Status |
|---|---|---|
| `round` table has NO unique constraint (only PK + `idx_round_userId` + FKs) | `apps/web/db/schema.ts` (`export const round = pgTable`, table extras block) | CONFIRMED — any retry inserts a duplicate row |
| Course unique index `(name, country, city)` exists but matching is by name only | `apps/web/db/schema.ts:122` (`course_name_country_city_key`) vs `apps/web/server/api/routers/round.ts:370` (`eq(course.name, coursePlayed.name)` with `.limit(1)`, no country/city filter) | CONFIRMED — global name-only match |
| Handicap recalc is already async: AFTER trigger on `round` enqueues, edge function drains | `supabase/migrations/20251207150152_replace_handicap_trigger.sql:57-58` (`AFTER INSERT OR UPDATE OR DELETE ON public.round`), `supabase/functions/process-handicap-queue/index.ts:102` | CONFIRMED |
| Quarantine exists: timeline recompute consumes only approved rounds | `process-handicap-queue/index.ts:192` (`.eq("approvalStatus", "approved")`) | CONFIRMED |
| Free-tier race path does post-commit compensating deletes | `round.ts` (~949–992): re-counts via Supabase REST **outside** the transaction, then issues 5 separate `db.delete` calls (submissions, round, extra tees' holes, tee, course) | CONFIRMED — deletes are themselves non-transactional (sequential, not wrapped) |
| `hcpStrokes` is client-supplied and feeds the net-double-bogey cap | `apps/web/types/scorecard-input.ts:169` (`hcpStrokes: z.number().min(0).max(99)`), `packages/handicap-core/src/calculations.ts:344` (`par + 2 + score.hcpStrokes`) | CONFIRMED. Damage bound also confirmed: line 345 `Math.min(hole.par + 5, netDoubleBogey)` caps at par+5 |
| Server-side derivation function exists | `packages/handicap-core/src/calculations.ts:387` (`addHcpStrokesToScores`) — and the queue recompute already uses it (`timeline.ts:134`) | CONFIRMED — the authoritative async recompute already ignores client `hcpStrokes`; only the synchronous per-round figures trust it |
| `strokes >= 1` enforced nowhere; zod floor is 0 | `scorecard-input.ts:168` (`strokes: z.number().min(0).max(99)`) | CONFIRMED |
| putts+penalties ≤ strokes−1 is UI-only | `apps/web/lib/scorecard/hole-detail.ts:40-55` (stepper caps, not schema validation) | CONFIRMED — schema allows `putts` ≤ 20 and `penaltyStrokes` ≤ 10 independent of `strokes` |
| Auto-create path can spawn pending course + tees + hole rows + admin email per submission | `round.ts:378-397` (course insert), post-commit `sendAdminSubmissionNotification` | CONFIRMED |
| userId spoofing blocked; plan gating precedes transaction | `round.ts:317-323` (FORBIDDEN on mismatch), `round.ts:331-350` | CONFIRMED |

## One nuance the summary compresses

"Even the trusted web client lives with an eventually-consistent handicap index" is true for the **authoritative timeline recompute**, but the synchronous transaction does compute and return a provisional `updatedHandicapIndex` per round (NOT NULL column, filled in-transaction). So the sync 201 response is not empty-handed — it can carry the provisional figure. This strengthens, not weakens, the `handicapRevision: "pending"` design, but the API doc must say the returned index is provisional, since a queue drain can revise it.

## Claims NOT verifiable from this repo (taken from external research)

- Strava/Garmin/Terra dedupe semantics (natural/source-ID upsert, at-least-once) — as summarized, "checked July 2026", not re-verified here.
- Stripe Idempotency-Key persisted-replay internals (Brandur account) — widely documented, not re-verified.
- IETF Idempotency-Key draft -07 expiring April 2026 without RFC status — not re-verified.
- GHIN being catalog-only for integrators — not re-verified.

None of these are load-bearing for the schema/transaction facts; they inform pattern choice only.

## Data that is missing and still obtainable

1. **Duplicate scan before the unique index.** Adding `UNIQUE(userId, teeId, teeTime)` fails if prod already contains violating rows. One query against prod (session pooler, per memory note) answers this and also answers the open question of `(userId, teeTime)` vs `(userId, teeId, teeTime)` — count how many same-user-same-teeTime pairs differ only by tee.
2. **hcpStrokes parity check.** `addHcpStrokesToScores` already exists and runs in the queue path; replaying it against historical rounds' stored client values is a runnable script, not a judgment call. This resolves the "server-derive vs trust client" open question with data.
3. **Retry-window telemetry.** The 24h-vs-7d key retention question is decidable from Sentry/PostHog data on native-app offline submission delays once instrumented; currently no data exists either way.
4. **Cloudflare challenge status.** The prod 429 Security Checkpoint on cookie-less requests (known gotcha) will hit this API's consumers identically; whether a bypass rule is already configured is checkable in the Vercel/Cloudflare dashboards and is a hard precondition to any of this working in prod.

## Factual assessment of the rejected options

- Upstash rejection rests on a correct fact: Redis SETNX cannot be atomic with the Postgres round insert; the codebase's own free-tier race path (round.ts:949) is an existing demonstration of what non-atomic cross-store coordination costs here.
- 202-async rejection rests on the verified fact that the expensive work is already off the request path; the transaction's remaining work is arithmetic + inserts.

## Verdict

The evidence supports the recommendation. Every codebase-level premise checked out at the cited locations; the external prior-art claims are unverified here but non-load-bearing. The gaps are obtainable data (items 1–4 above), not unknowable unknowns, and two of them (duplicate scan, parity check) should be run before the migration is written because their results can change the natural-key definition and the hcpStrokes cutover plan.
