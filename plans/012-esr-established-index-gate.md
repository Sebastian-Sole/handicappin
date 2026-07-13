# Plan 012: ESR must not fire without an established Handicap Index

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. This plan makes a DELIBERATE behavior change to the handicap
> engine — the characterization tests exist precisely so this change is made
> consciously; update them per Step 3, never casually. If anything in the
> "STOP conditions" section occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md` — unless a
> reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: verify PR #157 is merged (`git log --oneline -20 | grep -i "single-source\|timeline"` or `ls packages/handicap-core/src/timeline.ts`). This plan's in-scope files exist only after that merge. Then compare the "Current state" excerpts below against the live `timeline.ts`; on a mismatch, STOP.

## Status

- **Priority**: P1 (production correctness of the core product number; certification-audit exposure)
- **Effort**: S–M
- **Risk**: MED (changes historical handicap outputs by design; mitigated by the characterization suite and impact measurement)
- **Depends on**: plan 008 / PR #157 merged (the fix lands in `timeline.ts`, created by that PR)
- **Category**: bug
- **Planned at**: commit `ff6fcb8`, 2026-07-13 (targets the post-#157 tree)
- **Issue**: https://github.com/Sebastian-Sole/handicappin/issues/158

## Why this matters

Verified on `main` (2026-07-13): the Pass-1 rolling loop uses `calculateHandicapIndex(...)`'s **fewer-than-3-differentials placeholder (54)** as the ESR comparison basis. Rounds 2–3 of every player's history — and round 1 as well under the default `initialHandicapIndex` of 54 — compare an ordinary differential against a phantom index of 54, so `difference ≥ 10` fires and stamps **+2 Exceptional Score Reduction offsets** across the trailing window. Under WHS Rule 5.9, ESR exists to catch a player beating *their established index* by 7+; a player with fewer than three differentials has **no established index**, so ESR must not apply at all. The spurious offsets permanently depress `finalDifferential` on the earliest rounds, which sit in the best-8 selection for the player's entire first ~20 rounds (their whole first season). Plan 011 (starting-HI seed + CSV import) will push more history through this exact path, and this is the class of defect a federation certification review finds in minutes. Owner reviewed the analysis and approved the correction on 2026-07-13.

## Current state

After PR #157, the two-pass computation lives in `packages/handicap-core/src/timeline.ts` (exported as `computeHandicapTimeline`), mirrored byte-for-byte (modulo import lines) in `supabase/functions/handicap-shared/timeline.ts`, with `scripts/check-handicap-sync.mjs` (CI job `handicap-sync-check`) enforcing sync. The Deno edge function `supabase/functions/process-handicap-queue/index.ts` calls the mirrored copy.

The Pass-1 structure (verbatim behavior, verified on main at `supabase/functions/process-handicap-queue/index.ts:415-443` pre-merge; same code in `timeline.ts` post-merge):

```ts
let rollingIndex = initialHandicapIndex;            // line ~327 pre-merge
for (let i = 0; i < processedRounds.length; i++) {
  const pr = processedRounds[i];
  pr.existingHandicapIndex = rollingIndex;
  // ... AGS/APS/courseHandicap computed from rollingIndex ...
  // ... pr.rawDifferential computed ...
  const startIdx = Math.max(0, i - (ESR_WINDOW_SIZE - 1));
  const relevantDifferentials = processedRounds
    .slice(startIdx, i + 1)
    .map((round) => round.rawDifferential);
  pr.updatedHandicapIndex = calculateHandicapIndex(relevantDifferentials);

  const difference = rollingIndex - pr.rawDifferential;      // ← THE BUG SITE
  if (difference >= EXCEPTIONAL_ROUND_THRESHOLD) {
    const offset = difference >= 10 ? 2 : 1;
    const esrStartIdx = Math.max(0, i - (Math.min(ESR_WINDOW_SIZE, i + 1) - 1));
    for (let j = esrStartIdx; j <= i; j++) {
      processedRounds[j].esrOffset += offset;
    }
  }
  rollingIndex = pr.updatedHandicapIndex;
}
```

The placeholder source, `packages/handicap-core/src/calculations.ts:191-197`:

```ts
export function calculateHandicapIndex(scoreDifferentials: number[]): number {
  // Per USGA: fewer than 3 differentials -> no established index (return max).
  if (scoreDifferentials.length < 3) {
    return 54;
  }
  ...
```

So for round index `i`, the ESR basis `rollingIndex` is round `i−1`'s `updatedHandicapIndex`:
- `i = 0`: basis = `initialHandicapIndex` (profile default **54**; real seed if the user set one).
- `i = 1` and `i = 2`: basis = **54**, the placeholder — regardless of any seed.
- `i ≥ 3`: basis = a real computed index (though raw/uncapped — see Decision B).

Characterization tests pinning today's behavior: `apps/web/tests/unit/handicap/timeline.test.ts` (12 tests; the header documents this exact quirk and mandates deliberate updates). Related known smell CORRECTNESS-02 (ESR basis is uncapped) is measured in that file's comments — it is a separate decision (Decision B below), not silently fixed here.

Conventions: TypeScript strict, no `any`; Vitest; conventional commits; any change to `timeline.ts` requires the mirrored edit in `supabase/functions/handicap-shared/timeline.ts` or `pnpm check:handicap-sync` fails.

## The fix (decided design — implement exactly)

**ESR fires only when an established index exists.** A player's index is established once **≥ 3 differentials precede the current round** — i.e., for round index `i`, ESR may fire only when `i >= 3`. When `i < 3`, skip ESR detection entirely (no offset, regardless of `difference`).

```ts
// Rule 5.9: ESR applies only against an ESTABLISHED Handicap Index.
// With fewer than 3 prior differentials there is no established index —
// the 54 returned by calculateHandicapIndex is a display placeholder,
// not a comparison basis.
const hasEstablishedIndex = i >= 3;
const difference = rollingIndex - pr.rawDifferential;
if (hasEstablishedIndex && difference >= EXCEPTIONAL_ROUND_THRESHOLD) { ... }
```

**Decision A (made by owner, 2026-07-13, implicit in approving this fix): seeds do not enable ESR.** Even a user-provided `initialHandicapIndex` (a real official index) does not make rounds 0–2 ESR-eligible — we cannot distinguish a genuine declared index from the schema default of 54, so the `i >= 3` gate applies uniformly. Record this rationale in the code comment.

**Decision B (CORRECTNESS-02 — explicitly OUT of this plan's default scope): keep the uncapped raw rolling basis for `i >= 3`.** Current behavior is more ESR-aggressive after cap events (one-directional, anti-sandbagging-conservative). Do NOT change it. Add one code comment at the `difference` line noting the known deviation and pointing to the measurement cases in `timeline.test.ts`. If during implementation you find this decision entangled with the gate (it should not be — the gate is independent), STOP.

**Not in scope**: the related quirk that `pr.existingHandicapIndex` (and thus course handicap / net-double-bogey caps) for rounds 1–2 also uses the 54 placeholder instead of a seeded initial index. That changes AGS inputs, not just ESR, and interacts with plan 011's seed design — record it in Maintenance notes as a follow-up decision; do not fix it here.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Unit suite (quoted glob — the `pnpm test:unit` script's unquoted exclude is broken in zsh) | `cd apps/web && npx vitest run --exclude "tests/integration/**"` | all pass |
| Timeline tests only | `cd apps/web && npx vitest run tests/unit/handicap/timeline.test.ts` | all pass |
| Engine sync gate | `pnpm check:handicap-sync` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

Fresh-worktree note: if unit tests fail at import on missing env vars, copy the gitignored `apps/web/.env` and `apps/web/.env.storybook` from the main checkout; verify they stay untracked.

## Scope

**In scope** (the only files you should modify):
- `packages/handicap-core/src/timeline.ts` (the gate + Decision A/B comments)
- `supabase/functions/handicap-shared/timeline.ts` (identical mirrored edit)
- `apps/web/tests/unit/handicap/timeline.test.ts` (deliberate re-pin per Step 3)

**Out of scope** (do NOT touch):
- `packages/handicap-core/src/calculations.ts` — the `< 3 → 54` guard is correct for its purpose; the fix is at the call site's semantics, not here
- `supabase/functions/process-handicap-queue/index.ts` — queue machinery; it just calls the timeline function
- Any cap/Low-HI/PCC logic; `calculateHandicapIndex`'s fewer-than-20 table
- Backfill/recompute of existing users' stored indices (Maintenance notes)

## Git workflow

- Branch: `advisor/012-esr-established-index-gate`
- Conventional commits, e.g. `fix(handicap): gate ESR on an established index (>=3 prior differentials)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Impact measurement BEFORE the fix

Write (in the test file, as a temporarily-skipped or clearly-labeled block — or a scratch script you delete after recording results) a before/after probe: run 3 realistic fixtures through the CURRENT `computeHandicapTimeline` and record, per fixture, the sequence of `updatedHandicapIndex` for the first 10 rounds:
1. Default-seed player (initial 54), 10 ordinary bogey-golf rounds.
2. Seeded player (initial 12.0), 10 rounds of ~12-handicap golf.
3. Seeded player (initial 12.0) whose round 5 is genuinely exceptional (differential 3.0).

Record the outputs in the final report AND as a comment block in the test file ("pre-fix baseline, 2026-07").

**Verify**: baseline numbers recorded; all existing tests still pass (nothing changed yet).

### Step 2: Apply the gate, mirrored

Implement the `hasEstablishedIndex = i >= 3` gate exactly as specified in "The fix", with the Decision A rationale comment and the Decision B known-deviation comment, in `packages/handicap-core/src/timeline.ts`; mirror identically into `supabase/functions/handicap-shared/timeline.ts`.

**Verify**: `pnpm check:handicap-sync` → exit 0; `pnpm lint` → exit 0.

### Step 3: Deliberately re-pin the characterization tests

Update `timeline.test.ts` per its own header protocol:
- Update the header: the 54-reset ESR quirk is FIXED by plan 012; describe the new rule (`ESR requires ≥3 prior differentials`).
- Re-pin every fixture's expected `esrOffset`/`finalDifferential`/`updatedHandicapIndex` values that previously encoded rounds-0–2 contamination (regenerate by running the fixtures once, sanity-check the deltas make sense: early offsets disappear, early indices RISE relative to baseline, nothing changes from round 4 onward except through window carry-over).
- Add three NEW tests: (a) rounds 0–2 never receive ESR offsets even with `difference ≥ 10`; (b) a genuinely exceptional round at `i = 3` (first eligible) still triggers correctly at both the 7.0 and 10.0 boundaries; (c) fixture 3 from Step 1 (seeded player, exceptional round 5) — the exceptional round still gets its offset, the early rounds don't.
- Keep the CORRECTNESS-02 measurement cases; update their comments if their pinned values shift.

**Verify**: `npx vitest run tests/unit/handicap/timeline.test.ts` → all pass, including 3 new tests; full unit suite (quoted glob) → all pass; `calculations.test.ts` / `handicap-caps.test.ts` / `nine-hole-calculations.test.ts` unmodified (`git diff --stat` clean for them).

### Step 4: Post-fix impact comparison

Re-run the Step-1 probes against the fixed code. In the final report, present the before/after table per fixture: which rounds' indices changed and by how much. Expected shape: fixtures 1–2 lose the spurious early offsets (early indices rise toward honest values); fixture 3's round-5 ESR is preserved.

**Verify**: the comparison table exists in your report; deltas confined to rounds affected by rounds-0–2 offsets and their window carry-over.

## Test plan

Covered by Steps 1, 3, 4. Net: ≥3 new tests, all existing suites green, re-pinned values justified by the recorded baseline diff.

## Done criteria

- [ ] `timeline.ts` (both copies) gate ESR on `i >= 3`, with Decision A and Decision B comments; `pnpm check:handicap-sync` exits 0
- [ ] Full unit suite passes via the quoted-glob command; ≥3 new ESR-gate tests
- [ ] `calculations.ts` and the three pre-existing handicap test files unmodified
- [ ] Before/after impact table for the 3 fixtures in the final report
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- PR #157 is not merged (no `timeline.ts` on main) — report; do not implement against the branch.
- The live `timeline.ts` ESR block doesn't match the "Current state" excerpt (drift).
- Implementing the gate seems to require changing cap logic, `calculateHandicapIndex`, or anything in Decision B's territory — the gate is independent; entanglement means something is misunderstood.
- Any pre-existing test outside `timeline.test.ts` fails — you changed more than the gate.
- Fixture 3's genuine ESR stops firing — the gate is wrong (off-by-one on `i >= 3`); report rather than nudging the boundary until it passes.

## Maintenance notes

- **Existing users' stored indices**: they recompute automatically the next time their queue entry processes (next round submission). Whether to proactively enqueue a full recompute for all users (so historical charts correct themselves promptly) is an OWNER decision — flag it in the PR description. If done, expect early-round indices to rise slightly for recent signups; consider whether any user-facing note is warranted.
- **Follow-up decision (recorded, not planned)**: rounds 1–2 still use the 54 placeholder as `existingHandicapIndex` for course-handicap/NDB purposes even when the user seeded a real index. Decide together with plan 011's seed design whether the seed should hold until an index is established.
- Plan 011's CSV import (up to 50 rounds) should land AFTER this fix, or every import replays the old contamination.
- A federation-facing changelog line ("ESR now correctly requires an established index per Rule 5.9") is good material for the NGF/USGA technical conversations.
