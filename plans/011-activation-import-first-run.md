# Plan 011: Activation — starting-handicap seed, CSV round import, guided first-run

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0432f5f..HEAD -- apps/web/db/schema.ts apps/web/server/api/routers/round.ts apps/web/server/api/routers/course.ts apps/web/app/onboarding apps/web/components/homepage apps/native/app/onboarding.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L (three phases; each independently shippable — land A, then B, then C)
- **Risk**: MED (phase B writes rounds in bulk; bounded by validation + free-tier cap)
- **Depends on**: plan 008 strongly recommended first (imports feed the handicap engine; its tests are the safety net). Plan 009 helpful (measures activation).
- **Category**: direction
- **Planned at**: commit `0432f5f`, 2026-07-11

## Why this matters

Every golfer this app acquires already has a handicap and history somewhere (GHIN/WHS record, another app, a spreadsheet). Today there is no inbound path: no CSV/GHIN import exists anywhere in the codebase, and the first-run experience is a plan-selection paywall (`apps/web/app/onboarding/page.tsx`, `apps/native/app/onboarding.tsx`) followed by an empty dashboard. A switching golfer faces ~20 manual round entries before the app shows a meaningful index — the classic switching-cost wall that kills activation. Meanwhile the pieces half-exist: `profile.initialHandicapIndex` (`apps/web/db/schema.ts:37`, default 54) already seeds the engine's rolling index, GDPR *export* already ships, and the homepage "Journey to Scratch" visual hardcodes a scratch goal nobody set (`apps/web/components/homepage/handicap-goal.tsx:17-18`). This plan closes the loop: seed a starting index at onboarding (A), import history via CSV (B), and give the empty dashboard a guided path plus a real, user-set goal (C).

## Current state

- `apps/web/db/schema.ts:37` — `initialHandicapIndex: decimal<"number">().notNull().default(54)` on `profile`. The queue processor uses it as the timeline's starting rolling index. There is NO onboarding input for it.
- Onboarding: `apps/web/app/onboarding/page.tsx` and `apps/native/app/onboarding.tsx` are plan selection only.
- Round creation: single path `round.submitScorecard` (`apps/web/server/api/routers/round.ts:301`): validates `input.userId === ctx.user.id`, checks plan access (`:330-339`) and the 25-round free cap (`:341-346`, `FREE_TIER_ROUND_LIMIT` from `apps/web/utils/billing/constants.ts:8`), then a transaction resolving course/tee approval status (`:376-…`) and inserting round + scores; `resolvedApprovalStatus` comes from the matched course/tee (`:402,554,781`) — rounds on already-approved tees come out `approved`, unknown courses/tees create `pending` submissions for the admin queue.
- Course search: `course.searchCourses` (`apps/web/server/api/routers/course.ts:41-68`) — typeahead over approved courses, limit 10.
- Goal visual: `apps/web/components/homepage/handicap-goal.tsx:17-18` — "Calculate progress from starting handicap toward scratch (0) … simple 'journey to scratch' visualization". No `goal` column exists in `schema.ts`; no goal mutation in any router.
- Homepage/dashboard composition: `apps/web/components/homepage/home-page.tsx` (uses `initialHandicapIndex` at `:63-67`), `hero.tsx:20`.
- Conventions: forms = react-hook-form + zod shared schema; mutations via tRPC only; DB access server-side only; migrations pattern per `supabase/migrations/` (latest `20260703091818_…`); `pnpm check:schema-sync` after schema edits; web↔native parity for any web screen change (`.claude/rules/web-native-parity.md`).

## Design decisions (implement, don't relitigate)

