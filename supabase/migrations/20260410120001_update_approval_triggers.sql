-- =============================================================================
-- Migration: Update approval triggers, add rejection triggers, admin procedures
-- Purpose: Handle tee approval with parent archival, sibling remapping,
--          rejection cascades, and atomic admin approve/reject operations
-- Affected tables: teeInfo, round, score, course, submissions
-- =============================================================================

-- =============================================================================
-- Function: remap_round_to_tee
-- Purpose: Reassign a round (and its scores) from one tee to another.
-- Used by: approval trigger (remap siblings), rejection trigger (remap to parent)
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
begin
  -- Remap score.holeId references from source tee's holes to target tee's holes
  update public.score s
  set "holeId" = target_hole.id
  from public.hole source_hole, public.hole target_hole
  where s."holeId" = source_hole.id
    and source_hole."teeId" = p_from_tee_id
    and target_hole."teeId" = p_to_tee_id
    and target_hole."holeNumber" = source_hole."holeNumber"
    and s."roundId" = p_round_id;

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

comment on function public.remap_round_to_tee
  is 'Reassigns a round and its scores from one tee to another, remapping hole references by holeNumber. Used for approval (remap siblings) and rejection (remap to parent) operations.';

-- =============================================================================
-- Update cascade_approval_to_rounds to handle tee versioning
-- When a pending tee edit is approved:
-- 1. Archive the parent tee (old rounds still reference it via FK)
-- 2. Remap rounds from sibling pending edits to the newly approved tee
-- 3. Reject the sibling pending tees
-- =============================================================================
create or replace function public.cascade_approval_to_rounds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rounds_count integer;
begin
  -- Only proceed if the approval status was changed to 'approved'
  if new."approvalStatus" = 'approved' and (old."approvalStatus" is null or old."approvalStatus" != 'approved') then

    if tg_table_name = 'course' then
      -- Course was approved: update rounds where both course and tee are approved
      update public.round
      set "approvalStatus" = 'approved'
      where "courseId" = new.id
        and "approvalStatus" != 'approved'
        and "teeId" in (
          select t.id
          from public."teeInfo" t
          where t."approvalStatus" = 'approved'
        );

      get diagnostics affected_rounds_count = row_count;

      if affected_rounds_count > 0 then
        raise notice 'Course % approved: automatically approved % rounds', new.name, affected_rounds_count;
      end if;

    elsif tg_table_name = 'teeInfo' then
      -- Tee was approved: update rounds where both course and tee are approved
      -- Parent archival and sibling rejection are handled by approve_submission()
      update public.round
      set "approvalStatus" = 'approved'
      where "teeId" = new.id
        and "approvalStatus" != 'approved'
        and "courseId" in (
          select c.id
          from public.course c
          where c."approvalStatus" = 'approved'
        );

      get diagnostics affected_rounds_count = row_count;

      if affected_rounds_count > 0 then
        raise notice 'Tee % approved: automatically approved % rounds', new.name, affected_rounds_count;
      end if;

    end if;
  end if;

  return new;
end;
$$;

-- Recreate triggers with updated function
drop trigger if exists trigger_course_approval_cascade on public.course;
create trigger trigger_course_approval_cascade
  after update on public.course
  for each row
  when (new."approvalStatus" = 'approved' and old."approvalStatus" != 'approved')
  execute function public.cascade_approval_to_rounds();

drop trigger if exists trigger_tee_approval_cascade on public."teeInfo";
create trigger trigger_tee_approval_cascade
  after update on public."teeInfo"
  for each row
  when (new."approvalStatus" = 'approved' and old."approvalStatus" != 'approved')
  execute function public.cascade_approval_to_rounds();

-- =============================================================================
-- Function: handle_tee_rejection
-- Fires when a tee's approvalStatus changes to 'rejected'
-- For edits: remaps rounds to parent (if parent still active)
-- For new tees: rejects associated rounds
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
        -- Normal manual rejection: parent is still active, remap rounds to parent
        for affected_round in
          select id from public.round where "teeId" = new.id
        loop
          perform public.remap_round_to_tee(
            affected_round.id,
            new.id,
            new."parentTeeId"
          );
        end loop;

        -- Approve only the rounds we just remapped (not all pending rounds on parent)
        update public.round
        set "approvalStatus" = 'approved'
        where "teeId" = new."parentTeeId"
          and "approvalStatus" = 'pending'
          and id in (
            select s."roundId" from public.submissions s
            where s."teeId" = new.id
          )
          and exists (
            select 1 from public.course c
            where c.id = public.round."courseId"
              and c."approvalStatus" = 'approved'
          );
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

create trigger trigger_tee_rejection
  after update of "approvalStatus" on public."teeInfo"
  for each row
  when (new."approvalStatus" = 'rejected' and old."approvalStatus" != 'rejected')
  execute function public.handle_tee_rejection();

-- =============================================================================
-- Function: handle_course_rejection
-- When a course is rejected, reject all pending rounds on that course
-- =============================================================================
create or replace function public.handle_course_rejection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new."approvalStatus" = 'rejected' and old."approvalStatus" != 'rejected' then
    update public.round
    set "approvalStatus" = 'rejected'
    where "courseId" = new.id
      and "approvalStatus" = 'pending';
  end if;

  return new;
end;
$$;

create trigger trigger_course_rejection
  after update of "approvalStatus" on public.course
  for each row
  when (new."approvalStatus" = 'rejected' and old."approvalStatus" != 'rejected')
  execute function public.handle_course_rejection();

-- =============================================================================
-- Function: approve_submission
-- Purpose: Atomically approve a submission and its associated entities.
-- Triggers handle all cascading logic (round approval, parent archival, sibling rejection).
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

comment on function public.approve_submission
  is 'Atomically approves a submission and its course/tee. Handles parent archival, sibling round remapping, and sibling rejection directly. Then deletes the submission row. Cascade trigger handles round approval.';

-- =============================================================================
-- Function: reject_submission
-- Purpose: Atomically reject a submission and its associated entities.
-- Triggers handle round reassignment or rejection automatically.
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
  select * into v_submission
  from public.submissions
  where id = p_submission_id;

  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  -- Reject the entity (triggers handle cascade)
  if v_submission."submissionType" = 'new_course' then
    update public.course
    set "approvalStatus" = 'rejected'
    where id = v_submission."courseId";
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

comment on function public.reject_submission
  is 'Atomically rejects a submission, then deletes the submission row. Triggers handle round reassignment (for edits) or rejection (for new tees/courses) automatically. Audit trail is preserved via submittedBy on the entity.';
