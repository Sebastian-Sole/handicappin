-- =============================================================================
-- Migration: Allow merge_tees to work across courses
-- Purpose: Fix overly-defensive same-course restriction so merge_tees can be
--          used for the common "duplicate course merge" case where a tee on
--          Course B matches a tee on Course A.
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
  v_child_count integer;
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

  -- Cross-course merges: block if child tees exist pointing to the source,
  -- because their courseId would become inconsistent (they stay on the source
  -- course but lose their parent). Handle those separately first.
  if v_from_course_id != v_to_course_id then
    select count(*) into v_child_count
    from public."teeInfo"
    where "parentTeeId" = p_from_tee_id;

    if v_child_count > 0 then
      raise exception 'Cannot cross-course merge tee %: it has % child tee(s). Handle them first (reject or convert).',
        p_from_tee_id, v_child_count;
    end if;
  end if;

  -- Remap each round. Pass new course id when crossing courses so
  -- round.courseId stays consistent with round.teeId.
  for v_affected_round in
    select id from public.round where "teeId" = p_from_tee_id
  loop
    if v_from_course_id != v_to_course_id then
      perform public.remap_round_to_tee(
        v_affected_round.id, p_from_tee_id, p_to_tee_id, v_to_course_id
      );
    else
      perform public.remap_round_to_tee(
        v_affected_round.id, p_from_tee_id, p_to_tee_id
      );
    end if;
  end loop;

  -- Same-course merges: re-parent any child tees to the target
  if v_from_course_id = v_to_course_id then
    update public."teeInfo"
    set "parentTeeId" = p_to_tee_id
    where "parentTeeId" = p_from_tee_id;
  end if;

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
  is 'Merges source tee into target tee (same course or cross-course). Remaps rounds and scores (updating courseId if crossing courses), re-parents child tees on same-course merges, deletes related submissions, archives the source. Blocks cross-course merge if source has child tees.';