1. **Phase A — starting index**: after plan selection, an optional "Do you already have a handicap?" step writes `profile.initialHandicapIndex` (0.0–54.0, one decimal). Skippable; skip = leave 54. Native onboarding gets the same step (parity).
2. **Phase B — CSV import, existing approved courses only**: importer matches each row to an approved course + tee; rows that don't match are reported back per-row and skipped — the import NEVER creates courses/tees or `pending` submissions. (Community course submission stays the interactive flow.)
3. **CSV format v1 (per-hole, 9 or 18)**: header `date,course,tee,gender,holes,h1..h18` — `date` ISO `YYYY-MM-DD`; `course` name matched case-insensitively against approved courses (must match exactly one, else row error); `tee` name likewise within that course; `holes` 9|18; `h10..h18` empty for 9-hole rounds plus a `nineHoleSection` value front|back in the `tee` column's companion field — simplest encoding: an extra column `section` (front|back|blank). Total-score-only rows are NOT supported (engine needs per-hole strokes for net double bogey) — document this in the UI copy.
4. **Imports respect the free-tier cap**: rows beyond `remainingRounds` are rejected with a clear per-row error ("free tier limit") — the 25-round limit stays meaningful. Server enforces; client shows the count up front.
5. **Imported rounds** go through the SAME per-round validation as `submitScorecard` (score bounds, 9/18 shape, `nineHoleSection`) and are inserted with the approval status resolved from the approved tee (i.e., `approved`), then ONE handicap-queue recompute is enqueued at the end (not one per row) if the queue API allows it — check how `submitScorecard` enqueues; if it's a per-round DB trigger, let it be.
6. **Phase C — first-run + goal**: add `goalHandicapIndex: decimal, nullable` to `profile`; a small settings/inline control sets it; `handicap-goal.tsx` uses it when set (falls back to 0/scratch). Empty dashboard (0 rounds) renders a 3-item checklist: "Log your first round" → `/rounds/add`, "Import your history" → the Phase-B surface, "Set your goal" → the goal control. Native dashboard parity.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Local stack | `supabase start` | local DB up |
| Types regen | `pnpm gen:local` | supabase.ts updated |
| Schema zod sync | `pnpm check:schema-sync` | exit 0 |
| Tests | `pnpm test:unit` / `pnpm test:integration` | all pass |
| Lint | `pnpm lint` | exit 0 |
| Parity | `pnpm parity:styles` / `pnpm parity:drift` / `pnpm parity:routes` | exit 0 / noted / exit 0 |
| Native bundle | `cd apps/native && npx expo export -p ios` | bundles |

## Scope

**In scope**:
- `apps/web/app/onboarding/page.tsx` + the components it renders; `apps/native/app/onboarding.tsx` (Phase A parity)
- `apps/web/server/api/routers/account.ts` or `round.ts` — a `setInitialHandicap` mutation (put it where profile mutations already live; check `account.ts` first) and a new `round.importRounds` mutation
- `supabase/migrations/<ts>_profile_goal_handicap.sql`, `apps/web/db/schema.ts` (goal column), regenerated `types/supabase.ts`
- New import UI: a web route or profile-page section (prefer a section under the existing profile/rounds surface — adding a new top-level route requires `pnpm parity:routes` alignment or an `INTENTIONAL.webOnly` entry in `scripts/parity/routes.mjs`; prefer avoiding that)
- `apps/web/components/homepage/{home-page,handicap-goal}.tsx` + native dashboard sibling (Phase C)
- New tests per Test plan

**Out of scope** (do NOT touch):
- GHIN/GolfBox API integrations — no external APIs exist for us yet (see `docs/official-handicap-roadmap.md` once plan 007 lands)
- Course/tee creation from import rows (decision 2)
- The handicap engine and queue processor internals
- `submissions` table / moderation flows
- AI scorecard extraction

## Git workflow

- Branch: `advisor/011-activation-import-first-run`; one commit per phase minimum
- Conventional commits, e.g. `feat(onboarding): optional starting handicap step`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1 (Phase A): starting-handicap step

Add the optional step after plan selection on web onboarding; mutation validates `z.number().min(0).max(54)` (one decimal — use `z.number().multipleOf(0.1)` or round server-side) and writes `profile.initialHandicapIndex` for `ctx.user.id` only. Mirror the step on native onboarding. Copy: "If you have an official handicap today, enter it — your index starts there instead of 54."

**Verify**: `pnpm test:integration` includes a new case (mutation writes the value; rejects 54.1/−1); `pnpm lint` exit 0; `npx expo export -p ios` bundles.

### Step 2 (Phase B): `round.importRounds` mutation

Input: `z.array(importRowSchema).max(50)` (rows pre-parsed client-side from CSV; server never parses CSV text). For each row: resolve course by exact case-insensitive name among approved courses (reuse the query shape of `course.searchCourses` but exact-match; ambiguous/missing → row error), resolve tee by name + gender within it (approved only), fetch its holes, build the scores array, run the SAME zod validation as `submitScorecard` (`scorecardSchema` from `apps/web/types/scorecard-input.ts`), enforce the free-tier cap across the batch (count existing + accepted-so-far), insert accepted rounds in one transaction reusing the insert logic — extract the round+scores insert from `submitScorecard`'s transaction into a shared server helper rather than duplicating it (both callers use the helper; behavior of `submitScorecard` unchanged). Return `{ imported: n, errors: [{row, reason}] }`.

