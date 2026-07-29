-- =============================================================================
-- Migration: API-platform bundled `round` changes (subplan 003 / W3, DECISIONS #9)
--
-- ONE migration carrying five coupled changes to public.round:
--
--   1. STRICT natural-key unique constraint on
--      ("userId", "teeId", "teeTime", nine_hole_section), NULLS NOT DISTINCT.
--      The prod duplicate scan (2026-07-29, run against a prod DUMP per the
--      Ballerud lesson) was CLEAN: zero collisions under both candidate keys
--      and every teeTime is a real minute-precision wall-clock timestamp, so
--      the strict key applies directly — no cleanup/dedup step needed.
--      NULLS NOT DISTINCT (PG15+) is required because 18-hole rounds store
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
--   4. "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, maintained
--      by a BEFORE UPDATE trigger so every write path (web, native, watch,
--      PostgREST, /v1 API) bumps it. Keeps a future sync-cursor retrofit
--      cheap; the cursor endpoint itself remains declined (two-way-sync #7).
--      Existing rows backfill to the migration timestamp.
--
--   5. "quarantined" boolean NOT NULL DEFAULT false — the accept-and-quarantine
--      flag (billing gate CLOSED): an over-limit API round is stored with
--      quarantined = true, excluded from the free-tier count and from the
--      handicap computation, and unlocked on upgrade. Written by subplan 002
--      Part B's in-transaction check; this migration only provides the column
--      and updates the two counting sites (access-control + the handicap
--      queue processor) to exclude quarantined rows.
--      NOTE: `approvalStatus` is course-data moderation — a different axis —
--      and is deliberately NOT overloaded.
--
-- New columns inherit round's existing RLS policies unchanged.
-- Post-deploy: verify this DDL ran via a prod DUMP, not migration history
-- (shot-level-stats lesson: phantom "applied" row while the DDL never ran).
-- =============================================================================

-- 2/3/4/5: the four new columns.
alter table public.round
  add column if not exists "externalId" text,
  add column if not exists "submitted_via" text,
  add column if not exists "updated_at" timestamp not null default CURRENT_TIMESTAMP,
  add column if not exists "quarantined" boolean not null default false;

comment on column public.round."externalId" is
  'Client-supplied idempotency key, unique per user (DECISIONS #6, replay-by-lookup). NULL = submitted without a key (web/native today).';
comment on column public.round."submitted_via" is
  'Self-reported submission attribution, analytics only (no client registry yet). NULL = row predates this column.';
comment on column public.round."updated_at" is
  'Last modification time, maintained by trigger round_set_updated_at. Added so a future sync-cursor retrofit stays cheap (the cursor endpoint itself is declined).';
comment on column public.round."quarantined" is
  'Accept-and-quarantine flag (closed billing gate): TRUE = stored over-limit round, excluded from the free-tier count and the handicap computation until upgrade. Distinct axis from approvalStatus (course-data moderation).';

-- 1: strict natural-key unique constraint (scan was clean — applied directly).
alter table public.round
  add constraint "round_userId_teeId_teeTime_nineHoleSection_key"
  unique nulls not distinct ("userId", "teeId", "teeTime", "nine_hole_section");

comment on constraint "round_userId_teeId_teeTime_nineHoleSection_key" on public.round is
  'Natural-key duplicate guard for every write path (web/native/watch/API). NULLS NOT DISTINCT so 18-hole rounds (nine_hole_section NULL) collide too; front/back 9-hole pairs at the same teeTime remain distinct.';

-- 2: idempotency key uniqueness (per user; NULLs remain distinct by default).
alter table public.round
  add constraint "round_userId_externalId_key"
  unique ("userId", "externalId");

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
