# Tee/Course Approval Workflow & Immutable Tee Versioning

## Overview

Implement a robust approval workflow for user-submitted course and tee edits, with immutable tee versioning to preserve historical handicap calculation accuracy. This includes: a `submissions` pending queue table, immutable tee rows (edits create new pending rows), database triggers for approve/reject cascades, stored procedures for atomic admin actions, and fixes for the silent tee edit discard bug. Redundant snapshot column removal is handled in a separate Phase 6 release. Admin review is done directly via the Supabase dashboard (SQL or table editor).

## Current State Analysis

### Key Discoveries:

1. **Silent edit discard bug** (`server/api/routers/round.ts:298-314`): When a user edits a tee but keeps the same name+gender, the backend finds the existing tee by that combo and silently reuses its ID, discarding all edits. The frontend already marks the **tee** as `approvalStatus: "pending"` (via `hooks/useTeeManagement.ts:162`), which propagates through to the submission where the round inherits pending status. The result is orphaned pending rounds with no corresponding pending tee.

2. **Production handicap processor uses live tee data** (`supabase/functions/process-handicap-queue/index.ts:188-200`): The Edge Function fetches current `teeInfo` and `hole` rows to recalculate everything from scratch. If a tee row is modified in-place, all historical rounds recalculate with the new values. This is correct for data corrections but wrong for real-world tee changes.

3. **Unused versioning columns** (`db/schema.ts:152-153`): `teeInfo.isArchived` (boolean, default false) and `teeInfo.version` (integer, default 1) exist but are never read or written anywhere in the application.

4. **No admin UI**: Approvals require direct SQL in the Supabase dashboard. No `submissions` or audit trail exists.

5. **No submission tracking**: No way to know who submitted a course/tee or which round triggered it.

6. **Unique constraint** (`db/schema.ts:156-161`): `teeInfo(courseId, name, gender)` is unconditional -- prevents multiple rows with the same combo, blocking the pending-version approach.

7. **Redundant snapshot columns** (`db/schema.ts:237-238`): `round.courseRatingUsed` and `round.slopeRatingUsed` are populated at submission time. They are included in query results by `scorecard.ts:106-107` and `auth.ts:202-203`, but **no downstream consumer ever reads them**. All frontend components (`score-differential-step.tsx:30-34`, `course-handicap-step.tsx:35-51`) read ratings from `scorecard.teePlayed.*` instead. The Edge Function explicitly excludes them (`handicap-shared/round-schemas.ts:7-9`). With immutable tee versioning, `round.teeId` always points to the correct immutable tee row, making these columns fully redundant.

8. **Admin SQL scripts** (`scripts/parse_scorecard.py`, `scripts/parse_scorecard_transposed.py`): Generate SQL that inserts courses/tees with `approvalStatus: 'approved'` but no `submitted_by` column. These need updating for the new schema.

9. **Tee lookup has no approval status filter** (`server/api/routers/round.ts:300-311`): The query to find existing tees matches on `(courseId, name, gender)` without filtering by `approvalStatus` or `isArchived`. With the proposed partial unique index allowing multiple rows, this `.limit(1)` query becomes nondeterministic.

## Desired End State

- Tee edits create new pending `teeInfo` rows with full hole data, preserving the original row for historical rounds
- A `submissions` table acts as a pending queue linking each user submission to the user, round, and entities involved (rows are deleted once resolved; audit trail is preserved via `submittedBy` on the entity)
- Admins approve/reject submissions via stored procedures (`approve_submission`, `reject_submission`) in Supabase; database triggers handle all cascading logic automatically
- Rejected edits reassign the round to the original tee; rejected new courses/tees reject the round
- When one edit is approved, sibling pending edits are auto-rejected and their rounds are remapped to the approved version (not the archived parent)
- Users can see their own pending tees when selecting tees for a course, reducing re-entry of edited data
- Historical handicap calculations remain accurate because old `teeInfo` rows are never modified
- Redundant `courseRatingUsed` and `slopeRatingUsed` snapshot columns are removed from the `round` table
- Orphaned pending rounds in production are fixed
- SQL generation scripts include `submitted_by` (null for admin-inserted data)

## What We're NOT Doing

