# Core Web Vitals Performance Optimization Plan

## Overview

This plan addresses the slow performance metrics measured on the homepage, /about, and /rounds/add pages:
- **First Contentful Paint (FCP)**: 4.09s (target: <1.8s)
- **Largest Contentful Paint (LCP)**: 4.42s (target: <2.5s)
- **Time to First Byte (TTFB)**: 3.76s (target: <0.8s)

The root causes are sequential blocking data fetches, duplicate auth calls, heavy client-side monitoring, and lack of caching for static/semi-static content.

## Current State Analysis

### Critical Performance Bottlenecks

1. **Middleware + Navbar Duplicate Auth Calls**
   - `middleware.ts:5` → `updateSession()` calls `supabase.auth.getUser()` + `getSession()`
   - `navbar.tsx:28-29` → calls `supabase.auth.getUser()` AGAIN
   - Result: 2 auth round-trips per request

2. **Landing Page Sequential Fetches** (`landing.tsx:49-62`)
   - 3 sequential RPC calls (user count, round count, course count)
   - 1 Stripe API call for promo code
   - None parallelized with `Promise.all()`

3. **Authenticated Homepage Sequential Fetches** (`home-page.tsx:18-98`)
   - 4 sequential tRPC calls that block on each other
   - Course/tee data fetched only after rounds complete

4. **Heavy Client-Side Monitoring**
   - `instrumentation-client.ts:16`: `tracesSampleRate: 1` (100% of requests traced!)
   - Sentry Replay adds ~90-120KB to bundle
   - Vercel Analytics running alongside (redundant)

5. **No Caching Configuration**
   - No `revalidate` exports on any pages
   - No ISR (Incremental Static Regeneration) configured
   - QueryClient staleTime only 30 seconds

### Key Discoveries

| Issue | Location | Impact | Severity |
|-------|----------|--------|----------|
| Duplicate auth (middleware + navbar) | `middleware.ts:43`, `navbar.tsx:29` | +200-400ms TTFB | CRITICAL |
| Sequential landing page fetches | `landing.tsx:49-62` | +1-2s TTFB | CRITICAL |
| Sequential homepage fetches | `home-page.tsx:18-98` | +2-3s TTFB | CRITICAL |
| 100% client trace sampling | `instrumentation-client.ts:16` | +200-500ms overhead | HIGH |
| No page-level caching | All pages | Every request hits DB | HIGH |
| Recharts not lazy loaded | `chart.tsx:4` | +150KB bundle | MEDIUM |

## Desired End State

After implementation:
- **TTFB**: <800ms (from 3.76s) - 4.7x improvement
- **FCP**: <1.8s (from 4.09s) - 2.3x improvement
- **LCP**: <2.5s (from 4.42s) - 1.8x improvement
- **Real Experience Score**: >85 (from 69)

### Verification

- Vercel Speed Insights shows improved Core Web Vitals
- Lighthouse scores improve on all three pages
- Server response times visible in console logs show <100ms middleware, <500ms total TTFB

## What We're NOT Doing

- Replacing Supabase auth (out of scope)
- Replacing tRPC with REST (architectural change)
- Replacing Recharts with another library (just lazy loading)
- Full static generation (user-specific data requires dynamic rendering)
- Removing Sentry entirely (just reducing sampling)

## Implementation Approach

**Strategy**: Fix the biggest bottlenecks first (sequential fetches), then add caching, then optimize monitoring.

**Order of phases**:
1. Parallelize all sequential data fetches (biggest TTFB impact)
2. Eliminate duplicate Navbar auth call
3. Add ISR caching for public/semi-static content
4. Reduce Sentry tracing overhead
5. Lazy load Recharts

---

## Phase 1: Parallelize Sequential Data Fetches

### Overview

Convert sequential `await` calls to parallel `Promise.all()` patterns. This is the single biggest performance win.

### Changes Required

#### 1. Landing Page - Parallelize RPC Calls

**File**: `components/homepage/landing.tsx`
**Current**: Lines 49-62 execute sequentially
**Change**: Use Promise.all for all 4 async operations

```typescript
// BEFORE (sequential - ~4s total)
const { data: numberOfUsers } = await supabase.rpc("get_public_user_count");
const { data: numberOfRounds } = await supabase.rpc("get_public_round_count");
const { data: numberOfCourses } = await supabase.rpc("get_public_course_count");
let promoDetails = await getPromotionCodeDetails("EARLY100");

// AFTER (parallel - ~1s total)
const [
  { data: numberOfUsers, error: usersError },
  { data: numberOfRounds, error: roundsError },
  { data: numberOfCourses, error: coursesError },
  promoDetails,
] = await Promise.all([
  supabase.rpc("get_public_user_count"),
  supabase.rpc("get_public_round_count"),
  supabase.rpc("get_public_course_count"),
  getPromotionCodeDetails("EARLY100"),
]);
```

