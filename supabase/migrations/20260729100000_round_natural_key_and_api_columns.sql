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
--   6. WRITE-PRIVILEGE HARDENING (verified over PostgREST). `round` is
--      SERVER-WRITTEN — PostgREST is a read surface for it (owner decision,
--      2026-07-30). Before this migration, the permissive RLS policies plus
--      table-level grants let an authenticated user INSERT rounds and PATCH ANY
--      column of their own rows directly over PostgREST, including
--      `quarantined` (billing bypass once Part B ships), `approvalStatus` (a
--      live pre-existing hole: self-approving rounds into the handicap
--      computation past moderation), and the handicap computation's own inputs.
--      No app code ever used those write paths. Result: `authenticated`/`anon`
--      get no INSERT at all (6b) and UPDATE on `notes` only (6a), with the
--      restrictive INSERT policy retained as defense in depth (6c).
--
-- New columns inherit round's existing RLS policies unchanged (the permissive
-- INSERT policy is now unreachable for client roles — privileges are checked
-- before policies).
--
-- PROD APPLY (by hand — the migrate workflow is broken; see 003-notes.md):
--   * ORDERING: apply and verify this in prod BEFORE the PR merges, and deploy
--     process-handicap-queue only after. Merging auto-deploys web code that
--     queries `quarantined`; without the column the round count throws and the
--     billing access check fails OPEN. Full rationale in 003-notes.md.
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
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so the DO block swallows the
-- "already exists" error to make a re-run safe.
--
-- BOTH handlers are needed, and `duplicate_object` ALONE IS NOT ENOUGH here —
-- verified against a live DB, not assumed. `ADD CONSTRAINT ... UNIQUE` builds a
-- backing index named after the constraint, and on a re-run that INDEX name is
-- what collides first: the error is `duplicate_table` (42P07, 'relation "..."
-- already exists'), never `duplicate_object` (42710). This idiom was
-- transplanted from 20260501001627_add_round_nine_hole_section.sql, where the
-- constraints are CHECKs — no backing index, so 42710 is the only thing they can
-- raise and `duplicate_object` alone is right THERE. It was wrong here, and a
-- re-run of this file used to abort on the statement below.
do $$
begin
  alter table public.round
    add constraint "round_userId_teeId_teeTime_nineHoleSection_key"
    unique nulls not distinct ("userId", "teeId", "teeTime", "nine_hole_section");
exception
  when duplicate_table or duplicate_object then null;
end
$$;

comment on constraint "round_userId_teeId_teeTime_nineHoleSection_key" on public.round is
  'Natural-key duplicate guard for every write path (web/native/watch/API). NULLS NOT DISTINCT so 18-hole rounds (nine_hole_section NULL) collide too; front/back 9-hole pairs at the same teeTime remain distinct.';

-- 2: idempotency key uniqueness (per user; NULLs remain distinct by default).
-- Same two-handler requirement as above — this is also a UNIQUE constraint, so
-- a re-run raises 42P07 from its backing index.
do $$
begin
  alter table public.round
    add constraint "round_userId_externalId_key"
    unique ("userId", "externalId");
exception
  when duplicate_table or duplicate_object then null;
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

-- 6: write-privilege hardening over PostgREST.
--
-- THE GOVERNING INVARIANT (owner decision, 2026-07-30): `round` is
-- SERVER-WRITTEN. PostgREST is a read surface for this table. Users log rounds
-- through the app and connected apps will log them through `/v1` — both
-- server-side, as the `postgres` table owner. So `authenticated`/`anon` get
-- NO INSERT at all (6b) and UPDATE on `notes` only (6a).
--
-- TWO AXES, because privileges and policies answer different questions:
--
--   * PRIVILEGES (grants) are EXISTENCE-based — may the client name this
--     column, or use this verb, at all? This is the primary control here, and
--     for INSERT it is now the whole control.
--   * The RESTRICTIVE INSERT POLICY (6c) is VALUE-based — may the client send
--     a column carrying a specific value? Privileges cannot express that, so
--     the policy is retained as DEFENSE IN DEPTH against a future migration
--     re-granting INSERT. See 6c.
--
-- THE TRAP (why the blocks below revoke at TABLE level): a column-level REVOKE
-- is a NO-OP while the table-level grant is still held — Postgres allows the
-- write if EITHER the table-level OR a column-level privilege matches.
-- `revoke update ("quarantined")` on its own changes nothing. It is also the
-- reason 6c is worth keeping: one future `grant insert on public.round` line
-- overrides every column-level decision at once.
--
-- Deliberately NOT done with a BEFORE INSERT trigger: a trigger enumerates
-- columns in its body, so it would not auto-cover future columns, and silent
-- normalisation is harmful on an API surface — a client would send an
-- idempotency key, have it nulled, and get a 201 believing the key was
-- registered. A loud 42501 is the correct failure mode.
--
-- 6a: UPDATE — `notes` and nothing else.
--
-- THE INVARIANT: `round` is server-written. No client code — web, native, or
-- watch — issues a PostgREST UPDATE against this table. Every legitimate round
-- write (`submitScorecard`, the moderation approval flow,
-- `process_handicap_updates`, 002 Part B's quarantine check, 005's `/v1`
-- handlers) runs server-side as the `postgres` table owner through Drizzle, or
-- as `service_role`, and bypasses these grants entirely. A broad UPDATE grant
-- to `authenticated` therefore buys no functionality — it is pure surface, so
-- it is not granted.
--
-- Why each excluded group is server-written only:
--
--   * DURABLE INPUTS to the handicap computation. `teeTime` fixes a user's
--     round ORDERING, and the index is derived from a 20-round sliding window
--     over that ordering; `nine_hole_section` selects the front-vs-back course
--     rating, slope and par for a 9-hole round
--     (supabase/functions/handicap-shared/timeline.ts). `teeId`, `courseId`,
--     `holes_played` and `parPlayed` likewise scope which ratings and holes
--     the recompute reads. A client-authored value here re-derives a
--     DIFFERENT, internally self-consistent `profile.handicapIndex` — nothing
--     errors and nothing looks wrong afterwards. In a product with an
--     official-handicap workstream, a user forging their OWN index is the
--     threat model, so these columns are the server's to write.
--   * DERIVED OUTPUTS: `scoreDifferential`, `adjustedGrossScore`,
--     `adjustedPlayedScore`, `courseHandicap`, `existingHandicapIndex`,
--     `updatedHandicapIndex`, `exceptionalScoreAdjustment`. The recompute
--     computes and rewrites all of them; `profile.handicapIndex` is only ever
--     written by `process_handicap_updates`. A client value is at best noise
--     until the next recompute overwrites it, and at worst a misleading
--     display — either way it has no legitimate author but the server.
--   * RATINGS AUDIT: `course_rating_used` / `slope_rating_used` record the
--     ratings applied at time of play. The recompute reads live tee ratings
--     and never rewrites these, so a client edit persists indefinitely as a
--     falsified provenance record of how the round was rated.
--   * `quarantined` (billing state — service paths only), `approvalStatus`
--     (moderation — closes the pre-existing self-approval hole), `externalId`
--     (idempotency keys are immutable), `submitted_via` (attribution is
--     write-once by the server), `updated_at` (trigger-maintained), `userId`,
--     `id`, `createdAt`.
--
-- `notes` is the sole column with a plausible direct-edit affordance: free
-- text the player authored, read back only to the player, and an input to no
-- computation. It is the whole grant.
--
-- First-party server writes are unaffected (see the invariant above);
-- `service_role` retains its own grants. FAIL-SAFE BY DESIGN: any future
-- round column is NOT updatable by `authenticated` until this grant is
-- explicitly extended in a migration.
revoke update on public.round from authenticated, anon;
grant update (notes) on public.round to authenticated;

-- 6b: INSERT — revoked outright, with NO re-grant.
--
-- THE INVARIANT (owner decision, 2026-07-30): `round` is server-written, and
-- PostgREST is a READ surface for it. Three write paths are conceivable and
-- only two are real — users log rounds through the app (`submitScorecard`,
-- server-side Drizzle as the `postgres` table owner), and connected apps will
-- log them through `/v1` (005's handlers, likewise server-side). The third, a
-- client role INSERTing straight into the table over PostgREST, was never a
-- supported path: no code in `apps/web/**` or `apps/native/**` has ever used
-- it. It is now closed.
--
-- Said as an EXPLICIT REVOKE on purpose. The same practical effect is
-- reachable by leaving the NOT NULL columns out of a grant list and letting
-- nullability do the refusing — but that hides the decision inside an accident
-- of the schema, where adding a column default, or a new nullable column,
-- silently re-opens the door. Same reasoning as 6a: say what is meant.
--
-- Context still worth carrying about the two columns this block used to be
-- about, even though it no longer names any:
--   * `externalId` is the client-supplied idempotency key that 005's
--     replay-by-lookup on (userId, externalId) resolves against. A
--     client-authored value lets a fabricated row answer a replay for a round
--     the connected app never wrote — making the contract's "200 means your
--     round is stored" promise falsifiable — or collide with the app's own
--     deterministic key and 409 it forever.
--   * `submitted_via` is PROVENANCE. A client-authored value is
--     indistinguishable from a genuine API submission, which a handicap
--     product with an official-handicap workstream cannot accept.
-- Both are written by the server as the table owner. That reasoning no longer
-- needs a grant list to express: nothing is client-insertable at all.
--
-- The permissive "Users can insert their own rounds" RLS policy remains on the
-- table but is now unreachable for these roles — privileges are checked before
-- policies, so the refusal is 42501 on privilege. 6c stays as a second layer;
-- see its note.
--
-- FAIL-SAFE, stronger than 6a's: there is no grant list to keep in sync, so
-- every future `round` column is non-insertable by `authenticated`/`anon` by
-- default, with no migration needed to keep it that way.
revoke insert on public.round from authenticated, anon;

-- 6c: RESTRICTIVE INSERT policy — DELIBERATELY KEPT as a second layer.
--
-- With 6b revoking INSERT outright this policy is unreachable today: an
-- authenticated insert is refused on privilege before any policy is evaluated.
-- It stays because the failure mode it guards is realistic and cheap to hit — a
-- future migration (or a Supabase-side default-privilege sweep) that
-- blanket-restores `grant insert on public.round to authenticated` re-opens the
-- entire table in ONE statement. That is precisely what THE TRAP above makes
-- easy: a table-level grant overrides every column-level decision, so one
-- careless line silently undoes 6b in full.
--
-- If that day comes, this policy is what still refuses a pre-approved or
-- pre-quarantined round. That hole was verified live before the fix: a user
-- could submit their own unmoderated tee (rated 99.9/155), POST a pre-approved
-- round against it, get 201 with a -21.9 differential, and match the
-- handicap-processor filter (approvalStatus = 'approved' AND
-- quarantined = false) having never passed moderation. `round` has no BEFORE
-- INSERT trigger normalising `approvalStatus`, so the policy is the only
-- value-level control.
--
-- Value axis, not existence axis (see the two-axes note in 6): an authenticated
-- INSERT may only create a non-quarantined, non-approved (i.e. pending) round.
-- `approvalStatus` already defaults to 'pending'. Column privileges do NOT
-- constrain INSERT payload VALUES — verified: under a grant, an insert carrying
-- quarantined = true or approvalStatus = 'approved' succeeds — which is why a
-- grant alone could never be the whole answer, and why this layer is worth
-- keeping now that the grant is gone.
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
