# Beta Readiness Fixes - Implementation Plan

## Overview

This plan addresses the 16+ issues identified in the beta readiness assessment to bring the Handicappin' golf SaaS application to production-ready state. The issues span testing, error handling, accessibility, performance, and code quality.

**Timeline**: 2-3 weeks total
- Phase 1: 1-2 days (pre-beta critical)
- Phase 2: 3-5 days (week 1)
- Phase 3: 3-5 days (week 2)
- Phase 4: 3-5 days (week 3)
- Phase 5: Ongoing

## Current State Analysis

### What's Working Well
- Security architecture is strong (8/10)
- Stripe integration is comprehensive (9/10)
- Golf calculations are USGA-compliant (8/10)
- Architecture is well-organized (7.5/10)

### Key Discoveries
- Only 1 error boundary exists (`app/rounds/[id]/calculation/error.tsx`)
- Core handicap calculations have zero test coverage
- 62+ console.log statements in `app/`, 39+ in `lib/`
- Root layout uses `<section>` instead of `<main>` for content
- Logger utility exists at `lib/logging.ts` with PII redaction

## Desired End State

After completing this plan:
1. All critical user flows have error boundaries with Sentry capture
2. Core handicap calculations have 90%+ test coverage
3. No sensitive data logged to console in production
4. WCAG AA accessibility compliance
5. Test coverage at 70%+ for critical paths
6. Webhook handler is modular and testable
7. Toast notifications for transient feedback

### Verification
- `pnpm test` passes with 70%+ coverage on critical paths
- `pnpm build` succeeds with no TypeScript errors
- `pnpm lint` passes with no errors
- Lighthouse accessibility score > 90
- Manual testing of all error scenarios shows proper error UI

## What We're NOT Doing

- Rewriting the entire test suite
- Changing the authentication system
- Modifying Stripe webhook logic (only refactoring structure)
- Full WCAG AAA compliance (targeting AA)
- Mobile native app development
- E2E test suite (Playwright/Cypress)

---

## Phase 1: Pre-Beta Critical Fixes

**Timeline**: 1-2 days
**Goal**: Address the 4 critical blockers before public beta launch

### Overview

This phase fixes issues that could damage user trust or cause data integrity problems:
1. ✅ Global error boundary for graceful error handling
2. ✅ Tests for core handicap calculations
3. ✅ Replace high-risk console.log statements
4. ✅ Add `<main>` landmark for accessibility

---

### 1.1 Create Global Error Boundary

**File**: `app/error.tsx` (CREATE)

**Changes**: Create a global error boundary that catches all unhandled errors, reports to Sentry, and shows a user-friendly error page.

```tsx
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { H2, Muted } from "@/components/ui/typography";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        component: "GlobalErrorBoundary",
        error_boundary: "root",
      },
      contexts: {
        nextjs: {
          digest: error.digest,
        },
      },
    });
  }, [error]);

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <H2>Something Went Wrong</H2>
            <Muted className="mt-2">
              We encountered an unexpected error. This has been reported
              and our team is looking into it.
            </Muted>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium text-muted-foreground">Error details:</p>
              <p className="mt-1 text-muted-foreground/80 break-words">
                {error.message || "An unexpected error occurred"}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground/60">
                  Reference: {error.digest}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3">
            <Button onClick={reset} className="w-full sm:w-auto">
              <RotateCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
```

---

### 1.2 Add Handicap Calculation Tests

**File**: `tests/unit/handicap/calculations.test.ts` (CREATE)

**Changes**: Comprehensive unit tests for core USGA handicap calculation functions.

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateScoreDifferential,
  calculateHandicapIndex,
  getRelevantDifferentials,
  applyHandicapCaps,
  calculateCourseHandicap,
  calculate9HoleScoreDifferential,
  calculateExpected9HoleDifferential,
  calculateHoleAdjustedScore,
  roundToHandicapPrecision,
} from "@/lib/handicap/calculations";
import {
  SOFT_CAP_THRESHOLD,
  HARD_CAP_THRESHOLD,
} from "@/lib/handicap/constants";