#### 2. Authenticated Homepage - Parallelize tRPC Calls

**File**: `components/homepage/home-page.tsx`
**Current**: Lines 18-98 execute sequentially (rounds → bestRound → course → tee)
**Change**: Fetch rounds and bestRound in parallel, then course/tee in parallel

```typescript
// BEFORE (sequential - ~3s total)
const rounds = await api.round.getAllByUserId({ userId: id, amount: 20 });
const bestRound = await api.round.getBestRound({ userId: id });
// ... later
const course = await api.course.getCourseById({ courseId: bestRound.courseId });
const tee = await api.tee.getTeeById({ teeId: bestRound.teeId });

// AFTER (parallel - ~1s total)
// First batch: rounds and bestRound (no dependency)
const [rounds, bestRound] = await Promise.all([
  api.round.getAllByUserId({ userId: id, amount: 20 }),
  api.round.getBestRound({ userId: id }),
]);

// Second batch: course and tee (depend on bestRound)
let bestRoundCourse: Tables<"course"> | null = null;
let bestRoundTee: Tables<"teeInfo"> | null = null;

if (bestRound !== null) {
  [bestRoundCourse, bestRoundTee] = await Promise.all([
    api.course.getCourseById({ courseId: bestRound.courseId }),
    api.tee.getTeeById({ teeId: bestRound.teeId }),
  ]);
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build` (requires env vars)
- [x] Linting passes: `pnpm lint`
- [x] Existing tests pass: `pnpm test` (75/75 unit tests pass)

#### Manual Verification:
- [ ] Landing page loads noticeably faster
- [ ] Authenticated homepage loads noticeably faster
- [ ] No functional regressions (all data still displays correctly)
- [ ] Server logs show parallel fetch timing

---

## Phase 2: Eliminate Duplicate Navbar Auth Call

### Overview

The Navbar server component calls `supabase.auth.getUser()` on every page render, even though middleware already performed this check. We'll make Navbar a client component that receives user data as props from layout, or use React's cache() properly.

### Changes Required

#### 1. Update Root Layout to Pass User Data

**File**: `app/layout.tsx`
**Change**: Fetch user once at layout level, pass to Navbar

```typescript
// app/layout.tsx
import { createServerComponentClient } from "@/utils/supabase/server";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch user once at layout level (will be cached by React cache())
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationJsonLd />
        <SoftwareApplicationJsonLd />
      </head>
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <TRPCReactProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <BillingSync />
              <Navbar user={user} />  {/* Pass user as prop */}
              <section className="pt-16 grow bg-background flex flex-col">{children}</section>
              <Footer />
              <Toaster />
            </ThemeProvider>
          </TRPCReactProvider>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

#### 2. Update Navbar to Accept User Prop

**File**: `components/layout/navbar.tsx`
**Change**: Remove internal auth fetch, accept user as prop

```typescript
// BEFORE
export async function Navbar() {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();
  const isAuthed = data?.user;
  // ...
}

// AFTER
import { User } from "@supabase/supabase-js";

interface NavbarProps {
  user: User | null;
}

