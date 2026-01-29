# Statistics Page UX Redesign

## Overview

Redesign the Statistics page to improve discoverability and engagement with:
1. **Tab-based sections** for organized navigation
2. **Personal Bests/Records hero section** as the primary focus
3. **Animated counters and charts** for engagement
4. **Better statistical displays** throughout

## Current State

The existing Statistics page has all calculations working but displays them in a long scrolling layout that makes it hard to find specific stats and feels overwhelming.

## Implementation Approach

### Phase 1: Add Tabs Component

**File**: `components/ui/tabs.tsx` (new)

Install and create shadcn-style Tabs component using @radix-ui/react-tabs:

```bash
pnpm add @radix-ui/react-tabs
```

Create tabs component following shadcn pattern with styling.

### Phase 2: Create Hero Section with Personal Bests

**File**: `components/statistics/hero/personal-bests-hero.tsx` (new)

Hero section featuring:
- Large animated handicap display (text-6xl, similar to dashboard)
- Personal bests grid with animated counters:
  - Best Differential
  - Best Score
  - Lowest Handicap Achieved
  - Most Rounds in a Month
  - Longest Streak
- Player Type badge prominently displayed
- Trend indicator (improving/declining)

### Phase 3: Create Animated Counter Component

**File**: `components/statistics/animated-counter.tsx` (new)

Animated counter that counts up from 0 to target value on mount:
- Uses requestAnimationFrame for smooth animation
- Supports decimals for differentials
- Staggered entry animations using tailwindcss-animate

### Phase 4: Reorganize into Tab Sections

**File**: `components/statistics/statistics.tsx` (modify)

Restructure to use tabs:
- **Tab 1: Overview** - Quick stats cards, handicap trend chart
- **Tab 2: Courses** - Course analytics table and highlights
- **Tab 3: Patterns** - Day of week, time of day, rounds per month charts
- **Tab 4: Fun Facts** - Score distribution, strokes by par, player analysis

### Phase 5: Add Entry Animations

Apply staggered animations to stat cards and sections:
- `animate-in fade-in slide-in-from-bottom-4` for cards
- Stagger delays using custom CSS or inline styles
- Chart animations via Recharts' built-in animationDuration

### Phase 6: Add Personal Bests Calculations

**File**: `lib/statistics/calculations.ts` (modify)

Add new calculation functions:
- `calculatePersonalBests()` - best differential, best score, lowest handicap
- `calculateLongestStreak()` - consecutive rounds under a threshold
- `calculateBestMonth()` - month with most rounds played

## Files to Modify/Create

| File | Action |
|------|--------|
| `components/ui/tabs.tsx` | Create |
| `components/statistics/hero/personal-bests-hero.tsx` | Create |
| `components/statistics/animated-counter.tsx` | Create |
| `components/statistics/statistics.tsx` | Modify |
| `lib/statistics/calculations.ts` | Modify |
| `types/statistics.ts` | Modify (add PersonalBests type) |

## Component Structure After Redesign

```
Statistics Page
├── Header (title + time range filter)
├── Personal Bests Hero Section
│   ├── Large Handicap Display (animated)
│   ├── Personal Bests Grid (4-6 cards with animated counters)
│   └── Player Type Badge
├── Tabs Navigation
│   ├── Overview Tab
│   │   ├── Quick Stats Cards
│   │   └── Handicap Trend Chart
│   ├── Courses Tab
│   │   ├── Highlight Cards (best/worst/most played)
│   │   └── Course Performance Table
│   ├── Patterns Tab
│   │   ├── Day of Week Chart
│   │   ├── Time of Day Distribution
│   │   └── Rounds Per Month Chart
│   └── Fun Facts Tab
│       ├── Score Distribution Chart
│       ├── Strokes by Par Type
│       └── Day of Week Strokes Table
```

## Animation Strategy

1. **Hero section**: Fade in on mount with animated counters
2. **Tab content**: Fade in when tab becomes active
3. **Stat cards**: Staggered entry (0ms, 50ms, 100ms delays)
4. **Charts**: Use Recharts animationDuration={800}

## Verification

1. Navigate to `/statistics` as a premium user
2. Verify hero section displays with animated counters
3. Verify tabs switch content correctly
4. Verify time range filter updates all statistics
5. Verify animations play smoothly on page load and tab switch
6. Test on mobile - verify responsive layout
7. Run `pnpm build && pnpm lint` to verify no errors
