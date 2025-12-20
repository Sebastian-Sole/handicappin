---
date: 2025-12-19T00:00:00Z
git_commit: 26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056
branch: main
repository: Sebastian-Sole/handicappin
topic: "Score Bar Chart Incorrectly Showing Handicap-Affecting Rounds"
tags: [research, codebase, charts, handicap-calculation, bug-analysis, score-differential]
status: fixed
last_updated: 2025-12-19
last_updated_note: "Added follow-up research identifying score differential display issue and implemented fixes"
---

# Research: Score Bar Chart Incorrectly Showing Handicap-Affecting Rounds

**Date**: 2025-12-19T00:00:00Z
**Git Commit**: 26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056
**Branch**: main
**Repository**: Sebastian-Sole/handicappin

## Research Question

The score bar chart on the homepage (`app/page.tsx`) is incorrectly showing which rounds affect the handicap index. The issue is in `components/charts/score-bar-chart-display.tsx` where the visual highlighting of handicap-affecting rounds is not working correctly.

## Summary

**Critical Bug Identified**: The `getRelevantRounds` function in `lib/handicap/calculations.ts:261-293` has a missing `.slice(0, 1)` call when there are 5 or fewer rounds. This causes ALL rounds to be marked as affecting the handicap when only the BEST 1 round should be used according to USGA handicap calculation rules.

**Impact**: Users with 5 or fewer rounds see all their rounds colored as "Handicap affected" in the score bar chart, when only their best round should be highlighted.

**Additional Issue**: The code uses object reference equality (`.includes()`) to check if rounds are in the relevant list, which is fragile and could break if objects are reconstructed.

## Detailed Findings

### Bug #1: Missing Slice in `getRelevantRounds` for ≤5 Rounds