export function Navbar({ user }: NavbarProps) {
  const isAuthed = !!user;
  // ... rest of component (remove async, no longer fetches)
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build` (requires env vars)
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Navbar still shows correct auth state
- [ ] No duplicate `getUser()` calls in server logs
- [ ] Page loads faster (one less auth round-trip)

---

## Phase 3: Add ISR Caching for Public/Semi-Static Content

### Overview

Add Incremental Static Regeneration (ISR) to cache pages that don't need real-time data. Use tag-based revalidation for user-specific data.

### Changes Required

#### 1. Landing Page - Daily Revalidation

**File**: `components/homepage/landing.tsx` (or create wrapper)
**Note**: Since Landing is a component, we need to add caching at the page level

**File**: `app/page.tsx`
**Change**: Add revalidate for unauthenticated landing page

```typescript
// app/page.tsx
import { unstable_cache } from "next/cache";

// Cache the landing page data for 24 hours
const getCachedLandingData = unstable_cache(
  async () => {
    const supabase = await createServerComponentClient();

    const [
      { data: numberOfUsers, error: usersError },
      { data: numberOfRounds, error: roundsError },
      { data: numberOfCourses, error: coursesError },
      promoDetails,
    ] = await Promise.all([
      supabase.rpc("get_public_user_count"),
      supabase.rpc("get_public_round_count"),
      supabase.rpc("get_public_course_count"),
      getPromotionCodeDetails("EARLY100"),
    ]);

    return {
      numberOfUsers: usersError || numberOfUsers === null ? 10 : numberOfUsers || 10,
      numberOfRounds: roundsError || numberOfRounds === null ? 0 : numberOfRounds || 0,
      numberOfCourses: coursesError || numberOfCourses === null ? 0 : numberOfCourses || 0,
      promoDetails,
    };
  },
  ["landing-page-stats"],
  { revalidate: 86400 } // 24 hours
);
```

#### 2. About Page - Add Revalidation

**File**: `app/about/page.tsx`
**Change**: Add ISR with 24-hour revalidation

```typescript
// Add at top of file
export const revalidate = 86400; // Revalidate every 24 hours

// Cache the about page database queries
import { unstable_cache } from "next/cache";

const getCachedAboutStats = unstable_cache(
  async () => {
    const supabase = await createServerComponentClient();

    const [roundCount, courseCount] = await Promise.all([
      supabase.from("round").select("id", { count: "exact", head: true }),
      supabase.from("course").select("id", { count: "exact", head: true }),
    ]);

    return {
      roundCount: roundCount.count ?? 0,
      courseCount: courseCount.count ?? 0,
    };
  },
  ["about-page-stats"],
  { revalidate: 86400 }
);
```

#### 3. User-Specific Caching with Tags

**File**: `components/homepage/home-page.tsx`
**Change**: Cache user data with user-specific tags that can be invalidated on round submission

```typescript
import { unstable_cache } from "next/cache";

// Cache user's homepage data until they submit a new round
const getCachedUserHomeData = (userId: string) => unstable_cache(
  async () => {
    const [rounds, bestRound] = await Promise.all([
      api.round.getAllByUserId({ userId, amount: 20 }),
      api.round.getBestRound({ userId }),
    ]);

    let bestRoundCourse = null;
    let bestRoundTee = null;

    if (bestRound) {
      [bestRoundCourse, bestRoundTee] = await Promise.all([
        api.course.getCourseById({ courseId: bestRound.courseId }),
        api.tee.getTeeById({ teeId: bestRound.teeId }),
      ]);
    }

    return { rounds, bestRound, bestRoundCourse, bestRoundTee };
  },
  [`user-home-${userId}`],
  {
    revalidate: 3600, // 1 hour fallback
    tags: [`user-${userId}-rounds`] // Can be invalidated on round submission
  }
);
```

#### 4. Invalidate Cache on Round Submission

**File**: `server/api/routers/round.ts` (in createRound mutation)
**Change**: Add cache invalidation after successful round creation

```typescript
import { revalidateTag } from "next/cache";

// In the createRound mutation, after successfully creating a round:
revalidateTag(`user-${userId}-rounds`);
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build` (requires env vars)
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Landing page loads instantly on repeat visits (cached)
- [ ] About page loads instantly on repeat visits (cached)
- [ ] User homepage shows cached data until round submitted
- [ ] After submitting a round, homepage shows updated data

---

## Phase 4: Reduce Sentry Tracing Overhead

### Overview

The client-side Sentry is tracing 100% of requests, adding significant overhead. Reduce to 20% to match server-side sampling.

### Changes Required

#### 1. Reduce Client Trace Sampling

**File**: `instrumentation-client.ts`
**Change**: Reduce `tracesSampleRate` from 1 to 0.2

```typescript
// BEFORE
Sentry.init({
  dsn: "...",
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 1,  // 100% - way too aggressive
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
});

// AFTER
Sentry.init({
  dsn: "...",
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 0.2,  // 20% - matches server sampling
  enableLogs: process.env.NODE_ENV === "development",  // Only in dev
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: false,  // PII protection
});
```

### Success Criteria

#### Automated Verification:
- [x] Build passes: `pnpm build` (requires env vars)
- [x] No Sentry initialization errors in console

#### Manual Verification:
- [ ] Sentry still captures errors
- [ ] Reduced trace events in Sentry dashboard (~80% reduction)
- [ ] Page feels snappier (less monitoring overhead)

---

## Phase 5: Lazy Load Recharts

### Overview

Recharts adds ~150KB gzipped to the bundle. Lazy load it so it only downloads when charts are visible. This includes explaining what lazy loading is.

### What is Lazy Loading?

**Lazy loading** (also called "code splitting" or "dynamic imports") means:
1. Instead of loading all JavaScript upfront, we split the code into smaller chunks
2. Heavy components (like charts) are loaded **only when needed**
3. The initial page loads faster because it doesn't wait for chart code
4. When the user scrolls to see charts, React loads the chart code then

**How it works**:
- `next/dynamic` wraps a component in a dynamic import
- Next.js creates a separate JavaScript chunk for that component
- The chunk is fetched only when the component renders
- A loading placeholder shows while the chunk downloads

### Changes Required

#### 1. Create Lazy Chart Wrapper

**File**: `components/charts/lazy-handicap-trend-chart.tsx` (new file)

```typescript
"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load the chart - only downloads when rendered
const HandicapTrendChartDisplay = dynamic(
  () => import("./handicap-trend-chart-display"),
  {
    loading: () => (
      <Skeleton className="w-full h-[300px] rounded-lg" />
    ),
    ssr: false, // Charts don't need server-side rendering
  }
);

export default HandicapTrendChartDisplay;
```

#### 2. Create Lazy Score Bar Chart Wrapper

**File**: `components/charts/lazy-score-bar-chart.tsx` (new file)

```typescript
"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const ScoreBarChartDisplay = dynamic(
  () => import("./score-bar-chart-display"),
  {
    loading: () => (
      <Skeleton className="w-full h-[300px] rounded-lg" />
    ),
    ssr: false,
  }
);

