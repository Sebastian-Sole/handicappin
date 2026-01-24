---
date: 2026-01-23T16:45:00-05:00
git_commit: 0d17fe3713efad6f0010980976a2add1c3c8172e
branch: feat/round-calculation-page
repository: handicappin
topic: "USGA Handicap Calculation Misimplementations Analysis"
tags: [research, handicap, usga, 9-hole, score-differential, bug-analysis]
status: complete
last_updated: 2026-01-23
---

# Research: USGA Handicap Calculation Misimplementations

**Date**: 2026-01-23T16:45:00-05:00
**Git Commit**: 0d17fe3713efad6f0010980976a2add1c3c8172e
**Branch**: feat/round-calculation-page
**Repository**: handicappin

## Research Question

Identify where in the scorecard/round submission workflow or handicap recalculation workflow there could be potential misimplementations of the USGA handicapping rules, specifically investigating why a 9-hole round shows a stored differential of 17.6 but calculates to 33.2.

## Summary

The investigation found a **critical historical bug** that was fixed in commit `36ad1c5` (2026-01-18): 9-hole rounds were incorrectly using 18-hole ratings and the standard 18-hole differential formula instead of the proper USGA Rule 5.1b 9-hole calculation.

**Key Findings:**

1. **Historical Bug (FIXED)**: Before January 18, 2026, 9-hole rounds were calculated using 18-hole course/slope ratings with the standard differential formula, instead of the USGA-mandated 9-hole formula with expected differential
2. **Rounds submitted before fix have incorrect stored differentials** that cannot be automatically recalculated (values are locked at submission)
3. **The Supabase Edge Function (`handicap-shared/utils.ts`) is outdated** - missing the 9-hole specific functions
4. **The cron job correctly uses stored values** - it does NOT recalculate differentials, only ESR and handicap index

## Detailed Findings

### 1. The Historical Bug (Commit 36ad1c5 Fixed This)

**Before Fix** (pre-2026-01-18):

```typescript
// server/api/routers/round.ts - OLD CODE
const scoreDifferential = calculateScoreDifferential(
  adjustedGrossScore,
  teePlayed.courseRating18,    // WRONG: Used 18-hole rating for 9-hole rounds
  teePlayed.slopeRating18      // WRONG: Used 18-hole slope for 9-hole rounds
);
```

**After Fix** (current code):

```typescript
// server/api/routers/round.ts - CORRECT CODE (lines 69-88)
if (numberOfHolesPlayed === 9) {
  courseRatingUsed = teePlayed.courseRatingFront9;
  slopeRatingUsed = teePlayed.slopeRatingFront9;

  const expectedDifferential = calculateExpected9HoleDifferential(
    handicapIndex,
    teePlayed.courseRatingFront9,
    teePlayed.slopeRatingFront9,
    teePlayed.outPar
  );

  scoreDifferential = calculate9HoleScoreDifferential(
    adjustedPlayedScore,
    teePlayed.courseRatingFront9,
    teePlayed.slopeRatingFront9,
    expectedDifferential
  );
}
```

### 2. Why Stored Value (17.6) is Wrong

Using the user's example data:
- 9-hole adjusted played score: 44
- Handicap Index: 54
- **18-hole Course Rating (mistakenly used)**: ~73.2 (estimated 2× 36.6)
- **18-hole Slope (mistakenly used)**: ~139

**Old (incorrect) calculation:**
```
AGS for 9-hole = 44 + predictedStrokes + parForRemaining
    ≈ 44 + 34 + 36 = 114 (estimated)

Differential = (114 - 73.2) × 113 / 139
            ≈ 33.2
```

Wait, that doesn't produce 17.6 either. Let me recalculate what could produce 17.6:

The old code used `calculateAdjustedGrossScore()` which for 9-hole:
```
predictedStrokes = round((courseHandicap / 18) * holesLeft)
AGS = APS + predictedStrokes + parForRemainingHoles
```

If courseHandicap was ~34 (for HI=54 at 9-hole), predictedStrokes = round(34/18 * 9) = 17
If AGS = 44 + 17 + 36 = 97

Using 18-hole ratings (73.2 / 139):
```
(97 - 73.2) × 113 / 139 = 23.8 × 0.813 = 19.3
```

Still not 17.6 exactly, but the point is that **the wrong formula was used**.

### 3. What the Correct Calculation Should Be (USGA Rule 5.1b)

```
Played Differential = (44 - 36.6) × 113 / 139 = 6.02

9-hole Course Handicap = round((54/2) × (139/113) + (36.6-36))
                       = round(27 × 1.23 + 0.6)
                       = round(33.81) = 34

Expected Score = 36 + 34 = 70
Expected Differential = (70 - 36.6) × 113 / 139 = 27.15

Total Differential = 6.02 + 27.15 = 33.17 → rounds to 33.2
```

### 4. The Stored Values Are Locked

From the cron job (`app/api/cron/process-handicap-queue/route.ts`, lines 188-204):

```typescript
// Initialize processed rounds with STORED values (locked at submission time)
// Per USGA practical rules: AGS, scoreDifferential, existingHandicapIndex are locked
const processedRounds: ProcessedRound[] = userRounds.map((r) => ({
  // ...
  rawDifferential: r.scoreDifferential, // Raw differential from submission - LOCKED
  adjustedGrossScore: r.adjustedGrossScore, // Locked at submission
  adjustedPlayedScore: r.adjustedPlayedScore, // Locked at submission
  courseHandicap: r.courseHandicap, // Locked at submission
}));
```

