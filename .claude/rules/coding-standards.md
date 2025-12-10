---
alwaysApply: true
---

# Coding Standards & Rules

## 🎯 **Core Mission**

Build a customer-facing golf SaaS application that provides comprehensive handicap tracking, round management, and USGA-compliant calculations. The application offers transparent handicap calculations with detailed explanations, interactive scorecards, performance analytics, and subscription-based premium features for golfers of all skill levels.

## 🚫 **What NOT to Change**

### **Core Architecture (Locked)**

- **Next.js 15.5.7** with App Router - Do not downgrade or switch to Pages Router
- **React 19.2.1** with TypeScript - Do not downgrade React version
- **Tailwind CSS 4.1.12** - Do not replace with other CSS frameworks
- **Supabase Auth** with PostgreSQL RLS - Do not replace authentication system
- **tRPC 11.5.0** for type-safe API - Do not replace with REST or GraphQL
- **Drizzle ORM 0.44.5** for database - Keep PostgreSQL schema management
- **Stripe 20.0.0** for payments - Keep webhook-based subscription management
- **Vitest 3.2.4** for testing - Do not switch to Jest
- **pnpm** as package manager - Do not switch to npm or yarn

### **File Structure**

```
/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth route group (sign-in, sign-up)
│   ├── api/               # API routes (tRPC, Stripe webhooks, cron)
│   ├── billing/           # Subscription management pages
│   ├── calculators/       # Handicap calculator tools (premium)
│   ├── dashboard/         # Main user dashboard (premium)
│   ├── onboarding/        # New user onboarding flow
│   ├── profile/           # User profile settings
│   ├── rounds/            # Round management and history
│   ├── upgrade/           # Plan selection and upgrade
│   └── layout.tsx         # Root layout with providers
├── components/
│   ├── billing/           # Billing and subscription components
│   ├── dashboard/         # Dashboard widgets and charts
│   ├── forms/             # Form components (round entry, course search)
│   ├── golf/              # Golf-specific components (scorecards, calculators)
│   ├── layout/            # Layout components (header, navigation)
│   └── ui/                # shadcn/ui primitives (Radix + Tailwind)
├── server/
│   └── api/               # tRPC backend
│       ├── routers/       # Domain routers (auth, round, stripe, etc.)
│       ├── root.ts        # Main router aggregator
│       └── trpc.ts        # tRPC context and procedures
├── lib/
│   ├── stripe.ts          # Stripe integration (checkout, portal, webhooks)
│   ├── stripe-customer.ts # Customer creation and lookup
│   ├── stripe-security.ts # Customer ownership verification
│   ├── email-service.ts   # Resend email integration
│   └── logging.ts         # Structured logging utilities
├── utils/
│   ├── billing/           # Billing logic (access control, entitlements)
│   ├── calculations/      # USGA handicap calculation algorithms
│   └── supabase/          # Supabase client creation and JWT parsing
├── db/
│   └── schema.ts          # Drizzle ORM schema (DO NOT manually edit migrations)
├── emails/                # React Email templates
├── types/
│   └── supabase.ts        # Generated Supabase types (auto-generated)
└── tests/                 # Vitest tests
    ├── unit/              # Unit tests
    └── integration/       # Integration tests
```

### **Essential Type Definitions**

```typescript
// DO NOT REMOVE - Core database types from schema.ts
export type Profile = {
  id: string;
  email: string;
  handicapIndex: number | null;
  planSelected: "free" | "premium" | "unlimited" | "lifetime" | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: bigint | null;
  cancelAtPeriodEnd: boolean;
  billingVersion: number;
};

export type Round = {
  id: string;
  userId: string;
  courseId: string;
  teeId: string;
  playedAt: Date;
  adjustedGrossScore: number;
  scoreDifferential: number;
  courseRating: number;
  slopeRating: number;
};

export type Course = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
};

// Supabase Auth types
export type User = Database["public"]["Tables"]["profile"]["Row"];

// Stripe integration types
export type SubscriptionPlan = "free" | "premium" | "unlimited" | "lifetime";
```

