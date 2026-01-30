# Golf Calculators Page Implementation Plan

## Overview

Build a comprehensive Golf Calculators page with 9 WHS-compliant calculators organized in 3 categories, featuring automatic interoperability via shared React Context, collapsible formula explanations with USGA links, and responsive mobile-first design.

## Current State Analysis

- `/app/calculators/page.tsx` shows "Coming Soon" placeholder
- Two basic calculator components exist but are not integrated:
  - `components/calculators/course-handicap.tsx`
  - `components/calculators/score-differential.tsx`
- Route is gated to unlimited/lifetime plans via `UNLIMITED_PATHS`
- Core calculation functions exist in `lib/handicap/calculations.ts`
- Existing pattern: `roundCalculationContext.tsx` shows how to share values between calculation steps

## Desired End State

A fully functional `/calculators` page with:
- 9 calculators in 3 tabbed categories (Core, Advanced, Educational)
- Automatic value propagation between linked calculators
- Collapsible "How it's calculated" panels with USGA links
- Mobile: accordion-style with sticky linked values bar
- Desktop: grid layout with multiple expanded calculators
- Extensible architecture for adding future calculators

### Verification:
- All calculators produce correct results matching USGA formulas
- Values automatically propagate between linked calculators
- Responsive design works on mobile (375px) through desktop (1440px+)
- Page loads under premium gate without errors

## What We're NOT Doing

- No database persistence of calculator inputs/results
- No user preferences for default values (future feature)
- No calculator history/undo functionality
- No PDF export of calculations
- No comparison mode between multiple scenarios

## Implementation Approach

Use a **Calculator Registry pattern** with shared React Context:
1. Each calculator registers its inputs/outputs with the context
2. Context manages automatic value propagation
3. Calculators can be added by creating a component and registering it
4. UI renders calculators based on registry metadata

---

## Phase 1: Calculator Context & Architecture

### Overview
Create the shared context and type system that enables automatic value propagation between calculators.

### Changes Required:

#### 1. Calculator Types Definition

**File**: `types/calculators.ts` (new file)

```typescript
// Calculator field types for interoperability
export type CalculatorFieldType =
  | "handicapIndex"
  | "courseHandicap"
  | "playingHandicap"
  | "scoreDifferential"
  | "adjustedGrossScore"
  | "courseRating"
  | "slopeRating"
  | "par"
  | "holesPlayed"
  | "lowHandicapIndex";

// Calculator metadata for registry
export interface CalculatorMeta {
  id: string;
  name: string;
  description: string;
  category: "core" | "advanced" | "educational";
  inputs: CalculatorFieldType[];
  outputs: CalculatorFieldType[];
  usgaLink?: string;
}

// Shared values state
export interface CalculatorValues {
  handicapIndex: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
  scoreDifferential: number | null;
  adjustedGrossScore: number | null;
  courseRating: number | null;
  slopeRating: number | null;
  par: number | null;
  holesPlayed: 9 | 18;
  lowHandicapIndex: number | null;
  // For handicap index calculation
  scoreDifferentials: number[];
}
```

#### 2. Calculator Context

**File**: `contexts/calculatorContext.tsx` (new file)

```typescript
"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CalculatorValues, CalculatorFieldType } from "@/types/calculators";

interface CalculatorContextProps {
  values: CalculatorValues;
  setValue: (field: CalculatorFieldType, value: number | null) => void;
  setValues: (updates: Partial<CalculatorValues>) => void;
  resetValues: () => void;
  // Track which calculator last updated each field for UI highlighting
  lastUpdatedBy: Record<CalculatorFieldType, string | null>;
  setLastUpdatedBy: (field: CalculatorFieldType, calculatorId: string) => void;
  // Expansion state for mobile accordion
  expandedCalculator: string | null;
  setExpandedCalculator: (id: string | null) => void;
}

const defaultValues: CalculatorValues = {
  handicapIndex: null,
  courseHandicap: null,
  playingHandicap: null,
  scoreDifferential: null,
  adjustedGrossScore: null,
  courseRating: null,
  slopeRating: null,
  par: null,
  holesPlayed: 18,
  lowHandicapIndex: null,
  scoreDifferentials: [],
};

const CalculatorContext = createContext<CalculatorContextProps | undefined>(undefined);

export function CalculatorProvider({ children }: { children: ReactNode }) {
  const [values, setValuesState] = useState<CalculatorValues>(defaultValues);
  const [lastUpdatedBy, setLastUpdatedByState] = useState<Record<CalculatorFieldType, string | null>>({} as Record<CalculatorFieldType, string | null>);
  const [expandedCalculator, setExpandedCalculator] = useState<string | null>(null);

  const setValue = useCallback((field: CalculatorFieldType, value: number | null) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
  }, []);

  const setValues = useCallback((updates: Partial<CalculatorValues>) => {
    setValuesState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetValues = useCallback(() => {
    setValuesState(defaultValues);
    setLastUpdatedByState({} as Record<CalculatorFieldType, string | null>);
  }, []);

  const setLastUpdatedBy = useCallback((field: CalculatorFieldType, calculatorId: string) => {
    setLastUpdatedByState(prev => ({ ...prev, [field]: calculatorId }));
  }, []);

  return (
    <CalculatorContext.Provider value={{
      values,
      setValue,
      setValues,
      resetValues,
      lastUpdatedBy,
      setLastUpdatedBy,
      expandedCalculator,
      setExpandedCalculator,
    }}>
      {children}
    </CalculatorContext.Provider>
  );
}

export function useCalculatorContext() {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error("useCalculatorContext must be used within CalculatorProvider");
  }
  return context;
}
```

#### 3. Calculator Registry

**File**: `lib/calculator-registry.ts` (new file)

