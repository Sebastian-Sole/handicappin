# Round Calculation Page Redesign - Implementation Plan

## Overview

Redesign the round calculation page (`/rounds/[id]/calculation`) to provide an informative, interactive, and visually appealing step-by-step explanation of how a round's score differential was calculated. The page will feature a numbered stepper interface, expandable USGA explanations, improved 9-hole round handling, and interactive "what-if" calculators prefilled with round data.

## Current State Analysis

### What Exists (Near-Complete but Disabled)
- **Page Route**: `app/rounds/[id]/calculation/page.tsx` - Shows "Coming Soon" placeholder
- **Main Component**: `components/round-calculation.tsx` - Fully implemented but unused
- **Context Provider**: `contexts/roundCalculationContext.tsx` - Complete state management
- **Calculation Components**: All exist in `components/round/calculation/`:
  - `holesTable.tsx` - Hole-by-hole breakdown
  - `statCalculationDisplay.tsx` - Summary statistics
  - `courseHcpCalculationDisplay.tsx` - Course handicap with editable inputs
  - `AGSCalculationDisplay.tsx` - Adjusted gross score calculation
  - `ScoreDiffCalculationDisplay.tsx` - Score differential with formula

### Key Discoveries
- Calculations use `useMemo` for real-time updates when inputs change
- 9-hole rounds use a two-part formula: played differential + expected differential
- Context provides setters for all inputs (handicapIndex, slope, rating, par)
- Premium protection uses `PREMIUM_PATHS` in `utils/billing/constants.ts`

## Desired End State

A premium-only page that:
1. Shows a numbered stepper progress indicator with 5 calculation steps
2. Provides clear, expandable USGA explanations for each calculation
3. Handles 9-hole rounds with visual diagrams showing the two-part formula
4. Allows users to tweak values and see "what-if" scenarios with reset capability
5. Uses minimal but apparent animations (fade-ins, subtle transitions)
6. Is mobile-responsive and accessible

### Verification
- Page loads correctly for premium users viewing their own rounds
- Non-premium users are redirected to `/upgrade`
- Users cannot view other users' rounds
- All calculations match USGA formulas
- 9-hole rounds display correctly with expected differential explanation

## What We're NOT Doing

- Protecting all `/rounds/*` routes (only `/rounds/[id]/calculation`)
- Adding complex animations (no count-up numbers, guided tours, etc.)
- Creating a tabbed interface
- Adding preset "what-if" scenarios (just manual input editing)
- Modifying the underlying calculation logic

## Implementation Approach

We will:
1. Add specific middleware protection for the calculation route
2. Create a new stepper-based layout component
3. Refactor existing calculation components into step-based sections
4. Add expandable educational content using Collapsible components
5. Improve 9-hole round display with visual explanation
6. Add "Reset to Original" functionality and visual diff highlighting
7. Apply minimal CSS animations for polish

---

## Phase 1: Premium Protection & Page Activation

### Overview
Enable premium-only access for the calculation page and remove the "Coming Soon" placeholder.

### Changes Required

#### 1. Add Specific Middleware Check
**File**: `utils/supabase/middleware.ts`

Add a specific check for the calculation route pattern after the existing premium paths check (around line 184):

```typescript
// Existing premium paths check
const isPremiumRoute = premiumPaths.some((path) =>
  pathname.startsWith(path)
);

// Add specific check for round calculation page
const isRoundCalculationRoute = /^\/rounds\/[^/]+\/calculation$/.test(pathname);

const requiresPremium = isPremiumRoute || isRoundCalculationRoute;

if (requiresPremium && !userHasPremiumAccess) {
  const url = request.nextUrl.clone();
  url.pathname = "/upgrade";
  return NextResponse.redirect(url);
}
```

#### 2. Update Page to Remove Placeholder
**File**: `app/rounds/[id]/calculation/page.tsx`

Replace the entire file to enable the actual component:

