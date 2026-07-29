# 003 — W3 workstream notes (bundled migration)

**Date:** 2026-07-29 · **Migration:** `supabase/migrations/20260729100000_round_natural_key_and_api_columns.sql`

## Prod duplicate scan (C2) — result

Run against a production **dump** via the session pooler (not migration history — Ballerud
lesson; not direct IPv6). Result: **CLEAN.**

- Collisions under `(userId, teeTime)`: **0**
- Collisions under `(userId, teeId, teeTime, nine_hole_section)`: **0**
- `teeTime` distribution: all values are real **minute-precision wall-clock timestamps** —
  no date-only-midnight rows exist in prod (no fitness-app backfill has happened yet).

## Natural key + teeTime window (C2/C6) — specification

- Key: **strict** `UNIQUE NULLS NOT DISTINCT ("userId", "teeId", "teeTime", nine_hole_section)`,
  applied directly with **no cleanup/dedup step** (scan was clean).
- `NULLS NOT DISTINCT` because 18-hole rounds store `nine_hole_section = NULL`; with the
  Postgres default two identical 18-hole rounds would never collide. Front/back 9-hole pairs
  at the same `teeTime` remain distinct (C2's false-409 hazard).
- `teeTime` semantics pinned: minute-precision wall-clock timestamp (what web/native already
  write). **No sanity window is enforced in the key** (C6): historical fitness-app backfill of
  date-only rounds is legitimate and must not be blocked. If a backfill source emits date-only
  midnight timestamps, two same-day 18-hole rounds on the same tee would collide on the natural
  key — the **externalId idempotency key is the primary dedupe** for that path (DECISIONS #6),
  and 005's replay/conflict semantics (below) make the collision non-destructive.

## Idempotency (DECISIONS #6)

`"externalId" text NULL` + `UNIQUE("userId", "externalId")` (NULLS DISTINCT — web/native rows
carry NULL). Replay-by-lookup; 005's `POST /v1/rounds` implements the replay.

## Identical-body duplicate semantics (sub-decision) — DECIDED

- **Same `(userId, externalId)`, identical body → `200` with the existing round**
  (Terra/Stripe-success style; a retrying background-sync client must converge, not error).
- **Same `externalId`, different body → `409`** (RFC 9457; the client has a bug or reused a key).
- **Natural-key collision without an externalId match → `409`** with a problem body that
  includes the existing round's id (same-key-different-body is a real conflict; reserve 409
  for it).
- 005 encodes these in the `/v1` error mapper + OpenAPI; this file is the source for that
  encoding.

## Soft-delete vs append-only for `round` — DECIDED on paper

**Keep hard-delete for v1.** Rationale:

- The v1 sync contract (006) is **full-snapshot polling** — consumers refetch the complete
  rounds list, so a deleted round disappears from the snapshot and cannot sit next to a
  mismatched index, **provided** the convergence set is honored: on app-open/foreground a
  consumer refetches **profile AND the rounds list together** (two-way-sync condition 6).
- Append-only is rejected: users legitimately delete mistaken rounds, and GDPR erasure
  requires hard deletion anyway.
- `updated_at` (added in this migration, trigger-maintained) keeps the retrofit cheap: if an
  incremental cursor endpoint is ever reopened, adding `deleted_at` (soft-delete tombstones)
  becomes a prerequisite **at that time** — no consumer may build against hard-deletes plus a
  cursor. This does not reopen the cursor endpoint (declined, two-way-sync #7).

## `submitted_via` (billing-and-metering #4)

Nullable text, **analytics/attribution only** (self-reported; no client registry). NULL = row
predates the column. Day one the API path writes effectively `api:fitness`. No `api_clients`
registry until a real third-party consumer exists.

## `quarantined` (billing gate — CLOSED)

`boolean NOT NULL DEFAULT false`. Written by 002 Part B's in-transaction check (not in this
subplan). Excluded in this subplan from **every counting/handicap site**:

- free-tier count: `apps/web/utils/billing/access-control.ts` (`.eq("quarantined", false)`)
- billing-facing round count: `round.getCountByUserId`
  (`apps/web/server/api/routers/round.ts`) — native consumes it as its quota gate
  (profile screen, rounds/add, live setup) and the web homepage as totalRounds
- the post-commit race re-check in
  `apps/web/server/services/scorecard/submit-scorecard.ts` (must count the same population
  as the primary gate, or a divergence deletes a legitimate committed round)
- handicap computation: `supabase/functions/process-handicap-queue/index.ts` rounds fetch,
  the established-handicap count inside `submit-scorecard.ts`, and its second copy in
  `scorecard.getScorecardByRoundId` (`apps/web/server/api/routers/scorecard.ts`).

`approvalStatus` (course-data moderation) is a different axis and was not overloaded.

## Column-privilege hardening (review fix round — IN the migration)

The review's security pass verified over PostgREST that the permissive "Users can update
their own rounds" policy + the table-level UPDATE grant let an authenticated user PATCH any
column of their own rows — including `quarantined` (future billing bypass) and
`approvalStatus` (a **live pre-existing hole**: self-approving rounds into the handicap
computation past moderation). The migration now:

- revokes table-level UPDATE from `authenticated`/`anon` and re-grants **per column**
  (gameplay/rating columns + notes only). A bare `REVOKE UPDATE (col)` is a NO-OP while a
  table-level grant exists — Postgres checks table OR column privilege. Excluded:
  `quarantined`, `approvalStatus`, `externalId`, `submitted_via`, `updated_at`, `userId`,
  `id`, `createdAt`. Fail-safe: future columns are non-updatable by `authenticated` until
  the grant is extended in a migration.
- adds a RESTRICTIVE INSERT policy (`quarantined = false`) because column privileges do not
  constrain INSERT payloads (verified: an insert carrying `quarantined: true` succeeded
  under grants alone).
- Integration-tested as a real signed-in user: PATCH `quarantined`/`approvalStatus`/
  `externalId` → 42501; legitimate notes/strokes PATCH → 200 (and the `updated_at` trigger
  fires); INSERT with `quarantined: true` → 42501; normal INSERT → OK.

First-party server writes are unaffected (Drizzle connects as the `postgres` table owner);
`service_role` keeps its own grants.

## Duplicate-submission surfacing (review fix round)

A double submit (double-click, watch sync replay, native offline retry) previously leaked
the raw Postgres constraint message to the UI banner. The service now maps 23505 on either
round dedupe key to a typed `DuplicateRoundError` (natural-key vs external-id), and the
tRPC adapter maps it to `CONFLICT` with user-facing copy. 005's REST adapter reuses the
same error per the duplicate semantics above (identical-body → 200-replay; the CONFLICT
maps the same-key-different-body 409 arm).

## Prod apply checklist (migrate workflow is broken — this runs BY HAND)

1. `select version();` — NULLS NOT DISTINCT requires PG **>= 15** (local 15.x governs local
   only; confirm prod).
2. Apply **transactionally** (`psql -1` or `supabase db push`) so a partial run can never
   leave columns without constraints/grants. The file's `set local lock_timeout = '5s'`
   only takes effect inside a transaction (the CLI warns 25P01 and no-ops it when applying
   non-transactionally — another reason `psql -1` is required).
3. Both ADD CONSTRAINTs and the CREATE POLICY are wrapped in `duplicate_object`-swallowing
   DO blocks, so a re-run is safe.
4. Post-deploy: verify the DDL via a prod **dump** (information_schema /
   `pg_constraint` / `pg_policy` over the session pooler), not migration history —
   shot-level-stats lesson. Verified locally against the live local DB on 2026-07-29
   (columns incl. `updated_at timestamptz`, both constraints, trigger, 17-column UPDATE
   grant, restrictive INSERT policy).

## Open items / risks carried forward

- **Quarantined rounds still SURFACE in the UI** — round lists and stats
  (`round.getAllByUserId`, `scorecard.getAllScorecardsByUserId`, homepage `influencesHcp`
  labeling) do not filter or badge `quarantined = true` rows. They no longer count toward
  quota or handicap, but a quarantined round renders like any other. Hide-vs-badge is a
  **002 Part B decision** (deliberately not made here).
- **`updated_at` churn vs a future sync cursor (006 must know):**
  `process_handicap_updates` rewrites `updatedHandicapIndex` across a user's whole round
  history on every recompute, so the trigger mass-bumps `updated_at` on all those rows
  after each submission. Any 006 cursor built on `updated_at` will therefore full-re-sync a
  user's history per submission — fine for polling-snapshot v1, but a real cursor needs
  either a separate column or trigger suppression for the recompute path.
- **No DB-level free-tier quota enforcement:** a direct PostgREST INSERT bypasses the tRPC
  limit check entirely (verified 201 as an authenticated user). The free-tier limit is
  application-layer only today. Explicit open item for 002 Part B / 008 (launch gates) —
  recorded as fact, not assumption.
- **`submitted_via` spoofing** remains acceptable-by-design (attribution only, and now not
  even updatable post-insert by `authenticated`).
