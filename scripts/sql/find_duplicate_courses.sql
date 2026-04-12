-- =============================================================================
-- Find likely duplicate courses
-- Purpose: Identify candidate course pairs that may need merging
-- Heuristic: same country + city, with one name containing the other (case-insensitive)
-- =============================================================================

with course_pairs as (
  select
    a.id as a_id,
    a.name as a_name,
    a."approvalStatus" as a_status,
    a."submittedBy" as a_submitter,
    b.id as b_id,
    b.name as b_name,
    b."approvalStatus" as b_status,
    b."submittedBy" as b_submitter,
    a.city,
    a.country
  from public.course a
  join public.course b on
    a.id < b.id
    and a.country = b.country
    and lower(a.city) = lower(b.city)
    and (
      lower(a.name) = lower(b.name)
      or lower(a.name) like '%' || lower(b.name) || '%'
      or lower(b.name) like '%' || lower(a.name) || '%'
    )
)
select
  cp.*,
  (select count(*) from public."teeInfo" t where t."courseId" = cp.a_id) as a_tees,
  (select count(*) from public."teeInfo" t where t."courseId" = cp.b_id) as b_tees,
  (select count(*) from public.round r where r."courseId" = cp.a_id) as a_rounds,
  (select count(*) from public.round r where r."courseId" = cp.b_id) as b_rounds
from course_pairs cp
order by cp.country, cp.city, cp.a_name;