```typescript
import { RoundCalculation } from "@/components/round-calculation";
import { api } from "@/trpc/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const RoundCalculationPage = async (props: {
  params: Promise<{ id: string }>;
}) => {
  const params = await props.params;
  const { id: roundId } = params;

  if (!roundId) {
    return <div>Invalid round id</div>;
  }

  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const scorecard = await api.scorecard.getScorecardByRoundId({ id: roundId });

  if (!scorecard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Round not found</p>
      </div>
    );
  }

  if (scorecard.userId !== userId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">This round does not belong to you</p>
      </div>
    );
  }

  return <RoundCalculation scorecard={scorecard} />;
};

export default RoundCalculationPage;
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Non-premium users visiting `/rounds/[id]/calculation` are redirected to `/upgrade`
- [ ] Premium users can access their own round calculation pages
- [ ] Users cannot access other users' round calculations
- [ ] `/rounds/add` remains accessible to all users (not premium-protected)

---

## Phase 2: Stepper Layout Component

### Overview
Create a new stepper-based layout that shows numbered calculation steps with progress indicators.

### Changes Required

#### 1. Create Stepper Component
**File**: `components/ui/calculation-stepper.tsx`

```typescript
"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  id: number;
  title: string;
  description?: string;
}

interface CalculationStepperProps {
  steps: Step[];
  currentStep?: number;
  className?: string;
}

