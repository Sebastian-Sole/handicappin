# Plan 003: Close the rejection loop — persist a reason, keep submission history, show the user a path forward

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 469a53f..HEAD -- apps/web/db/schema.ts supabase/migrations/ apps/web/emails/round-rejected.tsx apps/web/server/api/routers/ apps/web/components/homepage/activity-feed.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. In particular, plans/002 (admin
> console) is expected to have landed first — its `rejectSubmission` tRPC
> mutation is modified here.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED–HIGH (changes the approval RPCs and the submissions lifecycle — the core community-data workflow)
- **Depends on**: plans/002-admin-moderation-console.md (the reason is *entered* through that console; do not start this plan until 002 is DONE)
- **Category**: direction
- **Planned at**: commit `469a53f`, 2026-07-02

## Why this matters

When an admin rejects a submission today, the reason has nowhere to live: `reject_submission(bigint)` takes no reason argument and **deletes the submission row** on resolution. The user's experience is a bare "Round rejected" label in their activity feed and an email whose advice is a printed guess ("Most rejections come from tee ratings…"). There is no submission-history view and no resubmit path. On the app's core action — submitting a round — this is a silent churn generator: the user did something wrong, nobody can tell them what, and the data model forgot the event. `BACKLOG.md` ("Rejected Submission Re-submission UX") names exactly this. This plan makes submissions a retained, stateful record with a rejection reason, threads the reason through the admin console, the email, and a user-facing history view, and links "fix it" back into the add-round flow.

## Current state

Files and facts (verified at commit `469a53f`):

- `supabase/migrations/20260410165734_fix_submission_fk_and_procedure_safety.sql:132-183` — `reject_submission(p_submission_id bigint)`: `security definer`, locks the row `for update`, guards null `teeId`/`courseId`, sets `approvalStatus='rejected'` on the course and/or tee, then:

  ```sql
  -- Clean up: delete the submission row now that it's resolved.
  -- The submittedBy column on course/teeInfo preserves the audit trail.
  delete from public.submissions where id = p_submission_id;
  ```

  `approve_submission` (same file, above it) ends with the same `delete`. Both are `service_role`-execute only (lines 190–194).
