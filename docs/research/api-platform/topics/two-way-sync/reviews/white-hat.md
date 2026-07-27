# White Hat Review — two-way-sync

Perspective: facts and information only. What does the evidence establish, what is assumed, what is still obtainable.

Verdict: **agree** (the factual foundation of the recommendation is sound; the remaining unknowns are external, not repo-internal).

## Claims verified directly against the repository

| Claim in research | Status | Evidence |
|---|---|---|
| Recalc is asynchronous; round inserted with pre-recalc index | VERIFIED | `apps/web/server/api/routers/round.ts` ~778: `existingHandicapIndex` and `updatedHandicapIndex` both set to the current `userProfile[0].handicapIndex` at insert time |
| pg_cron fires the queue processor every minute | VERIFIED | `supabase/migrations/20260502094814_search_path_handicap_queue_cron.sql`: `cron.schedule('process-handicap-queue', '* * * * *', ... net.http_post(...)` to the `process-handicap-queue` edge function |
| `process_handicap_updates` RPC updates `profile.handicapIndex` | VERIFIED | `supabase/migrations/20251207213412_add_process_handicap_updates_function.sql` lines 33–34 and 67–68: `UPDATE profile SET "handicapIndex" = ...` |
| `profile` is already in the realtime publication | VERIFIED | `supabase/migrations/20251107000000_enable_profile_realtime.sql`: `ALTER PUBLICATION supabase_realtime ADD TABLE profile;` |
| billing-sync.tsx runs the exact proposed pattern in prod | VERIFIED | `apps/web/components/billing-sync.tsx` lines 69–74: `postgres_changes` on `schema: "public", table: "profile", filter: id=eq.<userId>` |
| No `refetchInterval` anywhere in first-party app code | VERIFIED | grep over `apps/web/{app,components,hooks}` and `apps/native/{app,components}`: zero hits |
| `round` has no `updated_at`; a cursor endpoint needs schema work | VERIFIED | `apps/web/db/schema.ts` line 231ff: `round` has `createdAt` only; no `updatedAt`, no `deletedAt`/soft-delete column anywhere in schema.ts |
| Rounds are hard-deleted | VERIFIED (with nuance) | `round.ts` 971–983 issues `db.delete(round)` etc.; no soft-delete column exists. Nuance: those particular lines are rollback cleanup inside submit — but absence of any tombstone column makes the structural point (no cursor without schema work) hold regardless |
| Repo already runs trigger→queue→cron→pg_net twice, fire-and-forget | VERIFIED | `net.http_post` in the queue-cron migrations and `20260412120000_notify_round_approval_change.sql`; no delivery-status tracking anywhere |

## One factual refinement

"handicappin's own apps have no push for the handicap index" is true as stated, but slightly understated in the research's favor: billing-sync's subscription fires on **every** `profile` UPDATE for the user — including the recalc's `handicapIndex` update — it just refetches billing data. So the transport for Option B is not merely available; it is already firing in production on the exact event of interest. This strengthens, not weakens, the recommendation.

## Claims sourced externally but not independently re-verified here

These rest on the research file's citations (24 URLs in `research.md`); they are plausible and cited but were not re-checked in this review:

- Supabase Realtime specifics: RLS-per-subscriber on `postgres_changes`, RLS **not** applied to DELETE events, single-threaded / ~3k-subscriber steering toward Broadcast.
- QStash pricing ($1/100k msgs) and Svix pricing cliff (free 50k/mo → $490/mo).
- Strava/Garmin/Terra webhook history and Standard Webhooks adoption list.

None of these is load-bearing for the v1 decision (they gate the deferred Option C build), so their verification can be deferred with it.

## Assumptions presented as facts (flagged, not disputed)

1. **"~60-90s" freshness floor is an inference, not a measurement.** Cron cadence (60s) is verified; actual end-to-end latency (queue pickup + edge-function runtime + RPC) has not been measured. Obtainable: query prod `handicap_calculation_queue` processed timestamps vs round `createdAt`, or edge-function logs.
2. **"Websocket sidesteps the Cloudflare wall"** is true by construction (socket goes to `*.supabase.co`) but has not been demonstrated from a non-browser client against prod. Obtainable in minutes with a test script.
3. **The fitness app has no backend** is explicitly an open question, and the entire A-vs-C fork pivots on it. This is the single cheapest, highest-leverage fact still missing — one question to the owner (who is the same developer).

## Data still obtainable before locking the decision

- Answer the fitness-backend question (asks the owner; zero cost).
- Measure real recalc latency in prod (validates the "polling every 15s for 2min" parameters).
- Confirm topic-2 auth direction — the Realtime accelerator is conditional on a Supabase JWT existing in the fitness app; the research states this dependency correctly but the dependency is unresolved.
- Spot-check the July 2026 Supabase Realtime DELETE/RLS behavior if `round` is ever added to the publication (currently only `profile` is published, so the leak concern is not yet live).

## Bottom line

Every repo-internal fact the recommendation leans on is real and was verified in this review. The recommendation's logic chain (async recalc → 60s floor → push cannot beat polling on freshness → polling contract + free Realtime accelerator) follows from verified facts. The unverified residue is (a) external pricing/doc claims that only matter for the deferred webhook build, and (b) three obtainable data points listed above, of which the fitness-backend question should be answered before v1 scope is locked.