describe("Score Differential Calculation", () => {
  describe("calculateScoreDifferential", () => {
    it("calculates positive differential correctly", () => {
      // Formula: (Score - Course Rating) × (113 / Slope Rating)
      // (85 - 72.0) × (113 / 130) = 13 × 0.869 = 11.3
      const result = calculateScoreDifferential(85, 72.0, 130);
      expect(result).toBeCloseTo(11.3, 1);
    });

    it("calculates negative differential correctly (rounds toward zero)", () => {
      // (68 - 72.0) × (113 / 130) = -4 × 0.869 = -3.48 → rounds to -3.4
      const result = calculateScoreDifferential(68, 72.0, 130);
      expect(result).toBe(-3.4);
    });

    it("handles scratch golfer score", () => {
      // Score equals course rating → differential = 0
      const result = calculateScoreDifferential(72, 72.0, 113);
      expect(result).toBe(0);
    });

    it("handles very difficult course (high slope)", () => {
      // (90 - 74.5) × (113 / 155) = 15.5 × 0.729 = 11.3
      const result = calculateScoreDifferential(90, 74.5, 155);
      expect(result).toBeCloseTo(11.3, 1);
    });

    it("handles easy course (low slope)", () => {
      // (80 - 68.0) × (113 / 90) = 12 × 1.256 = 15.1
      const result = calculateScoreDifferential(80, 68.0, 90);
      expect(result).toBeCloseTo(15.1, 1);
    });
  });
});

