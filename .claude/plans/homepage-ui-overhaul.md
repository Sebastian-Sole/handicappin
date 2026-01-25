# Authenticated Homepage UI Overhaul - Implementation Plan

## Overview

Redesign the authenticated homepage to provide a premium sports app experience (inspired by Strava/Whoop), with improved statistics display, mobile-optimized charts, a recent activity feed, and enhanced UX throughout. The goal is to create a visually striking, data-rich experience that keeps users engaged and makes their golf performance data feel premium.

## Current State Analysis

### Existing Components:
- **`app/page.tsx`** - Entry point, routes to `Landing` or `HomePage` based on auth
- **`components/homepage/home-page.tsx`** - Main authenticated homepage container
- **`components/homepage/hero.tsx`** - Hero section with greeting and 4 StatBox cards
- **`components/homepage/statBox.tsx`** - Individual stat card (basic design)
- **`components/charts/lazy-handicap-trend-chart-display.tsx`** - Lazy-loaded trend chart
- **`components/charts/lazy-score-bar-chart-display.tsx`** - Lazy-loaded score chart
- **`components/loading/homepage-skeleton.tsx`** - Loading skeleton

### Key Issues:
1. Charts completely hidden on mobile (just shows "Go to Dashboard" button)
2. StatBox cards are functional but lack visual impact
3. No activity feed or timeline view of recent rounds
4. Limited statistics beyond the basic 4 metrics
5. No micro-interactions or premium feel
6. Hero section layout is basic and doesn't highlight the handicap index prominently

### Data Available (from tRPC):
- `api.round.getAllByUserId` - Last 20 rounds with full data
- `api.round.getBestRound` - Best round details
- `api.course.getCourseById` - Course information
- `api.tee.getTeeById` - Tee information
- Profile data: handicapIndex, name, createdAt, id

## Desired End State

After implementation, the authenticated homepage will feature:

1. **Prominent Handicap Display** - Large, animated handicap index with trend indicator
2. **Redesigned Stat Cards** - 4 cards with sparklines and improved visual hierarchy
3. **Mobile Charts** - Simplified charts visible on all screen sizes
4. **Activity Feed** - Timeline of recent rounds with milestones
5. **Quick Actions** - Clear CTAs for primary user actions
6. **Premium Feel** - Micro-interactions, smooth transitions, polished design

### Verification:
- Visual inspection on mobile (375px), tablet (768px), and desktop (1280px+)
- All charts render on mobile devices
- Activity feed shows last 5-10 rounds with correct data
- Page load performance remains under 3 seconds
- No TypeScript errors, linting passes, build succeeds

## What We're NOT Doing

- Landing page redesign (unauthenticated users)
- Dashboard page changes (separate from homepage)
- New API endpoints or database changes
- Authentication flow changes
- Chart library replacement (keeping Recharts)
- Complete color scheme overhaul

## Implementation Approach

We'll take a component-first approach, building new UI components that can be composed into the homepage. This allows for incremental testing and rollback if needed. Mobile-first design ensures the experience works on all devices.

---

## Phase 1: Hero Section Redesign

### Overview

Redesign the hero section to prominently feature the handicap index with a premium, Whoop-inspired design. Create a new layout that emphasizes the user's current handicap as the focal point.

### Changes Required:

#### 1. Create New Handicap Display Component

**File**: `components/homepage/handicap-display.tsx`
**Purpose**: Large, prominent handicap index display with trend indicator

```tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface HandicapDisplayProps {
  handicapIndex: number;
  previousHandicapIndex?: number;
  className?: string;
}

export function HandicapDisplay({
  handicapIndex,
  previousHandicapIndex,
  className,
}: HandicapDisplayProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // Animate the number on mount
  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const increment = handicapIndex / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= handicapIndex) {
        setDisplayValue(handicapIndex);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(current * 10) / 10);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [handicapIndex]);

  const change = previousHandicapIndex
    ? handicapIndex - previousHandicapIndex
    : 0;

  const changePercent = previousHandicapIndex
    ? ((change / previousHandicapIndex) * 100).toFixed(1)
    : "0";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Handicap Index
      </p>
      <div className="relative">
        <span className="text-6xl md:text-7xl lg:text-8xl font-bold text-foreground tabular-nums">
          {displayValue.toFixed(1)}
        </span>
      </div>
      {previousHandicapIndex && change !== 0 && (
        <div className={cn(
          "flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-sm font-medium",
          change < 0
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
        )}>
          {change < 0 ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
          <span>{Math.abs(Number(changePercent))}% from first round</span>
        </div>
      )}
    </div>
  );
}
```

