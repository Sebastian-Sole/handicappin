-- =============================================================================
-- Compare two courses side-by-side
-- Purpose: After finding a duplicate pair, inspect both to decide merge strategy
-- Usage: Replace :course_a_id and :course_b_id, then run each block
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Block 1: Basic course info
-- -----------------------------------------------------------------------------
select
  'A' as side,
  id,
  name,
  city,
  country,
  website,
  "approvalStatus",
  "submittedBy"
from public.course
where id = :course_a_id
union all
select
  'B' as side,
  id,
  name,
  city,
  country,
  website,
  "approvalStatus",
  "submittedBy"
from public.course
where id = :course_b_id;

-- -----------------------------------------------------------------------------
-- Block 2: Tees aligned by (name, gender) for easy comparison
-- -----------------------------------------------------------------------------
with tees_a as (
  select
    t.id, t.name, t.gender,
    t."courseRating18", t."slopeRating18",
    t."totalPar", t."totalDistance",
    t."approvalStatus", t."isArchived", t."parentTeeId",
    (select count(*) from public.hole h where h."teeId" = t.id) as hole_count,
    (select count(*) from public.round r where r."teeId" = t.id) as round_count
  from public."teeInfo" t
  where t."courseId" = :course_a_id
),
tees_b as (
  select
    t.id, t.name, t.gender,
    t."courseRating18", t."slopeRating18",
    t."totalPar", t."totalDistance",
    t."approvalStatus", t."isArchived", t."parentTeeId",
    (select count(*) from public.hole h where h."teeId" = t.id) as hole_count,
    (select count(*) from public.round r where r."teeId" = t.id) as round_count
  from public."teeInfo" t
  where t."courseId" = :course_b_id
)
select
  coalesce(a.name, b.name) as tee_name,
  coalesce(a.gender, b.gender) as gender,
  a.id as a_tee_id,
  b.id as b_tee_id,
  a."courseRating18" as a_rating,
  b."courseRating18" as b_rating,
  a."slopeRating18" as a_slope,
  b."slopeRating18" as b_slope,
  a."totalPar" as a_par,
  b."totalPar" as b_par,
  a.hole_count as a_holes,
  b.hole_count as b_holes,
  a.round_count as a_rounds,
  b.round_count as b_rounds,
  a."approvalStatus" as a_status,
  b."approvalStatus" as b_status,
  a."isArchived" as a_archived,
  b."isArchived" as b_archived
from tees_a a
full outer join tees_b b on lower(a.name) = lower(b.name) and a.gender = b.gender
order by tee_name, gender;

-- -----------------------------------------------------------------------------
-- Block 3: Pending submissions for either course
-- -----------------------------------------------------------------------------
select
  s.id as submission_id,
  s."submissionType",
  s."courseId",
  s."teeId",
  s."roundId",
  s."parentTeeId",
  s."submittedBy",
  s."createdAt"
from public.submissions s
where s."courseId" in (:course_a_id, :course_b_id)
order by s."createdAt";