```typescript
import { CalculatorMeta } from "@/types/calculators";

// Registry of all available calculators
export const CALCULATOR_REGISTRY: CalculatorMeta[] = [
  // Core Calculators
  {
    id: "course-handicap",
    name: "Course Handicap",
    description: "Calculate your course handicap for a specific set of tees",
    category: "core",
    inputs: ["handicapIndex", "slopeRating", "courseRating", "par", "holesPlayed"],
    outputs: ["courseHandicap"],
    usgaLink: "https://www.usga.org/handicapping/roh/Content/rules/6%201%20Calculation%20of%20Course%20Handicap.htm",
  },
  {
    id: "score-differential",
    name: "Score Differential",
    description: "Calculate the differential for a round you played",
    category: "core",
    inputs: ["adjustedGrossScore", "courseRating", "slopeRating"],
    outputs: ["scoreDifferential"],
    usgaLink: "https://www.usga.org/handicapping/roh/Content/rules/5%201%20Calculation%20of%20a%20Score%20Differential.htm",
  },
  {
    id: "handicap-index",
    name: "Handicap Index",
    description: "Calculate your handicap index from your score differentials",
    category: "core",
    inputs: [], // Uses scoreDifferentials array
    outputs: ["handicapIndex"],
    usgaLink: "https://www.usga.org/handicapping/roh/Content/rules/5%202%20Calculation%20of%20a%20Handicap%20Index.htm",
  },
  // Advanced Calculators
  {
    id: "playing-handicap",
    name: "Playing Handicap",
    description: "Calculate strokes received for different formats of play",
    category: "advanced",
    inputs: ["courseHandicap"],
    outputs: ["playingHandicap"],
    usgaLink: "https://www.usga.org/handicapping/roh/Content/rules/6%202%20Calculation%20of%20Playing%20Handicap.htm",
  },
  {
    id: "what-if-scenario",
    name: "What-If Scenario",
    description: "See how a hypothetical round would affect your handicap",
    category: "advanced",
    inputs: ["handicapIndex", "courseRating", "slopeRating"],
    outputs: ["scoreDifferential", "handicapIndex"],
  },
  {
    id: "exceptional-score",
    name: "Exceptional Score Reduction",
    description: "Understand when and how ESR applies to your handicap",
    category: "advanced",
    inputs: ["handicapIndex", "scoreDifferential"],
    outputs: [],
    usgaLink: "https://www.usga.org/handicapping/roh/Content/rules/5%209%20Exceptional%20Score%20Reduction.htm",
  },
  // Educational Calculators
  {
    id: "handicap-caps",
    name: "Soft & Hard Cap Visualizer",
    description: "See how caps limit handicap increases over time",
    category: "educational",
    inputs: ["handicapIndex", "lowHandicapIndex"],
    outputs: [],
    usgaLink: "https://www.usga.org/handicapping/roh/Content/rules/5%207%20Cap%20Procedure.htm",
  },
  {
    id: "nine-hole-equivalency",
    name: "9-Hole Equivalency",
    description: "Understand how 9-hole rounds convert to 18-hole differentials",
    category: "educational",
    inputs: ["handicapIndex", "courseRating", "slopeRating", "par", "adjustedGrossScore"],
    outputs: ["scoreDifferential"],
    usgaLink: "https://www.usga.org/handicapping/roh/Content/rules/5%201b%20Nine%20Hole%20Score.htm",
  },
  {
    id: "strokes-received",
    name: "Strokes Received",
    description: "See which holes you receive handicap strokes on",
    category: "educational",
    inputs: ["courseHandicap"],
    outputs: [],
  },
];

export function getCalculatorsByCategory(category: CalculatorMeta["category"]) {
  return CALCULATOR_REGISTRY.filter(calc => calc.category === category);
}

export function getCalculatorById(id: string) {
  return CALCULATOR_REGISTRY.find(calc => calc.id === id);
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [ ] Unit tests pass for calculator registry: `pnpm test`

#### Manual Verification:
- [ ] Context provides/receives values correctly (test with React DevTools)
- [ ] Calculator registry returns correct metadata

---

## Phase 2: Core Calculator Components

### Overview
Build the 3 core calculators with collapsible explanations and USGA links.

### Changes Required:

#### 1. Base Calculator Card Component

**File**: `components/calculators/calculator-card.tsx` (new file)

```typescript
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalculatorMeta } from "@/types/calculators";
import { useCalculatorContext } from "@/contexts/calculatorContext";

interface CalculatorCardProps {
  meta: CalculatorMeta;
  children: React.ReactNode;
  result?: React.ReactNode;
  explanation?: React.ReactNode;
  className?: string;
}