export function CalculationStepper({
  steps,
  currentStep,
  className,
}: CalculationStepperProps) {
  return (
    <nav aria-label="Calculation steps" className={cn("w-full", className)}>
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep !== undefined && step.id < currentStep;
          const isCurrent = currentStep === step.id;

          return (
            <li key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-200",
                    isCompleted && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : step.id}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs text-center hidden sm:block transition-colors duration-200",
                    (isCompleted || isCurrent) ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-colors duration-200",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

#### 2. Create Calculation Step Wrapper
**File**: `components/round/calculation/calculation-step.tsx`

```typescript
"use client";

import { cn } from "@/lib/utils";
import { H3, Muted } from "@/components/ui/typography";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface CalculationStepProps {
  stepNumber: number;
  title: string;
  description?: string;
  learnMoreContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CalculationStep({
  stepNumber,
  title,
  description,
  learnMoreContent,
  children,
  className,
}: CalculationStepProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={cn(
        "space-y-4 transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
          {stepNumber}
        </div>
        <div className="flex-1">
          <H3 className="mt-0">{title}</H3>
          {description && <Muted className="mt-1">{description}</Muted>}
        </div>
      </div>

      <div className="ml-12">{children}</div>

      {learnMoreContent && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="ml-12">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
            {isOpen ? "Hide" : "Learn more about"} this calculation
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
            {learnMoreContent}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Components export correctly

#### Manual Verification:
- [ ] Stepper displays 4 numbered steps horizontally
- [ ] Steps show titles on desktop, numbers only on mobile
- [ ] Calculation step sections fade in when scrolled into view
- [ ] "Learn more" sections expand/collapse smoothly

---

## Phase 3: Redesigned Main Component

### Overview
Refactor the main `RoundCalculation` component to use the new stepper layout and step-based sections.

### Changes Required

#### 1. Update RoundCalculation Component
**File**: `components/round-calculation.tsx`

```typescript
"use client";

import { H2, Muted } from "./ui/typography";
import { Separator } from "./ui/separator";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { CalculationStepper } from "./ui/calculation-stepper";
import HolesTable from "./round/calculation/holesTable";
import { CalculationStep } from "./round/calculation/calculation-step";
import CourseHandicapStep from "./round/calculation/steps/course-handicap-step";
import AdjustedScoresStep from "./round/calculation/steps/adjusted-scores-step";
import ScoreDifferentialStep from "./round/calculation/steps/score-differential-step";
import HandicapImpactStep from "./round/calculation/steps/handicap-impact-step";
import {
  RoundCalculationProvider,
  useRoundCalculationContext,
} from "@/contexts/roundCalculationContext";
import { ScorecardWithRound } from "@/types/scorecard";
import { CalendarDays, MapPin, Flag } from "lucide-react";

interface RoundCalculationProps {
  scorecard: ScorecardWithRound;
}

const CALCULATION_STEPS = [
  { id: 1, title: "Course Handicap" },
  { id: 2, title: "Adjusted Scores" },
  { id: 3, title: "Score Differential" },
  { id: 4, title: "Handicap Impact" },
];

const RoundCalculationContent = () => {
  const { scorecard, isNineHoles } = useRoundCalculationContext();
  const roundDate = new Date(scorecard.teeTime).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
      {/* Round Overview Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <H2 className="mb-2">{scorecard.course.name}</H2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  {roundDate}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {scorecard.teePlayed.teeName}
                </span>
                <span className="flex items-center gap-1">
                  <Flag className="w-4 h-4" />
                  {isNineHoles ? "9 Holes" : "18 Holes"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {scorecard.round.adjustedGrossScore}
                </div>
                <Muted>Score</Muted>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {scorecard.round.scoreDifferential.toFixed(1)}
                </div>
                <Muted>Differential</Muted>
              </div>
            </div>
          </div>
          {isNineHoles && (
            <Badge variant="secondary" className="w-fit mt-4">
              9-Hole Round - Calculated as 18-hole equivalent
            </Badge>
          )}
        </CardHeader>
      </Card>

      {/* Stepper Progress */}
      <CalculationStepper steps={CALCULATION_STEPS} className="py-4" />

      {/* Hole-by-Hole Results */}
      <section className="space-y-4">
        <H2>Hole-by-Hole Results</H2>
        <Muted>
          Your scores for each hole, with handicap strokes and adjusted scores.
        </Muted>
        <HolesTable />
      </section>

      <Separator />

      {/* Step 1: Course Handicap */}
      <CourseHandicapStep />

      <Separator />

      {/* Step 2: Adjusted Scores */}
      <AdjustedScoresStep />

      <Separator />

      {/* Step 3: Score Differential */}
      <ScoreDifferentialStep />

      <Separator />

      {/* Step 4: Handicap Impact */}
      <HandicapImpactStep />
    </div>
  );
};

export function RoundCalculation({ scorecard }: RoundCalculationProps) {
  return (
    <RoundCalculationProvider scorecard={scorecard}>
      <RoundCalculationContent />
    </RoundCalculationProvider>
  );
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] No unused imports or variables

#### Manual Verification:
- [ ] Round overview card displays course, date, tee, and hole count
- [ ] Score and differential are prominently displayed
- [ ] 9-hole rounds show badge indicating 18-hole equivalent calculation
- [ ] Stepper shows all 4 calculation steps

---

## Phase 4: Step Components with Educational Content

### Overview
Create individual step components with expandable USGA explanations and interactive inputs.

### Changes Required

#### 1. Course Handicap Step
**File**: `components/round/calculation/steps/course-handicap-step.tsx`

```typescript
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Muted, P, Blockquote } from "@/components/ui/typography";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const CourseHandicapStep = () => {
  const {
    handicapIndex,
    setHandicapIndex,
    slope,
    setSlope,
    rating,
    setRating,
    par,
    setPar,
    isNineHoles,
    setIsNineHoles,
    setHolesPlayed,
    courseHandicapCalculation,
    scorecard,
  } = useRoundCalculationContext();

  // Original values for comparison
  const originalHandicapIndex = scorecard.round.existingHandicapIndex;
  const originalSlope = isNineHoles
    ? scorecard.teePlayed.slopeRatingFront9
    : scorecard.teePlayed.slopeRating18;
  const originalRating = isNineHoles
    ? scorecard.teePlayed.courseRatingFront9
    : scorecard.teePlayed.courseRating18;
  const originalPar = isNineHoles
    ? scorecard.teePlayed.outPar
    : scorecard.teePlayed.totalPar;

  const hasChanges =
    handicapIndex !== originalHandicapIndex ||
    slope !== originalSlope ||
    rating !== originalRating ||
    par !== originalPar;

  const resetToOriginal = () => {
    setHandicapIndex(originalHandicapIndex);
    setSlope(originalSlope);
    setRating(originalRating);
    setPar(originalPar);
  };

  const isModified = (current: number, original: number) => current !== original;

  return (
    <CalculationStep
      stepNumber={1}
      title="Course Handicap"
      description="How many handicap strokes you received for this round"
      learnMoreContent={
        <div className="space-y-3">
          <Blockquote>
            Your Course Handicap represents the number of strokes you receive on
            this specific course and set of tees. It adjusts your Handicap Index
            to account for the difficulty of the course you&apos;re playing.
          </Blockquote>
          <P>
            The formula uses the Slope Rating (a measure of relative difficulty
            for bogey golfers compared to scratch golfers) and Course Rating
            (the expected score for a scratch golfer).
          </P>
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/5%201%20Course%20Handicap%20Calculation.htm"
            target="_blank"
            className="text-primary hover:underline text-sm"
          >
            Read more about Course Handicap calculation (USGA)
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Reset button */}
        {hasChanges && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetToOriginal}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to original values
          </Button>
        )}

        {/* Input grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label>Handicap Index</Label>
            <Input
              type="number"
              step="0.1"
              value={handicapIndex !== 0 ? handicapIndex : ""}
              onChange={(e) =>
                setHandicapIndex(Number.parseFloat(e.target.value) || 0)
              }
              className={cn(
                isModified(handicapIndex, originalHandicapIndex) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div>
            <Label>Slope Rating</Label>
            <Input
              type="number"
              value={slope !== 0 ? slope : ""}
              onChange={(e) =>
                setSlope(Number.parseFloat(e.target.value) || 0)
              }
              className={cn(
                isModified(slope, originalSlope) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div>
            <Label>Course Rating</Label>
            <Input
              type="number"
              step="0.1"
              value={rating !== 0 ? rating : ""}
              onChange={(e) =>
                setRating(Number.parseFloat(e.target.value) || 0)
              }
              className={cn(
                isModified(rating, originalRating) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div>
            <Label>Par</Label>
            <Input
              type="number"
              value={par !== 0 ? par : ""}
              onChange={(e) => setPar(Number(e.target.value) || 0)}
              className={cn(
                isModified(par, originalPar) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Label className="text-xs">18 holes</Label>
            <Switch
              checked={isNineHoles}
              onCheckedChange={(checked) => {
                setIsNineHoles(checked);
                setHolesPlayed(checked ? 9 : 18);
              }}
            />
            <Label className="text-xs">9 holes</Label>
          </div>
        </div>

        {/* Formula */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <Muted>
            {isNineHoles
              ? "Course Handicap (9 holes) = (Handicap Index ÷ 2) × (Slope ÷ 113) + (Course Rating − Par)"
              : "Course Handicap (18 holes) = Handicap Index × (Slope ÷ 113) + (Course Rating − Par)"}
          </Muted>
          <div className="flex flex-wrap items-center gap-2">
            <P className="font-medium">Course Handicap =</P>
            <Muted>
              {isNineHoles ? `(${handicapIndex} ÷ 2)` : handicapIndex} × ({slope}{" "}
              ÷ 113) + ({rating} − {par})
            </Muted>
            <P className="font-medium">=</P>
            <span className="text-xl font-bold text-primary">
              {Math.round(courseHandicapCalculation)}
            </span>
            <Muted>strokes</Muted>
          </div>
        </div>
      </div>
    </CalculationStep>
  );
};

export default CourseHandicapStep;
```

#### 2. Adjusted Scores Step
**File**: `components/round/calculation/steps/adjusted-scores-step.tsx`

```typescript
"use client";

import { Muted, P, Blockquote } from "@/components/ui/typography";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { calculateHoleAdjustedScore } from "@/lib/handicap";
import Link from "next/link";

const AdjustedScoresStep = () => {
  const { scorecard, apsStat } = useRoundCalculationContext();

  // Calculate how many holes had scores capped
  const cappedHoles = scorecard.teePlayed.holes
    ?.slice(0, scorecard.scores.length)
    .filter((hole) => {
      const score = scorecard.scores[hole.holeNumber - 1];
      if (!score) return false;
      const adjustedScore = calculateHoleAdjustedScore(hole, score);
      return adjustedScore < score.strokes;
    });

  const totalStrokes = scorecard.scores.reduce(
    (acc, score) => acc + score.strokes,
    0
  );
  const adjustmentAmount = totalStrokes - apsStat;

  return (
    <CalculationStep
      stepNumber={2}
      title="Adjusted Scores"
      description="How your hole scores were capped for handicap purposes"
      learnMoreContent={
        <div className="space-y-3">
          <Blockquote>
            The USGA limits the maximum score you can post on any hole to
            prevent one bad hole from disproportionately affecting your
            handicap. This is called &quot;Net Double Bogey&quot; adjustment.
          </Blockquote>
          <P>
            The maximum score per hole is the lower of:
          </P>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Par + 5 (absolute maximum)</li>
            <li>Par + 2 + your handicap strokes on that hole</li>
          </ul>
          <P>
            For example, on a Par 4 where you receive 1 handicap stroke, your
            maximum adjusted score is the lower of 9 (4+5) or 7 (4+2+1) = 7.
          </P>
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/3%202%20Acceptable%20Scores.htm"
            target="_blank"
            className="text-primary hover:underline text-sm"
          >
            Read more about Acceptable Scores (USGA)
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{totalStrokes}</div>
            <Muted>Total Strokes</Muted>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{apsStat}</div>
            <Muted>Adjusted Score</Muted>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {cappedHoles?.length || 0}
            </div>
            <Muted>Holes Capped</Muted>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              -{adjustmentAmount}
            </div>
            <Muted>Strokes Saved</Muted>
          </div>
        </div>

        {/* Explanation */}
        {cappedHoles && cappedHoles.length > 0 ? (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <P className="text-amber-800 dark:text-amber-200">
              {cappedHoles.length} hole{cappedHoles.length > 1 ? "s were" : " was"}{" "}
              adjusted: Hole{cappedHoles.length > 1 ? "s" : ""}{" "}
              {cappedHoles.map((h) => h.holeNumber).join(", ")}. This saved you{" "}
              {adjustmentAmount} stroke{adjustmentAmount > 1 ? "s" : ""} in your
              handicap calculation.
            </P>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <P className="text-green-800 dark:text-green-200">
              No holes were capped - all your scores were within the Net Double
              Bogey limit.
            </P>
          </div>
        )}

        {/* Formula reminder */}
        <div className="bg-muted/50 rounded-lg p-4">
          <Muted>
            Adjusted Played Score = Sum of all adjusted hole scores
          </Muted>
          <div className="flex items-center gap-2 mt-2">
            <P className="font-medium">Adjusted Played Score =</P>
            <span className="text-xl font-bold text-primary">{apsStat}</span>
          </div>
        </div>
      </div>
    </CalculationStep>
  );
};

export default AdjustedScoresStep;
```

#### 3. Score Differential Step
**File**: `components/round/calculation/steps/score-differential-step.tsx`

```typescript
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Muted, P, Blockquote } from "@/components/ui/typography";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ScoreDifferentialStep = () => {
  const {
    adjustedGrossScoreCalculation,
    rating,
    setRating,
    slope,
    setSlope,
    scoreDifferentialCalculation,
    isNineHoles,
    scorecard,
  } = useRoundCalculationContext();

  // Original values
  const originalSlope = isNineHoles
    ? scorecard.teePlayed.slopeRatingFront9
    : scorecard.teePlayed.slopeRating18;
  const originalRating = isNineHoles
    ? scorecard.teePlayed.courseRatingFront9
    : scorecard.teePlayed.courseRating18;

  const hasChanges = slope !== originalSlope || rating !== originalRating;

  const resetToOriginal = () => {
    setSlope(originalSlope);
    setRating(originalRating);
  };

  const isModified = (current: number, original: number) => current !== original;

  return (
    <CalculationStep
      stepNumber={3}
      title="Score Differential"
      description="Your performance relative to course difficulty"
      learnMoreContent={
        <div className="space-y-3">
          <Blockquote>
            The Score Differential measures how well you played compared to the
            difficulty of the course. It normalizes your score across different
            courses by accounting for both Course Rating and Slope Rating.
          </Blockquote>
          <P>
            A lower Score Differential indicates better performance. Your
            Handicap Index is calculated from your best Score Differentials.
          </P>
          {isNineHoles && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
              <P className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>9-Hole Round Note:</strong> Since you played 9 holes,
                your Score Differential is calculated as an 18-hole equivalent.
                This combines your actual 9-hole performance with an
                &quot;expected&quot; score for the unplayed 9 holes based on
                your Handicap Index.
              </P>
            </div>
          )}
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/5%201%20Calculation%20of%20a%20Score%20Differential.htm"
            target="_blank"
            className="text-primary hover:underline text-sm"
          >
            Read more about Score Differential calculation (USGA)
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Reset button */}
        {hasChanges && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetToOriginal}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to original values
          </Button>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Adjusted Gross Score</Label>
            <Input
              value={adjustedGrossScoreCalculation}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label>Course Rating</Label>
            <Input
              type="number"
              step="0.1"
              value={rating !== 0 ? rating : ""}
              onChange={(e) =>
                setRating(Number.parseFloat(e.target.value) || 0)
              }
              className={cn(
                isModified(rating, originalRating) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
          <div>
            <Label>Slope Rating</Label>
            <Input
              type="number"
              value={slope !== 0 ? slope : ""}
              onChange={(e) => setSlope(Number(e.target.value) || 0)}
              className={cn(
                isModified(slope, originalSlope) &&
                  "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              )}
            />
          </div>
        </div>

        {/* Formula */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <Muted>
            Score Differential = (Adjusted Gross Score − Course Rating) × 113 ÷
            Slope Rating
          </Muted>
          <div className="flex flex-wrap items-center gap-2">
            <P className="font-medium">Score Differential =</P>
            <Muted>
              ({adjustedGrossScoreCalculation} − {rating}) × 113 ÷ {slope}
            </Muted>
            <P className="font-medium">=</P>
            <span className="text-xl font-bold text-primary">
              {Math.round(scoreDifferentialCalculation * 10) / 10}
            </span>
          </div>
        </div>

        {/* 9-hole visual explanation */}
        {isNineHoles && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
            <P className="font-medium text-blue-800 dark:text-blue-200">
              9-Hole Calculation Breakdown
            </P>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-white dark:bg-blue-900/30 rounded-lg p-3">
                <div className="text-lg font-semibold">Played 9</div>
                <Muted>Your actual score</Muted>
              </div>
              <div className="flex items-center justify-center text-2xl font-bold text-blue-600">
                +
              </div>
              <div className="bg-white dark:bg-blue-900/30 rounded-lg p-3">
                <div className="text-lg font-semibold">Expected 9</div>
                <Muted>Based on your handicap</Muted>
              </div>
            </div>
            <Muted className="text-center">
              = 18-hole equivalent Score Differential
            </Muted>
          </div>
        )}
      </div>
    </CalculationStep>
  );
};

export default ScoreDifferentialStep;
```

#### 4. Handicap Impact Step
**File**: `components/round/calculation/steps/handicap-impact-step.tsx`

```typescript
"use client";

import { Muted, P, Blockquote } from "@/components/ui/typography";
import { CalculationStep } from "../calculation-step";
import { useRoundCalculationContext } from "@/contexts/roundCalculationContext";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const HandicapImpactStep = () => {
  const { scorecard, scoreDifferentialCalculation } = useRoundCalculationContext();

  const handicapBefore = scorecard.round.existingHandicapIndex;
  const handicapAfter = scorecard.round.updatedHandicapIndex;
  const change = handicapAfter - handicapBefore;
  const esrAdjustment = scorecard.round.exceptionalScoreAdjustment;

  const getTrendIcon = () => {
    if (change < -0.05)
      return <TrendingDown className="w-6 h-6 text-green-600" />;
    if (change > 0.05)
      return <TrendingUp className="w-6 h-6 text-red-600" />;
    return <Minus className="w-6 h-6 text-muted-foreground" />;
  };

  const getChangeColor = () => {
    if (change < -0.05) return "text-green-600";
    if (change > 0.05) return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <CalculationStep
      stepNumber={4}
      title="Handicap Impact"
      description="How this round affected your Handicap Index"
      learnMoreContent={
        <div className="space-y-3">
          <Blockquote>
            Your Handicap Index is calculated from your best Score Differentials
            out of your most recent 20 rounds. The number of differentials used
            depends on how many rounds you have posted.
          </Blockquote>
          <P>
            If you&apos;ve played fewer than 20 rounds, the calculation uses a
            smaller number of your best differentials with an adjustment factor.
          </P>
          {esrAdjustment !== 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <P className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Exceptional Score Reduction (ESR):</strong> When you
                post a Score Differential significantly better than your
                Handicap Index (7+ strokes), an ESR adjustment is applied to
                prevent rapid handicap manipulation.
              </P>
            </div>
          )}
          <Link
            href="https://www.usga.org/handicapping/roh/Content/rules/5%202%20Calculation%20of%20a%20Handicap%20Index.htm"
            target="_blank"
            className="text-primary hover:underline text-sm"
          >
            Read more about Handicap Index calculation (USGA)
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Before/After comparison */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 py-4">
          <div className="text-center">
            <Muted>Before this round</Muted>
            <div className="text-3xl font-bold">{handicapBefore.toFixed(1)}</div>
          </div>
          <ArrowRight className="w-8 h-8 text-muted-foreground hidden sm:block" />
          <div className="text-center">
            <Muted>After this round</Muted>
            <div className="text-3xl font-bold">{handicapAfter.toFixed(1)}</div>
          </div>
        </div>

        {/* Change indicator */}
        <div
          className={cn(
            "flex items-center justify-center gap-3 p-4 rounded-lg",
            change < -0.05 && "bg-green-50 dark:bg-green-950/20",
            change > 0.05 && "bg-red-50 dark:bg-red-950/20",
            Math.abs(change) <= 0.05 && "bg-muted/50"
          )}
        >
          {getTrendIcon()}
          <div>
            <P className={cn("font-semibold", getChangeColor())}>
              {change === 0
                ? "No change"
                : change > 0
                ? `+${change.toFixed(1)}`
                : change.toFixed(1)}{" "}
              {change !== 0 && "strokes"}
            </P>
            <Muted>
              {change < -0.05 && "Your handicap decreased (improved)"}
              {change > 0.05 && "Your handicap increased"}
              {Math.abs(change) <= 0.05 && "Your handicap stayed the same"}
            </Muted>
          </div>
        </div>

        {/* Exceptional Score Adjustment */}
        {esrAdjustment !== 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <P className="font-medium text-amber-800 dark:text-amber-200">
              Exceptional Score Reduction Applied
            </P>
            <Muted className="text-amber-700 dark:text-amber-300">
              This round was {Math.abs(esrAdjustment)} stroke
              {Math.abs(esrAdjustment) > 1 ? "s" : ""} better than expected. An
              ESR adjustment of {esrAdjustment} was applied to your recent
              differentials.
            </Muted>
          </div>
        )}

        {/* Score differential reminder */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <Muted>This round&apos;s Score Differential</Muted>
              <P className="text-2xl font-bold">
                {Math.round(scoreDifferentialCalculation * 10) / 10}
              </P>
            </div>
            <div className="text-right">
              <Muted>Differential used in calculation</Muted>
              <P className="text-2xl font-bold">
                {(
                  Math.round(scoreDifferentialCalculation * 10) / 10 +
                  esrAdjustment
                ).toFixed(1)}
              </P>
            </div>
          </div>
        </div>
      </div>
    </CalculationStep>
  );
};

export default HandicapImpactStep;
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] All imports resolve correctly
- [x] No linting errors: `pnpm lint`

#### Manual Verification:
- [ ] Each step shows numbered indicator and title
- [ ] "Learn more" sections expand with USGA explanations
- [ ] Modified inputs highlight in amber/yellow
- [ ] "Reset to original values" button appears when values are changed
- [ ] 9-hole rounds show visual breakdown diagram
- [ ] Handicap impact shows before/after with trend indicator

---

## Phase 5: Update Context for Reset Functionality (SKIPPED - Handled inline in step components)

### Overview
Minor updates to the context provider to support the reset functionality.

### Changes Required

#### 1. Add Original Values to Context
**File**: `contexts/roundCalculationContext.tsx`

Add these exports to the context interface and provider (add after existing state):

```typescript
// Add to RoundCalculationContextProps interface (around line 17)
interface RoundCalculationContextProps {
  // ... existing props ...
  originalValues: {
    handicapIndex: number;
    slope: number;
    rating: number;
    par: number;
  };
}

// In the provider, add after existing state (around line 65):
const originalValues = useMemo(() => ({
  handicapIndex: scorecard.round.existingHandicapIndex,
  slope: isNineHoles
    ? scorecard.teePlayed.slopeRatingFront9
    : scorecard.teePlayed.slopeRating18,
  rating: isNineHoles
    ? scorecard.teePlayed.courseRatingFront9
    : scorecard.teePlayed.courseRating18,
  par: isNineHoles
    ? scorecard.teePlayed.outPar
    : scorecard.teePlayed.totalPar,
}), [scorecard, isNineHoles]);

// Add to the Provider value object (around line 109):
<RoundCalculationContext.Provider
  value={{
    // ... existing values ...
    originalValues,
  }}
>
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build` (skipped - handled inline)

#### Manual Verification:
- [x] Context provides originalValues correctly (handled inline in step components)
- [x] Values update when isNineHoles toggles (handled inline in step components)

---

## Phase 6: Create Directory Structure (COMPLETED)

### Overview
Create the required directory structure for the new step components.

### Changes Required

Create directory: `components/round/calculation/steps/`

Files to create:
- `components/round/calculation/steps/course-handicap-step.tsx`
- `components/round/calculation/steps/adjusted-scores-step.tsx`
- `components/round/calculation/steps/score-differential-step.tsx`
- `components/round/calculation/steps/handicap-impact-step.tsx`

### Success Criteria

#### Automated Verification:
- [x] Directory exists
- [x] All files import correctly

---

## Testing Strategy

### Unit Tests

Create test file: `test/unit/components/calculation-step.test.tsx`

Test cases:
- CalculationStep renders with correct step number and title
- "Learn more" section expands/collapses correctly
- Fade-in animation triggers on scroll into view

### Integration Tests

Test cases:
- Premium user can access `/rounds/[id]/calculation`
- Non-premium user is redirected to `/upgrade`
- User cannot access another user's round calculation
- All calculation values match expected USGA formulas
- 9-hole rounds display correct formula breakdown
- Reset functionality restores original values

### Manual Testing Steps

1. Log in as a non-premium user, try to access `/rounds/[id]/calculation` - verify redirect to `/upgrade`
2. Log in as a premium user, access your own round calculation page
3. Verify all 4 steps display with correct information
4. Expand all "Learn more" sections and verify content
5. Modify input values and verify:
   - Inputs highlight in amber
   - "Reset to original" button appears
   - Calculations update in real-time
6. Click "Reset to original" and verify values restore
7. View a 9-hole round and verify:
   - Badge shows "9-Hole Round"
   - Visual diagram shows played + expected formula
   - Correct front 9 ratings are used
8. View a round with ESR adjustment and verify the notification appears
9. Test on mobile device - verify responsive layout

---

## Performance Considerations

- Use `useMemo` for all expensive calculations (already implemented in context)
- Intersection Observer for fade-in animations only triggers once per section
- Collapsible sections are rendered but hidden (no lazy loading needed for small content)
- No additional API calls - all data comes from initial scorecard fetch

---

## Migration Notes

- No database changes required
- No data migration needed
- Existing round data will display correctly with new UI
- Premium protection activates immediately after deployment

---

## References

- Existing page: `app/rounds/[id]/calculation/page.tsx`
- Existing component: `components/round-calculation.tsx`
- Context provider: `contexts/roundCalculationContext.tsx`
- Calculation logic: `lib/handicap/calculations.ts`
- Premium protection: `utils/supabase/middleware.ts:103-193`
- PREMIUM_PATHS: `utils/billing/constants.ts:22`
- Similar UI patterns: `components/round/calculation/*.tsx`