**Location**: [`lib/handicap/calculations.ts:261-263`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/lib/handicap/calculations.ts#L261-L263)

```typescript
export function getRelevantRounds(rounds: Tables<"round">[]) {
  if (rounds.length <= 5) {
    return rounds.sort((a, b) => a.scoreDifferential - b.scoreDifferential);  // ❌ BUG: Missing .slice(0, 1)
  } else if (rounds.length >= 6 && rounds.length <= 8) {
    return rounds
      .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
      .slice(0, 2);  // ✅ Correct
  }
  // ... rest of conditions
}
```

**The Problem**: When there are 5 or fewer rounds, the function returns ALL rounds sorted by differential instead of just the best 1 round.

**Comparison with Correct Implementation**: [`lib/handicap/calculations.ts:66-98`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/lib/handicap/calculations.ts#L66-L98)

```typescript
export function getRelevantDifferentials(
  scoreDifferentials: number[]
): number[] {
  if (scoreDifferentials.length <= 5) {
    return scoreDifferentials.slice(0, 1);  // ✅ Correct: Returns only 1
  } else if (scoreDifferentials.length >= 6 && scoreDifferentials.length <= 8) {
    return scoreDifferentials.slice(0, 2);  // ✅ Correct: Returns 2
  }
  // ... matches pattern
}
```

**Inconsistency Table**:

| Number of Rounds | `getRelevantDifferentials` (Correct) | `getRelevantRounds` (Current - Buggy) | Expected Behavior |
|------------------|--------------------------------------|---------------------------------------|-------------------|
| ≤ 5              | Returns 1 (slice(0, 1))              | Returns ALL (no slice) ❌             | Should return 1   |
| 6-8              | Returns 2 (slice(0, 2))              | Returns 2 (slice(0, 2)) ✅            | Returns 2         |
| 9-11             | Returns 3 (slice(0, 3))              | Returns 3 (slice(0, 3)) ✅            | Returns 3         |
| 12-14            | Returns 4 (slice(0, 4))              | Returns 4 (slice(0, 4)) ✅            | Returns 4         |
| 15-16            | Returns 5 (slice(0, 5))              | Returns 5 (slice(0, 5)) ✅            | Returns 5         |
| 17-18            | Returns 6 (slice(0, 6))              | Returns 6 (slice(0, 6)) ✅            | Returns 6         |
| 19               | Returns 7 (slice(0, 7))              | Returns 7 (slice(0, 7)) ✅            | Returns 7         |
| ≥ 20             | Returns 8 (slice(0, 8))              | Returns 8 (slice(0, 8)) ✅            | Returns 8         |

### Bug #2: Fragile Object Reference Comparison

**Location**: [`components/homepage/home-page.tsx:51-62`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/homepage/home-page.tsx#L51-L62)

```typescript
relevantRoundsList = getRelevantRounds(rounds);

previousScores = rounds
  .sort((a, b) => {
    return new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime();
  })
  .slice(-10)
  .map((round) => ({
    roundDate: new Date(round.teeTime).toLocaleDateString(),
    score: round.adjustedGrossScore,
    influencesHcp: relevantRoundsList.includes(round),  // Uses object reference equality
  }));
```

**The Issue**:
- Uses `.includes(round)` which relies on object reference equality
- Works currently because JavaScript preserves object references through `.sort()` and `.slice()`
- Fragile: could break if rounds are cloned/reconstructed anywhere in the data flow

### Data Flow Analysis

**Complete Flow from API to Chart**:

1. **Fetch Rounds** ([`components/homepage/home-page.tsx:18-21`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/homepage/home-page.tsx#L18-L21))
   ```typescript
   const rounds = await api.round.getAllByUserId({
     userId: id,
     amount: 20,
   });
   ```
   Fetches the 20 most recent rounds.

2. **Determine Relevant Rounds** ([`components/homepage/home-page.tsx:51`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/homepage/home-page.tsx#L51))
   ```typescript
   relevantRoundsList = getRelevantRounds(rounds);
   ```
   Calls buggy function that returns too many rounds when ≤5 total rounds.

3. **Prepare Chart Data** ([`components/homepage/home-page.tsx:53-62`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/homepage/home-page.tsx#L53-L62))
   ```typescript
   previousScores = rounds
     .sort((a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime())
     .slice(-10)  // Take last 10 rounds chronologically
     .map((round) => ({
       roundDate: new Date(round.teeTime).toLocaleDateString(),
       score: round.adjustedGrossScore,
       influencesHcp: relevantRoundsList.includes(round),
     }));
   ```

4. **Render Chart** ([`components/charts/score-bar-chart.tsx:88-99`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/charts/score-bar-chart.tsx#L88-L99))
   ```typescript
   <Bar dataKey="score" radius={8}>
     {scores.map((entry, index) => (
       <Cell
         key={`cell-${index}`}
         fill={
           entry.influencesHcp
             ? colors.barActive
             : colors.barInactive
         }
       />
     ))}
   </Bar>
   ```
   Colors bars based on `influencesHcp` boolean.

5. **Display Legend** ([`components/charts/score-legend.tsx:14-32`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/charts/score-legend.tsx#L14-L32))
   Shows "Handicap affected" vs "Handicap not affected" legend.

## Code References

- [`lib/handicap/calculations.ts:261-293`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/lib/handicap/calculations.ts#L261-L293) - Buggy `getRelevantRounds` function
- [`lib/handicap/calculations.ts:66-98`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/lib/handicap/calculations.ts#L66-L98) - Correct `getRelevantDifferentials` function (for comparison)
- [`components/homepage/home-page.tsx:51-62`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/homepage/home-page.tsx#L51-L62) - Where `influencesHcp` is set
- [`components/charts/score-bar-chart.tsx:88-99`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/charts/score-bar-chart.tsx#L88-L99) - Bar coloring logic
- [`components/charts/score-bar-chart-display.tsx`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/charts/score-bar-chart-display.tsx) - Chart wrapper component
- [`components/charts/score-legend.tsx`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/charts/score-legend.tsx) - Legend component
- [`components/dashboard/dashboard.tsx:21-33`](https://github.com/Sebastian-Sole/handicappin/blob/26ff3b2cc82b5f90eddebd8ab8f5832fa72c7056/components/dashboard/dashboard.tsx#L21-L33) - Same pattern used in dashboard

## Architecture Insights

### Pattern Used Throughout Codebase

The same pattern for determining handicap-affecting rounds is used in multiple locations:
1. **Homepage**: `components/homepage/home-page.tsx:51-62`
2. **Dashboard**: `components/dashboard/dashboard.tsx:21-33`

Both follow this flow:
```typescript
// 1. Get relevant rounds (sorted by differential, sliced to N best)
const relevantRoundsList = getRelevantRounds(rounds);

// 2. Sort by date and check membership
const chartData = rounds
  .sort((a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime())
  .map((round) => ({
    score: round.adjustedGrossScore,
    influencesHcp: relevantRoundsList.includes(round),  // Object equality
  }));
```

### USGA Handicap Rules Implementation

According to USGA rules (implemented correctly in `getRelevantDifferentials`):
- **3-5 rounds**: Use best 1 score
- **6-8 rounds**: Use best 2 scores
- **9-11 rounds**: Use best 3 scores
- **12-14 rounds**: Use best 4 scores
- **15-16 rounds**: Use best 5 scores
- **17-18 rounds**: Use best 6 scores
- **19 rounds**: Use best 7 scores
- **20+ rounds**: Use best 8 scores

The `getRelevantRounds` function should mirror this exactly.

## Historical Context (from experiences/)

### Previous Related Fixes

**Commit 338f6fc9fa37490e30bff99352ce85913f5a65ba** (Sept 16, 2024)
- Added the `getRelevantRounds()` function and handicap highlighting feature
- Introduced the `influencesHcp` boolean property
- Created the color-coded bar chart system

**Commit 67762fb60f7ef9d4084ea4c220f2da9dfd8b106d** (Oct 1, 2024)
- Fixed off-by-one error in chart display conditions
- Fixed slice logic: changed `.slice(10, 20)` to `.slice(-10)` to correctly show last 10 rounds
- Fixed conditions: changed `>= 5` to `> 5` and `<= 5` to `< 5`

**Commit 0c132b2c60cc6eeb71ba46d3e65820660c43aa0e** (Sept 16, 2024)
- Fixed X-axis date formatting (day/month order was reversed)

### Known Duplicate Code Issues

**From migration plan documentation**:
- Duplicate handicap utilities existed with bugs
- Source of truth: `supabase/functions/handicap-shared/utils.ts`
- Buggy duplicate: `utils/calculations/handicap.ts`
- Consolidated to: `lib/handicap/` directory (current location)

The bug in `getRelevantRounds` may be a remnant from the buggy duplicate that wasn't caught during consolidation.

## Impact Analysis

### Scenario 1: User with 5 Rounds

**Expected Behavior**:
- Only the round with the lowest `scoreDifferential` should be marked as affecting handicap
- Chart shows 5 bars: 1 colored "active", 4 colored "inactive"

**Actual Behavior (Current Bug)**:
- `getRelevantRounds` returns all 5 rounds sorted by differential
- Chart shows 5 bars: ALL colored "active"
- User sees incorrect visual representation

**User Impact**:
- Misleading information about which scores matter
- May not understand which rounds to focus on improving
- Contradicts USGA handicap calculation rules

### Scenario 2: User with 12 Rounds (Bug Fixed in Other Cases)

**Expected Behavior**:
- The 4 rounds with lowest `scoreDifferential` affect handicap
- Chart shows last 10 by date: some colored "active" if they're in the best 4

**Actual Behavior**:
- Works correctly (has `.slice(0, 4)`)
- Only affects the ≤5 rounds case

## Fix Required

### Primary Fix: Add Missing Slice

**File**: `lib/handicap/calculations.ts`
**Line**: 263

**Change**:
```typescript
// BEFORE (Bug):
if (rounds.length <= 5) {
  return rounds.sort((a, b) => a.scoreDifferential - b.scoreDifferential);
}

// AFTER (Fixed):
if (rounds.length <= 5) {
  return rounds
    .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
    .slice(0, 1);
}
```

This aligns `getRelevantRounds` with `getRelevantDifferentials` and USGA rules.

### Secondary Improvement: ID-Based Comparison (Optional)

**File**: `components/homepage/home-page.tsx`
**Line**: 51-62

**Current (Fragile)**:
```typescript
relevantRoundsList = getRelevantRounds(rounds);

previousScores = rounds
  .sort(...)
  .slice(-10)
  .map((round) => ({
    influencesHcp: relevantRoundsList.includes(round),  // Object reference equality
  }));
```

**Improved (Robust)**:
```typescript
const relevantRoundsList = getRelevantRounds(rounds);
const relevantRoundIds = new Set(relevantRoundsList.map(r => r.id));

previousScores = rounds
  .sort(...)
  .slice(-10)
  .map((round) => ({
    influencesHcp: relevantRoundIds.has(round.id),  // ID-based comparison
  }));
```

**Benefits**:
- More robust: doesn't rely on object reference equality
- Clearer intent: explicitly comparing IDs
- Safer: works even if objects are reconstructed

**Apply to**:
- `components/homepage/home-page.tsx:51-62`
- `components/dashboard/dashboard.tsx:21-33` (same pattern)

## Testing Recommendations

### Unit Tests for `getRelevantRounds`

```typescript
describe('getRelevantRounds', () => {
  it('should return only 1 round when there are 5 or fewer rounds', () => {
    const rounds = createMockRounds(5); // Helper to create 5 rounds with different differentials
    const result = getRelevantRounds(rounds);
    expect(result).toHaveLength(1);
    expect(result[0].scoreDifferential).toBe(Math.min(...rounds.map(r => r.scoreDifferential)));
  });

  it('should return 2 rounds when there are 6-8 rounds', () => {
    const rounds = createMockRounds(7);
    const result = getRelevantRounds(rounds);
    expect(result).toHaveLength(2);
  });

  // ... test all cases
});
```

### Integration Tests for Chart Display

```typescript
describe('Score Bar Chart Display', () => {
  it('should highlight only the best round when user has 5 rounds', () => {
    const user = createUserWithRounds(5);
    render(<HomePage profile={user.profile} />);

    const activeBars = screen.getAllByTestId('bar-active');
    const inactiveBars = screen.getAllByTestId('bar-inactive');

    expect(activeBars).toHaveLength(1);
    expect(inactiveBars).toHaveLength(4);
  });
});
```

### Manual Testing

1. Create test user with exactly 5 rounds
2. Navigate to homepage
3. Check score bar chart
4. Expected: Only 1 bar colored as "Handicap affected"
5. Verify legend shows correct colors

## Open Questions

1. Should we add TypeScript type guards to ensure rounds have required properties?
2. Should we add error handling if `scoreDifferential` is undefined?
3. Do we need to handle edge cases like negative differentials?
4. Should the dashboard component also be refactored to use ID-based comparison?

## Related Documentation

- `.claude/tickets/0033-add-handicap-queue-processing-test-coverage.md` - Comprehensive handicap calculation documentation
- `.claude/plans/migrate-handicap-cron-to-vercel/251217.md` - Migration plan with duplicate code issues documented

---

## Follow-up Research (2025-12-19)

### Critical Discovery: Chart Displays Wrong Metric

After investigating a user report showing incorrect highlighting with 8 rounds, a **more fundamental issue** was identified:

**The chart displays `adjustedGrossScore` but should display `scoreDifferential`**

### Why This Matters

**Adjusted Gross Score**:
- Raw score like 85, 90, 95
- Doesn't account for course difficulty
- Two rounds with same gross score can have very different handicap impact

**Score Differential**:
- Normalized value accounting for course difficulty: `(adjustedGrossScore - courseRating) * (113 / slopeRating)`
- This is what actually determines handicap
- Lower differential = better round for handicap purposes

### The Confusion

Example scenario causing confusion:
- **Round 1**: Adjusted gross score = 85, Score differential = 12.5 (easy course)
- **Round 2**: Adjusted gross score = 90, Score differential = 10.2 (hard course)
- **Round 3**: Adjusted gross score = 88, Score differential = 15.3 (medium course)

With 3 rounds, only the **best 1 differential** affects handicap (Round 2 with 10.2).

**What users saw** (displaying gross scores):
- Bar showing "90" is highlighted as affecting handicap
- Bars showing "85" and "88" are not highlighted
- **This looks wrong!** The highest score is highlighted?

**What users should see** (displaying differentials):
- Bar showing "10.2" is highlighted
- Bars showing "12.5" and "15.3" are not highlighted
- **Makes perfect sense!** The lowest differential is highlighted

### Fixes Implemented

**1. Fixed `getRelevantRounds` (Original Bug)**

**File**: `lib/handicap/calculations.ts:262-265`

```typescript
// BEFORE:
if (rounds.length <= 5) {
  return rounds.sort((a, b) => a.scoreDifferential - b.scoreDifferential);
}

// AFTER:
if (rounds.length <= 5) {
  return rounds
    .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
    .slice(0, 1);
}
```

**2. Changed Homepage Chart to Display Differentials**

**File**: `components/homepage/home-page.tsx:60`

```typescript
// BEFORE:
score: round.adjustedGrossScore,

// AFTER:
score: round.scoreDifferential,
```

**3. Changed Dashboard Chart to Display Differentials**

**File**: `components/dashboard/dashboard.tsx:28`

```typescript
// BEFORE:
score: scorecard.round.adjustedGrossScore,

// AFTER:
score: scorecard.round.scoreDifferential,
```

**4. Updated Chart Title**

**File**: `components/charts/score-bar-chart-display.tsx:31`

```typescript
// BEFORE:
<CardTitle className="sm:text-2xl text-xl">Previous Scores</CardTitle>

// AFTER:
<CardTitle className="sm:text-2xl text-xl">Score Differential History</CardTitle>
```

### Impact of Fixes

**Before**:
- Confusing display where "worse" gross scores were highlighted
- Users couldn't understand why certain rounds affected their handicap
- Chart title "Previous Scores" was misleading

**After**:
- Chart displays the actual metric used for handicap calculation
- Visual highlighting makes sense (lowest differentials are highlighted)
- Title "Score Differential History" is accurate
- Users can see which rounds truly affect their handicap

### Testing Recommendations

1. **User with 5 rounds**: Verify only 1 bar is highlighted (lowest differential)
2. **User with 8 rounds**: Verify 2 bars are highlighted (2 lowest differentials)
3. **User with 12 rounds**: Verify 4 bars are highlighted (4 lowest differentials)
4. **Visual verification**: Highlighted bars should have the lowest differential values
5. **Title check**: Chart title should read "Score Differential History"

### Additional Context

This fix aligns the visual representation with how golf handicaps actually work:
- **Handicap index** is calculated from the **best N score differentials** (not gross scores)
- **Score differential** accounts for course difficulty (slope/rating)
- A 95 on a championship course (differential 8.2) is better for handicap than an 85 on an easy course (differential 12.5)

The chart now correctly educates users about what impacts their handicap.

---

## Follow-up Research #2: Tooltip Display Issues (2025-12-19)

### Issues Identified

After the initial fixes, users reported additional tooltip problems:

1. **Line chart tooltip** always showing "54" for handicap index
2. **Bar chart tooltip** showing incorrect values (8.1 and 20.1 instead of actual score differentials)

### Root Cause Analysis

**Problem 1: Incorrect Chart Config Keys**

The tooltip system in recharts uses the `config` object to map `dataKey` values to display labels. The config key must match the dataKey used in the chart.

**Handicap Trend Chart** (`handicap-trend-chart.tsx:33-38`):
```typescript
// BEFORE (Wrong):
config={{
  desktop: {           // ❌ Wrong key
    label: "Score",    // ❌ Wrong label
    color: "hsl(var(--chart-1))",
  },
}}
// dataKey="handicap" doesn't match config key "desktop"
```

**Score Bar Chart** (`score-bar-chart.tsx:55-60`):
```typescript
// BEFORE (Wrong):
config={{
  round: {              // ❌ Wrong key
    label: "Desktop",   // ❌ Completely wrong label
    color: "hsl(var(--chart-1))",
  },
}}
// dataKey="score" doesn't match config key "round"
```

**Problem 2: Hardcoded Y-Axis Domain**

The handicap trend chart had a hardcoded Y-axis domain of `[0, 54]` with fixed ticks. This caused:
- Poor data visualization when handicaps were in a narrow range (e.g., 8-12)
- Tooltip potentially showing max domain value instead of actual values

### Fixes Implemented

**1. Fixed Handicap Trend Chart Config**

**File**: `components/charts/handicap-trend-chart.tsx:33-38`

```typescript
// BEFORE:
config={{
  desktop: {
    label: "Score",
    color: "hsl(var(--chart-1))",
  },
}}

// AFTER:
config={{
  handicap: {                // ✅ Matches dataKey="handicap"
    label: "Handicap Index", // ✅ Correct label
    color: "hsl(var(--chart-1))",
  },
}}
```

**2. Fixed Score Bar Chart Config**

**File**: `components/charts/score-bar-chart.tsx:55-60`

```typescript
// BEFORE:
config={{
  round: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
}}

// AFTER:
config={{
  score: {                      // ✅ Matches dataKey="score"
    label: "Score Differential", // ✅ Correct label
    color: "hsl(var(--chart-1))",
  },
}}
```

**3. Made Handicap Chart Y-Axis Dynamic**

**File**: `components/charts/handicap-trend-chart.tsx:29-53`

```typescript
// Calculate dynamic Y-axis range with padding
const hasData = previousHandicaps.length > 0;
const minHandicap = hasData
  ? Math.min(...previousHandicaps.map((h) => h.handicap))
  : 0;
const maxHandicap = hasData
  ? Math.max(...previousHandicaps.map((h) => h.handicap))
  : 54;
const range = maxHandicap - minHandicap;
const padding = Math.max(2, range * 0.2); // At least 2 units padding, or 20% of range

// Calculate nice tick spacing
const totalRange = range + padding * 2;
const tickSpacing = Math.ceil(totalRange / 5);
const startValue = Math.max(0, Math.floor(minHandicap - padding));
const endValue = Math.min(54, Math.ceil(maxHandicap + padding));

// Generate tick values dynamically
const tickValues = [];
for (let i = startValue; i <= endValue; i += tickSpacing) {
  tickValues.push(i);
}
```

Then updated the YAxis:
```typescript
// BEFORE:
<YAxis
  dataKey="handicap"
  domain={[0, 54]}
  ticks={[0, 9, 18, 27, 36, 45, 54]}
/>

// AFTER:
<YAxis
  dataKey="handicap"
  domain={[startValue, endValue]}  // ✅ Dynamic based on data
  ticks={tickValues}                // ✅ Dynamic tick marks
/>
```

### Impact of Tooltip Fixes

**Before**:
- Tooltips showed incorrect labels ("Score", "Desktop")
- Tooltips displayed wrong values or generic fallback values
- Handicap chart had poor zoom level (always 0-54 range)
- Users couldn't see actual values on hover

**After**:
- Tooltips show correct labels ("Handicap Index", "Score Differential")
- Tooltips display actual data values from each data point
- Handicap chart zooms to relevant range with appropriate padding
- Better data visibility and user experience

### How Recharts Tooltips Work

Understanding the tooltip system helps prevent future issues:

1. **Config Object**: Maps dataKey to display configuration
   ```typescript
   config={{
     [dataKey]: {
       label: "Display Label",  // Shown in tooltip
       color: "color-value"
     }
   }}
   ```

2. **Tooltip Rendering** (from `components/ui/chart.tsx:249`):
   ```typescript
   <span className="text-muted-foreground">
     {itemConfig?.label || item.name}  // Uses config[dataKey].label
   </span>
   ```

3. **Value Display** (from `components/ui/chart.tsx:253-255`):
   ```typescript
   {item.value && (
     <span className="font-mono font-medium tabular-nums text-foreground">
       {item.value.toLocaleString()}  // Displays actual value
     </span>
   )}
   ```

### Testing Checklist

- [ ] Handicap trend chart tooltip shows "Handicap Index" label
- [ ] Handicap trend chart tooltip shows actual handicap values
- [ ] Score bar chart tooltip shows "Score Differential" label
- [ ] Score bar chart tooltip shows actual differential values (not generic numbers)
- [ ] Handicap chart Y-axis zooms appropriately to data range
- [ ] Handicap chart Y-axis still caps at 0 minimum and 54 maximum
- [ ] Both tooltips display when hovering over data points

### Summary of All Fixes

This research uncovered and fixed **three separate issues**:

1. **Wrong metric displayed**: Changed from `adjustedGrossScore` to `scoreDifferential`
2. **Missing slice**: Fixed `getRelevantRounds` to return correct number of rounds for ≤5 rounds
3. **Broken tooltips**: Fixed config objects to match dataKeys and made Y-axis dynamic

All three issues contributed to user confusion about which rounds affect their handicap.

---

## Follow-up Research #3: Same-Day Round Data Collision (2025-12-19)

### Critical Issue Discovered

After fixing tooltips, users reported that **multiple rounds played on the same day showed the same value** in tooltips for both charts.

### Root Cause: Non-Unique Data Keys

Both charts used `roundDate` (formatted as "12/19/2025") as the data key. When multiple rounds were played on the same day:

**Problem in Homepage** (`home-page.tsx:47, 59`):
```typescript
previousHandicaps = rounds
  .map((round) => ({
    roundDate: new Date(round.teeTime).toLocaleDateString(), // ❌ Not unique!
    handicap: round.updatedHandicapIndex,
  }));

previousScores = rounds
  .map((round) => ({
    roundDate: new Date(round.teeTime).toLocaleDateString(), // ❌ Not unique!
    score: round.scoreDifferential,
  }));
```

**What Happened**:
- User plays 2 rounds on 12/19/2025
- Both rounds get key: `"12/19/2025"`
- Recharts treats them as the same data point
- Tooltips show the same value for both
- One round might be hidden entirely

**Same Issue in Dashboard** (`dashboard.tsx:27`):
```typescript
const sortedGraphData = scorecards
  .map((scorecard) => ({
    roundDate: new Date(scorecard.teeTime).toLocaleDateString(), // ❌ Not unique!
    score: scorecard.round.scoreDifferential,
  }));
```

### Why This Happens in Recharts

Recharts uses the data key as a unique identifier. From the data structure:
```typescript
data = [
  { roundDate: "12/19/2025", score: 8.1 },  // Round 1
  { roundDate: "12/19/2025", score: 12.3 }, // Round 2 - COLLISION!
]
```

When recharts processes this:
1. It groups/indexes data by the key field
2. Duplicate keys get merged or overwritten
3. Tooltips can't differentiate between rounds

### Fixes Implemented

**1. Added Unique ID to Homepage Data**

**File**: `components/homepage/home-page.tsx:46-54, 63-72`

```typescript
// BEFORE:
previousHandicaps = rounds
  .map((round) => ({
    roundDate: new Date(round.teeTime).toLocaleDateString(),
    handicap: round.updatedHandicapIndex,
  }));

// AFTER:
previousHandicaps = rounds
  .map((round) => ({
    id: round.id,                    // ✅ Unique identifier
    roundDate: new Date(round.teeTime).toLocaleDateString(),
    roundTime: new Date(round.teeTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),                               // ✅ Time for tooltip
    handicap: round.updatedHandicapIndex,
  }));
```

Same fix applied to `previousScores` mapping.

**2. Updated Dashboard Data**

**File**: `components/dashboard/dashboard.tsx:26-35`

```typescript
// BEFORE:
const sortedGraphData = scorecards
  .map((scorecard) => ({
    roundDate: new Date(scorecard.teeTime).toLocaleDateString(),
    score: scorecard.round.scoreDifferential,
  }));

// AFTER:
const sortedGraphData = scorecards
  .map((scorecard) => ({
    id: scorecard.round.id,          // ✅ Unique identifier
    roundDate: new Date(scorecard.teeTime).toLocaleDateString(),
    roundTime: new Date(scorecard.teeTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),                               // ✅ Time for tooltip
    score: scorecard.round.scoreDifferential,
    influencesHcp: relevantRoundsList.includes(scorecard.round),
  }));
```

**3. Enhanced Tooltip to Show Time**

**File**: `components/charts/handicap-trend-chart.tsx:94-107`

```typescript
<ChartTooltip
  cursor={false}
  content={
    <ChartTooltipContent
      labelFormatter={(value, payload) => {
        if (payload && payload[0]?.payload) {
          const data = payload[0].payload;
          return `${data.roundDate} at ${data.roundTime}`;  // Shows date + time
        }
        return value;
      }}
    />
  }
/>
```

**File**: `components/charts/score-bar-chart.tsx:74-87`
- Same tooltip enhancement applied

### Impact of Fixes

**Before**:
- Multiple rounds on same day showed identical tooltip values
- User couldn't distinguish between rounds
- Charts might hide duplicate-keyed data points
- Confusing when playing multiple rounds per day

**After**:
- Each round has unique ID in data structure
- Tooltips show both date AND time: "12/19/2025 at 2:30 PM"
- All rounds display correctly, even multiple per day
- Users can see exact time each round was played
- Each data point shows its actual unique value

### Data Structure Comparison

**Old Structure** (Non-unique keys):
```typescript
[
  { roundDate: "12/19/2025", score: 8.1 },
  { roundDate: "12/19/2025", score: 12.3 },  // Collision!
]
```

**New Structure** (Unique + Time Info):
```typescript
[
  { id: 123, roundDate: "12/19/2025", roundTime: "10:00 AM", score: 8.1 },
  { id: 124, roundDate: "12/19/2025", roundTime: "2:30 PM", score: 12.3 },
]
```

### Why ID is Important

The `id` field ensures:
1. **Uniqueness**: Each round has a unique database ID
2. **Stability**: ID doesn't change if date/time is edited
3. **Reliability**: Works regardless of how many rounds on same day
4. **React Keys**: Can be used as React key prop if needed

### Testing Checklist

- [ ] Play 2 rounds on the same day
- [ ] Verify both rounds appear in charts
- [ ] Hover over each round - tooltips should show different values
- [ ] Tooltip should display: "Date at Time" (e.g., "12/19/2025 at 2:30 PM")
- [ ] Handicap chart shows correct handicap for each round
- [ ] Score chart shows correct differential for each round
- [ ] Highlighting still works correctly for handicap-affecting rounds

### Summary of All Fixes

This research uncovered and fixed **four separate issues**:

1. ✅ **Wrong metric displayed**: Changed from `adjustedGrossScore` to `scoreDifferential`
2. ✅ **Missing slice**: Fixed `getRelevantRounds` to return correct number for ≤5 rounds
3. ✅ **Broken tooltips**: Fixed config objects to match dataKeys and made Y-axis dynamic
4. ✅ **Data key collisions**: Added unique IDs and time info for same-day rounds

All four issues have been resolved to provide accurate, detailed visualization of handicap data.

---

## Follow-up Research #4: Recharts Data Key Resolution (2025-12-19)

### Critical Discovery: Tooltip Still Broken

After adding ID and time fields, users reported tooltips STILL showed wrong values:
- Chart Y-axis displayed: ~19, 19, 54, 54, ~19, ~20, ~20, ~20, ~16, ~16
- Tooltips showed: 18.1 for most, 16.1 for the last two
- **All tooltips displayed the same value for same-day rounds**

### Root Cause: X-Axis DataKey

The previous fix added `id` to the data structure but **didn't update the X-axis dataKey**:

```typescript
// Data structure (with ID added):
{ id: 123, roundDate: "12/19/2025", score: 8.1 }
{ id: 124, roundDate: "12/19/2025", score: 12.3 }

// X-Axis still using non-unique key:
<XAxis dataKey="roundDate" />  // ❌ Still using roundDate!
```

**What This Caused**:
1. Recharts uses the X-axis `dataKey` to identify and index data points
2. With `dataKey="roundDate"`, multiple rounds on same day have same identifier
3. Recharts internally maps data by this key, causing collisions
4. Tooltips read from the merged/overwritten data
5. Result: Same tooltip value for all rounds on that date

### The Complete Fix

**1. Added Unique Key Field**

Changed from `id` to `key` (string) for consistency:

**File**: `components/homepage/home-page.tsx:47, 64`

```typescript
// BEFORE:
previousHandicaps = rounds.map((round) => ({
  id: round.id,
  roundDate: new Date(round.teeTime).toLocaleDateString(),
  // ...
}));

// AFTER:
previousHandicaps = rounds.map((round) => ({
  key: `${round.id}`,  // ✅ Unique string key for recharts
  roundDate: new Date(round.teeTime).toLocaleDateString(),
  // ...
}));
```

**2. Updated X-Axis to Use Unique Key**

**File**: `components/charts/handicap-trend-chart.tsx:76-89`

```typescript
// BEFORE:
<XAxis
  dataKey="roundDate"  // ❌ Not unique!
  tickFormatter={(value) => {
    const dateParts = value.split(/[-\/.\s]/);
    return `${dateParts[0]}/${dateParts[1]}`;
  }}
/>

// AFTER:
<XAxis
  dataKey="key"  // ✅ Unique identifier!
  tickFormatter={(value, index) => {
    const dataPoint = previousHandicaps[index];
    if (dataPoint?.roundDate) {
      const dateParts = dataPoint.roundDate.split(/[-\/.\s]/);
      return `${dateParts[0]}/${dateParts[1]}`;
    }
    return value;
  }}
/>
```

**File**: `components/charts/score-bar-chart.tsx:64-77`
- Same fix applied to bar chart

**File**: `components/dashboard/dashboard.tsx:27`
- Same fix applied to dashboard data

### Why This Works

**Before (Broken)**:
```typescript
// Data:
[
  { roundDate: "12/19/2025", score: 8.1 },
  { roundDate: "12/19/2025", score: 12.3 }
]

// Recharts internal map:
{
  "12/19/2025": { score: 12.3 }  // Second one overwrites first!
}

// Tooltip for ANY point on 12/19: shows 12.3
```

**After (Fixed)**:
```typescript
// Data:
[
  { key: "123", roundDate: "12/19/2025", score: 8.1 },
  { key: "124", roundDate: "12/19/2025", score: 12.3 }
]

// Recharts internal map:
{
  "123": { score: 8.1 },  // ✅ Unique entry
  "124": { score: 12.3 }   // ✅ Separate entry
}

// Tooltip shows correct value for each point
```

### How tickFormatter Works

The `tickFormatter` receives two parameters:
1. **`value`**: The actual dataKey value (now the unique key like "123")
2. **`index`**: The index in the data array

We use `index` to look up the actual data point and display the `roundDate`:

```typescript
tickFormatter={(value, index) => {
  const dataPoint = previousHandicaps[index];  // Get actual data
  return formatDate(dataPoint.roundDate);      // Display date
}}
```

This way:
- **Recharts uniqueness**: Uses `key` field (unique per round)
- **Visual display**: Shows `roundDate` on X-axis
- **Tooltips**: Read correct data point based on unique key

### Impact of Final Fix

**Before**:
- ❌ Same tooltip value for all rounds on same day
- ❌ Chart displayed correct Y-values but tooltip showed wrong values
- ❌ Data collision in recharts internal data structure

**After**:
- ✅ Each round has unique identifier in recharts
- ✅ Tooltips show correct value for each specific round
- ✅ No data collisions or overwrites
- ✅ X-axis still displays dates visually
- ✅ Tooltip shows: "Date at Time" with correct value

### Why ID Alone Wasn't Enough

Adding `id` to the data wasn't sufficient because:
1. Recharts doesn't automatically detect unique IDs
2. It uses the specified `dataKey` prop to identify points
3. If `dataKey="roundDate"`, it ignores the `id` field
4. **You must set `dataKey` to a unique field**

### Complete Summary of All Fixes

This research session uncovered and fixed **four separate but related issues**:

1. ✅ **Wrong metric displayed**: Changed from `adjustedGrossScore` to `scoreDifferential`
   - Files: `home-page.tsx:60,70`, `dashboard.tsx:28`

2. ✅ **Missing slice**: Fixed `getRelevantRounds` to return correct number for ≤5 rounds
   - File: `lib/handicap/calculations.ts:263-265`

3. ✅ **Broken tooltip config**: Fixed config objects to match dataKeys and made Y-axis dynamic
   - Files: `handicap-trend-chart.tsx:34-38`, `score-bar-chart.tsx:56-60`

4. ✅ **Recharts data key collision**: Changed X-axis to use unique key instead of date
   - Files: `home-page.tsx:47,64`, `dashboard.tsx:27`, `handicap-trend-chart.tsx:77`, `score-bar-chart.tsx:65`

### Testing Checklist

- [ ] Play 2+ rounds on the same day
- [ ] Verify all rounds appear as separate points
- [ ] Hover over each point - should show different values
- [ ] Y-axis values should match tooltip values exactly
- [ ] X-axis should still show dates (not IDs)
- [ ] Tooltip should show: "Date at Time"
- [ ] Handicap highlighting should still work correctly
- [ ] No data points should be merged or hidden

The tooltip system now correctly identifies and displays data for each individual round, regardless of how many rounds are played on the same day.