## ✅ **What TO Implement**

### **MVP Features**

- Golf handicap tracking with USGA-compliant calculations
- Interactive scorecard entry for 18-hole and 9-hole rounds
- User dashboard with handicap progression and round history
- Course and tee database with search functionality
- Responsive design for desktop, tablet, and mobile
- Real-time billing status updates via Supabase Realtime
- User authentication via Supabase Auth
- Subscription management with Stripe integration
- Route-based navigation with proper loading states and premium protection

### **Integration Requirements**

- tRPC for type-safe API communication (client ↔ server)
- Supabase for PostgreSQL database, authentication, and realtime
- Drizzle ORM for database schema management and migrations
- Stripe for payment processing and subscription management
- Tailwind CSS 4 for styling with shadcn/ui components
- Comprehensive testing with Vitest (unit & integration)
- Upstash Redis for rate limiting on API endpoints
- Resend for transactional email delivery
- Sentry for error tracking and performance monitoring

## 📋 **Coding Conventions**

### **TypeScript Standards**

```typescript
// Use explicit types for all props and API responses
interface ComponentProps {
  rounds: Round[];
  onRoundSelect?: (id: string) => void;
  className?: string;
}

// Use proper error handling with typed errors
const fetchUserRounds = async (userId: string): Promise<Round[] | null> => {
  try {
    const rounds = await api.round.getUserRounds.query({ userId });
    return rounds;
  } catch (error) {
    console.error("Failed to fetch rounds:", error);
    return null;
  }
};

// Use Zod for runtime validation (tRPC input/output schemas)
import { z } from "zod";

const createRoundSchema = z.object({
  courseId: z.string().uuid(),
  teeId: z.string().uuid(),
  playedAt: z.date(),
  scores: z.array(z.number().min(1).max(15)),
  adjustedGrossScore: z.number().min(18).max(200),
});

// Use Drizzle Zod schemas for database validation
import { createInsertSchema } from "drizzle-zod";
import { round } from "@/db/schema";

const insertRoundSchema = createInsertSchema(round);
```

### **Next.js App Router Patterns**

```typescript
// Server Components for data fetching via tRPC
import { api } from "@/trpc/server";

export default async function RoundsPage() {
  const rounds = await api.round.getUserRounds.query();

  return <RoundsTable rounds={rounds} />;
}

// Client Components for interactivity
"use client";

import { api } from "@/trpc/react";

export default function HandicapChart({ userId }: ChartProps) {
  const { data: handicapHistory } = api.round.getHandicapHistory.useQuery({ userId });
  const [selectedRange, setSelectedRange] = useState("6months");

  return (
    <div>
      <RangeSelector onSelect={setSelectedRange} />
      <LineChart data={handicapHistory} range={selectedRange} />
    </div>
  );
}

// Loading and error boundaries
export default function Loading() {
  return <Spinner aria-label="Loading rounds..." />;
}

export default function Error({ error }: { error: Error }) {
  return (
    <div role="alert">
      <h2>Something went wrong!</h2>
      <details>{error.message}</details>
    </div>
  );
}
```

### **Component Structure**

```typescript
// Order: imports, types, utils, main component
import React from "react";
import { cn } from "@/lib/utils";
import type { Round } from "@/db/schema";

// Component-specific types
interface RoundCardProps {
  round: Round;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onSelect?: (id: string) => void;
}

// Utility functions
const formatScore = (score: number): string => {
  return score.toString();
};

const formatDifferential = (diff: number): string => {
  return diff.toFixed(1);
};

// Main component
export default function RoundCard({
  round,
  size = "md",
  interactive = false,
  onSelect,
}: RoundCardProps) {
  // State declarations
  const [isExpanded, setIsExpanded] = useState(false);

  // Event handlers
  const handleClick = () => {
    if (interactive && onSelect) {
      onSelect(round.id);
    }
  };

  // Render
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        size === "sm" && "p-2",
        interactive && "cursor-pointer hover:bg-accent"
      )}
      onClick={handleClick}
    >
      <p>Score: {formatScore(round.adjustedGrossScore)}</p>
      <p>Differential: {formatDifferential(round.scoreDifferential)}</p>
    </div>
  );
}
```