#### 2. Redesign StatBox Component

**File**: `components/homepage/stat-card.tsx`
**Purpose**: Enhanced stat card with sparkline support and better visual hierarchy

```tsx
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  sparklineData?: number[];
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  sparklineData,
  className,
}: StatCardProps) {
  return (
    <Card className={cn(
      "p-4 md:p-5 transition-all duration-200 hover:shadow-md",
      "bg-card/50 backdrop-blur-sm border-border/50",
      className
    )}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        {icon && (
          <div className="text-primary/60">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {trend && trendValue && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md",
            trend === "down" && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
            trend === "up" && "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
            trend === "neutral" && "text-muted-foreground bg-muted"
          )}>
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "neutral" && <Minus className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3 h-8">
          <MiniSparkline data={sparklineData} trend={trend} />
        </div>
      )}
    </Card>
  );
}

// Simple SVG sparkline component
function MiniSparkline({
  data,
  trend
}: {
  data: number[];
  trend?: "up" | "down" | "neutral"
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 100;
  const height = 32;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  const strokeColor = trend === "down"
    ? "stroke-green-500"
    : trend === "up"
      ? "stroke-red-500"
      : "stroke-primary";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        className={cn("stroke-2", strokeColor)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

#### 3. Update Hero Component

**File**: `components/homepage/hero.tsx`
**Changes**: Restructure layout to feature HandicapDisplay prominently, use new StatCard

```tsx
import { Button } from "@/components/ui/button";
import { Tables } from "@/types/supabase";
import { ChevronRight, BarChart2, TrendingDown, Award, Target } from "lucide-react";
import Link from "next/link";
import { HandicapDisplay } from "./handicap-display";
import { StatCard } from "./stat-card";

interface HeroProps {
  profile: Tables<"profile">;
  previousScores: number[];
  previousHandicaps: number[];
  bestRound: Tables<"round"> | null;
  bestRoundTee: Tables<"teeInfo"> | null;
  bestRoundCourseName: string | undefined;
  handicapPercentageChange: number;
}

