-- =============================================================================
-- Migration: Submission lifecycle + rejection reason (plans/003-rejection-loop)
-- Purpose:
--   1. Make `submissions` a retained record instead of a row that gets
--      deleted the moment it's resolved: add status/resolvedAt/rejectionReason.
--   2. approve_submission / reject_submission now UPDATE the submission row
--      to its terminal status instead of deleting it.
--   3. reject_submission gains a required `p_reason` argument (2-arg
--      overload; the 1-arg signature is dropped).
--   4. Both RPCs are re-run-safe: calling them on an already-resolved
--      submission raises instead of silently doing nothing (previously this
--      was impossible since the row no longer existed after resolution).
-- =============================================================================

-- =============================================================================
-- 1. Schema: submissions gains status / resolvedAt / rejectionReason
-- =============================================================================
alter table public.submissions
  add column if not exists "status" text not null default 'pending',
  add column if not exists "resolvedAt" timestamptz,
  add column if not exists "rejectionReason" text;

-- =============================================================================
-- 2. approve_submission: resolve instead of delete, re-run safe
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

  if v_submission."status" != 'pending' then
    raise exception 'Submission % already resolved', p_submission_id;
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

      -- Resolve the sibling's submission row instead of deleting it. There's
      -- no admin-authored reason here (this is a side effect of a competing
      -- submission winning), so record a system-generated one so the
      -- submitter's history still explains what happened.
      update public.submissions
      set "status" = 'rejected',
          "resolvedAt" = now(),
          "rejectionReason" = 'Automatically rejected: a competing tee edit for the same tee was approved.'
      where "teeId" = v_sibling.id
        and "status" = 'pending';

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

  -- Resolve: mark the submission approved instead of deleting it, so the
  -- submitter retains a record of the decision.
  update public.submissions
  set "status" = 'approved',
      "resolvedAt" = now()
  where id = p_submission_id;
end;
$$;

comment on function public.approve_submission
  is 'Atomically approves a submission and its course/tee. Handles parent archival, sibling round remapping, and sibling rejection directly. Marks the submission row (and any auto-rejected sibling rows) resolved instead of deleting them. Cascade trigger handles round approval.';

-- =============================================================================
-- 3. reject_submission: drop the 1-arg signature, add a 2-arg overload that
--    requires a reason. Resolve instead of delete, re-run safe.
-- =============================================================================
drop function if exists public.reject_submission(bigint);

create or replace function public.reject_submission(
  p_submission_id bigint,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A rejection reason is required';
  end if;

  -- Lock the submission row to prevent concurrent approve/reject
  select * into v_submission
  from public.submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  if v_submission."status" != 'pending' then
    raise exception 'Submission % already resolved', p_submission_id;
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

  -- Resolve: mark the submission rejected with the admin's reason instead of
  -- deleting it, so the submitter can see why and the queue doesn't
  -- re-offer an already-decided row.
  update public.submissions
  set "status" = 'rejected',
      "resolvedAt" = now(),
      "rejectionReason" = p_reason
  where id = p_submission_id;
end;
$$;

comment on function public.reject_submission
  is 'Atomically rejects a submission with a required reason, then marks the submission row resolved instead of deleting it. Triggers handle round reassignment (for edits) or rejection (for new tees/courses) automatically.';

-- =============================================================================
-- 4. Restrict execute permissions on the (possibly new-signature) functions.
--    service_role-only, matching the existing lockdown.
-- =============================================================================
revoke execute on function public.approve_submission(bigint) from public, anon, authenticated;
grant execute on function public.approve_submission(bigint) to service_role;

revoke execute on function public.reject_submission(bigint, text) from public, anon, authenticated;
grant execute on function public.reject_submission(bigint, text) to service_role;