### **Styling with Tailwind CSS 4**

```typescript
// Use Tailwind utility classes with shadcn/ui components
import { cn } from "@/lib/utils";

// Basic styling with Tailwind
<div className="bg-background text-foreground p-4 rounded-md shadow-sm">
  Content here
</div>

// Use cn() for conditional classes
const cardClasses = cn(
  "rounded-lg border bg-card p-4",
  isActive && "bg-accent",
  size === "sm" && "p-2"
);

// Responsive design with Tailwind breakpoints
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
  {items.map(item => <Item key={item.id} {...item} />)}
</div>

// Use CSS variables from Tailwind config for theming
// Defined in app/globals.css with @theme directive
:root {
  --background: oklch(100% 0 0);
  --foreground: oklch(0% 0 0);
  --primary: oklch(45.55% 0.21 262.881);
}

// Dark mode support with next-themes
import { useTheme } from "next-themes";

const { theme, setTheme } = useTheme();
```

### **API Integration Patterns**

```typescript
// Use tRPC for type-safe API calls
import { api } from "@/trpc/server"; // Server Components
import { api as clientApi } from "@/trpc/react"; // Client Components

// Server-side data fetching with tRPC
import { api } from "@/trpc/server";

export default async function RoundsPage() {
  try {
    const rounds = await api.round.getUserRounds.query();
    return <RoundsTable rounds={rounds} />;
  } catch (error) {
    console.error("Failed to fetch rounds:", error);
    return <ErrorBoundary error="Failed to load rounds" />;
  }
}

// Client-side data fetching with tRPC + React Query
"use client";

import { api } from "@/trpc/react";

export default function RoundsList() {
  const {
    data: rounds,
    isLoading,
    error,
  } = api.round.getUserRounds.useQuery();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return <RoundsTable rounds={rounds} />;
}

// Mutations with optimistic updates
const createRoundMutation = api.round.createRound.useMutation({
  onMutate: async (newRound) => {
    // Cancel outgoing refetches
    await utils.round.getUserRounds.cancel();

    // Snapshot previous value
    const previousRounds = utils.round.getUserRounds.getData();

    // Optimistically update
    utils.round.getUserRounds.setData(undefined, (old) => [
      ...(old ?? []),
      newRound,
    ]);

    return { previousRounds };
  },
  onError: (err, newRound, context) => {
    // Rollback on error
    utils.round.getUserRounds.setData(undefined, context?.previousRounds);
  },
  onSettled: () => {
    // Refetch after mutation
    utils.round.getUserRounds.invalidate();
  },
});
```

### **Authentication Integration**

```typescript
// Use Supabase Auth in Server Components
import { createServerComponentClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <Dashboard userId={user.id} />;
}

// Client Components
"use client";

import { createClientComponentClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

export default function UserProfile() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (loading) return <Spinner />;
  if (!user) return <SignInPrompt />;

  return <Profile user={user} />;
}

// Middleware-based protection (recommended)
// In middleware.ts:
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
```

## 🔧 **Development Workflow**

### **Before Making Changes**

```bash
# Check current state
pnpm build           # TypeScript compilation check
pnpm lint            # ESLint check
pnpm test            # Run Vitest tests

# Generate Supabase types if schema changed
pnpm gen:types       # Generates types/supabase.ts from Supabase
```

### **Change Process**

