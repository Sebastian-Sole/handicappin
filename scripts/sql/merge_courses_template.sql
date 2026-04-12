-- =============================================================================
-- Course Merge Workflow Template
-- =============================================================================
-- Use after find_duplicate_courses.sql and compare_courses.sql have identified
-- a duplicate pair to merge.
--
-- Scenario: Course B is a duplicate of Course A. Goal: merge B → A so that
--           all rounds end up on A, Course B is deleted, and any improved
--           tee data from B becomes pending tee edits of A's tees.
--
-- Always run in a transaction on staging first. Wrap each admin session in
-- BEGIN ... COMMIT (or ROLLBACK) so you can verify before committing.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- For each tee on Course B, pick one case and uncomment the call.
-- Refer to compare_courses.sql output to decide.
-- -----------------------------------------------------------------------------

-- Case 1: Tee on B matches a tee on A with IDENTICAL data
--   Rounds on B's tee get remapped to A's tee; B's tee is archived.
-- select public.merge_tees(
--   p_from_tee_id => <B_TEE_ID>,
--   p_to_tee_id   => <A_TEE_ID>
-- );


-- Case 2: Tee on B matches a tee on A but B has BETTER/UPDATED data
--   Convert B's tee into a tee_edit of A's tee. Rounds and submissions follow.
--   Admin then reviews and approves via the normal submission flow.
-- select public.convert_tee_to_edit(
--   p_tee_id        => <B_TEE_ID>,
--   p_parent_tee_id => <A_TEE_ID>
-- );
-- -- After review:
-- -- select public.approve_submission(<submission_id>);
-- -- or reject:
-- -- select public.reject_submission(<submission_id>);


-- Case 3: Tee on B has NO equivalent on A (e.g. a new tee color)
--   Move the tee (and its rounds) over to Course A intact.
-- select public.move_tee_to_course(
--   p_tee_id       => <B_TEE_ID>,
--   p_to_course_id => <A_COURSE_ID>
-- );


-- Case 4: Tee on B is garbage and should be discarded
--   If it has rounds, pick a target tee on A and use merge_tees (Case 1) instead.
--   If no rounds, archive it.
-- update public."teeInfo" set "isArchived" = true where id = <B_TEE_ID>;


-- -----------------------------------------------------------------------------
-- Verify: Course B should have no non-archived tees and no rounds left
-- -----------------------------------------------------------------------------
select
  (select count(*) from public."teeInfo" where "courseId" = <B_COURSE_ID> and not "isArchived") as remaining_live_tees,
  (select count(*) from public.round where "courseId" = <B_COURSE_ID>) as remaining_rounds;

-- If both counts are 0, drop Course B:
-- select public.delete_empty_course(<B_COURSE_ID>);

commit;
-- or: rollback;
