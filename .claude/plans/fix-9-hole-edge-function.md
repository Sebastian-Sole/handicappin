# Fix 9-Hole Calculations in Supabase Edge Function

## Overview

Update the Supabase Edge Function `process-handicap-queue` to correctly calculate 9-hole score differentials using USGA Rule 5.1b. The Edge Function currently uses 18-hole ratings for all rounds, producing incorrect differentials for 9-hole rounds.

## Current State Analysis

### Key Discoveries:

1. **Edge Function uses wrong ratings** (`supabase/functions/process-handicap-queue/index.ts:320-324`):
   ```typescript
   pr.rawDifferential = calculateScoreDifferential(
     pr.adjustedGrossScore,
     teePlayed.courseRating18,  // WRONG for 9-hole rounds
     teePlayed.slopeRating18    // WRONG for 9-hole rounds
   );
   ```

2. **Missing 9-hole functions** (`supabase/functions/handicap-shared/utils.ts`):
   - `calculateExpected9HoleDifferential()` - NOT PRESENT
   - `calculate9HoleScoreDifferential()` - NOT PRESENT

3. **Pre-rounding issue** (`supabase/functions/handicap-shared/utils.ts:30`):
   ```typescript
   const adjustedHandicapIndex = Math.round((handicapIndex / 2) * 10) / 10;  // INCORRECT
   ```
   Should not pre-round the half-handicap.

4. **Correct implementation exists** in `lib/handicap/calculations.ts:85-133` (used by tRPC/Vercel)

## Desired End State

- Edge Function correctly calculates 9-hole differentials per USGA Rule 5.1b
- Code parity between `lib/handicap/calculations.ts` and `supabase/functions/handicap-shared/utils.ts`
- All existing tests continue to pass
- New 9-hole rounds processed by Edge Function have correct differentials

## What We're NOT Doing

- Migration script for historical affected rounds (can be added later)
- UI changes to show calculated vs stored differentials
- Consolidation to Vercel cron (not viable due to free tier)
- Changes to the Vercel cron job (already correct)

## Implementation Approach

Sync the Edge Function's shared utilities with the main handicap calculations library, ensuring 9-hole specific functions are added and the differential calculation logic branches correctly based on holes played.

---

## Phase 1: Update handicap-shared/utils.ts

### Overview

Add the missing 9-hole calculation functions and fix the course handicap pre-rounding issue.

### Changes Required:

#### 1. Add 9-hole functions to utils.ts

**File**: `supabase/functions/handicap-shared/utils.ts`
**Changes**: Add `calculateExpected9HoleDifferential` and `calculate9HoleScoreDifferential` functions

```typescript
/**
 * Calculates the expected 9-hole differential for the unplayed 9 holes.
 * This is used per USGA Rule 5.1b to create an 18-hole equivalent from a 9-hole round.
 *
 * Formula: Expected Score = Par + 9-hole Course Handicap
 * Then: Expected Differential = (Expected Score - 9-hole Course Rating) × (113 / 9-hole Slope)
 *
 * @param handicapIndex - The player's current handicap index
 * @param nineHoleCourseRating - The course rating for the 9 holes (front9 or back9)
 * @param nineHoleSlopeRating - The slope rating for the 9 holes (front9 or back9)
 * @param nineHolePar - The par for the 9 holes
 */
export function calculateExpected9HoleDifferential(
  handicapIndex: number,
  nineHoleCourseRating: number,
  nineHoleSlopeRating: number,
  nineHolePar: number
): number {
  // Calculate 9-hole course handicap (half the handicap index, adjusted for slope)
  const nineHoleCourseHandicap = Math.round(
    (handicapIndex / 2) * (nineHoleSlopeRating / 113) +
      (nineHoleCourseRating - nineHolePar)
  );

  // Expected score = par + course handicap for the 9 holes
  const expectedScore = nineHolePar + nineHoleCourseHandicap;

  // Calculate and return the expected differential (unrounded for combination)
  return (expectedScore - nineHoleCourseRating) * (113 / nineHoleSlopeRating);
}

/**
 * Calculates the 18-hole equivalent score differential for a 9-hole round.
 * Per USGA Rule 5.1b:
 *   9-hole Score Differential = (113 ÷ 9-hole Slope) × (9-hole adjusted score – 9-hole Course Rating)
 *   18-hole Equivalent = 9-hole played differential + expected 9-hole differential
 *
 * @param adjustedPlayedScore - The adjusted gross score for the 9 holes actually played
 * @param nineHoleCourseRating - The course rating for the played 9 holes
 * @param nineHoleSlopeRating - The slope rating for the played 9 holes
 * @param expectedNineHoleDifferential - The expected differential for the unplayed 9 holes
 */
export function calculate9HoleScoreDifferential(
  adjustedPlayedScore: number,
  nineHoleCourseRating: number,
  nineHoleSlopeRating: number,
  expectedNineHoleDifferential: number
): number {
  // Calculate the differential for the played 9 holes
  const playedDifferential =
    (adjustedPlayedScore - nineHoleCourseRating) * (113 / nineHoleSlopeRating);

  // Combine with expected differential to get 18-hole equivalent
  const combinedDifferential = playedDifferential + expectedNineHoleDifferential;

  // Round per USGA rules (negative differentials round towards zero)
  if (combinedDifferential < 0) {
    return Math.ceil(combinedDifferential * 10) / 10;
  }
  return Math.round(combinedDifferential * 10) / 10;
}
```

