-- =============================================================================
-- Find archived tees not referenced by any rounds
-- Purpose: Identify dead data safe to delete (archived tees with no rounds pointing to them)
-- Usage: Run the SELECT first to review, then uncomment the DELETE to clean up
-- =============================================================================

-- Preview: show archived tees with no round, child tee, or submission references
select
  t.id as tee_id,
  t.name as tee_name,
  t.gender,
  t."courseId",
  c.name as course_name,
  t."parentTeeId",
  t."approvalStatus",
  t."submittedBy"
from public."teeInfo" t
left join public.course c on c.id = t."courseId"
where t."isArchived" = true
  and not exists (
    select 1 from public.round r where r."teeId" = t.id
  )
  -- Don't delete if child tees still reference this as their parent
  and not exists (
    select 1 from public."teeInfo" child where child."parentTeeId" = t.id
  )
  -- Don't delete if submissions reference this tee (directly or as parent)
  and not exists (
    select 1 from public.submissions s
    where s."teeId" = t.id or s."parentTeeId" = t.id
  )
order by t."courseId", t.name;

-- Uncomment below to delete (cascades to holes via FK)
-- delete from public."teeInfo"
-- where id in (
--   select t.id
--   from public."teeInfo" t
--   where t."isArchived" = true
--     and not exists (
--       select 1 from public.round r where r."teeId" = t.id
--     )
--     and not exists (
--       select 1 from public."teeInfo" child where child."parentTeeId" = t.id
--     )
--     and not exists (
--       select 1 from public.submissions s
--       where s."teeId" = t.id or s."parentTeeId" = t.id
--     )
-- );
