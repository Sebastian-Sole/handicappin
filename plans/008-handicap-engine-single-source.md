# Plan 008: Single-source the handicap engine and put the untested orchestration under characterization tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. This plan must NOT change any handicap output — it is an
> extract-and-test refactor with a sync gate. If anything in the "STOP
> conditions" section occurs, stop and report — do not improvise. When done,
> update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0432f5f..HEAD -- packages/handicap-core supabase/functions/process-handicap-queue supabase/functions/handicap-shared scripts/check-schema-sync.mjs .github/workflows/ci.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the production calc path; mitigated by characterization-first ordering)
- **Depends on**: none. Recommended before plans 010/011 (both touch scoring inputs).
- **Category**: tech-debt / tests (compliance-enabling)
- **Planned at**: commit `0432f5f`, 2026-07-11
- **Issue**: https://github.com/Sebastian-Sole/handicappin/issues/138

## Why this matters

The handicap number is the product. Today it is produced by `supabase/functions/process-handicap-queue/index.ts`, whose two-pass rolling computation — including Exceptional Score Reduction (ESR), cap application, and the rolling index — exists ONLY in that Deno edge function and has ZERO tests. Worse, the math helpers it calls come from `supabase/functions/handicap-shared/utils.ts`, a hand-maintained copy of `packages/handicap-core/src/calculations.ts` — the well-tested package that ships to web/native is NOT the code that computes production handicaps. Any drift between the two, or any refactor of the queue processor, can silently corrupt every user's index. This plan extracts the orchestration into the shared package, adds a CI sync gate (modeled on the existing schema-sync gate), and pins current behavior with characterization tests. It is also a prerequisite for any official-handicap integration (plan 007): a licensing conversation requires demonstrably tested, single-source math.

## Current state

- `packages/handicap-core/src/calculations.ts` — pure TS engine (course handicap, differentials, 9-hole expected-score, best-8-of-20 + fewer-than-20 table in `calculateHandicapIndex`, `calculateLowHandicapIndex`, `applyHandicapCaps`, NDB, stroke allocation). Well unit-tested from `apps/web/tests/unit/handicap/calculations.test.ts`, `apps/web/tests/unit/handicap/nine-hole-calculations.test.ts`, and `apps/web/test/unit/handicap/handicap-caps.test.ts` (note: `test/` vs `tests/` — both exist).
- `packages/handicap-core/src/constants.ts` — `SOFT_CAP_THRESHOLD`, `HARD_CAP_THRESHOLD`, `LOW_HANDICAP_WINDOW_DAYS`, etc.
- `supabase/functions/handicap-shared/utils.ts` — hand-copied fork of `calculations.ts` (differences: `.ts` import extensions for Deno; omits `getRelevantRounds`/`RoundLike`). `supabase/functions/handicap-shared/constants.ts:1-4` says: "Mirror of packages/handicap-core/src/constants.ts. … Keep these values in sync". Nothing enforces this.
- `supabase/functions/process-handicap-queue/index.ts` — the orchestrator. Verified structure at `0432f5f`:
  - Merged Pass 1 (~line 317–443): iterates rounds chronologically with `let rollingIndex = initialHandicapIndex`; per round assigns `pr.existingHandicapIndex = rollingIndex`, computes AGS/APS/course handicap from tee+scores maps, computes `rawDifferential`, then a 20-round window (`ESR_WINDOW_SIZE`) of `rawDifferential`s → `calculateHandicapIndex` → ESR detection:
    ```ts
    const difference = rollingIndex - pr.rawDifferential;
    if (difference >= EXCEPTIONAL_ROUND_THRESHOLD) {
      const offset = difference >= 10 ? 2 : 1;
      // applies offset to esrOffset of every round in the trailing window
    }
    rollingIndex = pr.updatedHandicapIndex;
    ```
  - Pass 2 (~line 445–474): `pr.finalDifferential = pr.rawDifferential - pr.esrOffset`; windowed `calculateHandicapIndex` over final differentials; `applyHandicapCaps(calculatedIndex, calculateLowHandicapIndex(processedRounds, i))`; clamp `Math.min(…, MAX_SCORE_DIFFERENTIAL)` (54).
