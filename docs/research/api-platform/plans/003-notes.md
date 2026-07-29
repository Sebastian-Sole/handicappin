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
subplan). Excluded in this subplan from **both counting sites**:

- free-tier count: `apps/web/utils/billing/access-control.ts` (`.eq("quarantined", false)`)
- handicap computation: `supabase/functions/process-handicap-queue/index.ts` rounds fetch,
  and the established-handicap count inside
  `apps/web/server/services/scorecard/submit-scorecard.ts`.

`approvalStatus` (course-data moderation) is a different axis and was not overloaded.

## Open items / risks carried forward

- **RLS hole to close before 002 Part B ships:** the permissive "Users can update their own
  rounds" policy lets an authenticated user set `quarantined = false` on their own row via
  PostgREST, un-quarantining an over-limit round without upgrading. Today the column is
  inert (nothing writes `true`), so nothing is exploitable; before Part B lands, add a
  guard (trigger or restrictive policy) so only service-role paths may flip `quarantined`.
  Same class of note for `externalId`/`submitted_via` spoofing — acceptable because both are
  attribution/idempotency, not authorization.
- **Post-deploy verification (DoD):** after this migration reaches prod, verify the DDL via a
  prod **dump** (`\d round` equivalent / information_schema against the session pooler), not
  migration history — shot-level-stats lesson. Verified locally against the live local DB on
  2026-07-29 (columns + both constraints + trigger present).
