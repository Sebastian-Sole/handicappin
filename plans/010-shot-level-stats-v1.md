# Plan 010: Shot-level stats v1 — putts, fairways, penalties per hole; GIR, FIR%, putts/round in statistics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0432f5f..HEAD -- apps/web/db/schema.ts apps/web/types/scorecard-input.ts supabase/functions/handicap-shared/shared-schemas.ts apps/web/lib/statistics apps/web/server/api/routers/stats.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (touches the scoring write path; mitigated: all new fields optional, engine proven untouched by plan 008's tests)
- **Depends on**: plan 008 recommended first (its characterization tests prove the engine ignores the new fields); plan 009 useful (measures adoption of the toggle)
- **Category**: direction
- **Planned at**: commit `0432f5f`, 2026-07-11
- **Issue**: https://github.com/Sebastian-Sole/handicappin/issues/140

## Why this matters

The app already collects hole-by-hole scores (the hard part) but stores only `strokes` + `hcpStrokes` per hole (`apps/web/db/schema.ts:316-325`), so none of the statistics serious golfers expect — putts per round, greens in regulation, fairways hit, penalties — can exist. The 40+ functions in `apps/web/lib/statistics/calculations.ts` are all strokes-vs-par derived. Competitors (Arccos, TheGrint, Golfshot) lead with these "money stats". This caps the value of the statistics product that the $29 Unlimited tier is sold on and blocks strokes-gained-style analysis later. v1 adds three optional per-hole fields and four headline stats, entered via an opt-in "detailed scoring" mode.

## Current state

- `apps/web/db/schema.ts:316-325` — `score` table: `id, userId, roundId, holeId, strokes (int, notNull), hcpStrokes (int, default 0, notNull)` with FKs cascading on round/hole.
- `apps/web/types/scorecard-input.ts:164-170` — `scoreSchema = z.object({ id?, roundId?, holeId?, strokes: z.number().min(0).max(99), hcpStrokes: z.number().min(0).max(99) })`. This file is the SOURCE OF TRUTH mirrored to `supabase/functions/handicap-shared/shared-schemas.ts`, enforced by `node scripts/check-schema-sync.mjs` (CI job `schema-sync-check`, `.github/workflows/ci.yml:98-114`). Any change here requires the mirrored edit.
- The engine consumes only `strokes` and `hcpStrokes` (see `calculateHoleAdjustedScore`, `calculateAdjustedPlayedScore`, `addHcpStrokesToScores` in `packages/handicap-core/src/calculations.ts:297-426`) — extra optional fields flow through untouched.
- Statistics: `apps/web/lib/statistics/{calculations.ts,format-utils.ts,player-type.ts,index.ts}`; served by `apps/web/server/api/routers/stats.ts`, which gates on plan — `stats.ts:37-45` throws FORBIDDEN unless plan is `unlimited`/`lifetime`. KEEP this gating decision as-is (the packaging question is tracked separately in `plans/README.md`).
- Entry surfaces: web add-round under `apps/web/app/rounds/add/` + scorecard components under `apps/web/components/scorecard/`; native manual add `apps/native/app/rounds/add.tsx` and `apps/native/app/(tabs)/add.tsx`. Native LIVE flow (`apps/native/app/rounds/live/*`, `apps/native/lib/round-session/*`, watch Swift code) is OUT OF SCOPE — its offline protocol (`apps/native/lib/round-session/PROTOCOL.md`) and the Swift mirror make it a separate effort.
- Migrations: SQL files in `supabase/migrations/` named `YYYYMMDDHHMMSS_slug.sql` (latest: `20260703091818_submission_lifecycle_and_reason.sql`); Drizzle schema in `apps/web/db/schema.ts` is hand-maintained to match; `pnpm gen:local`/`pnpm gen:types` regenerates `apps/web/types/supabase.ts`; `pnpm check:schema-sync` guards the zod mirrors. Cross-check with `pnpm check:schema-sync` whenever touching schema (hard rule in `.claude/rules/coding-conventions.md`).
- Web is design source of truth; same-slug native screens must match (`.claude/rules/web-native-parity.md`); token classes only on native (`pnpm parity:styles`).

## Design decisions (implement, don't relitigate)

