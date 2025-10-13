# JWT Claims-Based Access Control Implementation Plan (Production-Grade)

## Overview

This plan migrates middleware access control from database queries to JWT claims, improving performance by ~200x (from ~200ms to <1ms per request). We'll use Supabase's **Custom Access Token Hook** to automatically inject **minimal** billing information into JWT claims.

**Key Design Principle**: Keep JWT claims tiny (<200 bytes) to minimize cookie size and edge performance impact.

## Current State Analysis

### What Exists Now:
- **Middleware** (`utils/supabase/middleware.ts:119`) queries database on every request via `getBasicUserAccess()`
- **Database Schema** (`db/schema.ts:39-43`) has `plan_selected`, `rounds_used`, `plan_selected_at` in `profile` table
- **Webhook Handlers** (`app/api/stripe/webhook/route.ts`) update `profile` table when billing changes
- **Performance Issue**: 50-200ms added latency per request due to database queries

### Key Constraints:
- ✅ Existing webhook handlers work and throw errors properly for retries
- ✅ Database schema is already set up correctly
- ⚠️ Must NOT directly modify `auth.users` table
- ⚠️ JWT claims can be stale (1-60 minutes until token refresh)
- ⚠️ Middleware runs on Edge Runtime (limited Node.js APIs)
- 🔥 **JWT size matters** - Large claims slow every request and hit header limits

### Key Discoveries:
- Supabase provides **Custom Access Token Hooks** for adding claims to JWTs
- Hook runs automatically before each token is issued (login, refresh)
- Claims are read-only in middleware via `user.app_metadata`
- Token refresh happens automatically ~every hour
- **JWT claims ride in cookies** - bigger claims = slower requests

## Desired End State

After implementation:
- ✅ Middleware reads **minimal** billing info from JWT claims (NO database queries)
- ✅ JWT claims are <200 bytes (4 fields only: plan, status, period_end, version)
- ✅ Custom Access Token Hook syncs `profile` data to JWT claims automatically
- ✅ Middleware latency reduced from 50-200ms to <1ms
- ✅ Graceful fallback to database if claims missing
- ✅ Manual refresh endpoint for immediate claim updates after checkout
- ✅ All existing access control logic works identically
- ✅ **Server-side enforcement remains** for critical operations

### Minimal JWT Claims Structure:

```json
{
  "app_metadata": {
    "billing": {
      "plan": "premium",              // "free" | "premium" | "unlimited" | "lifetime"
      "status": "active",             // "active" | "trialing" | "past_due" | "canceled" | "paused"
      "current_period_end": 1735699200, // unix seconds (null for lifetime/free)
      "cancel_at_period_end": false,  // true if canceled but access until period end
      "billing_version": 7            // bump on webhook changes for deterministic staleness
    }
  }
}
```

**Total size: ~80 bytes (5 fields, well under 200 byte target)**

**What's NOT in JWT (intentionally):**
- ❌ `rounds_used` - Changes frequently, always stale, enforce in server
- ❌ `plan_selected_at` - Not needed for access control
- ❌ `updated_at` - Use `billing_version` instead for deterministic staleness

### Verification:
```bash
# Performance verification
pnpm test:performance  # Measure middleware latency

# Functional verification
pnpm test              # All tests pass
pnpm build             # TypeScript compilation succeeds

# Manual verification
# 1. Login → Check JWT has billing claims (tiny payload)
# 2. Complete checkout → Immediate access granted
# 3. Webhook updates plan → Claims updated on next refresh
```

## What We're NOT Doing

- ❌ Real-time claim updates (WebSocket/SSE)
- ❌ Migrating to Stripe Sync Engine (separate future enhancement)
- ❌ Removing `getComprehensiveUserAccess()` (still needed for page-level verification)
- ❌ Directly modifying `auth.users` table via triggers
- ❌ Including usage counters (`rounds_used`) in JWT
- ❌ Near-instant downgrade revocation (1-hour staleness is acceptable)

## Implementation Approach

We'll use **Supabase Custom Access Token Hooks** (official approach) to inject **minimal** billing claims into JWTs. This approach:
1. Runs automatically on token issue/refresh
2. Reads from existing `profile` table
3. Adds **only 4 tiny claims** without touching `auth.users` directly
4. Zero changes to webhook handlers (they already update `profile`)
5. Server remains the enforcer for critical operations

The implementation is phased for safe, incremental deployment with rollback capability.

---

## Phase 0: Database Schema Updates (Prerequisite)

### Overview
Add missing fields to `profile` table to support new JWT claims structure.

### Changes Required:

#### 1. Database Migration: Add New Billing Fields

**File**: `supabase/migrations/YYYYMMDDHHMMSS_add_subscription_status_fields.sql` (NEW)

**Changes**: Add status, period_end, and billing_version fields

