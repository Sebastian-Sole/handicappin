# Backlog

## Rejected Submission Re-submission UX

Users whose submissions are rejected currently have no clear path to resubmit. The rejected round remains in their history with no explanation or action. A future improvement should:

- Show rejection reason to the user (from admin notes)
- Allow users to resubmit a corrected version of a rejected round/tee
- Provide a "submission history" view showing pending, approved, and rejected submissions

**Context**: Identified during review of the tee/course approval workflow plan (`.claude/plans/tee-course-approval-workflow.md`).

---

## Course/Tee Submissions Without a Round

Currently, the `submissions` table and workflow are tightly coupled to round submission — a course or tee can only be submitted as part of submitting a round. In the future, users should be able to:

- Submit a new course without needing to attach a round
- Submit tee edits independently of round entry
- Pre-populate the course database via community contributions

**Context**: The `submissions.roundId` FK is nullable to support this, but no code path currently creates a submission without a round.
