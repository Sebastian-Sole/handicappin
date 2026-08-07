-- =============================================================================
-- Migration: CHECK constraint round_approval_status_check on
-- round."approvalStatus" (low-severity batch)
--
-- The column is plain text with no domain constraint. Every handicap consumer
-- (timeline, process-handicap-queue, established-handicap count) filters
-- "approvalStatus" = 'approved' and therefore fails closed on junk values, but
-- the activity-feed transform used to fail OPEN and badge unknown values as
-- approved (fixed in the same batch, apps/web/utils/activity-transform.ts).
-- Pin the domain at the source: the only values ever written by any path
-- (default 'pending'; submitScorecard writes 'pending'/'approved'; the
-- moderation functions in 20260703091818_submission_lifecycle_and_reason.sql
-- transition to 'approved'/'rejected'; round-schemas.ts declares exactly this
-- literal union) are 'pending' | 'approved' | 'rejected'.
--
-- GUARD (run against PROD before applying — the ALTER validates existing rows
-- and will fail on any out-of-domain value):
--
--   select "approvalStatus", count(*)
--   from public.round
--   where "approvalStatus" not in ('pending', 'approved', 'rejected')
--   group by 1;
--
-- Expected result: zero rows. If any rows come back, decide their disposition
-- (map to 'pending' being the fail-closed choice) BEFORE applying.
-- =============================================================================

alter table public.round
  add constraint round_approval_status_check
  check ("approvalStatus" in ('pending', 'approved', 'rejected'));