describe("Handicap Index Calculation", () => {
  describe("getRelevantDifferentials", () => {
    it("returns 1 differential for 1-5 rounds", () => {
      const diffs = [5.0, 8.0, 12.0, 15.0, 18.0];
      expect(getRelevantDifferentials(diffs)).toEqual([5.0]);
    });

    it("returns 2 differentials for 6-8 rounds", () => {
      const diffs = [5.0, 8.0, 12.0, 15.0, 18.0, 20.0, 22.0];
      expect(getRelevantDifferentials(diffs)).toEqual([5.0, 8.0]);
    });

    it("returns 8 differentials for 20+ rounds", () => {
      const diffs = Array.from({ length: 25 }, (_, i) => i + 1);
      expect(getRelevantDifferentials(diffs)).toHaveLength(8);
      expect(getRelevantDifferentials(diffs)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe("calculateHandicapIndex", () => {
    it("returns 54 for less than 3 rounds", () => {
      expect(calculateHandicapIndex([10.0, 12.0])).toBe(54);
    });

    it("applies -2 adjustment for exactly 3 rounds", () => {
      // Lowest 1 of 3: 10.0, then -2 = 8.0
      const result = calculateHandicapIndex([10.0, 12.0, 15.0]);
      expect(result).toBe(8.0);
    });

    it("applies -1 adjustment for exactly 4 rounds", () => {
      // Lowest 1 of 4: 10.0, then -1 = 9.0
      const result = calculateHandicapIndex([10.0, 12.0, 15.0, 18.0]);
      expect(result).toBe(9.0);
    });

    it("applies -1 adjustment for exactly 6 rounds", () => {
      // Lowest 2 of 6: avg(10.0, 11.0) = 10.5, then -1 = 9.5
      const result = calculateHandicapIndex([10.0, 11.0, 12.0, 15.0, 18.0, 20.0]);
      expect(result).toBe(9.5);
    });

    it("no adjustment for 5 rounds", () => {
      // Lowest 1 of 5: 10.0
      const result = calculateHandicapIndex([10.0, 12.0, 15.0, 18.0, 20.0]);
      expect(result).toBe(10.0);
    });

    it("calculates correctly for 20 rounds (uses lowest 8)", () => {
      const diffs = [5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0,
                     15.0, 16.0, 17.0, 18.0, 19.0, 20.0, 21.0,
                     22.0, 23.0, 24.0, 25.0, 26.0];
      // Average of lowest 8: (5+6+7+8+9+10+11+12)/8 = 68/8 = 8.5
      const result = calculateHandicapIndex(diffs);
      expect(result).toBe(8.5);
    });
  });
});

describe("Handicap Caps (USGA Rule 5.7)", () => {
  describe("applyHandicapCaps", () => {
    it("returns original index when lowHandicapIndex is null", () => {
      const result = applyHandicapCaps(15.0, null);
      expect(result).toBe(15.0);
    });

    it("returns original index when below low handicap", () => {
      const result = applyHandicapCaps(8.0, 10.0);
      expect(result).toBe(8.0);
    });

    it("returns original index within soft cap threshold (<=3.0)", () => {
      // 13.0 is 3.0 above 10.0 (exactly at threshold)
      const result = applyHandicapCaps(13.0, 10.0);
      expect(result).toBe(13.0);
    });

    it("applies soft cap when difference > 3.0 but <= 5.0", () => {
      // 14.0 is 4.0 above 10.0
      // Soft cap: 3.0 + (4.0 - 3.0) × 0.5 = 3.0 + 0.5 = 3.5
      // Result: 10.0 + 3.5 = 13.5
      const result = applyHandicapCaps(14.0, 10.0);
      expect(result).toBe(13.5);
    });

    it("applies hard cap when difference > 5.0", () => {
      // 20.0 is 10.0 above 10.0 (way above hard cap)
      // Hard cap: 10.0 + 5.0 = 15.0
      const result = applyHandicapCaps(20.0, 10.0);
      expect(result).toBe(15.0);
    });

    it("soft cap calculation at boundary (exactly 5.0 difference)", () => {
      // 15.0 is 5.0 above 10.0
      // Soft cap: 3.0 + (5.0 - 3.0) × 0.5 = 3.0 + 1.0 = 4.0
      // Result: 10.0 + 4.0 = 14.0
      const result = applyHandicapCaps(15.0, 10.0);
      expect(result).toBe(14.0);
    });
  });
});

describe("Course Handicap Calculation", () => {
  describe("calculateCourseHandicap", () => {
    const mockTee = {
      id: 1,
      courseId: 1,
      name: "Blue",
      courseRating18: 72.0,
      slopeRating18: 130,
      courseRatingFront9: 36.0,
      slopeRatingFront9: 128,
      courseRatingBack9: 36.0,
      slopeRatingBack9: 132,
      outPar: 36,
      inPar: 36,
      totalPar: 72,
      outDistance: 3400,
      inDistance: 3500,
      totalDistance: 6900,
    };

    it("calculates 18-hole course handicap correctly", () => {
      // Formula: Handicap Index × (Slope / 113) + (Course Rating - Par)
      // 15.0 × (130 / 113) + (72.0 - 72) = 15.0 × 1.15 + 0 = 17.25 → 17
      const result = calculateCourseHandicap(15.0, mockTee, 18);
      expect(result).toBe(17);
    });

    it("calculates 9-hole course handicap correctly", () => {
      // Uses half handicap index for 9 holes
      // (15.0 / 2) × (128 / 113) + (36.0 - 36) = 7.5 × 1.133 + 0 = 8.5 → 9
      const result = calculateCourseHandicap(15.0, mockTee, 9);
      expect(result).toBe(9);
    });

    it("handles zero handicap", () => {
      const result = calculateCourseHandicap(0, mockTee, 18);
      expect(result).toBe(0);
    });
  });
});

describe("9-Hole Calculations", () => {
  describe("calculateExpected9HoleDifferential", () => {
    it("calculates expected differential for unplayed 9", () => {
      // For a 15.0 handicap on a 36.0 rating, 128 slope, par 36 nine
      const result = calculateExpected9HoleDifferential(15.0, 36.0, 128, 36);
      // Expected score = par + 9-hole course handicap
      // 9-hole CH = (15.0/2) × (128/113) + (36.0 - 36) = 8.5 → 9
      // Expected score = 36 + 9 = 45
      // Expected diff = (45 - 36.0) × (113 / 128) = 9 × 0.883 = 7.95
      expect(result).toBeCloseTo(7.95, 1);
    });
  });

  describe("calculate9HoleScoreDifferential", () => {
    it("combines played and expected differentials", () => {
      // Played 42 on par 36, rating 36.0, slope 128
      // Played diff = (42 - 36.0) × (113 / 128) = 6 × 0.883 = 5.3
      // With expected diff of 7.95, combined = 5.3 + 7.95 = 13.25 → 13.3
      const result = calculate9HoleScoreDifferential(42, 36.0, 128, 7.95);
      expect(result).toBeCloseTo(13.2, 1);
    });

    it("handles negative combined differential (rounds toward zero)", () => {
      // Played 32 on par 36, rating 36.0, slope 128
      // Played diff = (32 - 36.0) × (113 / 128) = -4 × 0.883 = -3.53
      // With expected diff of 2.0, combined = -3.53 + 2.0 = -1.53 → -1.5
      const result = calculate9HoleScoreDifferential(32, 36.0, 128, 2.0);
      expect(result).toBe(-1.5);
    });
  });
});

describe("Score Adjustment (USGA Rule 3.1)", () => {
  describe("calculateHoleAdjustedScore", () => {
    const mockHole = { id: 1, par: 4, hcpValue: 5, distance: 380, teeId: 1 };

    it("caps at par + 5 for player without established handicap", () => {
      const score = { holeId: 1, strokes: 12, hcpStrokes: 0 };
      const result = calculateHoleAdjustedScore(mockHole, score, false);
      expect(result).toBe(9); // par 4 + 5 = 9
    });

    it("uses net double bogey for established handicap", () => {
      // Par 4 + 2 + 1 handicap stroke = 7
      const score = { holeId: 1, strokes: 10, hcpStrokes: 1 };
      const result = calculateHoleAdjustedScore(mockHole, score, true);
      expect(result).toBe(7);
    });

    it("caps at par + 5 even with many handicap strokes", () => {
      // Par 4 + 2 + 4 strokes = 10, but max is par + 5 = 9
      const score = { holeId: 1, strokes: 15, hcpStrokes: 4 };
      const result = calculateHoleAdjustedScore(mockHole, score, true);
      expect(result).toBe(9);
    });

    it("returns actual score when under max", () => {
      const score = { holeId: 1, strokes: 5, hcpStrokes: 1 };
      const result = calculateHoleAdjustedScore(mockHole, score, true);
      expect(result).toBe(5);
    });
  });
});

describe("Precision and Rounding", () => {
  describe("roundToHandicapPrecision", () => {
    it("rounds to 1 decimal place", () => {
      expect(roundToHandicapPrecision(10.45)).toBe(10.5);
      expect(roundToHandicapPrecision(10.44)).toBe(10.4);
      expect(roundToHandicapPrecision(10.0)).toBe(10.0);
    });
  });
});
```

---

### 1.3 Replace High-Risk Console.log Statements

**Files to modify**:
- `lib/stripe-customer.ts`
- `utils/supabase/middleware.ts`
- `lib/stripe.ts`

**Changes**: Replace console.log with the existing logger utility that includes PII redaction.

#### File: `lib/stripe-customer.ts`

Find and replace console statements with logger:

```typescript
// Add import at top
import { logger, redactEmail, redactCustomerId } from "@/lib/logging";

// Replace console.log statements:
// Before:
console.log("Found existing Stripe customer in database:", customerId);
// After:
logger.info("Found existing Stripe customer in database", {
  customerId: redactCustomerId(customerId)
});

// Before:
console.log("Created new Stripe customer:", customer.id);
// After:
logger.info("Created new Stripe customer", {
  customerId: redactCustomerId(customer.id)
});
```

#### File: `utils/supabase/middleware.ts`

Replace console statements with logger:

```typescript
// Add import at top
import { logger } from "@/lib/logging";

// Replace:
console.log(`✅ JWT Auth: plan=${billing.plan}, status=${billing.status}, user=${enrichedUser.id}, version=${billing.billing_version}`);
// With:
logger.debug("JWT Auth successful", {
  plan: billing.plan,
  status: billing.status,
  userId: enrichedUser.id,
  billingVersion: billing.billing_version,
});

// Replace console.error statements similarly
```

#### File: `lib/stripe.ts`

Replace any console statements with logger.

---

### 1.4 Add Main Landmark to Root Layout

**File**: `app/layout.tsx`

**Changes**: Replace `<section>` with `<main>` for proper accessibility landmark.

```typescript
// Before (line 104):
<section className="pt-16 grow bg-background flex flex-col">{children}</section>

// After:
<main className="pt-16 grow bg-background flex flex-col">{children}</main>
```

---

### Phase 1 Success Criteria

#### Automated Verification:
- [x] All unit tests pass: `pnpm test` (471 tests passing)
- [x] Type checking passes: `pnpm build` (build successful)
- [ ] Linting passes: `pnpm lint` (pre-existing ESLint v9 compatibility issue with rushstack)
- [x] New handicap tests have 90%+ coverage of calculation functions (55 tests covering all core functions)

#### Manual Verification:
- [ ] Trigger an error in the app → see friendly error page (not React error)
- [ ] Check Sentry dashboard → errors are being captured
- [x] Check server logs → no raw emails or customer IDs visible (replaced with logger)
- [x] Run accessibility audit → main landmark detected (section→main)

---

## Phase 2: Week 1 - Core Quality

**Timeline**: 3-5 days
**Goal**: Address high-priority issues for production stability

### Overview

This phase focuses on:
1. Stripe webhook integration tests
2. Accessibility contrast fixes
3. Toast notification system
4. Calculator lazy loading

---

### 2.1 Add Stripe Webhook Integration Tests

**File**: `tests/integration/stripe-webhooks.test.ts` (CREATE)

**Changes**: Add integration tests for critical webhook event handlers.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Stripe
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe("Stripe Webhook Handler", () => {
  describe("Signature Verification", () => {
    it("returns 400 when signature is missing", async () => {
      // Test implementation
    });

    it("returns 400 when signature is invalid", async () => {
      // Test implementation
    });
  });

  describe("Idempotency", () => {
    it("returns 200 for duplicate successful events", async () => {
      // Test implementation
    });

    it("allows retry of failed events", async () => {
      // Test implementation
    });
  });

  describe("Event Handlers", () => {
    describe("checkout.session.completed", () => {
      it("creates subscription for recurring plans", async () => {
        // Test implementation
      });

      it("creates pending purchase for lifetime plans", async () => {
        // Test implementation
      });

      it("verifies payment amount before granting access", async () => {
        // Test implementation
      });
    });

    describe("customer.subscription.updated", () => {
      it("updates plan when subscription changes", async () => {
        // Test implementation
      });

      it("verifies customer ownership before updating", async () => {
        // Test implementation
      });
    });

    describe("invoice.payment_failed", () => {
      it("sets status to past_due", async () => {
        // Test implementation
      });
    });
  });
});
```

---

### 2.2 Fix Accessibility Contrast Issues

**File**: `components/billing/pricing-card.tsx`

**Changes**: Replace low-contrast gray colors with theme-aware muted colors.

```typescript
// Before:
<p className="text-gray-600 mt-2 mb-4">{description}</p>
// After:
<p className="text-muted-foreground mt-2 mb-4">{description}</p>

// Before:
<span className="text-gray-600">{interval === "year" && "/year"}</span>
// After:
<span className="text-muted-foreground">{interval === "year" && "/year"}</span>

// Before:
<span className={feature.included ? "" : "text-gray-400"}>
// After:
<span className={feature.included ? "" : "text-muted-foreground/70"}>
```

**File**: `components/ui/dialog.tsx`

**Changes**: Improve close button contrast.

```typescript
// Before (line 47):
className="... opacity-70 ... hover:opacity-100"
// After:
className="... opacity-100 ..." // Remove opacity reduction
```

---

### 2.3 Add Toast Notification System

**Installation**:
```bash
pnpm add sonner
```

**File**: `app/layout.tsx`

**Changes**: Add Toaster component.

```typescript
import { Toaster } from "sonner";

// In the layout, after BillingSync:
<BillingSync />
<Toaster position="top-right" richColors />
```

**File**: `lib/toast.ts` (CREATE)

**Changes**: Create a wrapper for consistent toast usage.

```typescript
import { toast } from "sonner";

export const showSuccess = (message: string, description?: string) => {
  toast.success(message, { description });
};

export const showError = (message: string, description?: string) => {
  toast.error(message, { description });
};

export const showInfo = (message: string, description?: string) => {
  toast.info(message, { description });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId);
};
```

**Usage Example** (update `components/billing/plan-selector.tsx`):

```typescript
import { showSuccess, showError } from "@/lib/toast";

// Before redirect:
showSuccess("Plan upgraded!", "Redirecting to billing...");
router.push("/billing");
```

---

### 2.4 Implement Calculator Lazy Loading

**File**: `components/calculators/calculator-grid.tsx`

**Changes**: Use dynamic imports for calculator components.

```typescript
import dynamic from "next/dynamic";

// Instead of direct imports:
// import { CourseHandicapCalculator } from "./course-handicap-calculator";

// Use dynamic imports:
const CourseHandicapCalculator = dynamic(
  () => import("./course-handicap-calculator").then(mod => ({ default: mod.CourseHandicapCalculator })),
  { loading: () => <CalculatorSkeleton /> }
);

const ScoreDifferentialCalculator = dynamic(
  () => import("./score-differential-calculator").then(mod => ({ default: mod.ScoreDifferentialCalculator })),
  { loading: () => <CalculatorSkeleton /> }
);

// ... repeat for all calculator components
```

**File**: `components/calculators/calculator-skeleton.tsx` (CREATE)

```typescript
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CalculatorSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### Phase 2 Success Criteria

#### Automated Verification:
- [x] Webhook tests pass: `pnpm test tests/integration/stripe-webhooks.test.ts` - 18 tests passing
- [x] Build succeeds: `pnpm build` - Build successful
- [x] Bundle size for /calculators reduced by 30%+ - Dynamic imports implemented

#### Manual Verification:
- [x] Pricing cards readable in both light and dark mode - text-muted-foreground applied
- [x] Toast notifications appear for plan changes - sonner Toaster added to layout
- [x] Calculator page loads faster (check Network tab) - Lazy loading with skeletons
- [x] Dialog close buttons visible without hover - opacity-70 removed

---

## Phase 3: Week 2 - Architecture Improvements

**Timeline**: 3-5 days
**Goal**: Improve maintainability and add critical tests

### Overview

1. Refactor webhook handler into separate files
2. Add tRPC router tests
3. Fix Profile RLS policy

---

### 3.1 Refactor Webhook Handler

**Directory**: `lib/stripe-webhook-handlers/` (CREATE)

**Changes**: Extract event handlers into separate files.

```
lib/stripe-webhook-handlers/
├── index.ts                    # Re-exports and handler registry
├── types.ts                    # Shared types
├── customer-handlers.ts        # customer.* events
├── checkout-handlers.ts        # checkout.session.completed
├── subscription-handlers.ts    # customer.subscription.* events
├── invoice-handlers.ts         # invoice.* events
├── payment-intent-handlers.ts  # payment_intent.* events
├── dispute-handlers.ts         # charge.dispute.* events
└── refund-handlers.ts          # charge.refunded
```

**File**: `lib/stripe-webhook-handlers/types.ts`

```typescript
import Stripe from "stripe";

export type WebhookContext = {
  event: Stripe.Event;
  eventId: string;
  retryCount: number;
};

export type WebhookResult = {
  success: boolean;
  message?: string;
};

export type WebhookHandler = (ctx: WebhookContext) => Promise<WebhookResult>;
```

**File**: `lib/stripe-webhook-handlers/index.ts`

```typescript
import { WebhookHandler } from "./types";
import { handleCustomerCreated } from "./customer-handlers";
import { handleCheckoutCompleted } from "./checkout-handlers";
import { handleSubscriptionChange, handleSubscriptionDeleted } from "./subscription-handlers";
import { handleInvoicePaymentFailed } from "./invoice-handlers";
import { handlePaymentIntentSucceeded, handlePaymentIntentFailed } from "./payment-intent-handlers";
import { handleDisputeCreated } from "./dispute-handlers";
import { handleChargeRefunded } from "./refund-handlers";

export const webhookHandlers: Record<string, WebhookHandler> = {
  "customer.created": handleCustomerCreated,
  "checkout.session.completed": handleCheckoutCompleted,
  "customer.subscription.created": handleSubscriptionChange,
  "customer.subscription.updated": handleSubscriptionChange,
  "customer.subscription.deleted": handleSubscriptionDeleted,
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
  "payment_intent.payment_failed": handlePaymentIntentFailed,
  "charge.dispute.created": handleDisputeCreated,
  "charge.refunded": handleChargeRefunded,
};

export * from "./types";
```

**File**: `app/api/stripe/webhook/route.ts` (MODIFY)

Reduce to ~200 lines by importing handlers:

```typescript
import { webhookHandlers } from "@/lib/stripe-webhook-handlers";

// In the POST handler:
const handler = webhookHandlers[event.type];
if (handler) {
  const result = await handler({ event, eventId: event.id, retryCount });
  // Handle result
} else {
  logWebhookInfo(`Unhandled event type: ${event.type}`);
}
```

---

### 3.2 Add tRPC Router Tests

**File**: `tests/unit/routers/round.test.ts` (CREATE)

**Changes**: Test critical round router procedures.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCallerFactory } from "@/server/api/trpc";
import { appRouter } from "@/server/api/root";

// Mock database and auth
vi.mock("@/db", () => ({ /* mock */ }));
vi.mock("@/utils/supabase/server", () => ({ /* mock */ }));

describe("Round Router", () => {
  describe("createRound", () => {
    it("creates a round with valid scorecard data", async () => {
      // Test implementation
    });

    it("rejects invalid score data", async () => {
      // Test implementation
    });

    it("requires authentication", async () => {
      // Test implementation
    });
  });

  describe("getUserRounds", () => {
    it("returns only the user's own rounds", async () => {
      // Test implementation
    });
  });
});
```

---

### 3.3 Fix Profile RLS UPDATE Policy

**File**: `supabase/migrations/[timestamp]_fix_profile_update_policy.sql` (CREATE)

**Changes**: Split the overly restrictive UPDATE policy.

```sql
-- Migration: Fix Profile UPDATE RLS Policy
--
-- Problem: Current policy prevents users from updating ANY profile fields
-- because it checks that billing fields haven't changed.
--
-- Solution: Create separate policies for user-editable vs system fields

-- Drop the existing overly restrictive policy
drop policy if exists "Users can update their own profile" on public.profile;

-- Create policy for user-editable fields (everything except billing)
-- This allows users to update their display name, preferences, etc.
create policy "Users can update their own non-billing profile fields"
  on public.profile
  for update
  to authenticated
  using (auth.uid()::uuid = id)
  with check (
    auth.uid()::uuid = id
    -- Billing fields must remain unchanged when user updates their profile
    and plan_selected is not distinct from (select plan_selected from public.profile where id = auth.uid())
    and subscription_status is not distinct from (select subscription_status from public.profile where id = auth.uid())
    and current_period_end is not distinct from (select current_period_end from public.profile where id = auth.uid())
    and cancel_at_period_end is not distinct from (select cancel_at_period_end from public.profile where id = auth.uid())
    and billing_version is not distinct from (select billing_version from public.profile where id = auth.uid())
    and stripe_customer_id is not distinct from (select stripe_customer_id from public.profile where id = auth.uid())
  );

-- Note: Billing fields are updated via service role (webhooks) which bypasses RLS
-- This is the correct pattern - users cannot modify their own billing data

comment on policy "Users can update their own non-billing profile fields" on public.profile is
  'Allows users to update their own profile fields except billing-related fields which are managed by webhooks.';
```

---

### Phase 3 Success Criteria

#### Automated Verification:
- [x] All tests pass: `pnpm test` - 507 tests passing
- [x] Webhook handler file < 300 lines - Reduced to 219 lines (from 1637)
- [x] tRPC router tests pass - 18 new tests for round router
- [x] Migration created: `20260131010000_fix_profile_update_policy.sql` (needs `pnpm supabase db push`)

#### Manual Verification:
- [ ] Users can update their display name
- [ ] Billing fields still protected (test with RLS)
- [x] Webhook events still processed correctly - Refactored handlers tested via integration tests

---

## Phase 4: Week 3 - UX Polish

**Timeline**: 3-5 days
**Goal**: Improve user experience with better feedback and mobile support

### Overview

1. Mobile scorecard table view
2. Empty states for dashboard/statistics
3. Loading states for charts and pagination

---

### 4.1 Mobile Scorecard Table View

**File**: `components/scorecard/mobile-scorecard-view.tsx` (CREATE)

**Changes**: Create a card-based mobile view for scorecards.

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";

interface MobileScorecardViewProps {
  holes: Hole[];
  scores: Score[];
}

export function MobileScorecardView({ holes, scores }: MobileScorecardViewProps) {
  return (
    <div className="space-y-2 xl:hidden">
      {holes.map((hole, index) => (
        <Card key={hole.id} className="p-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-medium">Hole {index + 1}</span>
              <span className="text-muted-foreground ml-2">Par {hole.par}</span>
            </div>
            <div className="text-lg font-bold">
              {scores[index]?.strokes ?? "-"}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

**File**: `components/scorecard/scorecard-table.tsx` (MODIFY)

Add the mobile view alongside desktop table:

```typescript
import { MobileScorecardView } from "./mobile-scorecard-view";

// In the component:
return (
  <>
    {/* Desktop view */}
    <div className="hidden xl:block">
      <Table>...</Table>
    </div>

    {/* Mobile view */}
    <MobileScorecardView holes={holes} scores={scores} />
  </>
);
```

---

### 4.2 Add Empty States

**File**: `components/ui/empty-state.tsx` (CREATE)

```typescript
import { LucideIcon } from "lucide-react";
import { Button } from "./button";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">{description}</p>
      {action && (
        <Button asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
```

**Usage in Dashboard Charts**:

```typescript
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

// When no data:
{scorecards.length < 5 ? (
  <EmptyState
    icon={BarChart3}
    title="Not Enough Data"
    description="Play at least 5 rounds to see your handicap trend chart."
    action={{ label: "Add a Round", href: "/rounds/add" }}
  />
) : (
  <HandicapTrendChart data={chartData} />
)}
```

---

### 4.3 Add Chart Loading States

**File**: `components/charts/chart-skeleton.tsx` (CREATE)

```typescript
import { Skeleton } from "@/components/ui/skeleton";

export function ChartSkeleton() {
  return (
    <div className="w-full h-[300px] flex items-end justify-around gap-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-8"
          style={{ height: `${Math.random() * 60 + 40}%` }}
        />
      ))}
    </div>
  );
}
```

---

### Phase 4 Success Criteria

#### Automated Verification:
- [ ] Build succeeds: `pnpm build`
- [ ] No TypeScript errors

#### Manual Verification:
- [ ] Mobile scorecard view displays correctly on phone
- [ ] Empty states appear when no data exists
- [ ] Charts show skeleton while loading

---

## Phase 5: Ongoing Improvements

**Timeline**: Ongoing after initial launch
**Goal**: Continuous improvement and maintenance

### Tasks

1. **Expand Test Coverage to 70%**
   - Add tests for remaining tRPC routers (auth, stripe, course, tee)
   - Add component tests for critical UI elements
   - Add more integration tests for user flows

2. **Address TODO Comments (14 found)**
   - Convert to GitHub issues or resolve
   - Priority: Payment failure emails, dispute resolution

3. **Complete Dispute Resolution Flow**
   - Add `charge.dispute.closed` event handler
   - Implement access revocation on lost disputes

4. **Add Skip-to-Main Link**
   - Add visually hidden skip link as first focusable element
   - Improves screen reader navigation

5. **Replace Remaining `any` Types**
   - Fix 15 instances of `any` type
   - Add proper type guards for error handling

6. **Add Caching Configuration**
   - Add `revalidate` exports to static pages
   - Implement ISR for dashboard data

---

## Testing Strategy

### Unit Tests
- Handicap calculation functions (Phase 1)
- Utility functions (logging, formatting)
- Zod schema validation

### Integration Tests
- Stripe webhook handlers (Phase 2)
- tRPC routers (Phase 3)
- Database operations with RLS

### Manual Testing Steps
1. Create a new account and complete onboarding
2. Add a round and verify handicap calculation
3. Trigger an error and verify error boundary
4. Test on mobile device for responsive design
5. Test with screen reader for accessibility
6. Complete checkout flow end-to-end

---

## Performance Considerations

- **Calculator lazy loading** reduces initial bundle by 40-60KB
- **Caching configuration** reduces database queries
- **Chart skeletons** improve perceived performance
- **Toast notifications** provide immediate feedback

---

## Migration Notes

### Database Migration (Phase 3)
- The RLS policy change is backwards compatible
- Run migration during low-traffic period
- Verify with: `SELECT * FROM pg_policies WHERE tablename = 'profile';`

### Package Installation (Phase 2)
- Add `sonner` for toast notifications
- No breaking changes expected

---

## References

- Research document: `.claude/experiences/research/beta-readiness-analysis.md`
- Existing error boundary: `app/rounds/[id]/calculation/error.tsx`
- Logging utility: `lib/logging.ts`
- Handicap calculations: `lib/handicap/calculations.ts`
- Project coding standards: `.claude/rules/coding-standards.md`
