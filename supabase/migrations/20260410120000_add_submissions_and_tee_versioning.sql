-- =============================================================================
-- Migration: Add submissions table, tee versioning support
-- Purpose: Enable immutable tee versioning and submission audit trail
-- Affected tables: course, teeInfo, round, new submissions table
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add submitted_by to course and teeInfo
-- Nullable: null means admin-inserted, non-null means user-submitted
-- -----------------------------------------------------------------------------
alter table public.course
  add column "submittedBy" uuid references public.profile(id) on delete set null;

comment on column public.course."submittedBy"
  is 'The user who submitted this course. Null for admin-inserted courses.';

alter table public."teeInfo"
  add column "submittedBy" uuid references public.profile(id) on delete set null;

comment on column public."teeInfo"."submittedBy"
  is 'The user who submitted this tee. Null for admin-inserted tees.';

-- -----------------------------------------------------------------------------
-- 2. Add parent_tee_id to teeInfo for edit lineage tracking
-- When a user edits an approved tee, a new row is created pointing back to the original
-- All pending edits point to the same approved parent (siblings, not a chain)
-- -----------------------------------------------------------------------------
alter table public."teeInfo"
  add column "parentTeeId" integer references public."teeInfo"(id) on delete set null;

comment on column public."teeInfo"."parentTeeId"
  is 'For tee edits: references the original approved tee this was derived from. Always points to the root approved tee, never to another pending edit. Null for original tees.';

-- -----------------------------------------------------------------------------
-- 3. Replace unique constraint with partial unique index
-- Allow multiple rows with same (courseId, name, gender) as long as only one is
-- active (non-archived AND approved). Pending/rejected rows don't conflict.
-- -----------------------------------------------------------------------------

-- Drop the existing unconditional unique index
drop index if exists "teeInfo_courseId_name_gender_key";

-- Create partial unique index: only one active approved tee per combo
create unique index "teeInfo_active_unique"
  on public."teeInfo"("courseId", name, gender)
  where "isArchived" = false and "approvalStatus" = 'approved';

-- -----------------------------------------------------------------------------
-- 4. Create submissions table
-- Lightweight audit trail for user-submitted course/tee data
-- Links submissions to the user, round, and entities involved
-- All writes happen server-side via Drizzle (postgres role, bypasses RLS)
-- -----------------------------------------------------------------------------
create table public.submissions (
  id bigint generated always as identity primary key,
  "submittedBy" uuid not null references public.profile(id) on delete cascade,
  "roundId" integer references public.round(id) on delete set null,
  "courseId" integer references public.course(id) on delete set null,
  "teeId" integer references public."teeInfo"(id) on delete set null,
  "submissionType" text not null,
  "parentTeeId" integer references public."teeInfo"(id) on delete set null,
  "createdAt" timestamp with time zone not null default now(),

  -- Constrain to known values
  check ("submissionType" in ('new_course', 'new_tee', 'tee_edit'))
);

comment on table public.submissions
  is 'Pending queue for user-submitted course and tee data. Links submissions to the user, round, and entities involved. Rows are deleted once approved or rejected -- audit trail is preserved via submittedBy on the entity.';

comment on column public.submissions."submissionType"
  is 'Type of submission: new_course, new_tee, tee_edit.';

comment on column public.submissions."parentTeeId"
  is 'For tee_edit submissions: the original approved tee being edited.';

-- Enable RLS
alter table public.submissions enable row level security;

-- Users can view their own submissions
create policy "Users can view their own submissions"
  on public.submissions
  for select
  to authenticated
  using ((select auth.uid()) = "submittedBy");

-- No insert/update/delete policies needed -- all writes happen server-side
-- via Drizzle (postgres role, bypasses RLS)

-- Index for user's pending submissions
create index "submissions_submitted_by_idx"
  on public.submissions("submittedBy");

-- Index for parentTeeId lookups (used by rejection trigger and admin queries)
create index "teeInfo_parent_tee_id_idx"
  on public."teeInfo"("parentTeeId")
  where "parentTeeId" is not null;
