# Plan 002: Thin admin moderation console — stop running approvals through the Supabase SQL editor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 469a53f..HEAD -- apps/web/server/api/ apps/web/app/ apps/web/emails/admin-submission-notification.tsx apps/web/env.ts scripts/parity/routes.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (first privileged surface in the app; authorization must be server-side and correct)
- **Depends on**: none (pairs with plans/003, which adds rejection reasons to the mutations built here)
- **Category**: direction
- **Planned at**: commit `469a53f`, 2026-07-02

## Why this matters

Every community course/tee submission is currently moderated by opening the Supabase SQL editor and hand-calling a stored procedure with a numeric ID — the admin notification email literally instructs this. That is founder-only, error-prone (one mistyped ID rejects the wrong tee), and about to collide with two growth fronts: App Store users arriving (PRs #127–#130 shipped the native app) and bulk course ingestion (29 staged, 539 targeted — plans/001). This plan builds the minimum honest version: a server-side admin gate, a pending-submissions queue page, and approve/reject actions that call the *existing, already-hardened* RPCs. It is also the prerequisite surface for the rejection-reason loop (plans/003).

## Current state

Files and facts (verified at commit `469a53f`):

- `apps/web/emails/admin-submission-notification.tsx:139-146` — the email's "Next step" text:

  ```tsx
  <strong>Next step:</strong> review the submission(s) and call{" "}
  <code>approve_submission(submissionId)</code> or{" "}
  <code>reject_submission(submissionId)</code> via the Supabase
  SQL editor using the service role.
  ```

- `supabase/migrations/20260410165734_fix_submission_fk_and_procedure_safety.sql` — the current (latest) definitions: `approve_submission(bigint)` and `reject_submission(bigint)`, both `security definer`, row-locked (`for update`), with null-FK guards; both `revoke ... from public, anon, authenticated` and `grant execute ... to service_role` (lines 190–194). Both delete the submission row when resolved. **Do not modify these RPCs in this plan** (plans/003 changes their signature; here you only call them).
- No admin surface exists: there is no `admin` directory under `apps/web/app/`, no `admin.ts` in `apps/web/server/api/routers/` (routers: account, auth, contact, course, hole, round, scorecard, stats, stripe, tee), and no role primitive — `grep -inE "isadmin|is_admin" apps/web/db/schema.ts` returns nothing.
- The only admin-identity signal in the codebase: `ADMIN_ALERT_EMAILS: z.string()` at `apps/web/env.ts:32` (comma-separated list consumed by `apps/web/lib/admin-alerts.ts` for notification fan-out).
- `apps/web/server/api/trpc.ts:240-242` — procedure primitives:

  ```ts
  export const publicProcedure = t.procedure;
  export const authedProcedure = t.procedure.use(async function isAuthed(opts) {
  ```

  (Read the full `isAuthed` middleware before Step 1 — your `adminProcedure` composes onto it.)
- `apps/web/db/schema.ts:377-402` — `submissions` table: `id, submittedBy, roundId (nullable), courseId, teeId, submissionType ('new_course'|'new_tee'|'tee_edit'), parentTeeId, createdAt`. RLS: users can select their **own** rows only — an admin listing cannot go through the user's RLS-scoped client.
- Supabase client conventions (`.claude/rules/coding-conventions.md`): `@supabase/ssr` clients for user-scoped access; the service-role client is allowed only in "clearly-scoped server utilities" and its use must be justified in the PR. Find the existing service-role client helper by `grep -rn "SERVICE_ROLE" apps/web/lib apps/web/server --include="*.ts" -l` and reuse it — do not instantiate a new one ad hoc.
- Web↔native parity gate: any new web route without a native twin fails `pnpm parity:routes` unless declared in `INTENTIONAL.webOnly` (`scripts/parity/routes.mjs:36-44`). An admin console is deliberately web-only.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Typecheck (web) | `pnpm --filter web exec tsc --noEmit` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Route parity gate | `pnpm parity:routes` | PASS |
| Dev server | `pnpm dev` | web on :3000 |

## Scope

**In scope** (the only files you should create/modify):
- `apps/web/env.ts` (add `ADMIN_EMAILS`)
- `apps/web/server/api/trpc.ts` (add `adminProcedure`)
- `apps/web/server/api/routers/admin.ts` (create)
- `apps/web/server/api/root.ts` (register the router — locate it; it's the file that composes `createTRPCRouter({...})` from the routers directory)
- `apps/web/app/admin/submissions/page.tsx` + colocated client components (create)
- `apps/web/emails/admin-submission-notification.tsx` (swap the SQL instruction for a link)
- `scripts/parity/routes.mjs` (declare the route web-only)
- `apps/web/tests/unit/` (new tests)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- The `approve_submission`/`reject_submission` SQL functions and any `supabase/migrations/` file — plans/003 owns RPC changes; this plan only calls them as-is.
- Rejection reasons / submission history for end users — plans/003.
- Billing/reconciliation admin views, webhook viewers, queue dashboards — deliberately deferred (see Maintenance notes).
- `apps/native/` — the console is web-only by design.

## Git workflow

- Branch: `advisor/002-admin-moderation-console`
- Commit style: conventional commits (e.g. `feat(admin): pending-submissions moderation queue`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the admin identity gate

1. In `apps/web/env.ts`, add `ADMIN_EMAILS: z.string()` to the server schema and `process.env.ADMIN_EMAILS` to `runtimeEnv`, mirroring how `ADMIN_ALERT_EMAILS` is declared at lines 32/82. Keep the two variables separate: `ADMIN_ALERT_EMAILS` = who gets notification emails; `ADMIN_EMAILS` = who may moderate. Add `ADMIN_EMAILS` to `.env.example` if that file exists (check; do not create it otherwise).
2. In `apps/web/server/api/trpc.ts`, add below `authedProcedure`:

   ```ts
   export const adminProcedure = authedProcedure.use(async function isAdmin(opts) {
     const email = opts.ctx.user?.email?.toLowerCase();
     const admins = env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
     if (!email || !admins.includes(email)) {
       throw new TRPCError({ code: "FORBIDDEN" });
     }
     return opts.next(opts);
   });
   ```

   Adapt the exact `ctx` shape to what `isAuthed` actually puts on context (read it first — it may expose `ctx.session.user` instead of `ctx.user`). Import `env` from wherever the file already imports it, or from `@/env` matching repo convention.

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0.

**Design note (decided here, revisit only when a second admin class appears)**: an env-var email allowlist beats a `profile.isAdmin` column for now — no schema change, no RLS surface to get wrong, no way to self-grant via a compromised app path, and it matches the existing `ADMIN_ALERT_EMAILS` pattern. The cost (redeploy to change admins) is acceptable at founder scale.

### Step 2: Build the admin router

Create `apps/web/server/api/routers/admin.ts` with three procedures (all `adminProcedure`):

- `listPendingSubmissions` (query): service-role client (RLS blocks cross-user reads on `submissions`), returning each pending submission joined with its course name (`course.name`), tee name/gender (`teeInfo.name`, `teeInfo.gender`), submitter email or id (`profile`), `submissionType`, and `createdAt`, ordered oldest-first. Type the output explicitly; no `any`.
- `approveSubmission` (mutation, input `z.object({ submissionId: z.number().int().positive() })`): service-role client → `.rpc("approve_submission", { p_submission_id: input.submissionId })`. Surface the Postgres error message on failure (the RPCs raise descriptive exceptions like `Submission % not found`).
- `rejectSubmission` (mutation, same input shape): `.rpc("reject_submission", { p_submission_id: input.submissionId })`.

Check the actual RPC argument name in the migration file before calling (`p_submission_id` per `20260410165734`). Register the router in the root router file.

Justification for service-role use (repo rule requires it stated in the PR): the RPCs are intentionally `service_role`-only (migration `20260410165734` lines 190–194) and the queue must read all users' submissions; access is gated by `adminProcedure` before the service client is touched, and the client never leaves this server-only module.

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 3: Build the queue page

Create `apps/web/app/admin/submissions/page.tsx`:

- Server Component by default; put interactivity (approve/reject buttons with confirmation) in a colocated `"use client"` component, per the repo's Server-Components-first convention.
- **Defense in depth**: the page itself must also check admin status server-side (same `ADMIN_EMAILS` check against the session user, via the existing server session helper in `apps/web/server/` or the `@supabase/ssr` server client) and render a 404 (`notFound()`) for non-admins — do not rely solely on the tRPC layer, and do not leak the page's existence.
- UI: table of pending submissions (type, course, tee, submitter, age), Approve / Reject buttons per row, each with a confirm step (submission IDs must never be one mis-click from the wrong action — this is the exact failure mode of the SQL editor workflow this plan removes). Use existing shadcn primitives from `apps/web/components/ui/` (Table, Button, AlertDialog); compose, don't add new primitives. Mutations via tRPC + React Query with invalidation of `listPendingSubmissions` on success.
- Accessibility: semantic table, labeled buttons, keyboard reachable — the `a11y-check` hook runs on TSX edits; don't suppress findings.
- Empty state: "No pending submissions."

**Verify**: `pnpm dev`, then as a NON-admin user `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/submissions` (with a non-admin session cookie, or logged out) → 404; as an admin-listed user in the browser → queue renders. Approve a seeded pending submission → row disappears; check the course/tee flipped to `approved` in the local DB.

### Step 4: Declare the route web-only and fix the email

1. In `scripts/parity/routes.mjs`, add `"admin/submissions"` to `INTENTIONAL.webOnly` (line ~36) with a comment: `// Admin moderation console — operator tool, web-only by design (plans/002).`
2. In `apps/web/emails/admin-submission-notification.tsx:139-146`, replace the SQL-editor instruction with a link to `${siteUrl}/admin/submissions` ("Review in the moderation queue"). Find how other emails in `apps/web/emails/` receive their base URL prop and match it.

**Verify**: `pnpm parity:routes` → PASS. `pnpm email` renders the updated template without the words "SQL editor".

### Step 5: Tests

See Test plan. **Verify**: `pnpm test:unit` → all pass, including the new tests.

## Test plan

- New file `apps/web/tests/unit/admin-procedure.test.ts` (model structure on an existing unit test in `apps/web/tests/unit/` — pick the nearest tRPC/middleware test; if none tests a procedure, test the extracted allowlist-check function instead — extract it to `apps/web/lib/admin-authz.ts` so it's testable):
  - admin email in list → allowed; case-insensitive match; whitespace in env var tolerated.
  - non-admin authed user → FORBIDDEN; unauthenticated → UNAUTHORIZED (from `authedProcedure`).
  - empty `ADMIN_EMAILS` → everyone forbidden.
- Integration (only if `apps/web/tests/integration/` has a Supabase harness — check first): `approveSubmission` against a seeded pending submission flips `course.approvalStatus` to `approved` and deletes the submission row. If no harness pattern fits, skip and note it.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter web exec tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:unit` passes with the new admin-authz tests
- [ ] `pnpm parity:routes` PASSES with `admin/submissions` declared web-only
- [ ] Non-admin (and logged-out) requests to `/admin/submissions` get 404
- [ ] `grep -rn "SQL editor" apps/web/emails/` returns nothing
- [ ] No `supabase/migrations/` file was added or modified (`git status`)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `isAuthed` middleware in `trpc.ts` doesn't expose the user's email on ctx (you'd need a profile lookup — report the actual ctx shape and wait for direction rather than adding a DB roundtrip to every admin call unreviewed).
- No existing server-side service-role client helper exists to reuse (creating the first one is a security-sensitive decision the operator should see).
- The RPC signatures in the latest migration don't match `(p_submission_id bigint)`.
- Calling the RPCs from the service-role client fails for a permissions reason — do not weaken any `revoke`/`grant`.
- You find an existing admin/authorization mechanism this plan doesn't know about (search first: `grep -rni "admin" apps/web/server apps/web/proxy.ts`).

## Maintenance notes

- plans/003 extends `rejectSubmission` with a reason parameter and stops the RPC deleting rows — the mutation built here is its integration point; keep its input schema in one exported zod object.
- When a second class of admin (or a non-founder moderator) appears, migrate the env allowlist to a `profile` role column + JWT claim; the `adminProcedure` seam means only the middleware changes.
- Natural extensions that were deliberately NOT built (keep the console honest before growing it): reconcile-billing trigger button, webhook event viewer, handicap-queue health view (`monitor-queue.sh` replacement), bulk-approve for ingested courses (plans/001 loads with `--approve` instead).
- Reviewer should scrutinize: the service-role client never reaches a client component; the page-level gate returns 404 (not 403) to avoid advertising the route; mutation error states surface the RPC's exception text.