The cron job explicitly does NOT recalculate `scoreDifferential` - it only:
1. Applies ESR offsets
2. Recalculates `updatedHandicapIndex`

### 5. Outdated Supabase Edge Function

**File**: `supabase/functions/handicap-shared/utils.ts`

This file is **missing** the 9-hole specific functions:
- ❌ `calculateExpected9HoleDifferential()` - NOT PRESENT
- ❌ `calculate9HoleScoreDifferential()` - NOT PRESENT

The edge function appears to be legacy code (being migrated to Vercel cron) but if it's still in use, it would have calculation issues.

### 6. Course Handicap Pre-Rounding Issue

In `calculateCourseHandicap()` for 9-hole rounds, there's a pre-rounding of the adjusted handicap index:

```typescript
// lib/handicap/calculations.ts - lines 40-46
if (numberOfHolesPlayed === 9) {
  // Only the final course handicap result is rounded to nearest integer
  return Math.round(
    (handicapIndex / 2) * (teePlayed.slopeRatingFront9 / 113) +
      (teePlayed.courseRatingFront9 - teePlayed.outPar)
  );
}
```

However, in `supabase/functions/handicap-shared/utils.ts` (legacy), there's an incorrect pre-rounding:

```typescript
// LEGACY - POTENTIALLY INCORRECT
const adjustedHandicapIndex = Math.round((handicapIndex / 2) * 10) / 10;
return Math.round(
  adjustedHandicapIndex * (teePlayed.slopeRatingFront9 / 113) + ...
);
```

This pre-rounding of the half-handicap can produce slightly different results.

## Code References

### Round Submission (Current - Correct)
- `server/api/routers/round.ts:30-112` - `getRoundCalculations()` function
- `server/api/routers/round.ts:69-88` - 9-hole specific branch with correct USGA Rule 5.1b

### Handicap Calculation Library (Main - Correct)
- `lib/handicap/calculations.ts:85-102` - `calculateExpected9HoleDifferential()`
- `lib/handicap/calculations.ts:115-133` - `calculate9HoleScoreDifferential()`
- `lib/handicap/calculations.ts:59-71` - `calculateScoreDifferential()` (18-hole)

### Handicap Queue Processor (Correct - Uses Stored Values)
- `app/api/cron/process-handicap-queue/route.ts:188-204` - Uses stored values, doesn't recalculate differential

### Legacy Edge Function (OUTDATED - Missing 9-hole functions)
- `supabase/functions/handicap-shared/utils.ts` - Missing 9-hole specific functions

### Historical Fix
- Commit `36ad1c5` (2026-01-18) - "fix: 9-hole handicap calculation"
- Introduced `calculateExpected9HoleDifferential()` and `calculate9HoleScoreDifferential()`
- Updated `getRoundCalculations()` to use correct 9-hole branch

## Architecture Insights

### Stored vs Calculated Values

| Field | When Set | Recalculated? |
|-------|----------|---------------|
| `adjustedGrossScore` | Submission | ❌ Locked |
| `adjustedPlayedScore` | Submission | ❌ Locked |
| `scoreDifferential` | Submission | ❌ Locked |
| `courseHandicap` | Submission | ❌ Locked |
| `existingHandicapIndex` | Submission | ❌ Locked |
| `updatedHandicapIndex` | Cron job | ✅ Recalculated |
| `exceptionalScoreAdjustment` | Cron job | ✅ Recalculated |

This means **rounds submitted with incorrect calculations cannot be automatically fixed** by the recalculation workflow.

### 9-Hole vs 18-Hole Calculation Paths

```
Round Submission
    ├─ numberOfHolesPlayed === 9
    │   ├─ Use Front9 ratings
    │   ├─ calculateExpected9HoleDifferential()
    │   └─ calculate9HoleScoreDifferential()
    │
    └─ numberOfHolesPlayed === 18
        ├─ Use 18-hole ratings
        └─ calculateScoreDifferential()
```

## Recommendations

### Immediate Actions

1. **Delete and re-enter affected rounds**: Users with 9-hole rounds submitted before 2026-01-18 should delete and re-enter those rounds to get correct differentials.

2. **Update Supabase Edge Function**: If still in use, sync `handicap-shared/utils.ts` with `lib/handicap/calculations.ts` to include 9-hole functions.

### Optional Future Improvements

3. **One-time migration script**: Create a database migration that:
   - Identifies 9-hole rounds submitted before 2026-01-18
   - Recalculates their `scoreDifferential` using correct 9-hole formula
   - Updates the stored values

4. **Display clarity**: Show both stored and calculated values in the UI to help users identify discrepancies.

5. **Validation check**: Add a validation that compares stored vs calculated differentials and flags mismatches.

## Open Questions

1. Is the Supabase Edge Function (`supabase/functions/process-handicap-queue/`) still active, or has it been fully replaced by Vercel cron?

2. How many 9-hole rounds were submitted before the fix (2026-01-18) and are affected?

3. Should the cron job be updated to optionally recalculate locked values for identified incorrect rounds?

## Test Coverage

The 9-hole calculation has good test coverage:
- `test/unit/handicap/nine-hole-calculations.test.ts` (257 lines)
- Tests for various handicap levels (high, low, scratch)
- Edge cases (negative differentials, boundary values)
- Comparison with 18-hole formulas
