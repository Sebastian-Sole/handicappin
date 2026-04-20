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

---

## Playwright E2E Scaffolding

Playwright is not yet installed. Before E2E specs can be written, the following need to be set up:

- Install `@playwright/test` and `@axe-core/playwright`; add `playwright.config.ts` with `keyboard-only`, `reflow-320`, and `forced-colors` projects
- Scaffold `e2e/` at the project root with `a11y-test.ts` (custom fixture exposing `makeAxeBuilder()`) and `a11y-assertions.ts` (the helpers table in the e2e-testing skill)
- Seeding scripts in `e2e/setup/` using the Supabase service-role client and Stripe test-mode SDK; `storageState` files for customer and admin sessions
- CI workflow (`.github/workflows/e2e.yml`) that installs Playwright browsers and uploads the report
- Fill in `.claude/skills/e2e-testing/references/personas/*.md` (first-time visitor, returning golfer, admin moderator, mobile-only, screen-reader user) and `references/user-test-contexts/*.md` (one per C-/A- scenario) as specified in `.claude/ONBOARDING.md` §4.7

**Context**: E2E skill and testing-modes reference are adapted to this domain but describe infrastructure that doesn't exist yet. See `.claude/skills/e2e-testing/SKILL.md`.