**Verify**: `pnpm test:integration` — new cases below — pass; existing `submitScorecard` integration tests unchanged and passing.

### Step 3 (Phase B): import UI

Client: file input → parse CSV (add a tiny dependency-free parser or use `papaparse` — check `pnpm ls papaparse` first; if absent, prefer hand-rolling for the fixed header over adding a dependency), preview table with per-row validation status, "Import N rounds" button → mutation → results with per-row errors. Downloadable template CSV. Place it as a section reachable from profile + the Phase-C checklist. Copy must state: only courses already in Handicappin can be matched; per-hole scores required.

**Verify**: manual: import a 3-row CSV against seeded local courses → 3 rounds appear, handicap recomputes; `pnpm lint` exit 0.

### Step 4 (Phase C): goal column + guided empty state

Migration adds `goalHandicapIndex` decimal NULL to `profile`; regen types; `pnpm check:schema-sync` (profile isn't in the synced zod set, but run it anyway). Mutation `account.setGoalHandicap` (0–54 or null). `handicap-goal.tsx`: use the user's goal when set, else keep scratch; label accordingly. Empty dashboard: the 3-item checklist (decision 6). Native parity for dashboard + goal display.

**Verify**: `pnpm test:unit` for goal fallback logic; `pnpm parity:styles` exit 0; `pnpm parity:drift` noted.

## Test plan

- Integration (`apps/web/tests/integration/`, model on the existing round-submission test — locate via `grep -rln "submitScorecard" apps/web/tests`):
  1. importRounds happy path: 2×18-hole + 1×9-hole (front) rows → 3 approved rounds, scores persisted, differential computed.
  2. Unknown course name → row error, nothing inserted for that row.
  3. Ambiguous course name (two approved courses sharing a name) → row error.
  4. Free-tier user with 24 existing rounds importing 3 → 1 imported, 2 rejected with cap reason.
  5. Cross-user: `userId` spoofing impossible (mutation uses `ctx.user.id` only).
  6. setInitialHandicap + setGoalHandicap bounds.
- Unit: CSV row parser (malformed row, missing h-columns for 18, extra columns), goal fallback.

## Done criteria

- [ ] Onboarding (web + native) offers the optional starting-handicap step
- [ ] `round.importRounds` exists; the 6 integration cases pass; `submitScorecard` tests unmodified and green
- [ ] Import UI with preview + per-row errors + template download works against local stack
- [ ] `profile.goalHandicapIndex` migration applied; goal drives `handicap-goal.tsx`; empty dashboard shows the checklist
- [ ] `pnpm parity:routes` exits 0 (no unmatched new route, or an INTENTIONAL entry with justification)
- [ ] `pnpm lint`, `pnpm test:unit`, `pnpm test:integration` all exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The round+scores insert inside `submitScorecard`'s transaction cannot be extracted without changing its behavior (e.g., interleaved course-creation writes make the helper boundary unclear) — propose the boundary in your report before cutting.
- The handicap queue turns out to enqueue per-round via DB trigger AND batching causes duplicate/parallel recomputes — describe what you found; do not hand-roll queue dedup.
- Free-tier cap semantics elsewhere (native paywall copy, `rounds/add/page.tsx` messaging) contradict batch-rejection UX — report, don't improvise new billing copy.
- You need a new top-level route AND `INTENTIONAL.webOnly` feels wrong — ask via report rather than adding casually (the parity rule says never add to it casually).

## Maintenance notes

- When GHIN/GPA or GolfBox API access materializes (plan 007 owner actions), the importer's row-validation + shared insert helper is the seam a real API import plugs into — keep the helper transport-agnostic.
- The 50-row batch limit is a first guess; revisit with real usage (plan 009's `round_submitted` events with `method: "import"` — add that enum value to the taxonomy when this lands).
- Reviewers: scrutinize the free-tier cap race (concurrent import + manual add — `round.ts:938` shows the existing re-check pattern; the import transaction should re-check inside too).