export default ScoreBarChartDisplay;
```

#### 3. Update Homepage to Use Lazy Charts

**File**: `components/homepage/home-page.tsx`
**Change**: Import lazy versions instead of direct imports

```typescript
// BEFORE
import HandicapTrendChartDisplay from "../charts/handicap-trend-chart-display";
import ScoreBarChartDisplay from "../charts/score-bar-chart-display";

// AFTER
import HandicapTrendChartDisplay from "../charts/lazy-handicap-trend-chart";
import ScoreBarChartDisplay from "../charts/lazy-score-bar-chart";
```

### Success Criteria

#### Automated Verification:
- [x] Build passes: `pnpm build` (requires env vars)
- [x] Build output shows separate chunk for recharts
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Homepage initial load is faster (charts load separately)
- [ ] Charts still render correctly when visible
- [ ] Loading skeleton shows briefly before chart appears
- [ ] Network tab shows chart chunk loading on demand

---

## Testing Strategy

### Unit Tests

No new unit tests needed - this is primarily a performance optimization of existing functionality.

### Integration Tests

- Test that parallel fetches return same data as sequential
- Test cache invalidation works correctly after round submission

### Manual Testing Steps

1. **Before/After Comparison**:
   - Run Lighthouse audit on homepage, /about, /rounds/add before changes
   - Record FCP, LCP, TTFB scores
   - Implement changes
   - Run Lighthouse again and compare

2. **Functional Testing**:
   - Verify landing page shows correct stats
   - Verify authenticated homepage shows correct data
   - Verify /rounds/add page works correctly
   - Verify round submission still works and updates data

3. **Cache Testing**:
   - Visit landing page, note load time
   - Refresh - should be nearly instant (cached)
   - Submit a round on authenticated homepage
   - Verify homepage data updates

4. **Lazy Loading Testing**:
   - Open Network tab in DevTools
   - Load homepage
   - Verify recharts chunk loads separately
   - Verify charts render after chunk loads

## Performance Considerations

### Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| TTFB | 3.76s | <0.8s | 4.7x faster |
| FCP | 4.09s | <1.8s | 2.3x faster |
| LCP | 4.42s | <2.5s | 1.8x faster |
| Bundle Size | ~500KB | ~350KB | 30% smaller (charts lazy) |
| Sentry Events | 100% traced | 20% traced | 80% reduction |

### Caching Summary

| Content | Cache Duration | Invalidation |
|---------|---------------|--------------|
| Landing page stats | 24 hours | Time-based |
| About page stats | 24 hours | Time-based |
| User homepage data | 1 hour OR on round submit | Tag-based |
| Course/tee data | 1 hour | Time-based |

## Migration Notes

- All changes are backward compatible
- No database migrations required
- No breaking API changes
- Caching can be rolled back by removing `revalidate` exports

## References

- Research: `/trpc/server.ts:15-24` - React cache() usage
- Research: `/trpc/query-client.ts:13` - QueryClient staleTime
- Current auth: `/utils/supabase/middleware.ts:41-48`
- Navbar auth: `/components/layout/navbar.tsx:28-29`
- Landing fetches: `/components/homepage/landing.tsx:49-62`
- Homepage fetches: `/components/homepage/home-page.tsx:18-98`
- Sentry config: `/instrumentation-client.ts:16`
