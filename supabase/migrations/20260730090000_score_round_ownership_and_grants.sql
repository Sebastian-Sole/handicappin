-- =============================================================================
-- Migration: enforce round ownership on public.score writes
--
-- Closes a cross-user data-integrity gap on `score`. Specifics are withheld
-- from this file deliberately, and will be documented once the fix is
-- deployed — the terseness here is intentional, not an omission.
--
-- THE INVARIANT this migration establishes:
--
--   A `score` row written by a non-owner role must attach to a `round` that
--   belongs to the caller.
--
-- `score`'s pre-existing permissive policies are all of the form
-- `auth.uid() = "userId"`. They constrain who the row SAYS it belongs to, but
-- they place no constraint on `roundId` — the column that actually decides
-- which round's scorecard, statistics and handicap the row feeds into. The two
-- restrictive policies below add the missing relational half, on both write
-- axes.
--
-- TWO AXES, both needed — same shape `round` received in
-- 20260729100000_round_natural_key_and_api_columns.sql:
--
--   1. RELATIONAL OWNERSHIP POLICIES (value-based): may the client send this
--      column carrying this VALUE? Correct for `roundId`, which a client must
--      be able to name — it is the point of the row — but may only populate
--      with a round it owns.
--   2. COLUMN-GRANT SWEEP (existence-based): may the client NAME this column
--      at all? Correct for columns with no benign client value. `score` had NO
--      column-level hardening whatsoever — full table INSERT and UPDATE grants
--      for `authenticated` AND `anon`.
--
-- FIRST-PARTY WRITES ARE UNAFFECTED: every score write in this repo goes
-- through Drizzle as the `postgres` table owner
-- (server/services/scorecard/submit-scorecard.ts), which bypasses both RLS and
-- these grants. A repo-wide search finds no client-side PostgREST write to
-- `score`; the only non-owner access paths are a read in
-- app/api/notifications/round-approval/route.ts and a service-role read in
-- supabase/functions/process-handicap-queue. Verified by the submit-scorecard
-- characterization, shot-detail-persistence and oauth-client-tokens suites,
-- plus tests/integration/score-round-ownership.test.ts.
--
-- PROD APPLY (by hand — the migrate workflow is broken; see
-- docs/research/api-platform/plans/003-notes.md):
--   * Apply transactionally (`psql -1` or `supabase db push`) so a partial run
--     can never leave the table with revoked grants and no re-grant.
--   * Audit for rows that already violate the invariant:
--       select s.id, s."userId", s."roundId", r."userId" as round_owner
--       from public.score s join public.round r on r.id = s."roundId"
--       where s."userId" <> r."userId";
--     This migration deliberately does NOT delete such rows — destructive
--     cleanup of production handicap inputs belongs in a separately reviewed
--     and verified step, not in a security patch.
--   * Post-deploy: verify the DDL via a prod DUMP, not migration history
--     (shot-level-stats lesson: phantom "applied" row, DDL never ran).
-- =============================================================================

-- Fail fast rather than queueing behind a long transaction: the REVOKEs below
-- take ACCESS EXCLUSIVE locks on public.score.
set local lock_timeout = '5s';

-- ── 1. Relational ownership: a score must attach to a round the caller owns ──
--
-- RESTRICTIVE so these AND with the existing permissive `auth.uid() = userId`
-- policies rather than widening anything: a write must now satisfy BOTH
-- "the row is mine" AND "the round is mine".
--
-- `(select auth.uid())` is wrapped in a scalar subquery deliberately: Postgres
-- hoists it into an InitPlan and evaluates it once per statement instead of
-- once per row, which matters because scorecards are written 18 rows at a time.
--
-- No recursion hazard here. The recursion class documented in the 004 OAuth
-- migration came from a policy on `profile` whose subquery selected from
-- `profile`. This subquery selects from `round`, and `round`'s own SELECT
-- policy is a plain `auth.uid() = "userId"` with no reference back to `score`,
-- so evaluation terminates.
--
-- The subquery runs with the caller's privileges, so `round`'s SELECT RLS
-- applies to it as well and independently restricts the visible rows to the
-- caller's own. The explicit `r."userId" = (select auth.uid())` predicate is
-- therefore redundant TODAY but is kept on purpose: it keeps this policy
-- correct on its own terms if `round`'s SELECT policy is ever loosened (e.g. a
-- future round-sharing feature), instead of silently inheriting a wider notion
-- of "visible round" as "ownable round".
drop policy if exists "Scores must attach to a round the caller owns (insert)" on public.score;
create policy "Scores must attach to a round the caller owns (insert)"
  on public.score
  as restrictive
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.round r
      where r.id = "roundId"
        and r."userId" = (select auth.uid())
    )
  );

