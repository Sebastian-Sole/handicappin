-- =============================================================================
-- Migration: Fix approval security, validation, and orphaned round handling
-- Purpose:
--   1. REVOKE public execute on admin RPC functions (security)
--   2. Add validation to remap_round_to_tee (defense-in-depth)
--   3. Fix handle_tee_rejection to approve ALL remapped rounds, not just
--      those with submissions rows (orphaned pending round bug)
--   4. Add null FK guards to approve/reject_submission
--   5. Reject tee when rejecting a new_course submission
--   6. Fix submissions.submittedBy CASCADE → SET NULL for consistency
-- Affected functions: remap_round_to_tee, handle_tee_rejection,
--                     approve_submission, reject_submission
-- =============================================================================

-- =============================================================================
-- 1. Security: Restrict admin RPC functions to service_role only
-- By default SECURITY DEFINER functions are callable by PUBLIC.
-- These must only be callable by the service_role (used by admin API routes).
-- =============================================================================

revoke execute on function public.approve_submission(bigint) from public, anon, authenticated;
grant execute on function public.approve_submission(bigint) to service_role;

revoke execute on function public.reject_submission(bigint) from public, anon, authenticated;
grant execute on function public.reject_submission(bigint) to service_role;

revoke execute on function public.remap_round_to_tee(integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.remap_round_to_tee(integer, integer, integer, integer) to service_role;

-- =============================================================================
-- 2. Replace remap_round_to_tee with validation
-- Asserts that the round currently belongs to p_from_tee_id and that all
-- scores were successfully remapped to the target tee.
-- =============================================================================
create or replace function public.remap_round_to_tee(
  p_round_id integer,
  p_from_tee_id integer,
  p_to_tee_id integer,
  p_new_course_id integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_tee_id integer;
  v_score_count integer;
  v_remapped_count integer;
begin
  -- Validate: round must currently belong to the source tee
  select "teeId" into v_current_tee_id
  from public.round
  where id = p_round_id;

  if not found then
    raise exception 'Round % not found', p_round_id;
  end if;

  if v_current_tee_id != p_from_tee_id then
    raise exception 'Round % belongs to tee %, not tee %',
      p_round_id, v_current_tee_id, p_from_tee_id;
  end if;

  -- Count scores for this round before remapping
  select count(*) into v_score_count
  from public.score
  where "roundId" = p_round_id;

  -- Remap score.holeId references from source tee's holes to target tee's holes
  update public.score s
  set "holeId" = target_hole.id
  from public.hole source_hole, public.hole target_hole
  where s."holeId" = source_hole.id
    and source_hole."teeId" = p_from_tee_id
    and target_hole."teeId" = p_to_tee_id
    and target_hole."holeNumber" = source_hole."holeNumber"
    and s."roundId" = p_round_id;

  get diagnostics v_remapped_count = row_count;

  -- Validate: all scores must have been remapped
  if v_remapped_count != v_score_count then
    raise exception 'Score remap mismatch for round %: expected % scores, remapped %',
      p_round_id, v_score_count, v_remapped_count;
  end if;

  -- Update the round's teeId (and optionally courseId)
  if p_new_course_id is not null then
    update public.round
    set "teeId" = p_to_tee_id,
        "courseId" = p_new_course_id
    where id = p_round_id;
  else
    update public.round
    set "teeId" = p_to_tee_id
    where id = p_round_id;
  end if;
end;
$$;

-- =============================================================================
-- 3. Fix handle_tee_rejection: approve ALL remapped rounds on parent tee
-- Previously this only approved rounds that had a matching submissions row,
-- causing rounds submitted against an already-pending tee (no submissions row)
-- to remain stuck as 'pending' after rejection + remap.
-- Now approves all rounds that were just remapped to the parent tee, as long
-- as the parent course is approved.
-- =============================================================================
create or replace function public.handle_tee_rejection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_round record;
  v_parent_archived boolean;
  v_remapped_round_ids integer[];
begin
  -- Only act when status changes TO 'rejected'
  if new."approvalStatus" = 'rejected' and old."approvalStatus" != 'rejected' then

    -- If this tee has a parent (it was an edit), check if parent is still active
    if new."parentTeeId" is not null then

      select "isArchived" into v_parent_archived
      from public."teeInfo"
      where id = new."parentTeeId";

      if v_parent_archived then
        -- Parent is archived = approval trigger already remapped our rounds
        -- to the approved sibling. Nothing to do.
        null;
      else
        -- Normal manual rejection: parent is still active, remap rounds to parent.
        -- Collect the IDs of rounds we're about to remap so we can approve them.
        select array_agg(id) into v_remapped_round_ids
        from public.round
        where "teeId" = new.id;

        for affected_round in
          select id from public.round where "teeId" = new.id
        loop
          perform public.remap_round_to_tee(
            affected_round.id,
            new.id,
            new."parentTeeId"
          );
        end loop;

        -- Approve ALL rounds we just remapped (not just those with submissions rows).
        -- This handles rounds submitted against an already-pending tee that had
        -- no submissions row of their own.
        if v_remapped_round_ids is not null then
          update public.round
          set "approvalStatus" = 'approved'
          where id = any(v_remapped_round_ids)
            and "approvalStatus" = 'pending'
            and exists (
              select 1 from public.course c
              where c.id = public.round."courseId"
                and c."approvalStatus" = 'approved'
            );
        end if;
      end if;

    else
      -- No parent tee (new tee that was rejected) -- reject the rounds too
      update public.round
      set "approvalStatus" = 'rejected'
      where "teeId" = new.id
        and "approvalStatus" = 'pending';
    end if;

  end if;

  return new;
end;
$$;

-- =============================================================================
-- 4. Fix approve_submission: add null FK guards + fix reject_submission to
--    also reject the tee when rejecting a new_course submission
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
  select * into v_submission
  from public.submissions
  where id = p_submission_id;

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
  select * into v_submission
  from public.submissions
  where id = p_submission_id;

  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  -- Guard: FK targets must still exist
  if v_submission."teeId" is null then
    raise exception 'Submission % has a null teeId — the submitted tee was deleted', p_submission_id;
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
-- 5. Fix submissions.submittedBy: CASCADE → SET NULL for consistency
-- When a user is deleted, keep the submission in the review queue rather than
-- silently deleting it. The underlying course/tee still exist (their submittedBy
-- is already SET NULL), so the admin should still be able to review them.
-- =============================================================================
alter table public.submissions
  drop constraint if exists "submissions_submittedBy_profile_id_fk",
  add constraint "submissions_submittedBy_profile_id_fk"
    foreign key ("submittedBy") references public.profile(id) on delete set null;

-- Column was NOT NULL — allow null now that we use SET NULL
alter table public.submissions
  alter column "submittedBy" drop not null;