export function CalculatorCard({
  meta,
  children,
  result,
  explanation,
  className
}: CalculatorCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const { expandedCalculator, setExpandedCalculator } = useCalculatorContext();

  const isExpanded = expandedCalculator === meta.id;

  // On mobile, use accordion behavior
  const handleToggle = () => {
    setExpandedCalculator(isExpanded ? null : meta.id);
  };

  return (
    <Card className={cn("transition-all", className)}>
      <CardHeader
        className="cursor-pointer md:cursor-default"
        onClick={() => handleToggle()}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">{meta.name}</CardTitle>
            <CardDescription className="mt-1">{meta.description}</CardDescription>
          </div>
          {/* Mobile expand indicator */}
          <div className="md:hidden">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {/* Content - always visible on desktop, accordion on mobile */}
      <CardContent className={cn(
        "space-y-4",
        "md:block", // Always show on desktop
        isExpanded ? "block" : "hidden md:block" // Accordion on mobile
      )}>
        {/* Input Fields */}
        {children}

        {/* Result Display */}
        {result && (
          <div className="pt-4 border-t">
            {result}
          </div>
        )}

        {/* Collapsible Explanation */}
        {explanation && (
          <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>How is this calculated?</span>
                {showExplanation ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              {explanation}
              {meta.usgaLink && (
                <a
                  href={meta.usgaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Learn more at USGA.org
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
```

#### 2. Course Handicap Calculator (Refactor)

**File**: `components/calculators/course-handicap-calculator.tsx` (new file, replaces old)

```typescript
"use client";

import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Muted, P } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";

const meta = getCalculatorById("course-handicap")!;

export function CourseHandicapCalculator() {
  const { values, setValue, setLastUpdatedBy } = useCalculatorContext();

  const courseHandicap = useMemo(() => {
    const { handicapIndex, slopeRating, courseRating, par, holesPlayed } = values;
    if (handicapIndex === null || slopeRating === null || courseRating === null || par === null) {
      return null;
    }

    if (holesPlayed === 9) {
      return Math.round((handicapIndex / 2) * (slopeRating / 113) + (courseRating - par));
    }
    return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - par));
  }, [values]);

  // Update shared context when result changes
  useEffect(() => {
    if (courseHandicap !== null) {
      setValue("courseHandicap", courseHandicap);
      setLastUpdatedBy("courseHandicap", meta.id);
    }
  }, [courseHandicap, setValue, setLastUpdatedBy]);

  const result = (
    <div className="flex items-center justify-between">
      <P className="font-medium">Course Handicap:</P>
      <span className="text-3xl font-bold text-primary">
        {courseHandicap !== null ? courseHandicap : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        {values.holesPlayed === 9 ? (
          <span>Course Handicap (9 holes) = (Handicap Index ÷ 2) × (Slope ÷ 113) + (Course Rating − Par)</span>
        ) : (
          <span>Course Handicap = Handicap Index × (Slope ÷ 113) + (Course Rating − Par)</span>
        )}
      </Muted>
      {courseHandicap !== null && values.handicapIndex !== null && (
        <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
          <P className="text-muted-foreground">
            {values.holesPlayed === 9 ? (
              <>({values.handicapIndex} ÷ 2) × ({values.slopeRating} ÷ 113) + ({values.courseRating} − {values.par})</>
            ) : (
              <>{values.handicapIndex} × ({values.slopeRating} ÷ 113) + ({values.courseRating} − {values.par})</>
            )}
          </P>
          <P className="font-bold mt-1">= {courseHandicap}</P>
        </div>
      )}
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="handicapIndex">Handicap Index</Label>
          <Input
            id="handicapIndex"
            type="number"
            step="0.1"
            placeholder="e.g., 12.4"
            value={values.handicapIndex ?? ""}
            onChange={(e) => setValue("handicapIndex", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slopeRating">Slope Rating</Label>
          <Input
            id="slopeRating"
            type="number"
            placeholder="e.g., 130"
            value={values.slopeRating ?? ""}
            onChange={(e) => setValue("slopeRating", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseRating">Course Rating</Label>
          <Input
            id="courseRating"
            type="number"
            step="0.1"
            placeholder="e.g., 72.3"
            value={values.courseRating ?? ""}
            onChange={(e) => setValue("courseRating", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="par">Par</Label>
          <Input
            id="par"
            type="number"
            placeholder="e.g., 72"
            value={values.par ?? ""}
            onChange={(e) => setValue("par", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <Label htmlFor="holesPlayed">18 holes</Label>
        <Switch
          id="holesPlayed"
          checked={values.holesPlayed === 9}
          onCheckedChange={(checked) => setValue("holesPlayed" as any, checked ? 9 : 18)}
        />
        <Label htmlFor="holesPlayed">9 holes</Label>
      </div>
    </CalculatorCard>
  );
}
```

#### 3. Score Differential Calculator (Refactor)

**File**: `components/calculators/score-differential-calculator.tsx` (new file)

```typescript
"use client";

import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import { calculateScoreDifferential } from "@/lib/handicap";

const meta = getCalculatorById("score-differential")!;

export function ScoreDifferentialCalculator() {
  const { values, setValue, setLastUpdatedBy } = useCalculatorContext();

  const scoreDifferential = useMemo(() => {
    const { adjustedGrossScore, courseRating, slopeRating } = values;
    if (adjustedGrossScore === null || courseRating === null || slopeRating === null) {
      return null;
    }
    return calculateScoreDifferential(adjustedGrossScore, courseRating, slopeRating);
  }, [values]);

  useEffect(() => {
    if (scoreDifferential !== null) {
      setValue("scoreDifferential", scoreDifferential);
      setLastUpdatedBy("scoreDifferential", meta.id);
    }
  }, [scoreDifferential, setValue, setLastUpdatedBy]);

  const result = (
    <div className="flex items-center justify-between">
      <P className="font-medium">Score Differential:</P>
      <span className="text-3xl font-bold text-primary">
        {scoreDifferential !== null ? scoreDifferential.toFixed(1) : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        Score Differential = (Adjusted Gross Score − Course Rating) × (113 ÷ Slope Rating)
      </Muted>
      {scoreDifferential !== null && (
        <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
          <P className="text-muted-foreground">
            ({values.adjustedGrossScore} − {values.courseRating}) × (113 ÷ {values.slopeRating})
          </P>
          <P className="font-bold mt-1">= {scoreDifferential.toFixed(1)}</P>
        </div>
      )}
      <Muted className="text-xs">
        Note: Negative differentials are rounded toward zero (ceiling).
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="adjustedGrossScore">Adjusted Gross Score</Label>
          <Input
            id="adjustedGrossScore"
            type="number"
            placeholder="e.g., 85"
            value={values.adjustedGrossScore ?? ""}
            onChange={(e) => setValue("adjustedGrossScore", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseRating-diff">Course Rating</Label>
          <Input
            id="courseRating-diff"
            type="number"
            step="0.1"
            placeholder="e.g., 72.3"
            value={values.courseRating ?? ""}
            onChange={(e) => setValue("courseRating", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slopeRating-diff">Slope Rating</Label>
          <Input
            id="slopeRating-diff"
            type="number"
            placeholder="e.g., 130"
            value={values.slopeRating ?? ""}
            onChange={(e) => setValue("slopeRating", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
```

#### 4. Handicap Index Calculator

**File**: `components/calculators/handicap-index-calculator.tsx` (new file)

```typescript
"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Muted, P, Small } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import { calculateHandicapIndex, getRelevantDifferentials } from "@/lib/handicap";
import { Plus, X } from "lucide-react";

const meta = getCalculatorById("handicap-index")!;

export function HandicapIndexCalculator() {
  const { values, setValue, setLastUpdatedBy } = useCalculatorContext();
  const [newDifferential, setNewDifferential] = useState("");

  const differentials = values.scoreDifferentials;

  const addDifferential = () => {
    const value = parseFloat(newDifferential);
    if (!isNaN(value)) {
      setValue("scoreDifferentials" as any, [...differentials, value]);
      setNewDifferential("");
    }
  };

  const removeDifferential = (index: number) => {
    setValue("scoreDifferentials" as any, differentials.filter((_, i) => i !== index));
  };

  const handicapIndex = useMemo(() => {
    if (differentials.length < 3) return null;
    return calculateHandicapIndex(differentials);
  }, [differentials]);

  const relevantDifferentials = useMemo(() => {
    if (differentials.length === 0) return [];
    const sorted = [...differentials].sort((a, b) => a - b);
    return getRelevantDifferentials(sorted);
  }, [differentials]);

  useEffect(() => {
    if (handicapIndex !== null) {
      setValue("handicapIndex", handicapIndex);
      setLastUpdatedBy("handicapIndex", meta.id);
    }
  }, [handicapIndex, setValue, setLastUpdatedBy]);

  const result = (
    <div className="flex items-center justify-between">
      <div>
        <P className="font-medium">Handicap Index:</P>
        {differentials.length < 3 && (
          <Small className="text-muted-foreground">
            Need {3 - differentials.length} more round(s)
          </Small>
        )}
      </div>
      <span className="text-3xl font-bold text-primary">
        {handicapIndex !== null ? handicapIndex.toFixed(1) : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        Your Handicap Index is calculated by averaging your best score differentials,
        based on how many rounds you have:
      </Muted>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>3-5 rounds: Best 1</div>
        <div>6-8 rounds: Best 2</div>
        <div>9-11 rounds: Best 3</div>
        <div>12-14 rounds: Best 4</div>
        <div>15-16 rounds: Best 5</div>
        <div>17-18 rounds: Best 6</div>
        <div>19 rounds: Best 7</div>
        <div>20+ rounds: Best 8</div>
      </div>
      {handicapIndex !== null && (
        <div className="bg-muted/50 rounded-lg p-3">
          <P className="text-sm text-muted-foreground">
            Using {relevantDifferentials.length} of {differentials.length} differentials:
          </P>
          <P className="font-mono">
            ({relevantDifferentials.join(" + ")}) ÷ {relevantDifferentials.length}
          </P>
          <P className="font-bold mt-1">= {handicapIndex.toFixed(1)}</P>
        </div>
      )}
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="newDifferential">Add Score Differential</Label>
            <Input
              id="newDifferential"
              type="number"
              step="0.1"
              placeholder="e.g., 12.3"
              value={newDifferential}
              onChange={(e) => setNewDifferential(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDifferential()}
            />
          </div>
          <Button
            onClick={addDifferential}
            className="self-end"
            disabled={!newDifferential}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {differentials.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {differentials.map((diff, index) => {
              const isUsed = relevantDifferentials.includes(diff);
              return (
                <Badge
                  key={index}
                  variant={isUsed ? "default" : "secondary"}
                  className="gap-1"
                >
                  {diff.toFixed(1)}
                  <button
                    onClick={() => removeDifferential(index)}
                    className="hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        {differentials.length > 0 && differentials.length < 3 && (
          <Muted className="text-sm">
            Add at least 3 differentials to calculate your handicap index.
          </Muted>
        )}
      </div>
    </CalculatorCard>
  );
}
```

#### 5. Calculator Barrel Export

**File**: `components/calculators/index.ts` (update)

```typescript
export { CalculatorCard } from "./calculator-card";
export { CourseHandicapCalculator } from "./course-handicap-calculator";
export { ScoreDifferentialCalculator } from "./score-differential-calculator";
export { HandicapIndexCalculator } from "./handicap-index-calculator";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [ ] Unit tests for calculations: `pnpm test`

#### Manual Verification:
- [ ] Course Handicap Calculator produces correct results
- [ ] Score Differential Calculator matches `calculateScoreDifferential()` function
- [ ] Handicap Index Calculator correctly selects best N differentials
- [ ] Values propagate between calculators automatically
- [ ] Collapsible explanations show/hide correctly
- [ ] USGA links open in new tab

---

## Phase 3: Advanced Calculator Components

### Overview
Build Playing Handicap, What-If Scenario, and Exceptional Score calculators.

### Changes Required:

#### 1. Playing Handicap Calculator

**File**: `components/calculators/playing-handicap-calculator.tsx` (new file)

```typescript
"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Muted, P } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";

const meta = getCalculatorById("playing-handicap")!;

// Common handicap allowances per USGA
const FORMAT_ALLOWANCES = [
  { id: "stroke", name: "Individual Stroke Play", allowance: 100 },
  { id: "match", name: "Individual Match Play", allowance: 100 },
  { id: "fourball-stroke", name: "Four-Ball Stroke Play", allowance: 85 },
  { id: "fourball-match", name: "Four-Ball Match Play", allowance: 90 },
  { id: "foursomes", name: "Foursomes", allowance: 50 },
  { id: "stableford", name: "Stableford", allowance: 95 },
];

export function PlayingHandicapCalculator() {
  const { values, setValue } = useCalculatorContext();
  const [format, setFormat] = useState("stroke");

  const selectedFormat = FORMAT_ALLOWANCES.find(f => f.id === format);

  const playingHandicap = useMemo(() => {
    if (values.courseHandicap === null || !selectedFormat) return null;
    return Math.round(values.courseHandicap * (selectedFormat.allowance / 100));
  }, [values.courseHandicap, selectedFormat]);

  const result = (
    <div className="flex items-center justify-between">
      <P className="font-medium">Playing Handicap:</P>
      <span className="text-3xl font-bold text-primary">
        {playingHandicap !== null ? playingHandicap : "—"}
      </span>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        Playing Handicap = Course Handicap × Handicap Allowance %
      </Muted>
      {playingHandicap !== null && selectedFormat && (
        <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
          <P className="text-muted-foreground">
            {values.courseHandicap} × {selectedFormat.allowance}%
          </P>
          <P className="font-bold mt-1">= {playingHandicap}</P>
        </div>
      )}
      <Muted className="text-xs">
        Different formats of play use different handicap allowances to ensure fair competition.
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="courseHandicap-play">Course Handicap</Label>
          <Input
            id="courseHandicap-play"
            type="number"
            placeholder="e.g., 14"
            value={values.courseHandicap ?? ""}
            onChange={(e) => setValue("courseHandicap", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="format">Format of Play</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger id="format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_ALLOWANCES.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({f.allowance}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </CalculatorCard>
  );
}
```

#### 2. What-If Scenario Calculator

**File**: `components/calculators/what-if-calculator.tsx` (new file)

```typescript
"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import { calculateScoreDifferential, calculateHandicapIndex } from "@/lib/handicap";
import { ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";

const meta = getCalculatorById("what-if-scenario")!;

export function WhatIfCalculator() {
  const { values } = useCalculatorContext();
  const [hypotheticalScore, setHypotheticalScore] = useState<number | null>(null);

  const hypotheticalDifferential = useMemo(() => {
    if (hypotheticalScore === null || values.courseRating === null || values.slopeRating === null) {
      return null;
    }
    return calculateScoreDifferential(hypotheticalScore, values.courseRating, values.slopeRating);
  }, [hypotheticalScore, values.courseRating, values.slopeRating]);

  const projectedHandicap = useMemo(() => {
    if (hypotheticalDifferential === null) return null;
    if (values.scoreDifferentials.length < 2) return null;

    // Add the hypothetical to existing differentials
    const newDifferentials = [...values.scoreDifferentials, hypotheticalDifferential];
    // Limit to 20 most recent
    const recentDifferentials = newDifferentials.slice(-20);

    if (recentDifferentials.length < 3) return null;
    return calculateHandicapIndex(recentDifferentials);
  }, [hypotheticalDifferential, values.scoreDifferentials]);

  const handicapChange = useMemo(() => {
    if (projectedHandicap === null || values.handicapIndex === null) return null;
    return projectedHandicap - values.handicapIndex;
  }, [projectedHandicap, values.handicapIndex]);

  const result = (
    <div className="space-y-4">
      {hypotheticalDifferential !== null && (
        <div className="flex items-center justify-between">
          <P className="font-medium">Hypothetical Differential:</P>
          <span className="text-2xl font-bold">{hypotheticalDifferential.toFixed(1)}</span>
        </div>
      )}
      {projectedHandicap !== null && values.handicapIndex !== null && (
        <div className="flex items-center gap-4">
          <div className="text-center">
            <Small className="text-muted-foreground">Current</Small>
            <P className="text-xl font-bold">{values.handicapIndex.toFixed(1)}</P>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="text-center">
            <Small className="text-muted-foreground">Projected</Small>
            <P className="text-xl font-bold text-primary">{projectedHandicap.toFixed(1)}</P>
          </div>
          {handicapChange !== null && (
            <div className={`flex items-center gap-1 ${
              handicapChange < 0 ? "text-green-600" : handicapChange > 0 ? "text-red-600" : "text-muted-foreground"
            }`}>
              {handicapChange < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : handicapChange > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span className="font-medium">
                {handicapChange > 0 ? "+" : ""}{handicapChange.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        This calculator shows how a hypothetical round would affect your handicap index.
        It calculates the score differential and projects your new handicap.
      </Muted>
      <Muted className="text-xs">
        Note: Actual results may vary based on soft/hard caps, ESR, and other factors.
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hypotheticalScore">Hypothetical Score</Label>
          <Input
            id="hypotheticalScore"
            type="number"
            placeholder="e.g., 82"
            value={hypotheticalScore ?? ""}
            onChange={(e) => setHypotheticalScore(e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseRating-whatif">Course Rating</Label>
          <Input
            id="courseRating-whatif"
            type="number"
            step="0.1"
            placeholder="e.g., 72.3"
            value={values.courseRating ?? ""}
            readOnly
            className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slopeRating-whatif">Slope Rating</Label>
          <Input
            id="slopeRating-whatif"
            type="number"
            placeholder="e.g., 130"
            value={values.slopeRating ?? ""}
            readOnly
            className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentHandicap">Current Handicap</Label>
          <Input
            id="currentHandicap"
            type="number"
            step="0.1"
            value={values.handicapIndex ?? ""}
            readOnly
            className="bg-muted"
          />
        </div>
      </div>
      {values.scoreDifferentials.length < 2 && (
        <Muted className="text-sm text-amber-600">
          Add at least 2 differentials in the Handicap Index calculator to see projections.
        </Muted>
      )}
    </CalculatorCard>
  );
}
```

#### 3. Exceptional Score Reduction Calculator

**File**: `components/calculators/exceptional-score-calculator.tsx` (new file)

```typescript
"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import { EXCEPTIONAL_ROUND_THRESHOLD } from "@/lib/handicap/constants";
import { AlertTriangle, CheckCircle } from "lucide-react";

const meta = getCalculatorById("exceptional-score")!;

export function ExceptionalScoreCalculator() {
  const { values, setValue } = useCalculatorContext();

  const analysis = useMemo(() => {
    if (values.handicapIndex === null || values.scoreDifferential === null) {
      return null;
    }

    const difference = values.handicapIndex - values.scoreDifferential;
    const isExceptional = difference >= EXCEPTIONAL_ROUND_THRESHOLD;

    // ESR adjustment calculation
    let esrAdjustment = 0;
    if (isExceptional) {
      if (difference >= 10) {
        esrAdjustment = -2;
      } else if (difference >= 7) {
        esrAdjustment = -1;
      }
    }

    return {
      difference,
      isExceptional,
      esrAdjustment,
      threshold: EXCEPTIONAL_ROUND_THRESHOLD,
    };
  }, [values.handicapIndex, values.scoreDifferential]);

  const result = analysis && (
    <div className="space-y-4">
      <Alert variant={analysis.isExceptional ? "destructive" : "default"}>
        {analysis.isExceptional ? (
          <>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Exceptional Score Detected</AlertTitle>
            <AlertDescription>
              This round is {analysis.difference.toFixed(1)} strokes better than your handicap index.
              ESR adjustment: {analysis.esrAdjustment} to handicap index.
            </AlertDescription>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Normal Score</AlertTitle>
            <AlertDescription>
              This round is within the normal range ({analysis.difference.toFixed(1)} strokes {analysis.difference >= 0 ? "better" : "worse"} than handicap).
              No ESR adjustment applies.
            </AlertDescription>
          </>
        )}
      </Alert>

      <div className="flex items-center gap-2">
        <Badge variant={analysis.isExceptional ? "destructive" : "secondary"}>
          {analysis.isExceptional ? "ESR Applies" : "No ESR"}
        </Badge>
        {analysis.esrAdjustment !== 0 && (
          <Badge variant="outline">
            Adjustment: {analysis.esrAdjustment}
          </Badge>
        )}
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        An Exceptional Score is a round with a score differential at least {EXCEPTIONAL_ROUND_THRESHOLD} strokes
        better than your Handicap Index. When this happens, ESR reduces your handicap immediately.
      </Muted>
      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <P className="font-medium">ESR Adjustments:</P>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>7.0 to 9.9 strokes better: -1.0 adjustment</li>
          <li>10.0+ strokes better: -2.0 adjustment</li>
        </ul>
      </div>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="handicapIndex-esr">Handicap Index</Label>
          <Input
            id="handicapIndex-esr"
            type="number"
            step="0.1"
            placeholder="e.g., 12.4"
            value={values.handicapIndex ?? ""}
            onChange={(e) => setValue("handicapIndex", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scoreDifferential-esr">Score Differential</Label>
          <Input
            id="scoreDifferential-esr"
            type="number"
            step="0.1"
            placeholder="e.g., 4.2"
            value={values.scoreDifferential ?? ""}
            onChange={(e) => setValue("scoreDifferential", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm build`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Playing Handicap correctly applies format allowances
- [ ] What-If shows realistic handicap projections
- [ ] ESR calculator correctly identifies exceptional scores (7+ strokes better)
- [ ] Read-only fields show linked values from other calculators

---

## Phase 4: Educational Calculator Components

### Overview
Build Soft/Hard Cap Visualizer, 9-Hole Equivalency, and Strokes Received calculators.

### Changes Required:

#### 1. Handicap Caps Visualizer

**File**: `components/calculators/handicap-caps-calculator.tsx` (new file)

```typescript
"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { Progress } from "@/components/ui/progress";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import { applyHandicapCaps } from "@/lib/handicap";
import { SOFT_CAP_THRESHOLD, HARD_CAP_THRESHOLD } from "@/lib/handicap/constants";

const meta = getCalculatorById("handicap-caps")!;

export function HandicapCapsCalculator() {
  const { values, setValue } = useCalculatorContext();

  const analysis = useMemo(() => {
    if (values.handicapIndex === null || values.lowHandicapIndex === null) {
      return null;
    }

    const uncappedIndex = values.handicapIndex;
    const cappedIndex = applyHandicapCaps(uncappedIndex, values.lowHandicapIndex);
    const difference = uncappedIndex - values.lowHandicapIndex;

    const softCapLimit = values.lowHandicapIndex + SOFT_CAP_THRESHOLD;
    const hardCapLimit = values.lowHandicapIndex + HARD_CAP_THRESHOLD;

    let status: "below" | "soft" | "hard" = "below";
    if (difference > HARD_CAP_THRESHOLD) {
      status = "hard";
    } else if (difference > SOFT_CAP_THRESHOLD) {
      status = "soft";
    }

    // Calculate progress percentage (0-100) within the cap range
    const progressPercent = Math.min(100, (difference / HARD_CAP_THRESHOLD) * 100);

    return {
      uncappedIndex,
      cappedIndex,
      difference,
      softCapLimit,
      hardCapLimit,
      status,
      progressPercent,
      wasReduced: cappedIndex < uncappedIndex,
    };
  }, [values.handicapIndex, values.lowHandicapIndex]);

  const result = analysis && (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <P className="font-medium">Capped Handicap Index:</P>
          {analysis.wasReduced && (
            <Small className="text-amber-600">
              Reduced from {analysis.uncappedIndex.toFixed(1)}
            </Small>
          )}
        </div>
        <span className="text-3xl font-bold text-primary">
          {analysis.cappedIndex.toFixed(1)}
        </span>
      </div>

      {/* Visual cap progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Low HI: {values.lowHandicapIndex?.toFixed(1)}</span>
          <span>Soft Cap (+{SOFT_CAP_THRESHOLD}): {analysis.softCapLimit.toFixed(1)}</span>
          <span>Hard Cap (+{HARD_CAP_THRESHOLD}): {analysis.hardCapLimit.toFixed(1)}</span>
        </div>
        <div className="relative">
          <Progress value={analysis.progressPercent} className="h-3" />
          {/* Soft cap marker */}
          <div
            className="absolute top-0 h-3 w-0.5 bg-amber-500"
            style={{ left: `${(SOFT_CAP_THRESHOLD / HARD_CAP_THRESHOLD) * 100}%` }}
          />
        </div>
        <div className="flex justify-center">
          <span className={`text-sm font-medium ${
            analysis.status === "below" ? "text-green-600" :
            analysis.status === "soft" ? "text-amber-600" : "text-red-600"
          }`}>
            {analysis.status === "below" && "Below soft cap - no reduction"}
            {analysis.status === "soft" && "Soft cap active - 50% reduction on increase"}
            {analysis.status === "hard" && "Hard cap reached - maximum +5.0 from low"}
          </span>
        </div>
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        The cap procedure limits how much your Handicap Index can increase above your
        Low Handicap Index (your lowest index in the past 365 days).
      </Muted>
      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <P className="font-medium">Cap Rules:</P>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li><strong>Soft Cap (+3.0):</strong> Increases above 3.0 are reduced by 50%</li>
          <li><strong>Hard Cap (+5.0):</strong> Maximum increase is capped at 5.0 strokes</li>
        </ul>
      </div>
      {analysis?.wasReduced && (
        <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-sm">
          <P className="font-medium text-amber-800 dark:text-amber-200">
            Your handicap was reduced by {(analysis.uncappedIndex - analysis.cappedIndex).toFixed(1)} strokes
            due to the {analysis.status} cap.
          </P>
        </div>
      )}
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="handicapIndex-caps">Current Handicap Index</Label>
          <Input
            id="handicapIndex-caps"
            type="number"
            step="0.1"
            placeholder="e.g., 15.2"
            value={values.handicapIndex ?? ""}
            onChange={(e) => setValue("handicapIndex", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lowHandicapIndex">Low Handicap Index (365 days)</Label>
          <Input
            id="lowHandicapIndex"
            type="number"
            step="0.1"
            placeholder="e.g., 10.5"
            value={values.lowHandicapIndex ?? ""}
            onChange={(e) => setValue("lowHandicapIndex", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
```

#### 2. 9-Hole Equivalency Calculator

**File**: `components/calculators/nine-hole-calculator.tsx` (new file)

```typescript
"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";
import { calculate9HoleScoreDifferential, calculateExpected9HoleDifferential } from "@/lib/handicap";
import { ArrowRight } from "lucide-react";

const meta = getCalculatorById("nine-hole-equivalency")!;

export function NineHoleCalculator() {
  const { values, setValue } = useCalculatorContext();
  const [nineHoleScore, setNineHoleScore] = useState<number | null>(null);

  // Use values from context, with 9-hole specific overrides
  const nineHoleCourseRating = values.courseRating;
  const nineHoleSlopeRating = values.slopeRating;
  const nineHolePar = values.par;

  const calculation = useMemo(() => {
    if (
      values.handicapIndex === null ||
      nineHoleCourseRating === null ||
      nineHoleSlopeRating === null ||
      nineHolePar === null ||
      nineHoleScore === null
    ) {
      return null;
    }

    // Expected differential for the unplayed 9 holes
    const expectedDifferential = calculateExpected9HoleDifferential(
      values.handicapIndex,
      nineHoleCourseRating,
      nineHoleSlopeRating,
      nineHolePar
    );

    // Played differential
    const playedDifferential = (nineHoleScore - nineHoleCourseRating) * (113 / nineHoleSlopeRating);

    // Combined 18-hole equivalent
    const equivalentDifferential = calculate9HoleScoreDifferential(
      nineHoleScore,
      nineHoleCourseRating,
      nineHoleSlopeRating,
      expectedDifferential
    );

    return {
      playedDifferential: Math.round(playedDifferential * 10) / 10,
      expectedDifferential: Math.round(expectedDifferential * 10) / 10,
      equivalentDifferential,
    };
  }, [values.handicapIndex, nineHoleCourseRating, nineHoleSlopeRating, nineHolePar, nineHoleScore]);

  const result = calculation && (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-muted/50 rounded-lg">
          <Small className="text-muted-foreground">Played 9</Small>
          <P className="text-xl font-bold">{calculation.playedDifferential.toFixed(1)}</P>
        </div>
        <div className="flex items-center justify-center">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <span className="mx-1 text-muted-foreground">+</span>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <Small className="text-muted-foreground">Expected 9</Small>
          <P className="text-xl font-bold">{calculation.expectedDifferential.toFixed(1)}</P>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
        <P className="font-medium">18-Hole Equivalent:</P>
        <span className="text-3xl font-bold text-primary">
          {calculation.equivalentDifferential.toFixed(1)}
        </span>
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        9-hole rounds are converted to 18-hole equivalents by adding:
      </Muted>
      <ol className="list-decimal pl-4 space-y-2 text-sm text-muted-foreground">
        <li>
          <strong>Played 9-hole differential:</strong> Calculated from your actual score
          using the 9-hole course rating and slope
        </li>
        <li>
          <strong>Expected 9-hole differential:</strong> Based on your handicap index,
          estimating what you would score on the unplayed 9 holes
        </li>
      </ol>
      <Muted className="text-xs">
        This ensures 9-hole rounds have appropriate weight in your handicap calculation.
      </Muted>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nineHoleScore">9-Hole Score</Label>
          <Input
            id="nineHoleScore"
            type="number"
            placeholder="e.g., 42"
            value={nineHoleScore ?? ""}
            onChange={(e) => setNineHoleScore(e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="handicapIndex-9hole">Handicap Index</Label>
          <Input
            id="handicapIndex-9hole"
            type="number"
            step="0.1"
            placeholder="e.g., 12.4"
            value={values.handicapIndex ?? ""}
            onChange={(e) => setValue("handicapIndex", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseRating-9hole">9-Hole Course Rating</Label>
          <Input
            id="courseRating-9hole"
            type="number"
            step="0.1"
            placeholder="e.g., 35.2"
            value={values.courseRating ?? ""}
            onChange={(e) => setValue("courseRating", e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slopeRating-9hole">9-Hole Slope Rating</Label>
          <Input
            id="slopeRating-9hole"
            type="number"
            placeholder="e.g., 125"
            value={values.slopeRating ?? ""}
            onChange={(e) => setValue("slopeRating", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="par-9hole">9-Hole Par</Label>
          <Input
            id="par-9hole"
            type="number"
            placeholder="e.g., 36"
            value={values.par ?? ""}
            onChange={(e) => setValue("par", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
      </div>
    </CalculatorCard>
  );
}
```

#### 3. Strokes Received Calculator

**File**: `components/calculators/strokes-received-calculator.tsx` (new file)

```typescript
"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Muted, P, Small } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { CalculatorCard } from "./calculator-card";
import { useCalculatorContext } from "@/contexts/calculatorContext";
import { getCalculatorById } from "@/lib/calculator-registry";

const meta = getCalculatorById("strokes-received")!;

// Default hole handicap allocation (1 = hardest, 18 = easiest)
const DEFAULT_HOLE_HANDICAPS = [1, 11, 5, 15, 3, 13, 7, 17, 9, 2, 12, 6, 16, 4, 14, 8, 18, 10];

export function StrokesReceivedCalculator() {
  const { values, setValue } = useCalculatorContext();
  const [useCustomAllocation, setUseCustomAllocation] = useState(false);
  const [holeHandicaps, setHoleHandicaps] = useState(DEFAULT_HOLE_HANDICAPS);

  const strokesPerHole = useMemo(() => {
    if (values.courseHandicap === null) return [];

    const courseHcp = Math.max(0, values.courseHandicap);
    return holeHandicaps.map((holeHcp) => {
      // Full strokes everyone gets
      const fullStrokes = Math.floor(courseHcp / 18);
      // Extra stroke if hole handicap <= remainder
      const remainder = courseHcp % 18;
      const extraStroke = holeHcp <= remainder ? 1 : 0;
      return fullStrokes + extraStroke;
    });
  }, [values.courseHandicap, holeHandicaps]);

  const totalStrokes = strokesPerHole.reduce((sum, s) => sum + s, 0);

  const result = values.courseHandicap !== null && (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <P className="font-medium">Total Strokes:</P>
        <span className="text-2xl font-bold text-primary">{totalStrokes}</span>
      </div>

      {/* Visual hole grid */}
      <div className="grid grid-cols-9 gap-1 sm:gap-2">
        {/* Front 9 */}
        {strokesPerHole.slice(0, 9).map((strokes, idx) => (
          <div key={idx} className="text-center">
            <Small className="text-muted-foreground">{idx + 1}</Small>
            <div className={`p-1 sm:p-2 rounded ${
              strokes > 0 ? "bg-primary/20" : "bg-muted/50"
            }`}>
              <span className="font-bold text-sm sm:text-base">{strokes}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-9 gap-1 sm:gap-2">
        {/* Back 9 */}
        {strokesPerHole.slice(9).map((strokes, idx) => (
          <div key={idx + 9} className="text-center">
            <Small className="text-muted-foreground">{idx + 10}</Small>
            <div className={`p-1 sm:p-2 rounded ${
              strokes > 0 ? "bg-primary/20" : "bg-muted/50"
            }`}>
              <span className="font-bold text-sm sm:text-base">{strokes}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {strokesPerHole.filter(s => s > 0).length > 0 && (
          <Badge variant="secondary">
            {strokesPerHole.filter(s => s > 0).length} holes with strokes
          </Badge>
        )}
        {strokesPerHole.filter(s => s >= 2).length > 0 && (
          <Badge variant="outline">
            {strokesPerHole.filter(s => s >= 2).length} holes with 2+ strokes
          </Badge>
        )}
      </div>
    </div>
  );

  const explanation = (
    <div className="space-y-3">
      <Muted>
        Handicap strokes are distributed across holes based on their difficulty rating
        (Hole Handicap). Lower hole handicap = harder hole = receives strokes first.
      </Muted>
      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
        <P className="font-medium">Distribution Rules:</P>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>Strokes are distributed one per hole, starting with the hardest (HCP 1)</li>
          <li>After all 18 holes have 1 stroke, distribution continues from HCP 1 again</li>
          <li>Course Handicap of 20 = 2 strokes on HCP 1-2 holes, 1 stroke on others</li>
        </ul>
      </div>
    </div>
  );

  return (
    <CalculatorCard meta={meta} result={result} explanation={explanation}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="courseHandicap-strokes">Course Handicap</Label>
          <Input
            id="courseHandicap-strokes"
            type="number"
            placeholder="e.g., 14"
            value={values.courseHandicap ?? ""}
            onChange={(e) => setValue("courseHandicap", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <Muted className="text-xs">
          Using standard hole handicap allocation. Your course may have a different allocation.
        </Muted>
      </div>
    </CalculatorCard>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm build`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Caps visualizer shows correct soft/hard cap behavior
- [ ] 9-hole calculator produces correct 18-hole equivalents
- [ ] Strokes received correctly distributes strokes by hole handicap
- [ ] All educational calculators have clear explanations

---

## Phase 5: Page Layout & Navigation

### Overview
Build the main calculators page with tabbed categories, responsive grid, and linked values bar.

### Changes Required:

#### 1. Linked Values Bar Component

**File**: `components/calculators/linked-values-bar.tsx` (new file)

```typescript
"use client";

import { useCalculatorContext } from "@/contexts/calculatorContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, RotateCcw } from "lucide-react";

export function LinkedValuesBar() {
  const { values, resetValues } = useCalculatorContext();

  // Only show values that have been set
  const activeValues = [
    values.handicapIndex !== null && { label: "HI", value: values.handicapIndex.toFixed(1) },
    values.courseHandicap !== null && { label: "Course HCP", value: values.courseHandicap.toString() },
    values.scoreDifferential !== null && { label: "Diff", value: values.scoreDifferential.toFixed(1) },
    values.courseRating !== null && { label: "CR", value: values.courseRating.toFixed(1) },
    values.slopeRating !== null && { label: "Slope", value: values.slopeRating.toString() },
  ].filter(Boolean) as { label: string; value: string }[];

  if (activeValues.length === 0) return null;

  return (
    <div className="sticky top-16 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Linked:</span>
            {activeValues.map((item, idx) => (
              <span key={item.label} className="flex items-center gap-1">
                {idx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                <Badge variant="secondary" className="whitespace-nowrap">
                  {item.label}: {item.value}
                </Badge>
              </span>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetValues}
            className="shrink-0"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### 2. Calculator Grid Component

**File**: `components/calculators/calculator-grid.tsx` (new file)

```typescript
"use client";

import { CourseHandicapCalculator } from "./course-handicap-calculator";
import { ScoreDifferentialCalculator } from "./score-differential-calculator";
import { HandicapIndexCalculator } from "./handicap-index-calculator";
import { PlayingHandicapCalculator } from "./playing-handicap-calculator";
import { WhatIfCalculator } from "./what-if-calculator";
import { ExceptionalScoreCalculator } from "./exceptional-score-calculator";
import { HandicapCapsCalculator } from "./handicap-caps-calculator";
import { NineHoleCalculator } from "./nine-hole-calculator";
import { StrokesReceivedCalculator } from "./strokes-received-calculator";

interface CalculatorGridProps {
  category: "core" | "advanced" | "educational";
}

export function CalculatorGrid({ category }: CalculatorGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {category === "core" && (
        <>
          <CourseHandicapCalculator />
          <ScoreDifferentialCalculator />
          <HandicapIndexCalculator />
        </>
      )}
      {category === "advanced" && (
        <>
          <PlayingHandicapCalculator />
          <WhatIfCalculator />
          <ExceptionalScoreCalculator />
        </>
      )}
      {category === "educational" && (
        <>
          <HandicapCapsCalculator />
          <NineHoleCalculator />
          <StrokesReceivedCalculator />
        </>
      )}
    </div>
  );
}
```

#### 3. Main Calculators Page (Refactor)

**File**: `app/calculators/page.tsx` (replace existing)

```typescript
import { createServerComponentClient } from "@/utils/supabase/server";
import { CalculatorsPageClient } from "./client";

export const metadata = {
  title: "Golf Calculators | Handicappin",
  description: "WHS-compliant golf calculators for handicap index, score differential, course handicap, and more.",
};

const CalculatorsPage = async () => {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's handicap index if available
  let userHandicapIndex: number | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profile")
      .select("handicapIndex")
      .eq("id", user.id)
      .single();
    userHandicapIndex = profile?.handicapIndex ?? null;
  }

  return <CalculatorsPageClient userHandicapIndex={userHandicapIndex} />;
};

export default CalculatorsPage;
```

#### 4. Client Component for Calculators Page

**File**: `app/calculators/client.tsx` (new file)

```typescript
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { H1, Muted } from "@/components/ui/typography";
import { CalculatorProvider } from "@/contexts/calculatorContext";
import { LinkedValuesBar } from "@/components/calculators/linked-values-bar";
import { CalculatorGrid } from "@/components/calculators/calculator-grid";
import { Calculator, Lightbulb, GraduationCap } from "lucide-react";

interface CalculatorsPageClientProps {
  userHandicapIndex: number | null;
}

export function CalculatorsPageClient({ userHandicapIndex }: CalculatorsPageClientProps) {
  const [activeTab, setActiveTab] = useState<"core" | "advanced" | "educational">("core");

  return (
    <CalculatorProvider>
      <div className="min-h-screen">
        <LinkedValuesBar />

        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <H1>Golf Calculators</H1>
            <Muted className="max-w-2xl mx-auto">
              WHS-compliant calculators to help you understand your handicap.
              Values automatically link between calculators for seamless calculations.
            </Muted>
          </div>

          {/* Category Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
              <TabsTrigger value="core" className="gap-2">
                <Calculator className="h-4 w-4 hidden sm:block" />
                Core
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2">
                <Lightbulb className="h-4 w-4 hidden sm:block" />
                Advanced
              </TabsTrigger>
              <TabsTrigger value="educational" className="gap-2">
                <GraduationCap className="h-4 w-4 hidden sm:block" />
                Educational
              </TabsTrigger>
            </TabsList>

            <div className="mt-8">
              <TabsContent value="core">
                <CalculatorGrid category="core" />
              </TabsContent>
              <TabsContent value="advanced">
                <CalculatorGrid category="advanced" />
              </TabsContent>
              <TabsContent value="educational">
                <CalculatorGrid category="educational" />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </CalculatorProvider>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [x] Page renders without errors

#### Manual Verification:
- [ ] Tab navigation switches between categories
- [ ] Linked values bar shows active values
- [ ] Reset button clears all values
- [ ] Mobile accordion behavior works (one calculator expanded at a time)
- [ ] Desktop shows grid layout with multiple calculators visible
- [ ] Sticky linked values bar stays visible while scrolling

---

## Phase 6: Polish & Testing

### Overview
Add validation, error states, loading states, accessibility, and tests.

### Changes Required:

#### 1. Input Validation Enhancement

Update calculator components to include:
- Min/max validation for numeric inputs
- Visual feedback for invalid values
- Accessible error messages

#### 2. Unit Tests

**File**: `tests/unit/calculators/calculator-context.test.ts` (new file)

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CalculatorProvider, useCalculatorContext } from "@/contexts/calculatorContext";

describe("CalculatorContext", () => {
  it("should provide default values", () => {
    const { result } = renderHook(() => useCalculatorContext(), {
      wrapper: CalculatorProvider,
    });

    expect(result.current.values.handicapIndex).toBeNull();
    expect(result.current.values.courseHandicap).toBeNull();
    expect(result.current.values.holesPlayed).toBe(18);
  });

  it("should update single value", () => {
    const { result } = renderHook(() => useCalculatorContext(), {
      wrapper: CalculatorProvider,
    });

    act(() => {
      result.current.setValue("handicapIndex", 12.4);
    });

    expect(result.current.values.handicapIndex).toBe(12.4);
  });

  it("should reset all values", () => {
    const { result } = renderHook(() => useCalculatorContext(), {
      wrapper: CalculatorProvider,
    });

    act(() => {
      result.current.setValue("handicapIndex", 12.4);
      result.current.setValue("courseHandicap", 14);
    });

    act(() => {
      result.current.resetValues();
    });

    expect(result.current.values.handicapIndex).toBeNull();
    expect(result.current.values.courseHandicap).toBeNull();
  });
});
```

**File**: `tests/unit/calculators/calculator-registry.test.ts` (new file)

```typescript
import { describe, it, expect } from "vitest";
import {
  CALCULATOR_REGISTRY,
  getCalculatorsByCategory,
  getCalculatorById
} from "@/lib/calculator-registry";

describe("Calculator Registry", () => {
  it("should have all 9 calculators", () => {
    expect(CALCULATOR_REGISTRY).toHaveLength(9);
  });

  it("should have 3 core calculators", () => {
    const core = getCalculatorsByCategory("core");
    expect(core).toHaveLength(3);
    expect(core.map(c => c.id)).toContain("course-handicap");
    expect(core.map(c => c.id)).toContain("score-differential");
    expect(core.map(c => c.id)).toContain("handicap-index");
  });

  it("should have 3 advanced calculators", () => {
    const advanced = getCalculatorsByCategory("advanced");
    expect(advanced).toHaveLength(3);
  });

  it("should have 3 educational calculators", () => {
    const educational = getCalculatorsByCategory("educational");
    expect(educational).toHaveLength(3);
  });

  it("should find calculator by id", () => {
    const calc = getCalculatorById("course-handicap");
    expect(calc).toBeDefined();
    expect(calc?.name).toBe("Course Handicap");
  });

  it("should return undefined for unknown id", () => {
    const calc = getCalculatorById("unknown-calculator");
    expect(calc).toBeUndefined();
  });
});
```

#### 3. Accessibility Improvements

- Add `aria-label` to all input fields
- Add `role="status"` to result displays for screen reader announcements
- Ensure focus management for accordion behavior
- Add keyboard navigation for tabs

#### 4. Documentation Update

Update existing old calculator files to point to new implementation:

**File**: `components/calculators/course-handicap.tsx`
Add deprecation comment and re-export from new file.

### Success Criteria:

#### Automated Verification:
- [ ] All unit tests pass: `pnpm test`
- [x] TypeScript compiles: `pnpm build`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] All calculators produce mathematically correct results
- [ ] Form validation prevents invalid inputs
- [ ] Screen reader announces results correctly
- [ ] Keyboard navigation works throughout
- [ ] Mobile accordion works smoothly
- [ ] Linked values update instantly across calculators
- [ ] Page performs well with all calculators rendered

---

## Testing Strategy

### Unit Tests:
- Calculator context state management
- Calculator registry metadata
- Individual calculation functions (already tested in lib/handicap)
- Value propagation between calculators

### Integration Tests:
- Full page render with all calculators
- Tab navigation between categories
- Value linking across multiple calculators
- Reset functionality

### Manual Testing Steps:
1. Enter handicap index in Core tab → verify it appears in linked bar
2. Switch to Advanced tab → verify handicap index is pre-filled
3. Calculate course handicap → verify it propagates to Playing Handicap
4. Use What-If calculator → verify projections are reasonable
5. Test on mobile device → verify accordion behavior
6. Test with keyboard only → verify full accessibility
7. Check all USGA links → verify they open correct pages

---

## Performance Considerations

- Use `useMemo` for all calculation results to prevent unnecessary recalculation
- Lazy load calculator components if bundle size becomes an issue
- Consider virtualization if more calculators are added
- Keep context updates minimal (individual field updates, not full object replacement)

---

## Migration Notes

- Old calculator components (`course-handicap.tsx`, `score-differential.tsx`) can be kept for backwards compatibility but should be deprecated
- No database migrations required
- No API changes required

---

## References

- Existing context pattern: `contexts/roundCalculationContext.tsx`
- Existing calculation display: `components/round/calculation/ScoreDiffCalculationDisplay.tsx`
- Core calculation functions: `lib/handicap/calculations.ts`
- UI components: `components/ui/`
- USGA Rules of Handicapping: https://www.usga.org/handicapping/roh/Content/rules/Rules%20TOC.htm