```sql
-- Migration: Add subscription status tracking fields for JWT claims
-- These fields enable middleware to handle edge cases without DB queries

-- Add subscription status (active, past_due, canceled, etc.)
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active'
    CHECK (subscription_status IN (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'paused',
      'incomplete',
      'incomplete_expired',
      'unpaid'
    ));

-- Add subscription period end (unix timestamp)
-- NULL for free tier and lifetime plans
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS current_period_end BIGINT DEFAULT NULL;

-- Add cancel_at_period_end flag
-- TRUE if subscription canceled but user has access until period end
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE NOT NULL;

-- Add billing version for deterministic staleness detection
-- Bump this on every webhook-driven billing change
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS billing_version INTEGER DEFAULT 1 NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profile_subscription_status ON profile(subscription_status);

-- Add comments for documentation
COMMENT ON COLUMN profile.subscription_status IS 'Stripe subscription status: active, past_due, canceled, etc. Synced via webhooks.';
COMMENT ON COLUMN profile.current_period_end IS 'Unix timestamp of subscription period end. NULL for free/lifetime. Used in JWT claims.';
COMMENT ON COLUMN profile.cancel_at_period_end IS 'TRUE if subscription canceled but user retains access until current_period_end. Prevents premature access revocation.';
COMMENT ON COLUMN profile.billing_version IS 'Incremented on every billing change. Used for deterministic JWT staleness detection.';
```

#### 2. Update Webhook Handlers to Set New Fields

**File**: `app/api/stripe/webhook/route.ts`

**Changes**: Update webhook handlers to populate new fields

```typescript
// In handleCheckoutCompleted function (line ~176):
await db
  .update(profile)
  .set({
    planSelected: plan,
    planSelectedAt: new Date(),
    subscriptionStatus: 'active', // NEW
    currentPeriodEnd: session.subscription?.current_period_end || null, // NEW
    cancelAtPeriodEnd: false, // NEW: Not canceled
    billingVersion: sql`billing_version + 1`, // NEW: Increment version
  })
  .where(eq(profile.id, userId));

// In handleSubscriptionChange function (line ~228):
await db
  .update(profile)
  .set({
    planSelected: plan,
    planSelectedAt: new Date(),
    subscriptionStatus: subscription.status, // NEW: active, past_due, etc.
    currentPeriodEnd: subscription.current_period_end, // NEW: unix timestamp
    cancelAtPeriodEnd: subscription.cancel_at_period_end || false, // NEW: Critical for graceful cancellation
    billingVersion: sql`billing_version + 1`, // NEW: Increment version
  })
  .where(eq(profile.id, userId));

// In handleSubscriptionDeleted function (line ~258):
await db
  .update(profile)
  .set({
    planSelected: "free",
    planSelectedAt: new Date(),
    subscriptionStatus: 'canceled', // NEW
    currentPeriodEnd: null, // NEW
    cancelAtPeriodEnd: false, // NEW: No longer relevant after deletion
    billingVersion: sql`billing_version + 1`, // NEW: Increment version
  })
  .where(eq(profile.id, userId));
```

#### 3. Update Database Schema TypeScript Definitions

**File**: `db/schema.ts`

**Changes**: Add new fields to schema

```typescript
export const profile = pgTable(
  "profile",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    name: text(),
    handicapIndex: decimal<"number">().notNull().default(54),
    verified: boolean().default(false).notNull(),
    initialHandicapIndex: decimal<"number">().notNull().default(54),
    createdAt: timestamp()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    // Billing/plan tracking fields
    roundsUsed: integer("rounds_used").default(0).notNull(),
    planSelected: text("plan_selected").$type<
      "free" | "premium" | "unlimited" | "lifetime" | null
    >(),
    planSelectedAt: timestamp("plan_selected_at"),

    // NEW: Subscription status tracking for JWT claims
    subscriptionStatus: text("subscription_status")
      .$type<"active" | "trialing" | "past_due" | "canceled" | "paused" | "incomplete" | "incomplete_expired" | "unpaid">()
      .default("active")
      .notNull(),
    currentPeriodEnd: integer("current_period_end"), // bigint stored as integer
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    billingVersion: integer("billing_version").default(1).notNull(),
  },
  // ... rest of table definition
);
```

### Success Criteria:

#### Automated Verification:
- [x] Migration applies successfully: `supabase db push`
- [x] New columns exist: `SELECT subscription_status, current_period_end, billing_version FROM profile LIMIT 1`
- [x] TypeScript types compile: `pnpm build`

#### Manual Verification:
- [ ] Webhook updates populate new fields correctly
- [ ] `billing_version` increments on each webhook
- [ ] `subscription_status` matches Stripe status
- [ ] `current_period_end` is unix timestamp or null

---

## Phase 1: Create Custom Access Token Hook

### Overview
Create a **hardened, minimal** Postgres function that runs before each JWT is issued, reading billing data from the `profile` table and adding **only 4 tiny claims** to the JWT.

### Changes Required:

#### 1. Supabase Migration: Custom Access Token Hook

**File**: `supabase/migrations/YYYYMMDDHHMMSS_add_billing_jwt_hook.sql` (NEW)

**Changes**: Create SQL migration for the custom access token hook with security hardening