const Hero = ({
  profile,
  previousScores,
  previousHandicaps,
  bestRound,
  bestRoundTee,
  bestRoundCourseName,
  handicapPercentageChange,
}: HeroProps) => {
  const hasPlayedAnyRounds = previousScores.length > 0;
  const firstHandicap = previousHandicaps.length > 0 ? previousHandicaps[0] : undefined;

  const calculatePlusMinusScore = (): string => {
    if (!bestRound || !bestRoundTee) return "—";
    const calculatedScore = bestRound.adjustedGrossScore - bestRoundTee.totalPar;
    return calculatedScore > 0 ? `+${calculatedScore}` : calculatedScore.toString();
  };

  const calculateAverageScore = (): string => {
    if (previousScores.length === 0) return "—";
    return (previousScores.reduce((a, b) => a + b, 0) / previousScores.length).toFixed(1);
  };

  const getAverageScoreTrend = (): "up" | "down" | "neutral" => {
    if (previousScores.length < 4) return "neutral";
    const halfLength = Math.floor(previousScores.length / 2);
    const firstHalf = previousScores.slice(0, halfLength);
    const secondHalf = previousScores.slice(halfLength);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    if (secondAvg < firstAvg - 0.5) return "down";
    if (secondAvg > firstAvg + 0.5) return "up";
    return "neutral";
  };

  return (
    <section className="w-full py-6 md:py-10 lg:py-12">
      <div className="container px-4 lg:px-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">
            Welcome back, {profile.name?.split(" ")[0] || "Golfer"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Member since {new Date(profile.createdAt).getFullYear()}
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] lg:gap-10">
          {/* Left: Handicap Display + CTAs */}
          <div className="flex flex-col items-center lg:items-start space-y-6">
            <HandicapDisplay
              handicapIndex={profile.handicapIndex}
              previousHandicapIndex={firstHandicap}
              className="py-6"
            />

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              <Link href="/rounds/add" className="flex-1">
                <Button size="lg" className="w-full">
                  Log Round
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/dashboard/${profile.id}`} className="flex-1">
                <Button size="lg" variant="outline" className="w-full">
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Stat Cards Grid */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <StatCard
              title="Avg Differential"
              value={calculateAverageScore()}
              subtitle="Last 10 rounds"
              trend={getAverageScoreTrend()}
              trendValue={getAverageScoreTrend() === "neutral" ? "Stable" : getAverageScoreTrend() === "down" ? "Improving" : "Increasing"}
              icon={<TrendingDown className="h-5 w-5" />}
              sparklineData={previousScores.slice(-10)}
            />
            <StatCard
              title="Best Round"
              value={calculatePlusMinusScore()}
              subtitle={bestRoundCourseName || "No rounds yet"}
              icon={<Award className="h-5 w-5" />}
            />
            <StatCard
              title="Rounds Played"
              value={previousScores.length}
              subtitle={previousScores.length < 20 ? `${20 - previousScores.length} to full index` : "Full index active"}
              icon={<Target className="h-5 w-5" />}
            />
            <StatCard
              title="Handicap Trend"
              value={handicapPercentageChange === 0 ? "—" : `${handicapPercentageChange > 0 ? "+" : ""}${(handicapPercentageChange * 100).toFixed(0)}%`}
              subtitle="Since first round"
              trend={handicapPercentageChange < 0 ? "down" : handicapPercentageChange > 0 ? "up" : "neutral"}
              trendValue={handicapPercentageChange < 0 ? "Improving" : handicapPercentageChange > 0 ? "Rising" : "Stable"}
              icon={<BarChart2 className="h-5 w-5" />}
              sparklineData={previousHandicaps.slice(-10)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [ ] No console errors in development

#### Manual Verification:
- [ ] Handicap index animates on page load
- [ ] Stat cards display correct data from API
- [ ] Sparklines render correctly with trend colors
- [ ] Layout works on mobile (375px), tablet (768px), desktop (1280px+)
- [ ] Dark mode colors are appropriate

---

## Phase 2: Mobile-First Charts

### Overview

Create simplified chart components that work on all screen sizes, replacing the current mobile behavior of hiding charts entirely.

### Changes Required:

#### 1. Create Mobile-Friendly Mini Chart Component

**File**: `components/charts/mini-chart.tsx`
**Purpose**: Compact chart for mobile/constrained spaces

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MiniChartProps {
  title: string;
  data: { value: number; label: string; highlighted?: boolean }[];
  className?: string;
  showLabels?: boolean;
}

export function MiniBarChart({
  title,
  data,
  className,
  showLabels = false
}: MiniChartProps) {
  if (data.length === 0) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Play 5+ rounds to see chart
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-1 h-20">
          {data.map((item, index) => {
            const height = ((item.value - minValue) / range) * 100;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className={cn(
                    "w-full rounded-t transition-all duration-300",
                    item.highlighted
                      ? "bg-primary"
                      : "bg-muted-foreground/20"
                  )}
                  style={{ height: `${Math.max(height, 10)}%` }}
                />
                {showLabels && (
                  <span className="text-[10px] text-muted-foreground">
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function MiniLineChart({
  title,
  data,
  className
}: MiniChartProps) {
  if (data.length < 2) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Play 5+ rounds to see trend
          </p>
        </CardContent>
      </Card>
    );
  }

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 200;
  const height = 60;
  const padding = 4;

  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((item.value - min) / range) * (height - padding * 2);
    return { x, y, value: item.value };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Determine trend for color
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const isImproving = lastValue < firstValue;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className={cn(
          "text-sm font-medium",
          isImproving ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )}>
          {lastValue.toFixed(1)}
        </span>
      </CardHeader>
      <CardContent className="pt-0">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-16"
          preserveAspectRatio="none"
        >
          {/* Gradient fill under line */}
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                className={isImproving ? "stop-green-500/20" : "stop-primary/20"}
                stopColor={isImproving ? "rgb(34 197 94 / 0.2)" : "var(--primary)"}
                stopOpacity="0.2"
              />
              <stop
                offset="100%"
                stopColor="transparent"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {/* Fill area */}
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
            fill="url(#chartGradient)"
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            className={cn(
              "stroke-2",
              isImproving ? "stroke-green-500" : "stroke-primary"
            )}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* End point dot */}
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3"
            className={cn(
              isImproving ? "fill-green-500" : "fill-primary"
            )}
          />
        </svg>
      </CardContent>
    </Card>
  );
}
```

#### 2. Update Homepage Charts Section

**File**: `components/homepage/home-page.tsx`
**Changes**: Show simplified charts on mobile, full charts on desktop

The updated component will:
- Show `MiniLineChart` and `MiniBarChart` on mobile (< md breakpoint)
- Show existing full charts on desktop (>= md breakpoint)
- Remove the "Go to Dashboard" button replacement

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Mini charts render on mobile (375px width)
- [ ] Full charts render on desktop (1280px+)
- [ ] Charts handle empty/insufficient data gracefully
- [ ] Trend colors (green for improvement) are correct
- [ ] Touch interactions work on mobile

---

## Phase 3: Recent Activity Feed

### Overview

Create a new Activity Feed component that shows recent rounds in a timeline format, with visual indicators for milestones and achievements.

### Changes Required:

#### 1. Create Activity Feed Component

**File**: `components/homepage/activity-feed.tsx`
**Purpose**: Timeline view of recent golf rounds

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tables } from "@/types/supabase";
import {
  Trophy,
  TrendingDown,
  TrendingUp,
  Calendar,
  MapPin,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: number;
  date: Date;
  courseName: string;
  score: number;
  scoreDifferential: number;
  handicapAfter: number;
  handicapChange: number;
  isPersonalBest: boolean;
  isMilestone?: string; // e.g., "10th round", "First round under 80"
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No rounds logged yet. Start your golf journey!
            </p>
            <Link href="/rounds/add">
              <Button>Log Your First Round</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          View All
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {activities.slice(0, 5).map((activity, index) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              isLast={index === activities.length - 1 || index === 4}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({
  activity,
  isLast
}: {
  activity: ActivityItem;
  isLast: boolean;
}) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(activity.date);

  return (
    <Link href={`/rounds/${activity.id}/calculation`}>
      <div className={cn(
        "flex items-start gap-3 p-3 -mx-3 rounded-lg",
        "hover:bg-accent/50 transition-colors cursor-pointer",
        "group"
      )}>
        {/* Timeline indicator */}
        <div className="flex flex-col items-center">
          <div className={cn(
            "w-2 h-2 rounded-full mt-2",
            activity.isPersonalBest ? "bg-yellow-500" : "bg-primary"
          )} />
          {!isLast && (
            <div className="w-px h-full bg-border flex-1 mt-1" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm truncate">
                {activity.courseName}
              </span>
              {activity.isPersonalBest && (
                <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs">
                  <Trophy className="h-3 w-3 mr-1" />
                  Best
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formattedDate}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-1 text-sm">
            <span className="text-muted-foreground">
              Score: <span className="text-foreground font-medium">{activity.score}</span>
            </span>
            <span className="text-muted-foreground">
              Diff: <span className="text-foreground font-medium">{activity.scoreDifferential.toFixed(1)}</span>
            </span>
            {activity.handicapChange !== 0 && (
              <span className={cn(
                "flex items-center gap-0.5",
                activity.handicapChange < 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}>
                {activity.handicapChange < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <TrendingUp className="h-3 w-3" />
                )}
                <span className="text-xs font-medium">
                  {activity.handicapChange > 0 ? "+" : ""}{activity.handicapChange.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          {activity.isMilestone && (
            <Badge variant="outline" className="mt-2 text-xs">
              {activity.isMilestone}
            </Badge>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-2" />
      </div>
    </Link>
  );
}
```

#### 2. Create Activity Data Transformer

**File**: `utils/activity-transform.ts`
**Purpose**: Transform round data into activity feed format

```typescript
import { Tables } from "@/types/supabase";

interface ActivityItem {
  id: number;
  date: Date;
  courseName: string;
  score: number;
  scoreDifferential: number;
  handicapAfter: number;
  handicapChange: number;
  isPersonalBest: boolean;
  isMilestone?: string;
}

export function transformRoundsToActivities(
  rounds: Tables<"round">[],
  courses: Map<string, string>, // courseId -> courseName
): ActivityItem[] {
  // Sort by date descending (most recent first)
  const sortedRounds = [...rounds].sort(
    (a, b) => new Date(b.teeTime).getTime() - new Date(a.teeTime).getTime()
  );

  // Track personal best differential
  let bestDifferential = Infinity;
  const activities: ActivityItem[] = [];

  // Process in chronological order to determine personal bests
  const chronologicalRounds = [...sortedRounds].reverse();
  const personalBestIds = new Set<number>();

  chronologicalRounds.forEach((round) => {
    if (round.scoreDifferential < bestDifferential) {
      bestDifferential = round.scoreDifferential;
      personalBestIds.add(round.id);
    }
  });

  // Build activity items (in reverse chronological order for display)
  sortedRounds.forEach((round, index) => {
    const previousRound = sortedRounds[index + 1];
    const handicapChange = previousRound
      ? round.updatedHandicapIndex - previousRound.updatedHandicapIndex
      : 0;

    // Determine milestones
    let milestone: string | undefined;
    const roundNumber = rounds.length - index;
    if (roundNumber === 1) {
      milestone = "First round!";
    } else if (roundNumber === 10) {
      milestone = "10th round";
    } else if (roundNumber === 20) {
      milestone = "Full handicap index";
    } else if (roundNumber === 50) {
      milestone = "50th round";
    } else if (roundNumber === 100) {
      milestone = "100th round";
    }

    activities.push({
      id: round.id,
      date: new Date(round.teeTime),
      courseName: courses.get(round.courseId) || "Unknown Course",
      score: round.adjustedGrossScore,
      scoreDifferential: round.scoreDifferential,
      handicapAfter: round.updatedHandicapIndex,
      handicapChange,
      isPersonalBest: personalBestIds.has(round.id),
      isMilestone: milestone,
    });
  });

  return activities;
}
```

#### 3. Integrate Activity Feed into Homepage

**File**: `components/homepage/home-page.tsx`
**Changes**: Add ActivityFeed component below charts section

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Activity feed shows last 5 rounds correctly
- [ ] Personal best badge appears on best differential round
- [ ] Milestone badges appear for round 1, 10, 20, 50, 100
- [ ] Clicking an activity item navigates to round calculation page
- [ ] Empty state displays correctly for new users
- [ ] Handicap change indicators show correct direction/color

---

## Phase 4: Quick Actions & Additional Stats

### Overview

Add a prominent Quick Actions section and additional statistics to provide more value to users.

### Changes Required:

#### 1. Create Quick Actions Component

**File**: `components/homepage/quick-actions.tsx`
**Purpose**: Prominent action buttons for common tasks

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PlusCircle,
  LayoutDashboard,
  Calculator,
  Settings,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  userId: string;
  className?: string;
}

export function QuickActions({ userId, className }: QuickActionsProps) {
  const actions = [
    {
      label: "Log Round",
      href: "/rounds/add",
      icon: PlusCircle,
      primary: true,
    },
    {
      label: "Dashboard",
      href: `/dashboard/${userId}`,
      icon: LayoutDashboard,
    },
    {
      label: "Calculators",
      href: "/calculators",
      icon: Calculator,
    },
    {
      label: "Profile",
      href: `/profile/${userId}`,
      icon: Settings,
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
      {actions.map((action) => (
        <Link key={action.href} href={action.href}>
          <Card className={cn(
            "p-4 flex flex-col items-center justify-center gap-2 h-full",
            "hover:bg-accent/50 transition-colors cursor-pointer",
            action.primary && "bg-primary/5 border-primary/20"
          )}>
            <action.icon className={cn(
              "h-6 w-6",
              action.primary ? "text-primary" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-sm font-medium",
              action.primary ? "text-primary" : "text-foreground"
            )}>
              {action.label}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
```

#### 2. Create Goals/Progress Component (Optional Enhancement)

**File**: `components/homepage/handicap-goal.tsx`
**Purpose**: Show progress toward handicap goals (if user sets one)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface HandicapGoalProps {
  currentHandicap: number;
  startingHandicap: number;
  className?: string;
}

export function HandicapGoal({
  currentHandicap,
  startingHandicap,
  className
}: HandicapGoalProps) {
  // Calculate progress from starting handicap toward scratch (0)
  // This is a simple "journey to scratch" visualization
  const progress = startingHandicap > 0
    ? Math.max(0, Math.min(100, ((startingHandicap - currentHandicap) / startingHandicap) * 100))
    : 0;

  const improvement = startingHandicap - currentHandicap;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Journey to Scratch
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Start: {startingHandicap.toFixed(1)}</span>
            <span className="font-medium text-foreground">
              {improvement >= 0 ? `${improvement.toFixed(1)} improved` : `${Math.abs(improvement).toFixed(1)} to go`}
            </span>
            <span>Goal: 0.0</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Quick actions grid displays correctly on all screen sizes
- [ ] All action links navigate to correct pages
- [ ] Primary action (Log Round) is visually distinct
- [ ] Touch targets are appropriately sized on mobile (min 44px)

---

## Phase 5: Integration & Polish

### Overview

Integrate all new components into the homepage, add loading states, transitions, and ensure overall polish.

### Changes Required:

#### 1. Update Main Homepage Component

**File**: `components/homepage/home-page.tsx`
**Purpose**: Integrate all new components with proper layout

```tsx
import { Tables } from "@/types/supabase";
import { api } from "@/trpc/server";
import Hero from "./hero";
import { ActivityFeed } from "./activity-feed";
import { QuickActions } from "./quick-actions";
import { MiniLineChart, MiniBarChart } from "../charts/mini-chart";
import HandicapTrendChartDisplay from "../charts/lazy-handicap-trend-chart-display";
import ScoreBarChartDisplay from "../charts/lazy-score-bar-chart-display";
import { getRelevantRounds } from "@/lib/handicap";
import { transformRoundsToActivities } from "@/utils/activity-transform";

interface HomepageProps {
  profile: Tables<"profile">;
}

export const HomePage = async ({ profile }: HomepageProps) => {
  const { id, handicapIndex } = profile;

  // Fetch all data in parallel
  const [rounds, bestRound] = await Promise.all([
    api.round.getAllByUserId({ userId: id, amount: 20 }),
    api.round.getBestRound({ userId: id }),
  ]);

  // Process data for charts and activity feed
  const sortedRounds = [...rounds].sort((a, b) => {
    const timeComparison = new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime();
    if (timeComparison !== 0) return timeComparison;
    return a.id - b.id;
  });

  const relevantRoundsList = getRelevantRounds(sortedRounds);

  const previousHandicaps = sortedRounds.slice(-10).map((round) => ({
    key: `${round.id}`,
    roundDate: new Date(round.teeTime).toLocaleDateString(),
    roundTime: new Date(round.teeTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    handicap: round.updatedHandicapIndex,
  }));

  const previousScores = sortedRounds.slice(-10).map((round) => ({
    key: `${round.id}`,
    roundDate: new Date(round.teeTime).toLocaleDateString(),
    roundTime: new Date(round.teeTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    score: round.scoreDifferential,
    influencesHcp: relevantRoundsList.includes(round),
  }));

  const percentageChange = previousHandicaps.length > 0
    ? Number(((handicapIndex - previousHandicaps[0].handicap) / previousHandicaps[0].handicap).toFixed(2))
    : 0;

  // Fetch course info for best round and activity feed
  let bestRoundCourse: Tables<"course"> | null = null;
  let bestRoundTee: Tables<"teeInfo"> | null = null;
  const courseMap = new Map<string, string>();

  if (bestRound) {
    // Fetch course data
    const courseIds = [...new Set(rounds.map(r => r.courseId))];
    const courses = await Promise.all(
      courseIds.map(id => api.course.getCourseById({ courseId: id }))
    );
    courses.forEach((course, i) => {
      if (course) courseMap.set(courseIds[i], course.name);
    });

    [bestRoundCourse, bestRoundTee] = await Promise.all([
      api.course.getCourseById({ courseId: bestRound.courseId }),
      api.tee.getTeeById({ teeId: bestRound.teeId }),
    ]);
  }

  // Transform data for activity feed
  const activities = transformRoundsToActivities(rounds, courseMap);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full bg-gradient-to-b from-primary/5 to-background">
          <Hero
            profile={profile}
            previousScores={previousScores.map(s => s.score)}
            previousHandicaps={previousHandicaps.map(h => h.handicap)}
            bestRound={bestRound}
            bestRoundTee={bestRoundTee}
            bestRoundCourseName={bestRoundCourse?.name}
            handicapPercentageChange={percentageChange}
          />
        </section>

        {/* Charts Section */}
        <section className="w-full py-8 lg:py-12">
          <div className="container px-4 lg:px-6">
            <h2 className="text-xl font-semibold mb-6">Performance Analytics</h2>

            {/* Mobile: Mini charts */}
            <div className="grid grid-cols-2 gap-4 md:hidden">
              <MiniLineChart
                title="Handicap Trend"
                data={previousHandicaps.map(h => ({
                  value: h.handicap,
                  label: h.roundDate,
                }))}
              />
              <MiniBarChart
                title="Score Differential"
                data={previousScores.map(s => ({
                  value: s.score,
                  label: s.roundDate,
                  highlighted: s.influencesHcp,
                }))}
              />
            </div>

            {/* Desktop: Full charts */}
            <div className="hidden md:grid gap-6 xl:grid-cols-2">
              <HandicapTrendChartDisplay
                handicapIndex={handicapIndex}
                percentageChange={percentageChange}
                previousHandicaps={previousHandicaps}
                profile={profile}
              />
              <ScoreBarChartDisplay
                previousScores={previousScores}
                profile={profile}
              />
            </div>
          </div>
        </section>

        {/* Activity Feed Section */}
        <section className="w-full py-8 lg:py-12 bg-muted/30">
          <div className="container px-4 lg:px-6">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <ActivityFeed activities={activities} />
              <div className="space-y-6">
                <QuickActions userId={profile.id} className="lg:grid-cols-2" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
```

#### 2. Update Loading Skeleton

**File**: `components/loading/homepage-skeleton.tsx`
**Purpose**: Match new design with appropriate skeleton structure

Update to reflect the new layout with:
- Hero section with large handicap display skeleton
- Stat cards grid skeleton
- Charts section skeleton
- Activity feed skeleton

#### 3. Add Subtle Animations

**File**: `app/globals.css`
**Add**: CSS animations for premium feel

```css
/* Add to globals.css */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out forwards;
}

.animation-delay-100 { animation-delay: 100ms; }
.animation-delay-200 { animation-delay: 200ms; }
.animation-delay-300 { animation-delay: 300ms; }
.animation-delay-400 { animation-delay: 400ms; }
```

### Success Criteria:

#### Automated Verification:
- [x] Full build passes: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [x] Type checking passes: `pnpm tsc --noEmit`

#### Manual Verification:
- [ ] Page loads correctly with all sections visible
- [ ] Layout is correct on mobile (375px), tablet (768px), desktop (1280px+)
- [ ] All data displays correctly from API
- [ ] Loading skeleton matches new design
- [ ] Animations are smooth and not jarring
- [ ] Dark mode works correctly throughout
- [ ] Page performance is acceptable (< 3s load time)
- [ ] No console errors or warnings
- [ ] All links navigate correctly
- [ ] Touch interactions work on mobile

---

## Testing Strategy

### Unit Tests:
- Test `transformRoundsToActivities` utility function
- Test sparkline data generation
- Test trend calculation functions

### Integration Tests:
- Test homepage renders with mock profile data
- Test activity feed renders correctly with various data states
- Test chart components handle edge cases (empty data, single data point)

### Manual Testing Steps:
1. Log in as a user with 0 rounds - verify empty states
2. Log in as a user with 5-10 rounds - verify charts appear
3. Log in as a user with 20+ rounds - verify full functionality
4. Test on iPhone SE (375px width) - verify mobile layout
5. Test on iPad (768px width) - verify tablet layout
6. Test on desktop (1280px+) - verify full desktop experience
7. Toggle dark mode - verify all colors are appropriate
8. Check page load performance in Chrome DevTools

## Performance Considerations

1. **Lazy load charts** - Already implemented, keep this pattern
2. **Limit activity feed** - Only show 5 items on homepage, link to full list
3. **Optimize course lookups** - Batch course API calls with Promise.all
4. **Use CSS animations** - Prefer CSS over JS for animations
5. **Skeleton loading** - Ensure skeleton matches final layout to prevent layout shift

## References

- Design inspiration: Strava, Whoop, Nike Run Club
- Current homepage: `components/homepage/home-page.tsx`
- Chart components: `components/charts/`
- Color system: `app/globals.css` (OKLCH variables)
- UI components: `components/ui/` (shadcn/ui)
