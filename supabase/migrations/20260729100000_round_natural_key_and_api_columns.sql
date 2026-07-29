-- =============================================================================
-- Migration: API-platform bundled `round` changes (subplan 003 / W3, DECISIONS #9)
--
-- ONE migration carrying five coupled changes to public.round, plus the
-- column-privilege hardening they require:
--
--   1. STRICT natural-key unique constraint on
--      ("userId", "teeId", "teeTime", nine_hole_section), NULLS NOT DISTINCT.
--      The prod duplicate scan (2026-07-29, run against a prod DUMP per the
--      Ballerud lesson) was CLEAN: zero collisions under both candidate keys
--      and every teeTime is a real minute-precision wall-clock timestamp, so
--      the strict key applies directly — no cleanup/dedup step needed.
--      NULLS NOT DISTINCT (PG15+ — run `select version()` BEFORE applying to
--      prod) is required because 18-hole rounds store
--      nine_hole_section = NULL: with default NULLS DISTINCT two identical
--      18-hole rounds would never collide and the index would only protect
--      9-hole rounds. Legitimate front/back 9-hole pairs at the same teeTime
--      still coexist because their sections differ.
--
--   2. "externalId" text NULL + UNIQUE("userId", "externalId") — the
--      client-supplied idempotency key (DECISIONS #6, externalId-primary,
--      replay-by-lookup; subplan 005's POST /v1/rounds implements the replay).
--      NULLS DISTINCT (default) is intentional: web/native rows carry NULL.
--
--   3. "submitted_via" text NULL — attribution/analytics ONLY (self-reported;
--      no client registry yet). NULL = pre-column legacy row; day one the
--      API path writes effectively 'api:fitness'.
--
--   4. "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
--      maintained by a BEFORE UPDATE trigger so every write path (web,
--      native, watch, PostgREST, /v1 API) bumps it. timestamptz — not naive
--      timestamp — because the column's stated purpose is a future sync
--      cursor. Keeps the retrofit cheap; the cursor endpoint itself remains
--      declined (two-way-sync #7). Existing rows backfill to the migration
--      timestamp.
--
--   5. "quarantined" boolean NOT NULL DEFAULT false — the accept-and-quarantine
--      flag (billing gate CLOSED): an over-limit API round is stored with
--      quarantined = true, excluded from the free-tier count and from the
--      handicap computation, and unlocked on upgrade. Written by subplan 002
--      Part B's in-transaction check; this migration provides the column and
--      hardens who may write it (6/6b below).
--      NOTE: `approvalStatus` is course-data moderation — a different axis —
--      and is deliberately NOT overloaded.
--
--   6. COLUMN-PRIVILEGE HARDENING (verified over PostgREST). The permissive
--      "Users can update their own rounds" RLS policy plus the table-level
--      UPDATE grant let an authenticated user PATCH ANY column of their own
--      rows — including `quarantined` (billing bypass once Part B ships) and
--      `approvalStatus` (a live pre-existing hole: self-approving rounds into
--      the handicap computation past moderation). This migration closes both.
--
-- New columns inherit round's existing RLS policies unchanged.
--
-- PROD APPLY (by hand — the migrate workflow is broken; see 003-notes.md):
--   * `select version();` first — NULLS NOT DISTINCT requires PG >= 15.
--   * Apply transactionally (`psql -1` or `supabase db push`) so a partial
--     run can never leave columns without their constraints or grants.
--   * Post-deploy: verify the DDL via a prod DUMP, not migration history
--     (shot-level-stats lesson: phantom "applied" row, DDL never ran).
-- =============================================================================

-- Fail fast instead of queueing behind long-running transactions: the ALTER
-- TABLE statements here take ACCESS EXCLUSIVE locks. `set local` scopes this
-- to the migration transaction (supabase CLI and `psql -1` both wrap this
-- file in one transaction).
set local lock_timeout = '5s';

-- 2/3/4/5: the four new columns.
alter table public.round
  add column if not exists "externalId" text,
  add column if not exists "submitted_via" text,
  add column if not exists "updated_at" timestamptz not null default CURRENT_TIMESTAMP,
  add column if not exists "quarantined" boolean not null default false;

comment on column public.round."externalId" is
  'Client-supplied idempotency key, unique per user (DECISIONS #6, replay-by-lookup). NULL = submitted without a key (web/native today).';
comment on column public.round."submitted_via" is
  'Self-reported submission attribution, analytics only (no client registry yet). NULL = row predates this column.';
comment on column public.round."updated_at" is
  'Last modification time (timestamptz), maintained by trigger round_set_updated_at. Added so a future sync-cursor retrofit stays cheap (the cursor endpoint itself is declined).';
comment on column public.round."quarantined" is
  'Accept-and-quarantine flag (closed billing gate): TRUE = stored over-limit round, excluded from the free-tier count and the handicap computation until upgrade. Distinct axis from approvalStatus (course-data moderation). Only service paths may write it (column-privilege hardening in this migration).';

-- 1: strict natural-key unique constraint (scan was clean — applied directly).
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS; the DO block swallows
-- duplicate_object so a re-run is safe — same idiom as
-- 20260501001627_add_round_nine_hole_section.sql.
do $$
begin
  alter table public.round
    add constraint "round_userId_teeId_teeTime_nineHoleSection_key"
    unique nulls not distinct ("userId", "teeId", "teeTime", "nine_hole_section");
exception
  when duplicate_object then null;
end
$$;

comment on constraint "round_userId_teeId_teeTime_nineHoleSection_key" on public.round is
  'Natural-key duplicate guard for every write path (web/native/watch/API). NULLS NOT DISTINCT so 18-hole rounds (nine_hole_section NULL) collide too; front/back 9-hole pairs at the same teeTime remain distinct.';

-- 2: idempotency key uniqueness (per user; NULLs remain distinct by default).
do $$
begin
  alter table public.round
    add constraint "round_userId_externalId_key"
    unique ("userId", "externalId");
exception
  when duplicate_object then null;
end
$$;

-- 4: updated_at trigger — fires on every UPDATE regardless of the write path.
create or replace function public.set_round_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := CURRENT_TIMESTAMP;
  return new;
end;
$$;

revoke execute on function public.set_round_updated_at() from public, anon, authenticated;

drop trigger if exists round_set_updated_at on public.round;
create trigger round_set_updated_at
  before update on public.round
  for each row
  execute function public.set_round_updated_at();

-- 6: column-privilege hardening for UPDATE over PostgREST.
--
-- IMPORTANT: the table-level revoke is what makes the column list effective —
-- Postgres allows an UPDATE if EITHER the table-level OR a column-level
-- privilege matches, so `revoke update ("quarantined")` alone would be a
-- NO-OP while the table-level grant exists.
--
-- The grant below intentionally EXCLUDES: "quarantined" (billing state —
-- service paths only), "approvalStatus" (moderation — closes the pre-existing
-- self-approval hole), "externalId" (idempotency keys are immutable),
-- "submitted_via" (attribution is write-once by the server), "updated_at"
-- (trigger-maintained), "userId", "id", "createdAt".
--
-- First-party server writes go through Drizzle as the `postgres` table owner
-- and are unaffected; `service_role` retains its own grants. FAIL-SAFE BY
-- DESIGN: any future round column is NOT updatable by `authenticated` until
-- this grant is explicitly extended in a migration.
revoke update on public.round from authenticated, anon;
grant update (
  "courseId",
  "teeId",
  "teeTime",
  "totalStrokes",
  "parPlayed",
  "adjustedGrossScore",
  "adjustedPlayedScore",
  "courseHandicap",
  "scoreDifferential",
  "existingHandicapIndex",
  "updatedHandicapIndex",
  "exceptionalScoreAdjustment",
  notes,
  course_rating_used,
  slope_rating_used,
  holes_played,
  nine_hole_section
) on public.round to authenticated;

-- 6b: column privileges do NOT constrain INSERT payload values (verified: an
-- insert carrying quarantined = true, or approvalStatus = 'approved',
-- succeeds under the grants above). Without this policy the self-approval
-- hole closed on UPDATE stays wide open on INSERT: a user submits their own
-- course/tee with invented ratings and POSTs a pre-approved round against it
-- directly to PostgREST, which then matches the handicap-processor filter
-- (approvalStatus = 'approved' AND quarantined = false) having never passed
-- moderation. Verified end-to-end: 201 with a -21.9 score differential
-- against an unmoderated tee rated 99.9/155.
--
-- ONE restrictive policy covers both columns. An authenticated INSERT may
-- only create a non-quarantined, non-approved (i.e. pending) round; the
-- `approvalStatus` default is already 'pending'.
--
-- Safe for first-party writes: `submitScorecard` runs through Drizzle as the
-- `postgres` table owner, which bypasses RLS entirely. Its moderation
-- invariant is independent and unchanged — `resolvedApprovalStatus` is forced
-- to 'pending' on every new/edited/pending-tee branch, so a client-supplied
-- "approved" can only survive when the tee resolves to an existing APPROVED,
-- non-archived row (otherwise CourseResolutionError). Service paths
-- (002 Part B, the moderation approval flow) likewise bypass RLS.
drop policy if exists "Users cannot self-approve or quarantine rounds" on public.round;
create policy "Users cannot self-approve or quarantine rounds"
  on public.round
  as restrictive
  for insert
  to authenticated
  with check (quarantined = false and "approvalStatus" <> 'approved');