- Building an admin UI or admin tRPC procedures -- admins use the Supabase dashboard directly; triggers handle all cascading logic
- Merge operations for duplicate courses/tees -- too many edge cases (mismatched hole counts, multi-tee courses); defer until there's a real need
- Admin role/permission system -- no `role` column needed; admins have direct Supabase access
- Migrating from the Supabase Edge Function to Vercel cron (separate concern)
- Adding email notifications for approval/rejection (future feature)
- Changing the Edge Function's calculation logic (it already correctly follows `round.teeId`)
- Adding a "rejected" status to the Zod schemas on the frontend (users don't submit rejected data)
- Retroactively fixing rounds submitted against incorrect-but-approved tees (user's responsibility; admin can manually remap via `remap_round_to_tee()` if needed -- see "Edge Cases" section)

## Implementation Approach

Build from the bottom up: schema first, then triggers/functions/procedures, then backend logic, then scripts, then data migration. Deploy all phases together as a single release. Admins approve/reject directly in Supabase -- the stored procedures and triggers do the heavy lifting.

---

## Phase 1: Schema Changes

### Overview

Add the `submissions` table, add `submittedBy` and `parentTeeId` columns to `teeInfo` and `course`, and replace the unique constraint with a partial index. The redundant snapshot column removal is deferred to Phase 6 (separate migration for easy rollback).

### Changes Required:

#### 1. Create migration file

**File**: `supabase/migrations/[timestamp]_add_submissions_and_tee_versioning.sql`

```sql
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

```

#### 2. Update Drizzle schema

**File**: `db/schema.ts`

Key changes:
- `course`: add `submittedBy` (uuid, nullable, references profile)
- `teeInfo`: add `submittedBy` (uuid, nullable, references profile), `parentTeeId` (integer, nullable, references teeInfo)
- New `submissions` table with all columns from migration above, including CHECK constraints
- Update the unique index definition on `teeInfo` to be the partial index
- **Do NOT remove** `courseRatingUsed` and `slopeRatingUsed` yet — deferred to Phase 6

#### 3. Snapshot column references (deferred to Phase 6)

Snapshot column removal is handled in Phase 6 as a separate migration. No changes to these files in Phase 1.

### Success Criteria:

#### Automated Verification:
- [ ] Migration applies cleanly: `supabase db push` or `supabase migration up`
- [ ] Drizzle schema matches migration: `pnpm drizzle-kit generate` produces no diff
- [x] Type checking passes: `pnpm build`
- [x] Existing tests pass: `pnpm test`

#### Manual Verification:
- [ ] Existing courses, tees, and rounds are unaffected (new columns are nullable)
- [ ] `submittedBy` is null for all existing rows (correct -- they were admin-inserted or pre-feature)
- [ ] Partial unique index allows inserting a pending tee with same (courseId, name, gender) as an approved one

---

## Phase 2: Utility Function, Cascade Triggers & Admin Procedures

### Overview

Create the `remap_round_to_tee()` utility function, update the `cascade_approval_to_rounds` trigger to handle approval/rejection flows with correct sibling remapping, add rejection triggers, and create atomic `approve_submission` / `reject_submission` stored procedures.

### Changes Required:

#### 1. Create migration for utility function and updated triggers

**File**: `supabase/migrations/[timestamp]_update_approval_triggers.sql`

**A. Create `remap_round_to_tee()` utility function** (used by approval and rejection triggers):

```sql
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
```

**B. Update `cascade_approval_to_rounds()`** to handle tee approval with parent archival, sibling round remapping, and sibling rejection:

When a pending tee edit is approved:
1. Archive the parent tee (old rounds still reference it via FK -- correct for historical accuracy)
2. Remap rounds from sibling pending edits to the newly approved tee (NOT to the archived parent)
3. Reject the sibling pending tees (their rounds are already remapped)

```sql
-- When a tee is approved and has a parent, archive parent and handle siblings
if new."approvalStatus" = 'approved' and new."parentTeeId" is not null then
  -- Archive the parent (old rounds keep referencing it -- correct)
  update public."teeInfo"
  set "isArchived" = true
  where id = new."parentTeeId";

  -- Remap sibling pending tees' rounds to the newly approved tee
  -- then reject the siblings. Must remap BEFORE rejecting to avoid
  -- the rejection trigger trying to remap to the (now archived) parent.
  declare
    sibling record;
    affected_round record;
  begin
    for sibling in
      select id from public."teeInfo"
      where "parentTeeId" = new."parentTeeId"
        and id != new.id
        and "approvalStatus" = 'pending'
    loop
      -- Remap each of this sibling's rounds to the approved tee
      for affected_round in
        select id from public.round where "teeId" = sibling.id
      loop
        perform public.remap_round_to_tee(
          affected_round.id, sibling.id, new.id
        );
      end loop;

      -- Approve the remapped rounds (they now point to an approved tee)
      update public.round
      set "approvalStatus" = 'approved'
      where "teeId" = new.id
        and "approvalStatus" = 'pending'
        and exists (
          select 1 from public.course c
          where c.id = public.round."courseId"
            and c."approvalStatus" = 'approved'
        );

      -- Clean up the sibling's submission row (audit trail preserved via submittedBy)
      delete from public.submissions where "teeId" = sibling.id;

      -- Reject the sibling tee
      update public."teeInfo"
      set "approvalStatus" = 'rejected'
      where id = sibling.id;
    end loop;
  end;
end if;
```

**C. Add `handle_tee_rejection()`** that fires when a tee's `approvalStatus` changes to `'rejected'`:

```sql
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
```

**D. Add `handle_course_rejection()`** for when a course is rejected:

```sql
-- When a course is rejected, reject all pending rounds on that course
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
```

**E. Create `approve_submission()` stored procedure** for atomic admin approval:

```sql
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
begin
  select * into v_submission
  from public.submissions
  where id = p_submission_id;

  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  -- Approve the entity (triggers handle cascade)
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

  -- Clean up: delete the submission row now that it's resolved.
  -- The submittedBy column on course/teeInfo preserves the audit trail.
  delete from public.submissions where id = p_submission_id;
end;
$$;

comment on function public.approve_submission
  is 'Atomically approves a submission and its course/tee, then deletes the submission row. Triggers handle round approval, parent archival, and sibling rejection automatically. Audit trail is preserved via submittedBy on the entity.';
```

**F. Create `reject_submission()` stored procedure** for atomic admin rejection:

```sql
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
  is 'Atomically rejects a submission with an optional reason, then deletes the submission row. Triggers handle round reassignment (for edits) or rejection (for new tees/courses) automatically. Audit trail is preserved via submittedBy on the entity.';
```

### Success Criteria:

#### Automated Verification:
- [ ] Migration applies cleanly
- [x] Type checking passes: `pnpm build`
- [x] Existing tests pass: `pnpm test`

#### Manual Verification:
- [ ] `select approve_submission(<id>)` approves entity and deletes the submission row
- [ ] `select reject_submission(<id>, null, 'reason')` rejects entity and deletes the submission row
- [ ] Approving a pending tee with `parentTeeId` archives the parent tee
- [ ] Approving a pending tee remaps sibling pending tees' rounds to the approved version (NOT to the archived parent)
- [ ] Sibling pending tees are rejected after their rounds are remapped
- [ ] Rejecting a pending tee (manual, parent still active) remaps rounds to parent and approves only the remapped rounds
- [ ] Rejecting a pending tee (auto, parent archived by approval trigger) does nothing (rounds already remapped)
- [ ] Rejecting a pending tee without `parentTeeId` rejects associated rounds
- [ ] Rejecting a pending course rejects associated rounds
- [ ] Cascade approval still works: approving a course auto-approves rounds where tee is approved

---

## Phase 3: Fix Round Submission Backend

### Overview

Fix the silent edit discard bug, update tee lookup to prefer approved tees, support users seeing their own pending tees, add submission tracking, and remove snapshot column logic.

### Changes Required:

#### 1. Update tee fetching to include user's pending tees

**File**: `server/api/routers/tee.ts` (or wherever tees are fetched for course selection)

Update the tee fetch query to return approved non-archived tees plus the current user's pending tees:

```typescript
const tees = await db
  .select()
  .from(teeInfo)
  .where(
    and(
      eq(teeInfo.courseId, courseId),
      or(
        // All approved non-archived tees (everyone sees these)
        and(
          eq(teeInfo.approvalStatus, "approved"),
          eq(teeInfo.isArchived, false)
        ),
        // User's own pending tees (only the submitter sees these)
        and(
          eq(teeInfo.approvalStatus, "pending"),
          eq(teeInfo.submittedBy, userId)
        )
      )
    )
  );
```

This prevents users from needing to re-enter tee edits while waiting for approval. Pending tees should be visually distinguishable in the frontend (e.g., a "Pending" badge).

#### 2. Update `submitScorecard` mutation

**File**: `server/api/routers/round.ts`

**A. Update tee lookup to prefer approved tees** (replace current logic at ~lines 298-314):

The lookup query must explicitly filter for approved non-archived tees to avoid ambiguity with the partial unique index:

```typescript
// Find existing APPROVED tee by courseId + name + gender
const existingTee = await tx
  .select()
  .from(teeInfo)
  .where(
    and(
      eq(teeInfo.courseId, courseId),
      eq(teeInfo.name, teePlayed.name),
      eq(teeInfo.gender, teePlayed.gender),
      eq(teeInfo.approvalStatus, "approved"),
      eq(teeInfo.isArchived, false)
    )
  )
  .limit(1);
```

**B. Detect tee data changes** (when an approved tee is found and the submitted tee is pending):

```typescript
if (existingTee.length > 0 && teePlayed.approvalStatus === "pending") {
  const existing = existingTee[0]!;

  // Compare submitted tee data against existing approved row
  const ratingEqual = (a: unknown, b: unknown): boolean =>
    Math.abs(Number(a) - Number(b)) < 0.001;

  const hasRatingChanges =
    !ratingEqual(existing.courseRating18, teePlayed.courseRating18) ||
    Number(existing.slopeRating18) !== Number(teePlayed.slopeRating18) ||
    !ratingEqual(existing.courseRatingFront9, teePlayed.courseRatingFront9) ||
    Number(existing.slopeRatingFront9) !== Number(teePlayed.slopeRatingFront9) ||
    !ratingEqual(existing.courseRatingBack9, teePlayed.courseRatingBack9) ||
    Number(existing.slopeRatingBack9) !== Number(teePlayed.slopeRatingBack9);

  const hasParChanges =
    existing.outPar !== teePlayed.outPar ||
    existing.inPar !== teePlayed.inPar ||
    existing.totalPar !== teePlayed.totalPar;

  const hasDistanceChanges =
    existing.outDistance !== teePlayed.outDistance ||
    existing.inDistance !== teePlayed.inDistance ||
    existing.totalDistance !== teePlayed.totalDistance;

  // Also compare hole-level data
  const existingHoles = await tx
    .select()
    .from(hole)
    .where(eq(hole.teeId, existing.id))
    .orderBy(hole.holeNumber);

  const hasHoleChanges = teePlayed.holes.some((submittedHole, index) => {
    const existingHole = existingHoles[index];
    if (!existingHole) return true;
    return (
      submittedHole.par !== existingHole.par ||
      submittedHole.distance !== existingHole.distance ||
      submittedHole.hcp !== existingHole.hcp
    );
  });

  if (hasRatingChanges || hasParChanges || hasDistanceChanges || hasHoleChanges) {
    // Real changes detected -- always create a new pending tee row
    // Multiple edits to the same parent coexist as siblings for audit trail
    // parentTeeId always points to the root approved tee, never another pending edit
    const [newTee] = await tx
      .insert(teeInfo)
      .values({
        courseId: resolvedCourseId,
        name: teePlayed.name,
        gender: teePlayed.gender,
        courseRating18: teePlayed.courseRating18,
        slopeRating18: teePlayed.slopeRating18,
        courseRatingFront9: teePlayed.courseRatingFront9,
        slopeRatingFront9: teePlayed.slopeRatingFront9,
        courseRatingBack9: teePlayed.courseRatingBack9,
        slopeRatingBack9: teePlayed.slopeRatingBack9,
        outPar: teePlayed.outPar,
        inPar: teePlayed.inPar,
        totalPar: teePlayed.totalPar,
        outDistance: teePlayed.outDistance,
        inDistance: teePlayed.inDistance,
        totalDistance: teePlayed.totalDistance,
        distanceMeasurement: teePlayed.distanceMeasurement,
        approvalStatus: "pending",
        parentTeeId: existing.id,
        submittedBy: userId,
        version: existing.version + 1,
      })
      .returning({ id: teeInfo.id });

    resolvedTeeId = newTee!.id;

    // Insert holes for the new pending tee
    const holeValues = teePlayed.holes.map((h) => ({
      teeId: resolvedTeeId,
      holeNumber: h.holeNumber,
      par: h.par,
      distance: h.distance,
      hcp: h.hcp,
    }));
    await tx.insert(hole).values(holeValues);
  } else {
    // No real changes -- user opened edit dialog but didn't change anything
    // Use existing tee and override approval status to approved
    resolvedTeeId = existing.id;
    approvalStatus = existing.approvalStatus as "approved" | "pending";
  }
} else if (existingTee.length > 0) {
  // Tee is approved and not edited -- reuse as-is
  resolvedTeeId = existingTee[0]!.id;
}
```

**C. Handle user selecting their own pending tee:**

When a user selects a pending tee (identified by `teePlayed.id` pointing to a pending row with `submittedBy = userId`):

```typescript
// If user selected their own pending tee (not editing it), just link the round
if (teePlayed.approvalStatus === "pending" && teePlayed.id > 0) {
  const pendingTee = await tx
    .select()
    .from(teeInfo)
    .where(
      and(
        eq(teeInfo.id, teePlayed.id),
        eq(teeInfo.approvalStatus, "pending"),
        eq(teeInfo.submittedBy, userId)
      )
    )
    .limit(1);

  if (pendingTee.length > 0) {
    resolvedTeeId = pendingTee[0]!.id;
    approvalStatus = "pending";
    // When editing a pending tee, parentTeeId should point to the ROOT
    // approved parent, not the pending tee itself
    parentTeeId = pendingTee[0]!.parentTeeId;
  }
}
```

**D. Create submission records** (after round insert):

```typescript
// Determine submission type and create audit record
const submissionRecords: Array<{
  submittedBy: string;
  roundId: number;
  courseId: number;
  teeId: number;
  submissionType: string;
  parentTeeId: number | null;
}> = [];

if (courseIsNew) {
  submissionRecords.push({
    submittedBy: userId,
    roundId: insertedRound.id,
    courseId: resolvedCourseId,
    teeId: resolvedTeeId,
    submissionType: "new_course",
    parentTeeId: null,
  });
} else if (teeIsNew && !teeIsEdit) {
  submissionRecords.push({
    submittedBy: userId,
    roundId: insertedRound.id,
    courseId: resolvedCourseId,
    teeId: resolvedTeeId,
    submissionType: "new_tee",
    parentTeeId: null,
  });
} else if (teeIsEdit) {
  submissionRecords.push({
    submittedBy: userId,
    roundId: insertedRound.id,
    courseId: resolvedCourseId,
    teeId: resolvedTeeId,
    submissionType: "tee_edit",
    parentTeeId: parentTeeId,
  });
}

if (submissionRecords.length > 0) {
  await tx.insert(submissions).values(submissionRecords);
}
```

**E. Set `submittedBy` on new courses and tees:**

Update the existing course insert (~line 281-291) to include `submittedBy: userId`.
Update the existing tee insert (~line 327-349) to include `submittedBy: userId`.

#### 3. Verify Zod schema for scorecard input

**File**: `types/scorecard-input.ts`

The `approvalStatus` field on the tee schema (line 77) currently allows `"approved" | "pending"`. No changes needed -- the frontend already correctly sets this. Verify that `"rejected"` is NOT added to the frontend schema since users never submit rejected data.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [x] Existing tests pass: `pnpm test`

#### Manual Verification:
- [ ] Submitting a round with an unedited approved tee: round is approved, no submission record created
- [ ] Editing a tee's course rating and submitting: new pending tee row created with `parentTeeId`, submission record with `tee_edit` type, round is pending
- [ ] Editing hole pars/distances and submitting: same as above -- hole changes are detected
- [ ] Opening edit dialog but changing nothing: existing tee reused, round approved (no orphan)
- [ ] Creating a new course: submission record with `new_course` type
- [ ] Creating a new tee on existing course: submission record with `new_tee` type
- [ ] User selects their own pending tee for a new round: round links to existing pending tee, no duplicate created
- [ ] User edits their own pending tee: new pending tee created with `parentTeeId` pointing to the root approved parent
- [ ] Multiple users editing the same tee: each gets their own pending tee row (siblings, not a chain)
- [ ] Decimal tolerance: submitting tee with course rating "72.10" against existing "72.1" does not create spurious pending tee

---

## Phase 4: Update SQL Generation Scripts

### Overview

Update the two Python scripts that admins use to insert course data directly into the database. They need to include the new `submittedBy` column (set to null for admin inserts).

### Changes Required:

#### 1. Update `scripts/parse_scorecard.py`

**A. Update `generate_sql_with_variables()`** (~line 344):

In the `teeInfo` INSERT statement (~line 408-426), add `"submittedBy"` column with null value:

```python
sql_parts.append(f"""    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus", "submittedBy"
    )
    values (
        v_course_id, '{tee_name_escaped}', '{tee.gender}',
        {tee.course_rating_18}, {tee.slope_rating_18},
        {course_rating_9:.1f}, {slope_rating_9},
        {course_rating_9:.1f}, {slope_rating_9},
        {out_par}, {in_par}, {total_par},
        {out_distance}, {in_distance}, {total_distance},
        '{course.distance_measurement}', 'approved', null
    )
    returning id into v_tee_id_{i};""")
```

In the `course` INSERT statement (~line 381-383), add `"submittedBy"` column with null value:

```python
sql_parts.append(f"""    insert into public.course (name, city, country, website, "approvalStatus", "submittedBy")
    values ('{name_escaped}', '{city_escaped}', '{country_escaped}', {website_value}, 'approved', null)
    returning id into v_course_id;""")
```

**B. Also update the older `generate_sql()` function** (~line 257) with the same changes for consistency, even though `generate_sql_with_variables()` is the one called by `main()`.

#### 2. Update `scripts/parse_scorecard_transposed.py`

**A. Update `generate_sql_for_tee()`** (~line 215):

In the `teeInfo` INSERT statement (~line 251-269), add `"submittedBy"` column with null value:

```python
sql_parts.append(f"""    insert into public."teeInfo" (
        "courseId", name, gender,
        "courseRating18", "slopeRating18",
        "courseRatingFront9", "slopeRatingFront9",
        "courseRatingBack9", "slopeRatingBack9",
        "outPar", "inPar", "totalPar",
        "outDistance", "inDistance", "totalDistance",
        "distanceMeasurement", "approvalStatus", "submittedBy"
    )
    values (
        v_course_id, '{tee_name_escaped}', '{tee.gender}',
        {tee.course_rating_18}, {tee.slope_rating_18},
        {course_rating_9:.1f}, {tee.slope_rating_18},
        {course_rating_9:.1f}, {tee.slope_rating_18},
        {out_par}, {in_par}, {total_par},
        {out_distance}, {in_distance}, {total_distance},
        '{course.distance_measurement}', 'approved', null
    )
    returning id into v_tee_id;""")
```

**B. Update `generate_full_sql()`** (~line 312):

In the `course` INSERT statement (~line 345-347), add `"submittedBy"` column with null value:

```python
sql_parts.append(f"""    insert into public.course (name, city, country, website, "approvalStatus", "submittedBy")
    values ('{name_escaped}', '{city_escaped}', '{country_escaped}', {website_value}, 'approved', null)
    returning id into v_course_id;""")
```

### Success Criteria:

#### Automated Verification:
- [ ] Scripts execute without error: `python scripts/parse_scorecard.py` (with test input)
- [ ] Scripts execute without error: `python scripts/parse_scorecard_transposed.py` (with test input)
- [ ] Generated SQL is valid and includes `"submittedBy"` column

#### Manual Verification:
- [ ] Generated SQL inserts course with `submittedBy = null`
- [ ] Generated SQL inserts teeInfo with `submittedBy = null`
- [ ] Generated SQL executes successfully against the database with the new schema

---

## Phase 5: Data Migration for Orphaned Pending Rounds

### Overview

Fix existing production data: pending rounds whose course and tee are both approved. This runs last, after all code changes are deployed.

### Changes Required:

#### 1. Create data migration

**File**: `supabase/migrations/[timestamp]_fix_orphaned_pending_rounds.sql`

```sql
-- =============================================================================
-- Migration: Fix orphaned pending rounds
-- Purpose: Approve rounds that are pending but whose course and tee are both approved.
-- These were caused by the silent tee edit discard bug (now fixed in Phase 3).
-- This migration runs last to ensure the bug fix is in place before cleanup.
-- =============================================================================

-- Find and approve orphaned pending rounds, with logging
do $$
declare
  affected_count integer;
begin
  update public.round r
  set "approvalStatus" = 'approved'
  from public.course c, public."teeInfo" t
  where r."courseId" = c.id
    and r."teeId" = t.id
    and r."approvalStatus" = 'pending'
    and c."approvalStatus" = 'approved'
    and t."approvalStatus" = 'approved';

  get diagnostics affected_count = row_count;
  raise notice 'Fixed % orphaned pending rounds', affected_count;
end $$;
```

This migration is idempotent -- running it again has no effect since it only touches pending rounds.

### Success Criteria:

#### Manual Verification:
- [ ] Query `select count(*) from round where "approvalStatus" = 'pending'` before and after migration
- [ ] All previously orphaned rounds are now approved
- [ ] Handicap recalculation is triggered for affected users (the round UPDATE trigger will enqueue them)

---

## Phase 6: Remove Redundant Snapshot Columns (Separate Release)

### Overview

Remove the `courseRatingUsed` and `slopeRatingUsed` columns from the `round` table and all code references. This is deployed as a separate release after the main workflow is verified working.

### Changes Required:

#### 1. Create migration file

**File**: `supabase/migrations/[timestamp]_remove_snapshot_columns.sql`

```sql
-- =============================================================================
-- Migration: Remove redundant snapshot columns from round
-- Purpose: These columns were written at round creation but never read by
-- frontend display or handicap recalculation. With immutable tee versioning,
-- round.teeId always points to the correct immutable tee row.
-- =============================================================================

-- Drop the redundant columns
alter table public.round drop column "course_rating_used";
alter table public.round drop column "slope_rating_used";
```

#### 2. Update Drizzle schema

**File**: `db/schema.ts`

Remove `courseRatingUsed` and `slopeRatingUsed` from the `round` table definition.

#### 3. Remove all code references

**Files to update:**
- `server/api/routers/round.ts`: Remove from `RoundCalculations` type (lines 26-27), computation logic (lines 67-68, 72-73, 93-94), return value (lines 109-110), destructuring (lines 465-466), and DB insert (lines 490-491)
- `server/api/routers/scorecard.ts`: Remove from return objects (lines 106-107, 224-229)
- `server/api/routers/auth.ts`: Remove `courseRatingUsed` and `slopeRatingUsed` from the GDPR data export mapping (lines 202-203)
- `tests/unit/statistics/test-fixtures.ts`: Remove from fixture data (lines 67-68)
- `supabase/functions/handicap-shared/round-schemas.ts`: Remove the exclusion comment (lines 7-9, no longer relevant)
- Regenerate types: `pnpm gen:types`

**Note**: The `holesPlayed` column mentioned in the same Edge Function comment should NOT be removed -- it is actively read by frontend components.

### Success Criteria:

#### Automated Verification:
- [ ] Migration applies cleanly
- [ ] Drizzle schema matches migration: `pnpm drizzle-kit generate` produces no diff
- [ ] Type checking passes: `pnpm build`
- [ ] Existing tests pass: `pnpm test`

#### Manual Verification:
- [ ] Snapshot columns are gone from the round table
- [ ] Frontend scorecard display still shows correct ratings (from teePlayed, not snapshot columns)
- [ ] GDPR data export works correctly without the removed columns

---

## Testing Strategy

### Unit Tests:

- **Tee change detection logic**: Test that `hasRatingChanges`, `hasParChanges`, `hasDistanceChanges`, `hasHoleChanges` correctly identify differences
- **Decimal tolerance**: Test that course rating "72.10" vs "72.1" is not flagged as a change
- **Submission record creation**: Test that the correct `submissionType` is determined based on the submission context

### Integration Tests:

- **Round submission with tee edit**: Submit a round with an edited tee, verify new pending tee row created with `parentTeeId`, submission record exists
- **Round submission with no changes**: Submit a round where user opened edit but changed nothing, verify existing tee reused, no orphaned pending round
- **User selects own pending tee**: Submit round with previously created pending tee, verify round links to it, no duplicate tee created
- **Approval cascade via stored procedure**: `select approve_submission(<id>)`, verify tee approved, parent archived, round approved, submission deleted, handicap recalculation enqueued
- **Concurrent edit safety**: Two pending tees with same `parentTeeId`, approve one, verify the other's rounds are remapped to the winner (not the archived parent) and the sibling is rejected
- **Manual rejection via stored procedure**: `select reject_submission(<id>)`, verify rounds reassigned to parent, scores remapped via `remap_round_to_tee()`, submission deleted
- **Auto-rejection (parent archived)**: Reject a sibling after another sibling was approved, verify rejection trigger does nothing (rounds already remapped by approval trigger)
- **Rejection without parent**: Reject a new tee, verify rounds rejected
- **Decimal tolerance**: Submit a tee with course rating "72.10" against existing "72.1", verify no spurious pending tee created

### Manual Testing Steps:

1. Submit a round on an approved course/tee with no edits -- should be approved immediately
2. Edit a tee's course rating, submit round -- round should be pending, new pending tee in DB
3. Edit hole pars only, submit round -- same as above (hole changes detected)
4. Open edit dialog, change nothing, submit round -- should be approved (no orphan)
5. Create new course with tees, submit round -- all pending, submission record created
6. Submit a second round selecting the pending tee from step 2 -- round links to existing pending tee
7. Approve via stored procedure: `select approve_submission(<id>)` -- cascade triggers fire, round approved, parent tee archived, submission deleted
8. Reject via stored procedure: `select reject_submission(<id>)` -- round reassigned to parent, scores remapped, submission deleted
9. Submit two edits to same tee (two users), approve one -- verify the other is auto-rejected and its rounds point to the approved version
10. Verify scorecard display shows correct ratings after remap (from teePlayed, not snapshot columns)

## Edge Cases

### Approved tee with incorrect data (the Evan scenario)

**Scenario**: User Ben edits the yellow tee and submits a round. User Evan submits a round to the same yellow tee (unedited) without realizing the data is wrong. Yellow tee edit is approved. Ben's round is approved with correct data. Evan's round was already auto-approved against the original (incorrect) tee.

**Behavior**: Evan's round keeps the old tee data because it points to the now-archived original tee. The Edge Function recalculates Evan's handicap using the archived tee's ratings. This is by design:
- Evan saw the tee data during submission and implicitly accepted it
- USGA handicap calculations use the rating at the time the round was played
- Retroactive changes conflate "correcting wrong data" with "tee was re-rated"

**Admin escape hatch**: If the old data was objectively wrong (not re-rated), an admin can manually remap Evan's round:

```sql
-- Remap specific rounds from archived tee to corrected tee
select public.remap_round_to_tee(<round_id>, <old_tee_id>, <new_tee_id>);
```

### Multiple users editing the same tee

Each edit creates its own pending tee row (siblings with the same `parentTeeId`). When an admin approves one:
1. The approved edit becomes the new canonical tee
2. All sibling edits' rounds are remapped to the approved version
3. Sibling edits are rejected
4. All affected users get handicap recalculations

### User edits their own pending tee

If a user selects their own pending tee and edits it, a new pending tee is created with `parentTeeId` pointing to the **root approved parent** (not to the pending tee). This keeps all edits as flat siblings for clean admin review.

## Performance Considerations

- The partial unique index on `teeInfo` is more restrictive (includes WHERE clause), which is slightly more efficient than the previous unconditional index for write operations
- The `submissions` table indexes on `status` (partial, pending only) and `submittedBy` keep admin and user queries fast
- The partial index on `parentTeeId` (non-null only) keeps rejection trigger and admin queries fast without bloating the index for the majority of rows where `parentTeeId` is null
- The `remap_round_to_tee` function operates on a single round at a time -- the approval trigger loops through affected rounds individually
- The hole comparison in Phase 3 requires fetching existing holes during submission -- this adds one query but only when the tee is marked as pending (edited)
- Removing the snapshot columns (Phase 6) reduces the round table row size and eliminates unnecessary write operations during round creation

## Admin Workflow

Admins approve/reject submissions via stored procedures in the Supabase dashboard. One call handles everything atomically.

**To find pending submissions:**
```sql
select s.*, p.email as submitter_email, c.name as course_name, t.name as tee_name
from public.submissions s
join public.profile p on p.id = s."submittedBy"
left join public.course c on c.id = s."courseId"
left join public."teeInfo" t on t.id = s."teeId"
where s.status = 'pending'
order by s."createdAt";
```

**To approve a submission:**
```sql
select public.approve_submission(<submission_id>);
```

**To reject a submission:**
```sql
select public.reject_submission(<submission_id>);
```

**To manually remap a round (e.g., the Evan scenario):**
```sql
select public.remap_round_to_tee(<round_id>, <old_tee_id>, <new_tee_id>);
```

## Deployment

Phases 1-5 are deployed together as a single release. Phase 6 (snapshot column removal) is deployed separately to allow independent rollback.

```
Phase 1 (Schema)
  → Phase 2 (Utility Fn + Triggers + Procedures)
    → Phase 3 (Backend Fix)
      → Phase 4 (Scripts)
        → Phase 5 (Data Migration — runs last)

--- separate release ---

Phase 6 (Snapshot Column Removal)
```

Phase 5 (orphaned rounds fix) runs last to ensure the bug fix from Phase 3 is in place before cleanup. The round UPDATE trigger will enqueue handicap recalculations for affected users.

Phase 6 can be deployed once the main release is verified working in production.

## Known Limitations (Deferred)

- **Merge operations**: Not implemented. If duplicate courses/tees are submitted, admins can approve one and reject the other. Full merge (reassigning rounds across courses with FK remapping) is deferred until there's a real need -- too many edge cases (mismatched hole counts, multi-tee courses).
- **Submission notifications**: No email notifications to users when their submissions are approved/rejected. Can be added later with a trigger on `submissions.status` changes.
- **Submission UI for users**: Users can see their own pending tees in tee selection, but there's no dedicated frontend for viewing submission history yet.
- **Admin dashboard**: No frontend for admin review. Admins use stored procedures in the Supabase dashboard.

## References

- Current teeInfo schema: `db/schema.ts:131-176`
- Current round submission logic: `server/api/routers/round.ts:217-556`
- Current cascade trigger: `supabase/migrations/20251011121805_cascade_approval_rounds.sql`
- Current handicap queue trigger: `supabase/migrations/20260214120000_fix_enqueue_trigger_cascade_delete.sql`
- Edge Function (production processor): `supabase/functions/process-handicap-queue/index.ts`
- Frontend tee management: `hooks/useTeeManagement.ts`
- SQL generation scripts: `scripts/parse_scorecard.py`, `scripts/parse_scorecard_transposed.py`
- Snapshot column exclusion comment: `supabase/functions/handicap-shared/round-schemas.ts:7-9`
- Unique index name: `teeInfo_courseId_name_gender_key` (confirmed in `db/schema.ts:156`, migration `20251011094523`)