#### 2. Fix calculateCourseHandicap pre-rounding

**File**: `supabase/functions/handicap-shared/utils.ts`
**Changes**: Remove incorrect pre-rounding of half-handicap for 9-hole rounds

```typescript
// BEFORE (incorrect):
if (numberOfHolesPlayed === 9) {
  const adjustedHandicapIndex = Math.round((handicapIndex / 2) * 10) / 10;
  return Math.round(
    adjustedHandicapIndex * (teePlayed.slopeRatingFront9 / 113) +
      (teePlayed.courseRatingFront9 - teePlayed.outPar)
  );
}

// AFTER (correct - matches lib/handicap/calculations.ts):
if (numberOfHolesPlayed === 9) {
  // Use half the handicap index for 9-hole rounds (no pre-rounding per USGA)
  // Only the final course handicap result is rounded to nearest integer
  return Math.round(
    (handicapIndex / 2) * (teePlayed.slopeRatingFront9 / 113) +
      (teePlayed.courseRatingFront9 - teePlayed.outPar)
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: Edge Function deploys without errors
- [x] Existing tests pass: `pnpm test`

#### Manual Verification:
- [ ] Edge Function deploys successfully to Supabase
- [ ] Function exports include new 9-hole functions

---

## Phase 2: Update process-handicap-queue/index.ts

### Overview

Modify the Edge Function to use 9-hole specific calculations when processing 9-hole rounds.

### Changes Required:

#### 1. Import new 9-hole functions

**File**: `supabase/functions/process-handicap-queue/index.ts`
**Changes**: Add imports for new functions

```typescript
import {
  calculateHandicapIndex,
  calculateScoreDifferential,
  calculateCourseHandicap,
  calculateAdjustedGrossScore,
  calculateAdjustedPlayedScore,
  calculateLowHandicapIndex,
  applyHandicapCaps,
  addHcpStrokesToScores,
  calculateExpected9HoleDifferential,    // NEW
  calculate9HoleScoreDifferential,       // NEW
  ProcessedRound,
} from "../handicap-shared/utils.ts";
```

#### 2. Update differential calculation logic

**File**: `supabase/functions/process-handicap-queue/index.ts`
**Changes**: Replace lines 311-344 (Pass 2: Calculate raw differentials) with 9-hole aware logic

```typescript
// Pass 2: Calculate raw differentials and detect ESR
let rollingIndex = initialHandicapIndex;
for (let i = 0; i < processedRounds.length; i++) {
  const pr = processedRounds[i];
  pr.existingHandicapIndex = rollingIndex;

  const teePlayed = teeMap.get(pr.teeId);
  if (!teePlayed) throw new Error(`Tee not found for round ${pr.id}`);

  const roundScores = roundScoresMap.get(pr.id);
  if (!roundScores) throw new Error(`Scores not found for round ${pr.id}`);

  const numberOfHolesPlayed = roundScores.length;

  // Calculate differential based on holes played (USGA Rule 5.1b for 9-hole)
  if (numberOfHolesPlayed === 9) {
    // Use 9-hole (front9) ratings per USGA Rule 5.1b
    const expectedDifferential = calculateExpected9HoleDifferential(
      pr.existingHandicapIndex,
      teePlayed.courseRatingFront9,
      teePlayed.slopeRatingFront9,
      teePlayed.outPar
    );

    // Calculate 18-hole equivalent differential
    pr.rawDifferential = calculate9HoleScoreDifferential(
      pr.adjustedPlayedScore,  // Use adjustedPlayedScore for 9-hole, not adjustedGrossScore
      teePlayed.courseRatingFront9,
      teePlayed.slopeRatingFront9,
      expectedDifferential
    );
  } else {
    // 18-hole calculation uses 18-hole ratings
    pr.rawDifferential = calculateScoreDifferential(
      pr.adjustedGrossScore,
      teePlayed.courseRating18,
      teePlayed.slopeRating18
    );
  }

  const startIdx = Math.max(0, i - (ESR_WINDOW_SIZE - 1));
  const relevantDifferentials = processedRounds
    .slice(startIdx, i + 1)
    .map((round) => round.rawDifferential);
  pr.updatedHandicapIndex = calculateHandicapIndex(relevantDifferentials);

  const difference = rollingIndex - pr.rawDifferential;
  if (difference >= EXCEPTIONAL_ROUND_THRESHOLD) {
    const offset = difference >= 10 ? 2 : 1;
    const esrStartIdx = Math.max(
      0,
      i - (Math.min(ESR_WINDOW_SIZE, i + 1) - 1)
    );
    for (let j = esrStartIdx; j <= i; j++) {
      processedRounds[j].esrOffset += offset;
    }
  }

  rollingIndex = pr.updatedHandicapIndex;
}
```

#### 3. Store holesPlayed in ProcessedRound (optional but helpful)

**File**: `supabase/functions/handicap-shared/utils.ts`
**Changes**: Add `holesPlayed` field to ProcessedRound type if needed for debugging

```typescript
export type ProcessedRound = {
  id: number;
  teeTime: Date;
  adjustedGrossScore: number;
  adjustedPlayedScore: number;
  existingHandicapIndex: number;
  rawDifferential: number;
  esrOffset: number;
  finalDifferential: number;
  updatedHandicapIndex: number;
  teeId: number;
  courseHandicap: number;
  approvalStatus: string;
  holesPlayed?: number;  // NEW: Optional for tracking
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes
- [x] Unit tests pass: `pnpm test`
- [ ] Edge Function deploys successfully

#### Manual Verification:
- [ ] Submit a 9-hole round and verify the differential calculation is correct
- [ ] Verify that 18-hole rounds still calculate correctly (no regression)
- [ ] Check logs in Supabase dashboard for any errors during processing

---

## Phase 3: Add Edge Function Tests (Optional but Recommended)

### Overview

Create tests specifically for the Edge Function's 9-hole handling to prevent future regressions.

### Changes Required:

#### 1. Create test file for Edge Function utils

**File**: `test/unit/handicap/edge-function-utils.test.ts`
**Changes**: Mirror the existing 9-hole tests but for the Edge Function code

```typescript
import { describe, expect, test } from "vitest";

// Note: These would need to be imported from a testable location
// or the Edge Function utils would need to be symlinked/copied

describe("Edge Function 9-Hole Calculations", () => {
  test("calculateExpected9HoleDifferential matches main lib", () => {
    // Test parity with lib/handicap/calculations.ts
  });

  test("calculate9HoleScoreDifferential matches main lib", () => {
    // Test parity with lib/handicap/calculations.ts
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] New tests pass: `pnpm test`
- [ ] Build passes: `pnpm build`

---

## Testing Strategy

### Unit Tests:
- Existing 9-hole tests in `test/unit/handicap/nine-hole-calculations.test.ts` validate the algorithm
- The Edge Function should produce identical results to `lib/handicap/calculations.ts`

### Integration Tests:
- Submit a 9-hole round via the API
- Trigger handicap recalculation via Edge Function
- Verify stored differential matches expected calculation

### Manual Testing Steps:
1. Deploy updated Edge Function to Supabase
2. Create a test user with a known handicap index (e.g., 18.0)
3. Submit a 9-hole round with known scores
4. Verify the calculated differential matches USGA Rule 5.1b formula
5. Example calculation to verify:
   - Handicap Index: 18.0
   - Front 9: CR 35.5, Slope 125, Par 36
   - Score: 45 (adjusted played score)
   - Expected: Combined differential ≈ 17.7 (played diff + expected diff)

## Performance Considerations

- No significant performance impact expected
- Same number of database queries
- Slightly more computation for 9-hole rounds (expected differential calculation)

## Migration Notes

- This change affects **future** 9-hole rounds processed by the Edge Function
- **Historical 9-hole rounds with incorrect differentials are NOT fixed by this change**
- A separate migration script would be needed to recalculate historical rounds (out of scope)

## References

- Research document: `.claude/experiences/research/usga-handicap-calculation-misimplementations.md`
- USGA Rule 5.1b: 9-hole score differential calculation
- Fix commit: `36ad1c5` (2026-01-18) - Fixed this in tRPC/Vercel cron
- Main implementation: `lib/handicap/calculations.ts:85-133`
- Test coverage: `test/unit/handicap/nine-hole-calculations.test.ts`