1. **Three new nullable columns on `score`**: `putts integer NULL`, `fairwayHit boolean NULL` (NULL also covers par-3s where fairway doesn't apply), `penaltyStrokes integer NULL`. No GIR column — GIR is derived: `gir = (strokes − putts) ≤ (par − 2)` when `putts` is present.
2. **Opt-in entry**: a "Detailed scoring" toggle on the add-round form; off by default; when off, nothing changes. Persist the toggle preference client-side (match however the form already persists UI state; if it doesn't, default off every time — do not add a DB column for the preference).
3. **Stats v1** (only when data exists): putts/round (avg, rounds with full putts data), GIR% (holes with putts data), FIR% (holes with `fairwayHit` non-null), penalties/round. Each stat must handle partial data gracefully — compute over the subset of holes/rounds that have the field, and surface the sample size ("based on N rounds").
4. **Handicap math untouched**: `penaltyStrokes` is informational only in v1 (penalty strokes are already inside `strokes` as played) — it does NOT feed any engine input.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Local stack | `supabase start` (if available) | local DB up |
| Types regen | `pnpm gen:local` (local) or `pnpm gen:types` (remote) | `apps/web/types/supabase.ts` updated, not hand-edited |
| Schema zod sync | `pnpm check:schema-sync` | exit 0 |
| Handicap sync (if plan 008 landed) | `pnpm check:handicap-sync` | exit 0 |
| Tests | `pnpm test:unit` / `pnpm test:integration` | all pass |
| Lint | `pnpm lint` | exit 0 |
| Native bundle | `cd apps/native && npx expo export -p ios` | bundles |
| Parity | `pnpm parity:styles` && `pnpm parity:drift` | styles exit 0; drift noted |

## Scope

**In scope**:
- `supabase/migrations/<timestamp>_score_shot_detail.sql` (create)
- `apps/web/db/schema.ts` (score table), `apps/web/types/supabase.ts` (regenerated only)
- `apps/web/types/scorecard-input.ts` + `supabase/functions/handicap-shared/shared-schemas.ts` (mirrored optional fields)
- Web add-round form components (`apps/web/app/rounds/add/`, `apps/web/components/scorecard/`)
- `apps/web/lib/statistics/*`, `apps/web/server/api/routers/stats.ts` (new stat outputs), statistics UI components (`apps/web/components/statistics/`)
- Native siblings: `apps/native/app/rounds/add.tsx`, `apps/native/app/(tabs)/add.tsx`, `apps/native/components/statistics/*` (parity)
- New tests (locations in Test plan)

**Out of scope** (do NOT touch):
- `packages/handicap-core/*` and `supabase/functions/process-handicap-queue/*` — zero math changes
- The live-round session (`apps/native/lib/round-session/*`, `apps/native/app/rounds/live/*`) and ALL Swift/watch code — v2, explicitly deferred
- The stats plan-gating in `stats.ts:37-45` — packaging is a separate owner decision
- Strokes-gained — requires shot-location data; out of v1 entirely
- RLS policies beyond what the migration needs (new columns inherit the row's existing policies)

## Git workflow

- Branch: `advisor/010-shot-level-stats-v1`
- Conventional commits per step, e.g. `feat(stats): optional per-hole putts/fairway/penalty capture`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Migration + Drizzle schema

Write the migration:
```sql
ALTER TABLE "score" ADD COLUMN "putts" integer;
ALTER TABLE "score" ADD COLUMN "fairwayHit" boolean;
ALTER TABLE "score" ADD COLUMN "penaltyStrokes" integer;
```
(Match quoting/casing conventions of recent migrations — inspect `20260703091818_submission_lifecycle_and_reason.sql` first; the schema uses camelCase column names.) Update the `score` table in `apps/web/db/schema.ts` with the three nullable columns. Apply locally, regenerate types.

**Verify**: `supabase db reset` (or `supabase migration up`) applies cleanly; `pnpm gen:local` → `types/supabase.ts` shows the columns; `pnpm lint` → exit 0.

### Step 2: Zod schemas (both copies)

Add to `scoreSchema` in `apps/web/types/scorecard-input.ts`:
```ts
putts: z.number().int().min(0).max(20).optional(),
fairwayHit: z.boolean().optional(),
penaltyStrokes: z.number().int().min(0).max(10).optional(),
```
Mirror the identical fields into `supabase/functions/handicap-shared/shared-schemas.ts` the way that file mirrors the rest.

**Verify**: `pnpm check:schema-sync` → exit 0; `pnpm test:unit` → pass (this is the proof the engine path tolerates the new fields; if any handicap test fails, STOP).

### Step 3: Persist through the write path

Follow `strokes` from the add-round form to the `submitScorecard` insert (`apps/web/server/api/routers/round.ts:301` onward; the transaction inserts score rows near where `hcpStrokes` is written). Thread the three optional fields through the insert. Confirm the round UPDATE/edit path (if the router has one) also carries them.

**Verify**: `pnpm test:integration` (needs local Supabase) → pass, including one new integration case (Test plan).

### Step 4: Entry UI — web, then native parity

Web: add a "Detailed scoring" toggle to the add-round scorecard entry; when on, each hole row exposes putts (numeric stepper), fairway (hit/missed/–), penalties (numeric, default 0 hidden behind a "+"). Reuse existing scorecard input components/primitives (`apps/web/components/scorecard/`, shadcn primitives from `components/ui/`); match existing form patterns (react-hook-form + zod). Then mirror on the native manual add screens with token classes.

**Verify**: `pnpm lint` → exit 0; `pnpm parity:styles` → exit 0; `npx expo export -p ios` → bundles; manual: web dev server, add a round with detailed scoring, confirm rows persist (query local DB or view round detail).

### Step 5: Stats

In `apps/web/lib/statistics/calculations.ts` add pure functions: `calculatePuttsPerRound`, `calculateGIRPercentage` (derived rule from Design decision 1 — needs hole par, which the stats layer already joins for strokes-vs-par stats), `calculateFIRPercentage` (exclude par-3s and NULLs from denominator), `calculatePenaltiesPerRound`. Each returns `{ value, sampleSize }`. Expose via the existing stats router shape; render in the statistics overview (web `apps/web/components/statistics/overview/overview-section.tsx` + native `apps/native/components/statistics/performance-tab.tsx` parity) with a "based on N rounds" subtitle and an empty-state prompting the detailed-scoring toggle.

**Verify**: `pnpm test:unit` → new stat function tests pass; `pnpm parity:drift` output noted.

## Test plan

- Unit (`apps/web/tests/unit/statistics/…`, model on existing statistics tests if present, else on `tests/unit/handicap/calculations.test.ts` structure): each new stat function — full data, partial data (some holes missing putts), zero data (returns sampleSize 0, no NaN), par-3 exclusion for FIR, GIR derivation boundaries (strokes−putts == par−2 exactly).
- Integration (`apps/web/tests/integration/`, model on the round-submission integration test — find via `grep -rln "submitScorecard" apps/web/tests/integration`): submit a scorecard with detailed fields → rows persisted with values; submit without → columns NULL; handicap queue output identical in both cases.
- Existing handicap tests must pass unmodified.

## Done criteria

- [ ] Migration applies; `score` has 3 nullable columns; `types/supabase.ts` regenerated (not hand-edited)
- [ ] `pnpm check:schema-sync` exits 0
- [ ] All existing handicap tests pass unmodified
- [ ] Web + native manual add support detailed entry behind a toggle; `pnpm parity:styles` exits 0
- [ ] 4 new stats render with sample-size handling; unit tests cover the edge cases listed
- [ ] `grep -rn "penaltyStrokes" packages/handicap-core supabase/functions/process-handicap-queue` → no matches (engine untouched)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any existing handicap/engine test fails at any step — the "engine ignores extra fields" assumption broke; report.
- The score insert in `round.ts` turns out to be built by the edge function rather than the router (i.e., you can't find the insert in the transaction) — re-read, and if the write path genuinely differs from "Current state", report.
- The add-round form architecture can't accommodate per-hole extra inputs without restructuring (e.g., it's a single grid component with fixed columns used by 5+ screens) — propose the restructure in your report first.
- You're tempted to add fields to the live-round session or watch protocol — out of scope, stop.

## Maintenance notes

- v2 candidates (deferred): detailed entry in the live round + watch (requires `round-session` PROTOCOL + Swift changes); strokes-gained (needs shot locations); AI scorecard extraction (`apps/web/app/api/ai/extract-scorecard/route.ts`) could populate putts if scorecards show them.
- The packaging question (which tier gets these stats) is an owner decision recorded in `plans/README.md` — if it changes, the gate lives at `stats.ts:37-45`.
- Reviewers: watch that NULL-handling in stats can't divide by zero, and that the native add screen stays 1:1 with web (parity rule).