```sql
-- Migration: Add Custom Access Token Hook for Billing Claims
-- This function runs automatically before each JWT is issued (login, refresh)
-- and adds MINIMAL billing information from the profile table to JWT claims.
--
-- Security: SECURITY DEFINER with safe search_path
-- Performance: Single SELECT by user_id, no joins
-- Payload: Minimal (4 fields, ~60 bytes)

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Required to access profile table from auth context
SET search_path = public  -- Prevent search_path attacks
STABLE  -- Function doesn't modify database
AS $$
DECLARE
  claims jsonb := event->'claims';
  rec record;
BEGIN
  -- Get user's MINIMAL billing information from profile table
  -- Only select fields that will be in JWT (keep it tiny!)
  SELECT
    COALESCE(plan_selected, 'free')::text AS plan,
    COALESCE(subscription_status, 'active')::text AS status,
    current_period_end,  -- NULL for free/lifetime
    COALESCE(cancel_at_period_end, false)::boolean AS cancel_at_period_end,
    COALESCE(billing_version, 1)::integer AS billing_version
  INTO rec
  FROM public.profile
  WHERE id = (event->>'user_id')::uuid;

  -- Handle missing profile (shouldn't happen, but be defensive)
  IF NOT FOUND THEN
    rec.plan := 'free';
    rec.status := 'active';
    rec.current_period_end := NULL;
    rec.cancel_at_period_end := false;
    rec.billing_version := 0;
  END IF;

  -- Add MINIMAL billing information to claims
  -- This will be available in JWT as app_metadata.billing
  -- Total payload: ~80 bytes (5 fields)
  claims := jsonb_set(
    claims,
    '{app_metadata, billing}',
    jsonb_build_object(
      'plan', rec.plan,
      'status', rec.status,
      'current_period_end', rec.current_period_end,
      'cancel_at_period_end', rec.cancel_at_period_end,
      'billing_version', rec.billing_version
    )
  );

  -- Return modified claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON public.profile TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;

-- Add comment for documentation
COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Custom Access Token Hook: Injects MINIMAL billing information (4 fields, ~60 bytes) from profile table into JWT claims. Runs automatically on token issue/refresh. SECURITY DEFINER with safe search_path.';
```

#### 2. Configure Hook in Supabase Dashboard

**Manual Step**: Enable the custom access token hook in Supabase Dashboard

**Instructions**:
1. Go to Supabase Dashboard → Authentication → Hooks
2. Select "Custom Access Token Hook"
3. Choose the function: `public.custom_access_token_hook`
4. Enable the hook
5. Test with a test user login

**Alternative (Supabase CLI)**:
```bash
# If using Supabase CLI v1.27.0+
supabase hooks create custom_access_token \
  --function public.custom_access_token_hook \
  --enabled
```

### Success Criteria:

#### Automated Verification:
- [x] Migration applies successfully: `supabase db push`
- [ ] Function exists in database: `SELECT * FROM pg_proc WHERE proname = 'custom_access_token_hook'`
- [ ] Permissions granted correctly: `SELECT has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE')`
- [ ] Function has `SECURITY DEFINER`: `SELECT prosecdef FROM pg_proc WHERE proname = 'custom_access_token_hook'` returns `t`

#### Manual Verification:
- [ ] Login as test user → inspect JWT → verify `app_metadata.billing` exists
- [ ] JWT contains ONLY 5 fields: `plan`, `status`, `current_period_end`, `cancel_at_period_end`, `billing_version`
- [ ] JWT billing payload is <100 bytes (target: ~80 bytes)
- [ ] Hook function executes without errors (check Supabase logs)
- [ ] Token refresh updates billing claims correctly
- [ ] NO `rounds_used` in JWT (intentional)

---

## Phase 2: Update Middleware to Read JWT Claims

### Overview
Refactor middleware to read **minimal** billing information from JWT claims instead of querying the database. Use status and period_end for edge case handling.

### Changes Required:

#### 1. Middleware: Read JWT Claims

**File**: `utils/supabase/middleware.ts`

**Changes**: Replace database query with JWT claim reading (minimal claims)