-- The UPDATE axis needs BOTH clauses:
--   * USING      — the row must currently sit on a round the caller owns, so
--                  any row already violating the invariant is frozen rather
--                  than remaining editable.
--   * WITH CHECK — the row must still sit on an owned round afterwards.
-- Without WITH CHECK a restrictive UPDATE policy leaves the post-image
-- unconstrained; Postgres only reuses USING as the check for the pre-existing
-- permissive policy.
drop policy if exists "Scores must attach to a round the caller owns (update)" on public.score;
create policy "Scores must attach to a round the caller owns (update)"
  on public.score
  as restrictive
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.round r
      where r.id = "roundId"
        and r."userId" = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.round r
      where r.id = "roundId"
        and r."userId" = (select auth.uid())
    )
  );

-- ── 2. Column-grant sweep ────────────────────────────────────────────────────
--
-- THE TRAP (why each block revokes at TABLE level first): a column-level
-- REVOKE is a NO-OP while the table-level grant is still held — Postgres
-- allows the write if EITHER the table-level OR a column-level privilege
-- matches. `revoke update ("roundId") on public.score from authenticated` on
-- its own would change nothing. Each block therefore revokes the verb at table
-- level and then re-grants the allowed columns.
--
-- Corollary for future migrations: a later bare
-- `grant insert on public.score to authenticated` (or `grant update`, or a
-- `grant all`) SILENTLY OVERRIDES every column grant below and re-opens the
-- existence axis. Column grants must be re-stated, never blanket-restored.
--
-- `anon` is included in both REVOKEs and in neither GRANT. It holds no
-- permissive policy on `score`, so RLS already denies it, but it should not
-- carry a table-level write privilege it can never legitimately use.
-- `service_role` (BYPASSRLS) and `postgres` (table owner) keep their own grants
-- and are untouched.

-- 2a. INSERT.
--
-- EXCLUDED — `id`: a `serial` whose value belongs to `score_id_seq`. A client
-- has no benign reason to name it, and naming it desynchronises the sequence
-- from the table (every later default-driven insert then fails on the primary
-- key until the sequence catches up) — a denial of service against every other
-- writer, reachable by any authenticated user.
--
-- GRANTED — everything else, because each has a legitimate client value on a
-- normal per-hole write:
--   * "userId"  — required; the existing permissive policy is stated in terms
--                 of it, so the client must be able to send it.
--   * "roundId" — required; which round the hole belongs to. Constrained by
--                 VALUE in 1 above, not by existence.
--   * "holeId"  — required; which hole was played.
--   * strokes, "hcpStrokes" — the score itself.
--   * putts, "fairwayHit", "penaltyStrokes" — optional shot-level detail
--     (plans/010); NULL means "not tracked", and clients legitimately send
--     them.
--
-- FAIL-SAFE BY DESIGN: any future `score` column is NOT insertable by
-- `authenticated` until a migration explicitly extends this grant. That is the
-- property this block buys even though only `id` is excluded today.
revoke insert on public.score from authenticated, anon;
grant insert (
  "userId",
  "roundId",
  "holeId",
  strokes,
  "hcpStrokes",
  putts,
  "fairwayHit",
  "penaltyStrokes"
) on public.score to authenticated;

-- 2b. UPDATE. Same revoke-then-regrant shape as 2a (see THE TRAP above).
--
-- EXCLUDED, all four for the same underlying reason — they are the row's
-- STRUCTURAL IDENTITY, fixed when the score is created, and none has a benign
-- client value in an edit:
--   * "roundId" — which round a score belongs to is decided at creation, not
--                 edited. Denying it by EXISTENCE here as well as by value in
--                 1 is belt and braces on purpose: an existence denial fails
--                 loudly regardless of how the policy expression evaluates, so
--                 the invariant survives a future migration that edits or
--                 drops the restrictive policy.
--   * "holeId"  — moving a score to a different hole is not an edit, it is a
--                 rewrite. There is also no constraint tying `hole.teeId` to
--                 the round's tee, so a re-pointed `holeId` can reference a
--                 hole on an entirely different course and silently corrupt
--                 per-hole statistics.
--   * "userId"  — the ownership anchor. RLS already blocks handing a row to
--                 another user (the permissive policy's USING doubles as its
--                 WITH CHECK), so this is defence in depth for a column with
--                 no legitimate new value.
--   * `id`      — immutable primary key; changing it would also break the
--                 sequence relationship described in 2a.
--
-- GRANTED — the mutable score payload only. These are what a legitimate edit
-- of a logged hole changes.
revoke update on public.score from authenticated, anon;
grant update (
  strokes,
  "hcpStrokes",
  putts,
  "fairwayHit",
  "penaltyStrokes"
) on public.score to authenticated;

-- SELECT and DELETE are deliberately left alone. Both are already scoped by
-- `auth.uid() = "userId"` policies (plus the restrictive OAuth delete-deny from
-- 20260728091000), and narrowing read columns is a separate change with its own
-- compatibility surface.
