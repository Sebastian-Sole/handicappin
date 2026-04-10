-- =============================================================================
-- Migration: Fix orphaned pending rounds
-- Purpose: Approve rounds that are pending but whose course and tee are both approved.
-- These were caused by the silent tee edit discard bug (now fixed in Phase 3).
-- This migration runs last to ensure the bug fix is in place before cleanup.
-- =============================================================================

-- Find and approve orphaned pending rounds, with logging
do $$
declare
  affected_count integer;
begin
  update public.round r
  set "approvalStatus" = 'approved'
  from public.course c, public."teeInfo" t
  where r."courseId" = c.id
    and r."teeId" = t.id
    and r."approvalStatus" = 'pending'
    and c."approvalStatus" = 'approved'
    and t."approvalStatus" = 'approved';

  get diagnostics affected_count = row_count;
  raise notice 'Fixed % orphaned pending rounds', affected_count;
end $$;