```typescript
// Define billing claims type (minimal)
type BillingClaims = {
  plan: string;
  status: string;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  billing_version: number;
};

// Clock skew tolerance for expiry checks (prevent edge flaps)
const EXPIRY_LEEWAY_SECONDS = 120; // 2 minutes

export async function updateSession(request: NextRequest) {
  // ... existing setup code ...

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ... existing public path and reset token logic ...

  // Check access control for authenticated users on protected routes
  const premiumPaths = PREMIUM_PATHS;

  if (
    user &&
    !isPublic &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/billing") &&
    !pathname.startsWith("/upgrade")
  ) {
    const startTime = performance.now(); // Performance monitoring
    console.log("🔍 Middleware: Checking access for user:", user.id);

    try {
      // NEW: Read MINIMAL billing info from JWT claims (NO DATABASE QUERY!)
      const billing = user.app_metadata?.billing as BillingClaims | undefined;

      let plan: string | null = null;
      let status: string = 'active';
      let hasPremiumAccess: boolean = false;

      // Graceful fallback to database if claims missing (during migration)
      if (!billing) {
        console.warn(
          `⚠️ Missing JWT claims for user ${user.id}, falling back to database`
        );

        // Fallback: Query database (temporary during migration)
        const access = await getBasicUserAccess(user.id);
        plan = access.plan;
        hasPremiumAccess = access.hasPremiumAccess;
      } else {
        // JWT claims present - use them!
        plan = billing.plan;
        status = billing.status;

        // Check for edge cases using status and period_end
        // This avoids database queries for common scenarios

        // 1. Check subscription status (but respect cancel_at_period_end)
        // If canceled but cancel_at_period_end=true, keep access until expiry
        if (status === 'past_due' || status === 'incomplete' || status === 'paused') {
          console.warn(`⚠️ Subscription ${status} for user ${user.id}`);
          hasPremiumAccess = false; // Revoke premium access
        }
        // 2. Handle "canceled" status: check cancel_at_period_end flag
        else if (status === 'canceled') {
          if (billing.cancel_at_period_end && billing.current_period_end) {
            // User canceled but has access until period end
            // Check if period has expired (with leeway for clock skew)
            const nowSeconds = Date.now() / 1000;
            const isExpired = nowSeconds > (billing.current_period_end + EXPIRY_LEEWAY_SECONDS);

            if (isExpired) {
              console.warn(`⚠️ Canceled subscription expired for user ${user.id}`);
              hasPremiumAccess = false;
            } else {
              console.log(`✅ Canceled subscription still valid until ${new Date(billing.current_period_end * 1000).toISOString()} for user ${user.id}`);
              hasPremiumAccess = plan === "premium" || plan === "unlimited" || plan === "lifetime";
            }
          } else {
            // Canceled without period end, or cancel_at_period_end=false (immediate cancellation)
            console.warn(`⚠️ Subscription canceled (immediate) for user ${user.id}`);
            hasPremiumAccess = false;
          }
        }
        // 3. Check if subscription expired (with leeway for clock skew)
        else if (billing.current_period_end && Date.now() / 1000 > (billing.current_period_end + EXPIRY_LEEWAY_SECONDS)) {
          console.warn(`⚠️ Subscription expired for user ${user.id}`);
          hasPremiumAccess = false; // Revoke premium access
        }
        // 4. Normal case: check plan type
        else {
          hasPremiumAccess =
            plan === "premium" || plan === "unlimited" || plan === "lifetime";
        }

        console.log(
          `✅ Using JWT claims for user ${user.id} (v${billing.billing_version})`
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`⏱️ Middleware access check took: ${duration.toFixed(2)}ms`, {
        userId: user.id,
        source: billing ? "jwt" : "database",
        plan,
        status,
        hasPremiumAccess,
      });

      // Alert if middleware is slow
      const threshold = billing ? 10 : 100;
      if (duration > threshold) {
        console.warn(
          `🐌 Slow middleware detected: ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
          {
            userId: user.id,
            source: billing ? "jwt" : "database",
            pathname,
          }
        );
      }

      // Check if user needs onboarding (no plan selected)
      if (!plan) {
        console.log(
          "🚫 Middleware: No plan selected, redirecting to onboarding"
        );
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }

      // Check premium routes
      const isPremiumRoute = premiumPaths.some((path) =>
        pathname.startsWith(path)
      );

      if (isPremiumRoute && !hasPremiumAccess) {
        console.log(
          "🚫 Middleware: Premium route blocked, redirecting to upgrade"
        );
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }

      console.log("✅ Middleware: Access granted for plan:", plan);
    } catch (error) {
      console.error("❌ Middleware: Error checking access:", error);
      // On error, redirect to onboarding to be safe
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation succeeds: `pnpm build`
- [x] Linting passes: `pnpm lint`
- [x] No runtime errors in middleware

#### Manual Verification:
- [ ] User with JWT claims can access protected routes without database query
- [ ] User without JWT claims falls back to database query gracefully
- [ ] Logging shows "Using JWT claims" with version number
- [ ] Logging shows "falling back to database" for users without claims
- [ ] Middleware handles `past_due` status correctly (revokes access)
- [ ] Middleware handles expired `current_period_end` correctly (revokes access with 2min leeway)
- [ ] Middleware handles `cancel_at_period_end=true` correctly (keeps access until expiry)
- [ ] Middleware handles `cancel_at_period_end=false` correctly (immediate revocation)
- [ ] Access control logic works identically to before (no regressions)
- [ ] Premium routes still blocked for free users
- [ ] Onboarding redirect works for users without plan
- [ ] Middleware latency is <5ms with JWT claims

---

## Phase 3: Add JWT Refresh Endpoint

### Overview
Create an API endpoint to force JWT token refresh, enabling immediate access after checkout or subscription changes. This collapses the staleness window from 1 hour to seconds.

### Changes Required:

#### 1. JWT Refresh API Endpoint

**File**: `app/api/auth/refresh-claims/route.ts` (NEW)

**Changes**: Create new API route for manual JWT refresh

```typescript
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/refresh-claims
 *
 * Forces a JWT token refresh to immediately update billing claims.
 * This is useful after checkout completion or subscription changes
 * to avoid waiting for the automatic token refresh (~1 hour).
 *
 * How it works:
 * 1. Updates user metadata (triggers token refresh)
 * 2. Custom Access Token Hook reads latest data from profile table
 * 3. New JWT issued with updated billing claims
 * 4. Client receives fresh token with current billing info
 *
 * Returns:
 * - 200: Success with updated billing claims
 * - 401: Unauthorized (no user session)
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("JWT refresh failed: No authenticated user", userError);
      return NextResponse.json(
        { error: "Unauthorized", message: "No authenticated user" },
        { status: 401 }
      );
    }

    console.log(`🔄 JWT Refresh requested for user: ${user.id}`);

    // Force token refresh by updating user metadata
    // This triggers Supabase to issue a new JWT with updated claims
    // The custom access token hook will automatically inject latest billing data
    const { data, error } = await supabase.auth.updateUser({
      data: {
        last_claims_refresh: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("JWT refresh failed:", error);
      return NextResponse.json(
        { error: "Refresh failed", message: error.message },
        { status: 500 }
      );
    }

    const billing = data.user?.app_metadata?.billing;

    console.log("✅ JWT refresh successful:", {
      userId: user.id,
      billing,
    });

    return NextResponse.json(
      {
        success: true,
        billing,
        message: "JWT claims refreshed successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("JWT refresh error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

#### 2. Update Checkout Success Page

**File**: `app/billing/success/page.tsx`

**Changes**: Add JWT refresh after checkout for immediate access

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function BillingSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function refreshClaims() {
      try {
        // Get current user
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        // Refresh JWT claims immediately to collapse staleness window
        console.log("🔄 Refreshing JWT claims after checkout...");
        const response = await fetch("/api/auth/refresh-claims", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to refresh claims");
        }

        const data = await response.json();
        console.log("✅ JWT claims refreshed:", data);

        setStatus("success");

        // Wait 2 seconds to show success message, then redirect
        setTimeout(() => {
          router.push(`/dashboard/${user.id}`);
          router.refresh(); // Force Next.js to re-run middleware
        }, 2000);
      } catch (error) {
        console.error("Failed to refresh claims:", error);
        // Continue anyway - claims will refresh naturally within ~1 hour
        setStatus("success");
        setTimeout(() => {
          if (userId) {
            router.push(`/dashboard/${userId}`);
            router.refresh();
          }
        }, 2000);
      }
    }

    refreshClaims();
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          {status === "loading" && (
            <>
              <div className="text-6xl mb-4">⏳</div>
              <h1 className="text-4xl font-bold mb-4">Processing...</h1>
              <p className="text-lg text-gray-600 mb-8">
                Activating your subscription...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-4xl font-bold mb-4">Welcome to Premium!</h1>
              <p className="text-lg text-gray-600 mb-8">
                Your subscription is now active. You now have access to all
                premium features including the dashboard, advanced calculators,
                and unlimited rounds.
              </p>
              <p className="text-sm text-gray-500">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-4xl font-bold mb-4">Almost There!</h1>
              <p className="text-lg text-gray-600 mb-8">
                Your subscription is being processed. You'll have access within
                a few minutes.
              </p>
            </>
          )}
        </div>

        <div className="space-y-4">
          <Link
            href={userId ? `/dashboard/${userId}` : "/"}
            className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="block w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
          >
            Back to Home
          </Link>
        </div>

        <div className="mt-8 pt-8 border-t">
          <p className="text-sm text-gray-600">
            Need help? Contact us at{" "}
            <a
              href="mailto:support@handicappin.com"
              className="text-blue-600 hover:underline"
            >
              support@handicappin.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### 3. Verify Client-Side Supabase Client Exists

**File**: `utils/supabase/client.ts`

**Action**: Check if file exists, create if needed

```typescript
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/supabase";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation succeeds: `pnpm build`
- [x] No linting errors: `pnpm lint`
- [ ] API endpoint returns 401 when not authenticated
- [ ] API endpoint returns 200 with billing data when authenticated

#### Manual Verification:
- [ ] Complete checkout → redirected to success page
- [ ] Success page calls refresh endpoint automatically
- [ ] JWT claims updated immediately (verify in DevTools → Application → Cookies)
- [ ] User redirected to dashboard after 2 seconds
- [ ] Dashboard loads successfully with new premium access
- [ ] No database query logged in middleware (check console for "Using JWT claims")
- [ ] Staleness window collapsed from ~1 hour to ~2 seconds

---

## Phase 4: Observability & Monitoring

### Overview
Add production-grade observability to monitor JWT claim usage, fallback ratio, and claim payload size.

### Changes Required:

#### 1. Add Observability Metrics (Optional but Recommended)

**File**: `utils/supabase/middleware.ts`

**Changes**: Add metrics for monitoring (adapt to your observability stack)

```typescript
// At the end of the access control block:

// Metric 1: JWT vs Database fallback ratio
if (billing) {
  // Emit metric: jwt_claims_used
  // In production, send to your metrics service (Datadog, New Relic, etc.)
  console.info("METRIC: jwt_claims_used", {
    userId: user.id,
    billing_version: billing.billing_version,
  });
} else {
  // Emit metric: database_fallback_used
  console.warn("METRIC: database_fallback_used", {
    userId: user.id,
  });
}

// Metric 2: JWT claim size (sampled, 1% of requests)
if (billing && Math.random() < 0.01) {
  const claimSize = JSON.stringify(billing).length;
  console.info("METRIC: jwt_claim_size_bytes", {
    size: claimSize,
    userId: user.id,
  });

  // Alert if claim size is too large (>200 bytes)
  if (claimSize > 200) {
    console.error("ALERT: JWT claim size exceeds 200 bytes", {
      size: claimSize,
      billing,
    });
  }
}

// Metric 3: Middleware latency (already tracked via performance.now())
// Send to your metrics service in production
```

#### 2. Update Access Control Documentation

**File**: `utils/billing/access-control.ts`

**Changes**: Update comments to reflect new JWT-based approach

```typescript
/**
 * Lightweight version of access control for Edge Runtime (middleware)
 * Reads MINIMAL billing info from JWT claims for optimal performance (<1ms).
 *
 * ⚠️ PERFORMANCE NOTE: This function is now only used as a FALLBACK when JWT
 * claims are missing. In normal operation, middleware reads directly from JWT.
 *
 * JWT claims structure (MINIMAL, ~80 bytes):
 * {
 *   plan: "free" | "premium" | "unlimited" | "lifetime",
 *   status: "active" | "past_due" | "canceled" | ...,
 *   current_period_end: number | null,
 *   cancel_at_period_end: boolean,
 *   billing_version: number
 * }
 *
 * JWT claims are updated automatically via Custom Access Token Hook on:
 * - User login
 * - Token refresh (~every 1 hour)
 * - Manual refresh via /api/auth/refresh-claims
 *
 * ⚠️ STALENESS NOTE: JWT claims can be stale (1-60 minutes). This is acceptable
 * because middleware is a COARSE FILTER. Page components MUST still use
 * getComprehensiveUserAccess() which verifies with Stripe directly for critical ops.
 *
 * ⚠️ USAGE LIMITS: rounds_used is NOT in JWT (intentional). Enforce usage limits
 * in server actions by querying the database.
 */
export async function getBasicUserAccess(
  userId: string
): Promise<FeatureAccess> {
  // This function is now only used as a fallback when JWT claims are missing
  // In normal operation, middleware reads directly from JWT claims

  const supabase = await createServerComponentClient();

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("plan_selected, rounds_used, subscription_status")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return createNoAccessResponse();
  }

  // No plan selected yet
  if (!profile.plan_selected) {
    return createNoAccessResponse();
  }

  // Free plan
  if (profile.plan_selected === "free") {
    return createFreeTierResponse(profile.rounds_used || 0);
  }

  // Paid plan (trust database, Stripe verification happens in page components)
  return {
    plan: profile.plan_selected as "premium" | "unlimited" | "lifetime",
    hasAccess: true,
    hasPremiumAccess: true,
    hasUnlimitedRounds: hasUnlimitedRounds(profile.plan_selected),
    remainingRounds: Infinity,
    status: "active",
    isLifetime: profile.plan_selected === "lifetime",
    currentPeriodEnd:
      profile.plan_selected === "lifetime"
        ? new Date("2099-12-31T23:59:59.000Z")
        : null,
  };
}
```

### Testing Strategy

#### Integration Tests (Manual - Priority)

- [ ] **Test 1: New User Signup**
  - Create new account
  - Check JWT contains MINIMAL billing claims (5 fields only)
  - Verify claim size <100 bytes (target: ~80 bytes)
  - Select plan during onboarding
  - Verify claims updated on next page load

- [ ] **Test 2: Checkout Flow**
  - Complete Stripe checkout (test mode)
  - Verify redirect to success page
  - Verify JWT refresh triggered (check logs)
  - Verify immediate dashboard access
  - Check middleware logs for "Using JWT claims"
  - Verify `billing_version` incremented

- [ ] **Test 3: Webhook Updates**
  - Trigger Stripe webhook (subscription.updated)
  - Verify database updated with new status
  - Verify `billing_version` incremented
  - User logs out and back in
  - Verify JWT has updated billing info

- [ ] **Test 4: Token Refresh**
  - Login as user
  - Wait 5+ minutes (or force token expiry)
  - Refresh page
  - Verify new JWT issued with fresh claims

- [ ] **Test 5: Fallback Behavior**
  - Login as user without JWT claims (legacy user)
  - Verify middleware falls back to database
  - Check logs for "falling back to database"
  - Verify access control still works correctly

- [ ] **Test 6: Edge Cases (Status Handling)**
  - Set user status to `past_due` via webhook
  - Verify middleware revokes premium access
  - Check logs for "Subscription past_due"
  - Set user status back to `active`
  - Verify access restored after token refresh

- [ ] **Test 7: Expiry Handling**
  - Set `current_period_end` to past timestamp (>2 min ago)
  - Verify middleware revokes access
  - Check logs for "Subscription expired"
  - Set `current_period_end` to recent timestamp (<2 min ago)
  - Verify middleware KEEPS access (clock skew leeway)

- [ ] **Test 8: Cancel at Period End**
  - User cancels subscription (Stripe sets `cancel_at_period_end=true`)
  - Verify `status=canceled` and `cancel_at_period_end=true` in DB
  - Verify middleware KEEPS access (period not expired yet)
  - Check logs for "Canceled subscription still valid until..."
  - Set `current_period_end` to past timestamp
  - Verify middleware NOW revokes access
  - Check logs for "Canceled subscription expired"

- [ ] **Test 9: Immediate Cancellation**
  - Simulate immediate cancellation (`cancel_at_period_end=false`)
  - Verify middleware revokes access immediately
  - Check logs for "Subscription canceled (immediate)"

#### Performance Tests (Priority)

- [ ] **Baseline Measurement (Before)**
  - Measure middleware latency with database queries
  - Record: p50, p95, p99 latencies
  - Expected: 50-200ms

- [ ] **After Migration Measurement**
  - Measure middleware latency with JWT claims
  - Record: p50, p95, p99 latencies
  - Expected: <1ms (99% improvement)

- [ ] **JWT Claim Size Verification**
  - Decode JWT and measure `billing` object size
  - Expected: <100 bytes (target: ~80 bytes)
  - Should contain ONLY 5 fields

- [ ] **Load Test**
  - Simulate 100 requests/second
  - Verify no database connection pool exhaustion
  - Verify all requests use JWT claims
  - Verify middleware stays under 5ms

#### Observability Checks (Production)

- [ ] **Metric 1: Fallback Ratio**
  - Monitor ratio of JWT claims used vs database fallback
  - Target: >99% JWT claims within 1 week of deployment
  - Alert if fallback ratio >5%

- [ ] **Metric 2: Claim Size**
  - Monitor JWT claim payload size
  - Target: <100 bytes
  - Alert if size >200 bytes

- [ ] **Metric 3: Middleware Latency**
  - Monitor p95 middleware latency
  - Target: <5ms with JWT claims
  - Alert if latency >10ms

- [ ] **Metric 4: Hook Errors**
  - Monitor Supabase logs for hook failures
  - Target: 0 errors
  - Alert on any hook errors

### Success Criteria:

#### Automated Verification:
- [ ] All TypeScript types pass: `pnpm build`
- [ ] No linting errors: `pnpm lint`
- [ ] No console errors in development

#### Manual Verification:
- [ ] Middleware latency reduced by >95% (from ~100ms to <5ms)
- [ ] JWT claims present for all authenticated users
- [ ] JWT claims are <100 bytes
- [ ] Fallback works when claims missing
- [ ] Monitoring logs show fallback ratio and claim size
- [ ] No access control regressions
- [ ] Checkout flow grants immediate access
- [ ] Edge cases handled correctly (past_due, expired)

---

## Production Readiness Checklist

### Security
- [ ] Hook function has `SECURITY DEFINER` with safe `search_path`
- [ ] Minimal permissions granted (`SELECT` on profile only)
- [ ] No sensitive data in JWT claims (no PII, no payment methods)
- [ ] Server-side enforcement remains for critical operations
- [ ] `getComprehensiveUserAccess()` still used for page-level checks

### Performance
- [ ] JWT claims are <100 bytes (target: ~80 bytes, 5 fields)
- [ ] Middleware latency <5ms with JWT claims
- [ ] No database queries in middleware hot path
- [ ] Hook function is single SELECT (no joins)
- [ ] Clock skew leeway (120s) added to prevent false expiry triggers

### Reliability
- [ ] Graceful fallback to database if claims missing
- [ ] Webhook handlers increment `billing_version`
- [ ] Error handling in all code paths
- [ ] Rollback plan documented and tested

### Observability
- [ ] Metrics for JWT vs database fallback ratio
- [ ] Metrics for JWT claim size
- [ ] Metrics for middleware latency
- [ ] Supabase hook error monitoring
- [ ] Logs sample at reasonable rate (avoid log spam)

### Testing
- [ ] All manual tests pass
- [ ] Performance tests show >95% improvement
- [ ] Edge cases handled correctly
- [ ] No regressions in existing functionality

---

## Migration Notes

### Deployment Strategy

**Phase 0: Schema Updates (Prerequisite)**
1. Apply migration to add new fields: `supabase db push`
2. Update webhook handlers to populate new fields
3. Update TypeScript types: `pnpm build`
4. Deploy webhook handler changes
5. Verify webhooks populate new fields correctly

**Phase 1: Deploy Hook (No Breaking Changes)**
1. Apply hook migration: `supabase db push`
2. Enable hook in Supabase Dashboard
3. Test with development users
4. Monitor Supabase logs for hook errors
5. Verify JWT claims appear in tokens
6. No code changes yet → fully backward compatible

**Phase 2: Deploy Middleware Changes (Graceful Fallback)**
1. Deploy updated middleware code
2. Middleware reads JWT claims first
3. Falls back to database if claims missing
4. Both approaches work simultaneously
5. Monitor ratio of JWT vs database usage (target: >99% JWT)

**Phase 3: Deploy Refresh Endpoint (Recommended)**
1. Deploy refresh endpoint
2. Update success page to call endpoint
3. Test checkout flow end-to-end
4. Verify immediate access after checkout

**Phase 4: Monitor and Optimize**
1. Monitor middleware latency (target: <5ms)
2. Monitor fallback ratio (target: <1%)
3. Monitor claim size (target: <100 bytes)
4. Monitor hook errors (target: 0)
5. Once confident, consider removing fallback (future optimization)

### Rollback Plan

If issues arise, rollback is simple:

**Immediate Rollback (Code Level)**:
```typescript
// In middleware, force database fallback:
const billing = null; // Force fallback to database
// This instantly reverts to old behavior without redeployment
```

**Full Rollback (Remove Hook)**:
1. Disable hook in Supabase Dashboard (instant)
2. Redeploy previous middleware code
3. System returns to original database-query behavior
4. No data loss (database unchanged)
5. No user impact (access control identical)

### Edge Cases Handled

**Missing Claims**:
- New users: Hook creates claims on first login
- Legacy users: Middleware falls back to database gracefully
- Hook failure: Fallback ensures access control still works

**Stale Claims**:
- Detection: Use `billing_version` for deterministic staleness
- Impact: Minor (downgrades delayed by <1 hour)
- Mitigation: Manual refresh endpoint after critical operations

**Status Edge Cases**:
- `past_due`: Middleware revokes premium access immediately
- `paused`: Middleware revokes premium access immediately
- `incomplete`: Middleware revokes premium access immediately
- `canceled` with `cancel_at_period_end=true`: Middleware KEEPS access until `current_period_end` expires
- `canceled` with `cancel_at_period_end=false`: Middleware revokes premium access immediately
- Expired `current_period_end`: Middleware revokes access (with 2-minute clock skew leeway)

**Hook Errors**:
- Hook failure: User can still authenticate (fallback works)
- Monitor Supabase logs for hook errors
- Alert on hook errors (should be 0)

---

## Key Design Decisions

### Why Minimal Claims?

**Problem**: Large JWT claims slow every request and hit header limits.

**Solution**: Include ONLY 5 fields (~80 bytes):
- `plan`: Access level
- `status`: Subscription state
- `current_period_end`: Expiry detection
- `cancel_at_period_end`: Graceful cancellation handling
- `billing_version`: Deterministic staleness

**What's Excluded**:
- ❌ `rounds_used` - Changes frequently, enforce in server
- ❌ `plan_selected_at` - Not needed for access control
- ❌ `updated_at` - Use `billing_version` instead

### Why Status + Period End + Cancel Flag?

Enables middleware to handle edge cases without database queries:
- `past_due` → Revoke access immediately
- `paused` → Revoke access immediately
- `canceled` with `cancel_at_period_end=true` → Keep access until period end (graceful)
- `canceled` with `cancel_at_period_end=false` → Revoke access immediately
- `current_period_end` expired (with 2-min leeway) → Revoke access

**Critical**: The `cancel_at_period_end` flag prevents accidentally revoking access for users who canceled but paid through the end of their billing cycle. Without this, they'd lose access immediately on cancellation.

### Why Billing Version?

Deterministic staleness detection:
- Increments on every webhook
- Compare JWT version vs DB version
- No timestamp math required
- Enables future optimizations (version-based refresh)

### Why Server Remains Enforcer?

Middleware is a **coarse filter** for UX, not security:
- Fast route gating (<1ms)
- Acceptable staleness (1-60 min)
- Server verifies with Stripe for critical ops
- `getComprehensiveUserAccess()` remains for page-level checks

---

## References

- Original ticket: `.claude/tickets/0010-migrate-to-jwt-claims-access-control.md`
- Production feedback: (inline in this plan)
- Related documentation:
  - `.claude/plans/0004-refactor-stripe-billing-code/JWT_CLAIMS_MIGRATION.md`
  - `.claude/plans/0004-refactor-stripe-billing-code/SECURITY_NOTES.md`
- Supabase documentation:
  - [Custom Access Token Hooks](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
  - [JWT Fields](https://supabase.com/docs/guides/auth/jwt-fields)
  - [JWTs in Supabase](https://supabase.com/docs/guides/auth/jwts)
- Current implementation:
  - Middleware: `utils/supabase/middleware.ts:119`
  - Access control: `utils/billing/access-control.ts:26`
  - Webhook handlers: `app/api/stripe/webhook/route.ts`
  - Database schema: `db/schema.ts:39-43`

---

## Future Enhancements (Out of Scope)

- Supabase Stripe Sync Engine (better webhook reliability)
- Near-instant downgrade revocation (version-based refresh)
- Usage tracking in JWT (requires different architecture)
- Real-time claim updates (WebSocket/SSE)
- Reconciliation job (DB vs Stripe sync check)
- Remove database fallback (after 100% JWT coverage)
- Automated performance testing in CI/CD
- Advanced observability (Datadog, New Relic integration)