- `apps/web/db/schema.ts:377-402` — `submissions`: `id, submittedBy, roundId (nullable), courseId, teeId, submissionType, parentTeeId, createdAt`. No status, no resolution timestamp, no reason. RLS already lets users `select` their own rows (`(select auth.uid()) = "submittedBy"`, lines 395–400) — a history view is one policy away from working; it just has no rows to show because resolution deletes them.
- `apps/web/emails/round-rejected.tsx:15-22` — props: `name, courseName, teeName, teePlayedAt, roundsUrl, supportEmail`. No reason. The body's guidance is generic; the CTA links to a plain rounds URL.
- `apps/web/components/homepage/activity-feed.tsx:111` — the only in-app rejection surface: a bare "Round rejected" feed label.
- Rejection emails are sent from the round-approval notification route: `apps/web/app/api/notifications/round-approval/route.ts` (read it before Step 4 — it's where the reason must be threaded into the email payload).
- plans/002 (prerequisite) adds `apps/web/server/api/routers/admin.ts` with `rejectSubmission({ submissionId })` calling the RPC, and an `/admin/submissions` queue page.
- Migration conventions: hand-written timestamped SQL in `supabase/migrations/`, Drizzle schema kept in sync by hand, `pnpm check:schema-sync` verifies, `pnpm gen:local` regenerates Supabase types.
- Triggers: earlier migrations (`20260410120001_update_approval_triggers.sql`) wire approval-status cascades between course/tee/round — read them before touching the RPCs; the round's own `approvalStatus` is what the activity feed and email flow key off.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck (web) | `pnpm --filter web exec tsc --noEmit` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Integration tests | `pnpm test:integration` | all pass (hits local Supabase) |
| Schema sync | `pnpm check:schema-sync` | exit 0 |
| Route parity | `pnpm parity:routes` | PASS |
| Email preview | `pnpm email` | renders templates |

## Scope

**In scope**:
- `supabase/migrations/<timestamp>_submission_lifecycle_and_reason.sql` (create)
- `apps/web/db/schema.ts` (submissions columns)
- `apps/web/server/api/routers/admin.ts` (reason input on reject)
- The plans/002 admin queue UI component (reason textarea on reject confirm)
- `apps/web/server/api/routers/` (new user-facing `listMySubmissions` — put it in the most fitting existing router, likely `scorecard.ts` or a small addition to `round.ts`)
- `apps/web/app/profile/[id]/` or the rounds surface for the history view (see Step 5 decision)
- `apps/web/emails/round-rejected.tsx` + `apps/web/app/api/notifications/round-approval/route.ts`
- `apps/web/components/homepage/activity-feed.tsx` (show reason snippet)
- `apps/web/tests/` (unit + integration)
- `scripts/parity/routes.mjs` (only if a new route is added in Step 5)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Round-less course/tee submissions (nullable `roundId` flywheel) — a separate future effort; do not widen the submission creation paths here.
- Resubmit-with-prefilled-data — Step 6 ships a deep link only; full prefill is deferred (see Maintenance notes).
- `apps/native/` — the history view's native twin is follow-up work; if you add a new web route, declare it in `INTENTIONAL.webOnly` with a `// TODO: port` comment rather than building the native screen in this plan.
- The approval (happy-path) email/flow beyond adding the retained-row status write.

## Git workflow

- Branch: `advisor/003-rejection-loop`
- Commit style: conventional commits (e.g. `feat(submissions): persist resolution status and rejection reason`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Schema — make submissions a retained record

Add to `submissions` in `apps/web/db/schema.ts` and a new migration:

```sql
alter table public.submissions
  add column if not exists "status" text not null default 'pending',
  add column if not exists "resolvedAt" timestamptz,
  add column if not exists "rejectionReason" text;
```

Drizzle side: `status: text().$type<"pending" | "approved" | "rejected">().default("pending").notNull()`, nullable `resolvedAt` timestamp with timezone, nullable `rejectionReason` text. (Union-typed text, not enum — repo rule.)

**Verify**: `pnpm check:schema-sync` → exit 0; `pnpm --filter web exec tsc --noEmit` → exit 0.

### Step 2: Migration — RPCs resolve instead of delete; reject takes a reason

In the same migration file, `create or replace` both functions, preserving everything they already do (row lock, null-FK guards, `security definer`, `set search_path = ''`, cascade updates) and changing only the resolution:

- `approve_submission(p_submission_id bigint)`: replace the final `delete` with
  `update public.submissions set "status" = 'approved', "resolvedAt" = now() where id = p_submission_id;`
- `reject_submission(p_submission_id bigint, p_reason text default null)`: same replacement with `status='rejected'`, `"rejectionReason" = p_reason`. Guard: `if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'A rejection reason is required'; end if;` — the whole point is that rejections carry reasons; don't let the default make it optional in practice. (The `default null` exists only so the old 1-arg signature can be dropped cleanly — see next line.)
- Postgres treats the 2-arg function as a new overload: `drop function if exists public.reject_submission(bigint);` before creating the 2-arg version, then re-issue the `revoke`/`grant` pair for **both** functions with their new signatures (copy lines 190–194 of `20260410165734` and fix the signature on the reject one).
- Also update the RPCs' internal queue-processing: both functions must now filter `where id = p_submission_id and "status" = 'pending'` in the initial locked select, and raise `'Submission % already resolved'` if the row exists but isn't pending (re-run safety now that rows survive).

**Verify** (local Supabase): apply the migration; in SQL: rejecting a seeded pending submission with a reason sets `status='rejected'`, `rejectionReason`, `resolvedAt`, and does NOT delete the row; calling it again raises `already resolved`; calling with an empty reason raises. `pnpm gen:local` regenerates types cleanly.

### Step 3: Thread the reason through the admin console

- `admin.ts` `rejectSubmission` input becomes `z.object({ submissionId: z.number().int().positive(), reason: z.string().trim().min(3).max(1000) })`; pass `p_reason` in the `.rpc()` call.
- `listPendingSubmissions` filters `status = 'pending'` (not "all rows" — resolved rows now persist).
- Queue UI: the reject confirmation dialog gains a required textarea ("Reason shown to the user"). Disable confirm until non-empty.

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0; in the dev app, rejecting without a reason is impossible; with a reason, the row leaves the queue.

### Step 4: Thread the reason into the email

- `round-rejected.tsx`: add `rejectionReason?: string | null` to props; render it in a visually distinct block ("Why it was rejected") above the generic guidance when present. Keep the generic paragraph as fallback when absent (old in-flight events).
- `apps/web/app/api/notifications/round-approval/route.ts`: read the file, find where the rejected branch builds the email payload, and include the submission's `rejectionReason` (it must be fetched with whatever query feeds this route — extend that query, matching its existing style).

**Verify**: `pnpm email` → the round-rejected preview renders a reason block when the preview props include one; `pnpm lint` → exit 0.

### Step 5: User-facing submission history + feed reason

- Add `listMySubmissions` as an `authedProcedure` (user-scoped Supabase client — the RLS select-own policy at `schema.ts:395-400` already permits this; no service role) returning the user's submissions with status, reason, course/tee names, createdAt/resolvedAt.
- Surface decision (decided here): render history as a section on the existing profile page (`apps/web/app/profile/[id]/`) rather than a new route — it avoids a new parity entry and matches where users manage their account. Locate the profile page's section structure and add "My submissions" following its existing card/section pattern, showing status chips (pending/approved/rejected) and the rejection reason inline.
- `activity-feed.tsx:111`: where the feed renders "Round rejected", append a short reason preview when the feed item's round links to a rejected submission with a reason (extend the feed's data source only if it's a cheap join; if the feed query is a hot path with no submission join, link to the profile history section instead — note which you did).

**Verify**: `pnpm parity:routes` → PASS (no new route). In dev: a user with a rejected submission sees status + reason in profile; another user cannot see it (RLS — check by hitting `listMySubmissions` as a different user → empty).

### Step 6: Resubmit deep link

In the history section and the rejected feed item, add a "Fix and resubmit" link to `/rounds/add`. Full prefill of the original data is explicitly deferred; the link is the honest v1.

**Verify**: link navigates; `pnpm lint` → exit 0.

## Test plan

- **Integration** (`apps/web/tests/integration/`, real local Supabase — model on an existing integration test there):
  - reject with reason → row retained with `status='rejected'`, reason, `resolvedAt`; tee/course flipped to rejected.
  - reject twice → second call raises `already resolved`.
  - reject with empty reason → raises.
  - approve → `status='approved'`, row retained.
  - RLS: user A cannot select user B's submissions.
- **Unit** (`apps/web/tests/unit/`): zod input schema for `rejectSubmission` (min length, trims); email template renders with/without reason.
- Run `pnpm test:integration` and `pnpm test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `pnpm check:schema-sync`, `pnpm --filter web exec tsc --noEmit`, `pnpm lint` all exit 0
- [ ] `pnpm test:unit` and `pnpm test:integration` pass, including the new cases above
- [ ] `grep -n "delete from public.submissions" supabase/migrations/<new file>` returns nothing (resolution no longer deletes)
- [ ] The 1-arg `reject_submission(bigint)` no longer exists (`\df public.reject_submission` shows only the 2-arg form) and both RPCs remain `service_role`-execute only
- [ ] `pnpm parity:routes` PASSES
- [ ] A rejected submission's reason is visible in: admin queue (entry), email preview, profile history, and (reason or link) the activity feed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- plans/002 has not landed (no `admin.ts` router / no admin queue UI) — this plan modifies both.
- The RPC bodies in the latest migration differ materially from the `20260410165734` excerpts (another migration may have superseded them — find the latest definition first with `grep -rln "reject_submission" supabase/migrations/ | sort | tail -1`).
- The approval triggers (`20260410120001`) turn out to read or depend on submission-row deletion (e.g. a trigger keyed on `delete on submissions`) — report the trigger before changing lifecycle semantics.
- The round-approval notification route derives its data in a way that can't see the submission row (e.g. fires before resolution) — report the actual sequencing.
- Retained rows break any existing query that assumed `submissions` only contains pending rows (`grep -rn "from(submissions)\|from submissions" apps/web/server apps/web/app` and check each caller) — report the callers instead of patching them ad hoc.

## Maintenance notes

- Retention means `submissions` now grows unboundedly; at current scale that's fine. If it ever matters, archive resolved rows older than N months — do not go back to deleting on resolution.
- The deferred full resubmit-prefill: the natural design is `/rounds/add?resubmit=<submissionId>` hydrating the scorecard form from the original round + rejection reason banner. It needs the round's scores joined back, which is why it was cut from v1.
- Round-less submissions (BACKLOG "Course/Tee Submissions Without a Round") build directly on this plan's retained lifecycle — when that lands, `roundId is null` rows flow through the same status machine, and cleanup paths keyed on `roundId` (`round.ts:947`) must learn the null case.
- Reviewer should scrutinize: the migration's `drop function` + `revoke`/`grant` re-issue (a missed grant silently breaks the admin console); the RLS check in the integration tests actually uses two different authed clients, not service role.