- Known smell recorded as CORRECTNESS-02 (LOW confidence): Pass-1 ESR detection runs against an uncapped raw-differential rolling index. Do NOT fix this in this plan — Step 5 only *measures* it.
- Sync-gate precedent to copy: `scripts/check-schema-sync.mjs` (normalizes expected differences between `apps/web/types/scorecard-input.ts` and the edge copy) and the CI job `schema-sync-check` in `.github/workflows/ci.yml:98-114`.
- Deno functions cannot import workspace packages (that's WHY the fork exists — see the comment in `handicap-shared/constants.ts`). Do not try to make Deno import `@handicappin/handicap-core`; the fork stays, but becomes machine-checked.

Conventions: TypeScript strict, no `any`; Vitest (`pnpm test:unit`); conventional commits.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Lint | `pnpm lint` | exit 0 |
| New sync gate | `node scripts/check-handicap-sync.mjs` | exit 0, "in sync" |
| Sync gate must fail on drift | temporarily edit one char in `handicap-shared/utils.ts`, rerun | exit 1; then revert |

## Scope

**In scope**:
- `packages/handicap-core/src/timeline.ts` (create), `packages/handicap-core/src/index.ts` (export it)
- `supabase/functions/handicap-shared/timeline.ts` (create, mirrored), `supabase/functions/handicap-shared/utils.ts` + `constants.ts` (only if normalization requires header comments)
- `supabase/functions/process-handicap-queue/index.ts` (replace inline passes with the call)
- `scripts/check-handicap-sync.mjs` (create), root `package.json` (add `check:handicap-sync` script), `.github/workflows/ci.yml` (add job)
- `apps/web/tests/unit/handicap/timeline.test.ts` (create)

**Out of scope** (do NOT touch):
- Any math behavior: outputs must be bit-identical. No fixing CORRECTNESS-02, no PCC, no penalty scores.
- `apps/web/types/scorecard-input.ts` / `shared-schemas.ts` (owned by the schema sync)
- The queue/trigger machinery around the computation (row claiming, retries, Supabase client code)
- Swift/watch code (displays server values only; no math there)

## Git workflow

- Branch: `advisor/008-handicap-engine-single-source`
- Conventional commits, one per step, e.g. `refactor(handicap): extract timeline computation into handicap-core`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `computeHandicapTimeline` into the package

Create `packages/handicap-core/src/timeline.ts` exporting a pure function that reproduces the merged Pass 1 + Pass 2 from `process-handicap-queue/index.ts` **verbatim in behavior**. Signature shape (adapt names to what the orchestrator actually passes — read the surrounding code first):

```ts
export type TimelineInputs = {
  processedRounds: ProcessedRound[];        // pre-sorted chronologically, pre-populated ids/teeIds/approvalStatus
  teeMap: Map<number, Tee>;
  roundScoresMap: Map<number, Score[]>;
  holesMap: Map<number, Hole[]>;
  initialHandicapIndex: number;
};
export function computeHandicapTimeline(inputs: TimelineInputs): ProcessedRound[];
```

Move the loop bodies; import helpers from `./calculations` and `./constants`. No behavior edits — copy the arithmetic exactly, including the ESR window arithmetic and the final 54 clamp. Export from `src/index.ts`.

**Verify**: `pnpm test:unit` → existing suites still pass (nothing imports timeline yet); `pnpm lint` → exit 0.

### Step 2: Characterization tests BEFORE touching the edge function

Create `apps/web/tests/unit/handicap/timeline.test.ts` (model structure on `apps/web/tests/unit/handicap/calculations.test.ts`). Build fixture helpers that fabricate tees/holes/scores (18-hole, par 72, slope 113, rating 72 keeps arithmetic legible). Cases — assert exact final `updatedHandicapIndex`/`esrOffset`/`finalDifferential` sequences:

1. Rolling baseline: 25 mediocre rounds → index follows best-8-of-20 window; first rounds use the fewer-than-20 table (−2 @3 diffs, −1 @4 and @6).
2. ESR boundaries: a round exactly 6.9 better than the rolling index → no offset; exactly 7.0 → offset 1 applied to the trailing ≤20-round window; 10.0 → offset 2.
3. ESR stacking: two exceptional rounds inside one window → offsets accumulate on overlapping rounds.
4. Cap interaction: history that triggers soft cap (rise > 3.0 over 365-day low) and hard cap (> 5.0) in Pass 2, combined with a prior ESR.
5. New player: `initialHandicapIndex = 54`, fewer than 3 rounds → index stays 54.
6. Mixed 9-hole rounds (front and back) interleaved with 18-hole.

To get expected values: run the fixtures through `computeHandicapTimeline` ONCE, eyeball the outputs for sanity against the WHS rules described in `calculations.ts` doc comments, then pin them as literals (characterization). Mark the file header: "Characterization tests — pin current production behavior; intentional rule changes must update these deliberately."

**Verify**: `pnpm test:unit -- timeline` → all new tests pass.

### Step 3: Mirror into the Deno fork and switch the orchestrator

Copy `timeline.ts` to `supabase/functions/handicap-shared/timeline.ts`, adjusting only import specifiers to Deno style (match how `handicap-shared/utils.ts` imports `constants.ts`). Replace the inline Pass 1 + Pass 2 in `process-handicap-queue/index.ts` with a call to `computeHandicapTimeline`, keeping all surrounding queue machinery untouched.

**Verify**: `git diff supabase/functions/process-handicap-queue/index.ts` shows the two passes replaced by one call and no other logic changes. If a local Supabase stack is available (`supabase start`), run the existing integration tests: `pnpm test:integration` → pass; if no local stack, note that in the report.

### Step 4: Add the sync gate

Create `scripts/check-handicap-sync.mjs` modeled on `scripts/check-schema-sync.mjs`: compare `packages/handicap-core/src/{calculations,constants,timeline}.ts` against `supabase/functions/handicap-shared/{utils,constants,timeline}.ts` after normalizing the KNOWN differences (strip/normalize import lines; allow the documented omission of `getRelevantRounds`/`RoundLike` in the fork — encode that as an explicit allowlist, not a fuzzy diff). Add root script `"check:handicap-sync": "node scripts/check-handicap-sync.mjs"`. Add a CI job to `.github/workflows/ci.yml` cloned from the `schema-sync-check` job (lines 98–114), named `handicap-sync-check`.

**Verify**: `node scripts/check-handicap-sync.mjs` → exit 0. Then the mutation test from the Commands table (edit one char in the fork → exit 1 → revert).

### Step 5: Measure the CORRECTNESS-02 smell (report only)

Add 2–3 additional test cases where Pass-1's uncapped rolling index disagrees with the capped index near ESR thresholds (e.g., a capped player whose raw rolling index is 8.1 above a new differential but capped index is only 6.8 above). Record in the test file, as comments, whether detection flips. DO NOT change the algorithm. Summarize what you find in your final report.

**Verify**: tests pass (they pin whatever current behavior IS).

## Test plan

Covered by Steps 2 and 5. Total: ≥9 new test cases in `timeline.test.ts`. Existing suites (`calculations.test.ts`, `nine-hole-calculations.test.ts`, `handicap-caps.test.ts`) must pass unmodified — if one fails, you changed behavior: STOP.

## Done criteria

- [ ] `computeHandicapTimeline` exists in `packages/handicap-core` and is the only implementation of the two-pass logic (grep: the ESR `difference >= EXCEPTIONAL_ROUND_THRESHOLD` expression appears exactly twice repo-wide — package + mirrored fork — and NOT in `process-handicap-queue/index.ts`)
- [ ] `pnpm test:unit` exits 0 including ≥9 new timeline tests
- [ ] `node scripts/check-handicap-sync.mjs` exits 0, and exits 1 under the mutation test
- [ ] `handicap-sync-check` job present in `.github/workflows/ci.yml`
- [ ] Existing handicap test files unmodified (`git diff --stat` clean for them)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The two-pass structure in `process-handicap-queue/index.ts` no longer matches the "Current state" description (drift).
- Any pre-existing handicap test fails after your extraction — you altered behavior; report the diff instead of "fixing" the test.
- The fork (`handicap-shared/utils.ts`) turns out to differ from `calculations.ts` in MATH (not just imports/omissions) — that's a live production divergence; report it immediately as a finding, do not silently reconcile.
- Deno deployment concerns (e.g., `deno.json` import-map changes) exceed adding one mirrored file.

## Maintenance notes

- From now on, any change to `calculations.ts`/`constants.ts`/`timeline.ts` requires the mirrored edit in `handicap-shared/` — the CI gate will hold the line; the error message should say exactly that.
- Step 5's findings feed a future decision on CORRECTNESS-02 (sequential vs two-pass ESR). If pursued, build fixtures from published USGA worked examples first.
- Plan 010 (shot-level stats) adds optional fields to score inputs; this plan's tests are the safety net proving those fields don't perturb the math.
