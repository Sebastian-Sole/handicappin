-- =============================================================================
-- Migration: Merge helper procedures for admin use
-- Purpose: Provide atomic building blocks for merging duplicate tees and courses
-- Affected: teeInfo, round, score, submissions, course
-- =============================================================================

-- =============================================================================
-- Function: merge_tees
-- Purpose: Merge two tees on the SAME course. Remaps rounds (scores remap by
--          hole number), re-parents child tees, deletes submissions referencing
--          the source, and archives the source tee.
-- =============================================================================
create or replace function public.merge_tees(
  p_from_tee_id integer,
  p_to_tee_id integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_course_id integer;
  v_to_course_id integer;
  v_affected_round record;
begin
  if p_from_tee_id = p_to_tee_id then
    raise exception 'Cannot merge a tee into itself';
  end if;

  select "courseId" into v_from_course_id
  from public."teeInfo" where id = p_from_tee_id;
  if not found then
    raise exception 'Source tee % not found', p_from_tee_id;
  end if;

  select "courseId" into v_to_course_id
  from public."teeInfo" where id = p_to_tee_id;
  if not found then
    raise exception 'Target tee % not found', p_to_tee_id;
  end if;

  if v_from_course_id != v_to_course_id then
    raise exception 'Tees are on different courses (% vs %). Use course merge helpers instead.',
      v_from_course_id, v_to_course_id;
  end if;

  -- Remap each round (scores.holeId re-bound by hole number)
  for v_affected_round in
    select id from public.round where "teeId" = p_from_tee_id
  loop
    perform public.remap_round_to_tee(
      v_affected_round.id, p_from_tee_id, p_to_tee_id
    );
  end loop;

  -- Re-parent any child tees that pointed to the source
  update public."teeInfo"
  set "parentTeeId" = p_to_tee_id
  where "parentTeeId" = p_from_tee_id;

  -- Clean up submissions referencing the source tee
  delete from public.submissions
  where "teeId" = p_from_tee_id or "parentTeeId" = p_from_tee_id;

  -- Archive the source tee (audit trail preserved)
  update public."teeInfo"
  set "isArchived" = true
  where id = p_from_tee_id;
end;
$$;

comment on function public.merge_tees
  is 'Merges source tee into target tee on the same course. Remaps all rounds and scores, re-parents child tees, deletes related submissions, archives the source.';

-- =============================================================================
-- Function: convert_tee_to_edit
-- Purpose: Repurpose a tee (typically on a duplicate course) as a tee_edit of
--          another approved tee. Moves the tee to the target course, sets
--          parentTeeId, marks pending, updates rounds and submissions.
--          Admin can then approve via approve_submission normally.
-- =============================================================================
create or replace function public.convert_tee_to_edit(
  p_tee_id integer,
  p_parent_tee_id integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tee record;
  v_parent record;
begin
  if p_tee_id = p_parent_tee_id then
    raise exception 'Cannot make a tee its own parent';
  end if;

  select * into v_tee from public."teeInfo" where id = p_tee_id;
  if not found then
    raise exception 'Tee % not found', p_tee_id;
  end if;

  select * into v_parent from public."teeInfo" where id = p_parent_tee_id;
  if not found then
    raise exception 'Parent tee % not found', p_parent_tee_id;
  end if;

  if v_parent."approvalStatus" != 'approved' or v_parent."isArchived" then
    raise exception 'Parent tee % must be approved and non-archived', p_parent_tee_id;
  end if;

  -- Reassign the tee to match the parent's identity
  update public."teeInfo"
  set
    "courseId" = v_parent."courseId",
    name = v_parent.name,
    gender = v_parent.gender,
    "parentTeeId" = p_parent_tee_id,
    "approvalStatus" = 'pending',
    "isArchived" = false
  where id = p_tee_id;

  -- Rounds played on this tee need their courseId updated to match
  update public.round
  set "courseId" = v_parent."courseId"
  where "teeId" = p_tee_id;

  -- Update existing submissions for this tee into tee_edit form
  update public.submissions
  set
    "submissionType" = 'tee_edit',
    "parentTeeId" = p_parent_tee_id,
    "courseId" = v_parent."courseId"
  where "teeId" = p_tee_id;

  -- If no submission existed, create one (so admin can approve via approve_submission)
  if not exists (select 1 from public.submissions where "teeId" = p_tee_id)
     and v_tee."submittedBy" is not null then
    insert into public.submissions (
      "submittedBy", "teeId", "courseId", "submissionType", "parentTeeId"
    )
    values (
      v_tee."submittedBy",
      p_tee_id,
      v_parent."courseId",
      'tee_edit',
      p_parent_tee_id
    );
  end if;
end;
$$;

comment on function public.convert_tee_to_edit
  is 'Converts a tee (often on a duplicate course) into a tee_edit of another approved tee. Moves rounds/submissions to match, then approve_submission works normally.';

-- =============================================================================
-- Function: move_tee_to_course
-- Purpose: Move a tee (and its rounds/submissions) to a different course.
--          Used when a duplicate course has a tee that doesn't exist on the target.
-- =============================================================================
create or replace function public.move_tee_to_course(
  p_tee_id integer,
  p_to_course_id integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tee record;
begin
  select * into v_tee from public."teeInfo" where id = p_tee_id;
  if not found then
    raise exception 'Tee % not found', p_tee_id;
  end if;

  if v_tee."courseId" = p_to_course_id then
    raise exception 'Tee % is already on course %', p_tee_id, p_to_course_id;
  end if;

  if not exists (select 1 from public.course where id = p_to_course_id) then
    raise exception 'Target course % not found', p_to_course_id;
  end if;

  -- Guard against violating the partial unique index: an approved non-archived
  -- tee with the same (courseId, name, gender) cannot exist on the target
  if v_tee."approvalStatus" = 'approved' and not v_tee."isArchived" then
    if exists (
      select 1 from public."teeInfo"
      where "courseId" = p_to_course_id
        and name = v_tee.name
        and gender = v_tee.gender
        and "approvalStatus" = 'approved'
        and "isArchived" = false
    ) then
      raise exception 'An approved tee named % (%) already exists on course %. Use merge_tees or convert_tee_to_edit instead.',
        v_tee.name, v_tee.gender, p_to_course_id;
    end if;
  end if;

  update public."teeInfo"
  set "courseId" = p_to_course_id
  where id = p_tee_id;

  update public.round
  set "courseId" = p_to_course_id
  where "teeId" = p_tee_id;

  update public.submissions
  set "courseId" = p_to_course_id
  where "teeId" = p_tee_id;
end;
$$;

comment on function public.move_tee_to_course
  is 'Moves a tee (and its rounds/submissions) to a different course. Blocks if an approved tee with the same (name, gender) already exists on the target.';

-- =============================================================================
-- Function: delete_empty_course
-- Purpose: Safely delete a course with no tees or rounds. Used as the final
--          step of a course merge.
-- =============================================================================
create or replace function public.delete_empty_course(
  p_course_id integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public."teeInfo" where "courseId" = p_course_id and not "isArchived") then
    raise exception 'Course % still has non-archived tees. Merge or move them first.', p_course_id;
  end if;

  if exists (select 1 from public.round where "courseId" = p_course_id) then
    raise exception 'Course % still has rounds. Remap them first.', p_course_id;
  end if;

  -- Archived tees on this course and any dangling submissions can be cleaned up
  delete from public.submissions where "courseId" = p_course_id;
  delete from public."teeInfo" where "courseId" = p_course_id;
  delete from public.course where id = p_course_id;
end;
$$;

comment on function public.delete_empty_course
  is 'Deletes a course after all live tees and rounds have been moved/merged off it. Cleans up archived tees and submissions on the course.';