1. Generate Supabase types if database schema changed: `pnpm gen:types`
2. Create/update tRPC routers in `server/api/routers/` with Zod schemas
3. Create/update components with proper TypeScript types
4. Write tests for new functionality (unit and integration)
5. Run linting and type checking: `pnpm build && pnpm lint`
6. Test in browser with `pnpm dev`
7. Deploy to Vercel for staging review

### **Error Resolution Priority**

1. TypeScript compilation errors (highest)
2. ESLint errors
3. Test failures
4. Runtime errors
5. Warnings (address but don't block)

## 🚨 **Critical Don'ts**

### **Architecture Violations**

- ❌ No direct Supabase database queries in frontend (use tRPC)
- ❌ No manual modifications to `types/supabase.ts` (use `pnpm gen:types`)
- ❌ No Pages Router patterns in App Router project
- ❌ No client-side authentication logic without proper session management
- ❌ No inline styles (use Tailwind CSS classes)
- ❌ No direct Stripe API calls from client (use tRPC server procedures)
- ❌ No modifications to user billing fields from frontend (RLS protected)

### **Performance Killers**

- ❌ Don't fetch data in client components without React Query caching
- ❌ Don't create objects in render methods (use useMemo)
- ❌ Don't forget to memoize expensive handicap calculations
- ❌ Don't ignore Next.js caching mechanisms (revalidate, force-cache)
- ❌ Don't bundle large dependencies on client side (use dynamic imports)
- ❌ Don't recalculate handicaps synchronously (use queue pattern)

### **Code Quality**

- ❌ No `console.log` statements in production code
- ❌ No `any` types (use proper TypeScript)
- ❌ No hardcoded values (use environment variables/tokens)
- ❌ No commented-out code blocks
- ❌ No missing error boundaries

## 🎨 **UI/UX Guidelines**

### **Design Principles**

- Clean, golf-focused interface for recreational and serious golfers
- Clear handicap visualization with transparent calculations
- Responsive design for mobile scorecard entry and desktop analysis
- Accessible design following WCAG AA guidelines
- Consistent spacing and typography using Tailwind design system
- Premium feel with subtle animations and transitions

### **Component Hierarchy**

```
App Layout
├── Navigation Header
│   ├── Logo/Brand (Handicappin')
│   ├── Main Navigation (Dashboard, Rounds, Calculators)
│   ├── Upgrade Button (for free tier)
│   └── User Menu (Profile, Billing, Sign Out)
├── Page Content
│   ├── Page Title with Description
│   ├── Handicap Index Display (prominent)
│   ├── Golf Scorecard / Round Entry Form
│   ├── Charts (Handicap Progression, Score Trends)
│   └── Action Buttons (Add Round, Calculate, etc.)
├── Real-time Components
│   └── BillingSync (invisible, handles subscription updates)
└── Footer (optional)
```

### **Interaction Patterns**

- Click round cards to view detailed scorecard
- Hover states for course/tee selection
- Loading skeletons for async handicap calculations
- Sort and filter for round history tables
- Mobile-optimized scorecard entry with touch targets
- Real-time subscription status updates (no page refresh needed)
- Premium feature gates with upgrade prompts
- Accessible keyboard navigation throughout

## 🧪 **Testing Standards**

### **Testing Framework Stack**

- **Vitest 3.2.4** for unit and integration tests
- **React Testing Library** for component testing (if needed)
- **tRPC test utilities** for API testing
- **Stripe test mode** for payment integration tests
- **Test fixtures** for golf data (courses, rounds, handicaps)

### **Testing Philosophy**

```typescript
// ✅ CORRECT: Test business logic and calculations
describe("Handicap Calculations", () => {
  it("should calculate score differential correctly", () => {
    const round = {
      adjustedGrossScore: 85,
      courseRating: 72.0,
      slopeRating: 130,
    };

    const differential = calculateScoreDifferential(round);

    // (85 - 72.0) * 113 / 130 = 11.3
    expect(differential).toBeCloseTo(11.3, 1);
  });

  it("should apply soft cap when differential exceeds 3.0", () => {
    const handicapIndex = 10.0;
    const lowestIndex = 5.0;

    const capped = applySoftCap(handicapIndex, lowestIndex);

    // Soft cap should reduce the increase
    expect(capped).toBeLessThan(handicapIndex);
  });
});

// ✅ CORRECT: Test Stripe integration with mocks
describe("Stripe Checkout", () => {
  it("should create checkout session with correct price", async () => {
    const result = await api.stripe.createCheckout.mutate({
      plan: "premium",
    });

    expect(result.url).toContain("checkout.stripe.com");
    // Verify price ID matches environment variable
  });
});

// ❌ WRONG: Testing implementation details
expect(component.state.isCalculating).toBe(true);
```

### **Test Organization**

```
tests/
├── unit/                   # Component and utility tests
│   ├── calculations/      # USGA handicap calculation tests
│   ├── utils/             # Utility function tests
│   └── logging.test.ts    # Logging utility tests
├── integration/            # API integration tests
│   ├── stripe-pricing.test.ts  # Stripe price verification
│   ├── handicap-flow.test.ts   # End-to-end handicap calculation
│   └── billing.test.ts         # Subscription lifecycle tests
├── fixtures/               # Test data
│   ├── rounds.ts          # Sample round data
│   ├── courses.ts         # Sample course data
│   └── users.ts           # Sample user profiles
└── utils.ts               # Test utilities and helpers
```

### **API Testing Patterns**

```typescript
// Test tRPC procedures with proper setup
import { describe, it, expect } from "vitest";
import { createCaller } from "@/server/api/root";
import { createMockContext } from "@/tests/utils";

describe("Round tRPC Router", () => {
  it("should fetch user rounds successfully", async () => {
    const ctx = createMockContext({ userId: "test-user-id" });
    const caller = createCaller(ctx);

    const rounds = await caller.round.getUserRounds();

    expect(rounds).toHaveLength(3);
    expect(rounds[0]).toHaveProperty("adjustedGrossScore");
  });

  it("should calculate handicap index correctly", async () => {
    const ctx = createMockContext({ userId: "test-user-id" });
    const caller = createCaller(ctx);

    const result = await caller.round.calculateHandicap();

    expect(result.handicapIndex).toBeCloseTo(12.5, 1);
  });

  it("should reject unauthorized access", async () => {
    const ctx = createMockContext({ userId: null }); // Unauthenticated
    const caller = createCaller(ctx);

    await expect(caller.round.getUserRounds()).rejects.toThrow("UNAUTHORIZED");
  });
});

// Test Stripe integration with test mode
describe("Stripe Integration", () => {
  it("should verify pricing configuration", () => {
    const { premiumPrice, unlimitedPrice } = getStripeConfig();

    expect(premiumPrice).toBe(1900); // $19.00 in cents
    expect(unlimitedPrice).toBe(2900); // $29.00 in cents
  });
});
```

## 📱 **Responsive Design Standards**

### **Breakpoint Strategy**

```typescript
// Use Tailwind CSS breakpoints consistently
// Tailwind default breakpoints:
// - sm: 640px
// - md: 768px
// - lg: 1024px
// - xl: 1280px
// - 2xl: 1536px

// Responsive grid example
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
  {rounds.map(round => (
    <RoundCard key={round.id} round={round} />
  ))}
</div>

// Responsive scorecard layout
<div className="flex flex-col lg:flex-row gap-4">
  <div className="w-full lg:w-2/3">
    <GolfScorecard />
  </div>
  <div className="w-full lg:w-1/3">
    <HandicapSummary />
  </div>
</div>
```

### **Mobile-First Approach**

```typescript
// Start with mobile styles, enhance for larger screens
// Tailwind is mobile-first by default

// Example: Handicap Index Display
<div className="text-3xl md:text-4xl lg:text-5xl font-bold">
  {handicapIndex ?? "N/A"}
</div>

// Example: Responsive padding and spacing
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-2xl md:text-3xl lg:text-4xl">Round History</h1>
</div>

// Example: Mobile scorecard vs desktop
<div className="
  // Mobile: Stack vertically
  flex flex-col space-y-2
  // Desktop: Horizontal layout
  lg:flex-row lg:space-y-0 lg:space-x-4
">
  <HoleScore hole={1} />
  <HoleScore hole={2} />
</div>
```

## 🔒 **Security Guidelines**

### **Authentication Security**

```typescript
// Always validate sessions server-side with Supabase Auth
import { createServerComponentClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Proceed with authenticated request
  // RLS policies will automatically filter data by user.id
}

// Use environment variables for sensitive data
import { env } from "@/env";

const stripeConfig = {
  secretKey: env.STRIPE_SECRET_KEY, // Never expose in client
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
};

const supabaseConfig = {
  url: env.NEXT_PUBLIC_SUPABASE_URL, // Public
  anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // Public
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, // Server-only
};

// Row-Level Security (RLS) example
// In Supabase migration:
CREATE POLICY "Users can only view their own rounds"
  ON rounds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users cannot modify their own billing"
  ON profile FOR UPDATE
  USING (
    auth.uid() = id AND
    (OLD.plan_selected IS NOT DISTINCT FROM NEW.plan_selected)
  );
```

### **Data Validation**

```typescript
// Validate all inputs with Zod (tRPC procedures)
import { z } from "zod";

const createRoundSchema = z.object({
  courseId: z.string().uuid(),
  teeId: z.string().uuid(),
  playedAt: z.date(),
  scores: z.array(z.number().min(1).max(15)).length(18), // 18 holes
  adjustedGrossScore: z.number().min(18).max(200),
});

export const roundRouter = createTRPCRouter({
  createRound: authedProcedure
    .input(createRoundSchema)
    .mutation(async ({ input, ctx }) => {
      // Input is fully validated and type-safe
      const round = await db.round.insert(input);
      return round;
    }),
});

// Validate Stripe webhooks
const webhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.any()),
  }),
});

// Validate payment amounts (defense in depth)
function verifyPaymentAmount(
  amount: number,
  plan: SubscriptionPlan
): boolean {
  const expectedAmounts = {
    premium: 1900, // $19.00
    unlimited: 2900, // $29.00
    lifetime: 14900, // $149.00
  };

  return amount === expectedAmounts[plan];
}
```

## 🚀 **Performance Optimization**

### **Next.js Optimization**

```typescript
// Use Next.js caching strategies
export const revalidate = 3600; // Cache course data for 1 hour

// Implement proper loading states
export default function Loading() {
  return <RoundsTableSkeleton />;
}

// Use dynamic imports for large chart libraries
import dynamic from "next/dynamic";

const HandicapProgressChart = dynamic(
  () => import("./HandicapProgressChart"),
  {
    loading: () => <ChartSkeleton />,
    ssr: true, // Recharts works server-side
  }
);

// Optimize images
import Image from "next/image";

<Image
  src="/course-logo.jpg"
  alt="Course Logo"
  width={200}
  height={100}
  priority={false} // Lazy load non-critical images
/>;

// Use Suspense boundaries for streaming
import { Suspense } from "react";

export default function Dashboard() {
  return (
    <div>
      <Suspense fallback={<HandicapSkeleton />}>
        <HandicapIndex />
      </Suspense>
      <Suspense fallback={<RoundsSkeleton />}>
        <RecentRounds />
      </Suspense>
    </div>
  );
}
```

### **React Optimization**

```typescript
// Memoize expensive handicap calculations
const calculatedHandicap = useMemo(() => {
  return calculateHandicapIndex(rounds, lowestHandicapIndex);
}, [rounds, lowestHandicapIndex]);

// Memoize sorted rounds
const sortedRounds = useMemo(() => {
  return rounds.sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
}, [rounds]);

// Optimize re-renders with memo and callback
const RoundCard = memo(({ round, onSelect }: RoundCardProps) => {
  const handleClick = useCallback(() => {
    onSelect?.(round.id);
  }, [round.id, onSelect]);

  return (
    <div onClick={handleClick}>
      <p>Score: {round.adjustedGrossScore}</p>
      <p>Differential: {round.scoreDifferential.toFixed(1)}</p>
    </div>
  );
});

// Use React Query for caching and deduplication
const { data: rounds } = api.round.getUserRounds.useQuery(
  undefined,
  {
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  }
);
```

## 📊 **Analytics and Monitoring**

### **Error Tracking**

```typescript
// Implement proper error boundaries with Sentry
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry
    Sentry.captureException(error, {
      tags: {
        component: "GlobalErrorBoundary",
      },
      contexts: {
        nextjs: {
          digest: error.digest,
        },
      },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="text-muted-foreground">
        We've been notified and are looking into it.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}

// Track Stripe webhook errors with context
Sentry.captureException(error, {
  tags: {
    webhook_type: event.type,
    customer_id: customer.id,
  },
  contexts: {
    stripe: {
      event_id: event.id,
      retry_count: retryCount,
    },
  },
});
```

### **Performance Monitoring**

```typescript
// Monitor key metrics with Sentry
import * as Sentry from "@sentry/nextjs";

// Track handicap calculation performance
const transaction = Sentry.startTransaction({
  name: "Calculate Handicap Index",
  op: "calculation",
});

try {
  const handicapIndex = calculateHandicapIndex(rounds);
  transaction.setStatus("ok");
  return handicapIndex;
} catch (error) {
  transaction.setStatus("internal_error");
  throw error;
} finally {
  transaction.finish();
}

// Monitor Stripe webhook processing time
const span = transaction.startChild({
  op: "stripe.webhook",
  description: event.type,
});

await processWebhook(event);
span.finish();

// Use Vercel Analytics for page views
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

// Monitor slow database queries (over 1 second)
const queryStart = performance.now();
const rounds = await db.query.round.findMany();
const queryTime = performance.now() - queryStart;

if (queryTime > 1000) {
  Sentry.captureMessage("Slow database query", {
    level: "warning",
    extra: { queryTime, table: "round" },
  });
}
```

## 🎯 **Success Metrics**

### **Technical**

- [ ] Zero TypeScript compilation errors
- [ ] All ESLint rules pass
- [ ] Test coverage > 70% for handicap calculation logic
- [ ] Stripe integration tests pass (pricing, webhooks, idempotency)
- [ ] Bundle size optimized for mobile users
- [ ] tRPC type safety enforced across all API calls
- [ ] Supabase RLS policies protect all sensitive data

### **Performance**

- [ ] First Contentful Paint < 2s
- [ ] Largest Contentful Paint < 3s
- [ ] Time to Interactive < 3.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Handicap calculation completes < 500ms
- [ ] Stripe webhook processing < 1s (idempotency check included)
- [ ] Mobile scorecard entry is smooth (60fps)

### **User Experience**

- [ ] Responsive design works on mobile, tablet, and desktop
- [ ] Accessible to screen readers (WCAG AA)
- [ ] Loading skeletons for all async operations
- [ ] Error states are user-friendly with clear next steps
- [ ] Authentication flow is seamless (sign-up to first round < 3 min)
- [ ] Subscription upgrade flow is clear and trustworthy
- [ ] Real-time billing updates (no page refresh needed)
- [ ] Handicap calculations include clear explanations
- [ ] Golf terminology is accurate and appropriate for all skill levels

---

This comprehensive coding standards document ensures consistency, maintainability, and alignment with the project's core mission of providing a transparent, USGA-compliant golf handicap tracking SaaS application with premium subscription features.
