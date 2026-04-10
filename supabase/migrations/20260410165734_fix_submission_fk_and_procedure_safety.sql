-- =============================================================================
-- Migration: Fix submission FK constraint name + add row locking + null guards
-- Purpose: Address review findings from PR #111
--   1. Fix FK constraint name mismatch (Postgres auto-name vs Drizzle name)
--   2. Add SELECT ... FOR UPDATE to approve/reject to prevent race conditions
--   3. Add null courseId guard to reject_submission
-- =============================================================================

-- =============================================================================
-- 1. Fix submissions.submittedBy FK constraint
-- The original migration (20260410120000) used an inline FK:
--   "submittedBy" uuid not null references public.profile(id) on delete cascade
-- Postgres auto-names this "submissions_submittedBy_fkey".
-- Migration 20260410120003 tried to drop "submissions_submittedBy_profile_id_fk"
-- (Drizzle naming convention), which silently no-oped via IF EXISTS, leaving
-- the original CASCADE FK in place alongside the new SET NULL FK.
-- Fix: drop the actual Postgres-named constraint, then ensure the SET NULL
-- constraint exists.
-- =============================================================================

-- Drop the original Postgres auto-named CASCADE constraint
alter table public.submissions
  drop constraint if exists "submissions_submittedBy_fkey";

-- Drop the Drizzle-named constraint added by migration 120003 (if it exists)
alter table public.submissions
  drop constraint if exists "submissions_submittedBy_profile_id_fk";

-- Re-add with correct SET NULL behavior
alter table public.submissions
  add constraint "submissions_submittedBy_profile_id_fk"
    foreign key ("submittedBy") references public.profile(id) on delete set null;

-- =============================================================================
-- 2. Replace approve_submission with row-locked version
-- Uses SELECT ... FOR UPDATE to prevent concurrent approval/rejection races.
-- =============================================================================
create or replace function public.approve_submission(
  p_submission_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
  v_sibling record;
  v_affected_round record;
begin
  -- Lock the submission row to prevent concurrent approve/reject
  select * into v_submission
  from public.submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  -- Guard: FK targets must still exist (could be SET NULL if entity was deleted)
  if v_submission."teeId" is null then
    raise exception 'Submission % has a null teeId — the submitted tee was deleted', p_submission_id;
  end if;

  if v_submission."courseId" is null then
    raise exception 'Submission % has a null courseId — the submitted course was deleted', p_submission_id;
  end if;

  -- For tee_edit: handle parent archival and sibling rejection
  if v_submission."submissionType" = 'tee_edit' and v_submission."parentTeeId" is not null then

    -- 1. Archive the parent BEFORE approving the new tee
    -- to avoid violating the partial unique index
    update public."teeInfo"
    set "isArchived" = true
    where id = v_submission."parentTeeId";

    -- 2. Remap sibling pending tees' rounds to the tee being approved,
    -- then reject the siblings. Must remap BEFORE rejecting.
    for v_sibling in
      select id from public."teeInfo"
      where "parentTeeId" = v_submission."parentTeeId"
        and id != v_submission."teeId"
        and "approvalStatus" = 'pending'
    loop
      -- Remap each sibling's rounds to the tee being approved
      for v_affected_round in
        select id from public.round where "teeId" = v_sibling.id
      loop
        perform public.remap_round_to_tee(
          v_affected_round.id, v_sibling.id, v_submission."teeId"
        );
      end loop;

      -- Clean up the sibling's submission rows
      delete from public.submissions where "teeId" = v_sibling.id;

      -- Reject the sibling tee (triggers handle round status cascade)
      update public."teeInfo"
      set "approvalStatus" = 'rejected'
      where id = v_sibling.id;
    end loop;
  end if;

  -- Approve the entity (cascade trigger handles round approval)
  if v_submission."submissionType" = 'new_course' then
    -- New course: approve course first, then tee
    update public.course
    set "approvalStatus" = 'approved'
    where id = v_submission."courseId";

    update public."teeInfo"
    set "approvalStatus" = 'approved'
    where id = v_submission."teeId";
  else
    -- new_tee or tee_edit: approve just the tee
    update public."teeInfo"
    set "approvalStatus" = 'approved'
    where id = v_submission."teeId";
  end if;

  -- Clean up: delete the approved submission row.
  -- The submittedBy column on course/teeInfo preserves the audit trail.
  delete from public.submissions where id = p_submission_id;
end;
$$;

-- =============================================================================
-- 3. Replace reject_submission with row-locked version + null courseId guard
-- =============================================================================
create or replace function public.reject_submission(
  p_submission_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
begin
  -- Lock the submission row to prevent concurrent approve/reject
  select * into v_submission
  from public.submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  -- Guard: FK targets must still exist
  if v_submission."teeId" is null then
    raise exception 'Submission % has a null teeId — the submitted tee was deleted', p_submission_id;
  end if;

  if v_submission."courseId" is null then
    raise exception 'Submission % has a null courseId — the submitted course was deleted', p_submission_id;
  end if;

  -- Reject the entity (triggers handle cascade)
  if v_submission."submissionType" = 'new_course' then
    -- Reject the course
    update public.course
    set "approvalStatus" = 'rejected'
    where id = v_submission."courseId";

    -- Also reject the associated tee to prevent orphaned pending tees
    update public."teeInfo"
    set "approvalStatus" = 'rejected'
    where id = v_submission."teeId";
  else
    -- new_tee or tee_edit: reject just the tee
    update public."teeInfo"
    set "approvalStatus" = 'rejected'
    where id = v_submission."teeId";
  end if;

  -- Clean up: delete the submission row now that it's resolved.
  -- The submittedBy column on course/teeInfo preserves the audit trail.
  delete from public.submissions where id = p_submission_id;
end;
$$;

-- =============================================================================
-- 4. Restrict execute permissions (same as migration 120003)
-- Ensure the updated functions remain locked down to service_role only.
-- =============================================================================
revoke execute on function public.approve_submission(bigint) from public, anon, authenticated;
grant execute on function public.approve_submission(bigint) to service_role;

revoke execute on function public.reject_submission(bigint) from public, anon, authenticated;
grant execute on function public.reject_submission(bigint) to service_role;
