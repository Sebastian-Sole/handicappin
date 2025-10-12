# 0010 - Migrate to JWT Claims-Based Access Control

## 🎯 **Description**

Migrate middleware access control from database queries to JWT claims to eliminate database calls on every request. This improves performance by ~200x (from ~200ms to <1ms per request) and reduces database connection pool pressure.

## 📋 **User Story**

As a user, I want faster page loads so that I can navigate the application without delays caused by middleware database queries on every request.

## 🔧 **Technical Context**

**Current Architecture (Problem):**

```typescript
// Middleware hits Supabase on EVERY request
const { data: profile } = await supabase
  .from("profile")
  .select("plan_selected, rounds_used")
  .eq("id", userId)
  .single();
```

**Performance Issues:**

- 🐌 50-200ms added latency per request
- 💥 Database becomes a single point of failure in middleware
- 💸 Database connection pool exhaustion under load (100 req/s = 100 DB queries/s)
- 🔄 Race conditions with webhook updates

**New Architecture (Solution):**
Store billing information in JWT `app_metadata` claims. Middleware decodes JWT (CPU-only, <1ms) instead of querying database.

**Security Note:**
JWT claims can be stale (1-60 minutes until token refresh), but this is acceptable because:

1. Middleware is a coarse filter, not source of truth
2. Page components still verify with Stripe for critical actions
3. Webhooks trigger metadata updates
4. Upgrades can force immediate refresh

## ✅ **Acceptance Criteria**

- [ ] Database trigger syncs `plan_selected` to JWT claims automatically
- [ ] Middleware reads billing info from JWT claims (no database query)
- [ ] Webhook handlers update JWT claims when billing changes
- [ ] JWT refresh endpoint created for immediate claim updates
- [ ] Middleware includes graceful fallback to database if claims missing
- [ ] Page load latency reduced by ~150ms (measured via monitoring)
- [ ] All webhook cases are handled to have a synced db
- [ ] All existing access control logic works identically
- [ ] Build passes with no TypeScript errors

## 🚨 **Technical Requirements**

### **Implementation Details**

#### 1. Create Database Trigger for Auto-Sync

Create Supabase migration to sync billing metadata to JWT claims:

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_sync_billing_to_jwt_claims.sql

-- Function to sync billing metadata to auth.users
CREATE OR REPLACE FUNCTION sync_billing_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update auth.users metadata when profile.plan_selected changes
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{billing}',
    jsonb_build_object(
      'plan', NEW.plan_selected,
      'rounds_used', NEW.rounds_used,
      'plan_selected_at', extract(epoch from NEW.plan_selected_at)::bigint,
      'updated_at', extract(epoch from NOW())::bigint
    )
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profile updates
CREATE TRIGGER sync_billing_metadata_trigger
  AFTER INSERT OR UPDATE OF plan_selected, rounds_used, plan_selected_at
  ON profile
  FOR EACH ROW
  EXECUTE FUNCTION sync_billing_to_auth_metadata();

-- Backfill existing users
UPDATE auth.users u
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{billing}',
  jsonb_build_object(
    'plan', p.plan_selected,
    'rounds_used', p.rounds_used,
    'plan_selected_at', extract(epoch from p.plan_selected_at)::bigint,
    'updated_at', extract(epoch from NOW())::bigint
  )
)
FROM profile p
WHERE u.id = p.id;
```

#### 2. Update Middleware to Read JWT Claims

```typescript
// utils/supabase/middleware.ts

export async function updateSession(request: NextRequest) {
  // ... existing session setup ...

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Read billing info from JWT claims (NO DATABASE QUERY!)
    const billing = user.app_metadata?.billing as
      | {
          plan?: string;
          rounds_used?: number;
          plan_selected_at?: number;
          updated_at?: number;
        }
      | undefined;

    // Graceful fallback to database if claims missing (during migration)
    let plan = billing?.plan || null;
    let roundsUsed = billing?.rounds_used || 0;

    if (!billing) {
      console.warn(
        `Missing JWT claims for user ${user.id}, falling back to database`
      );
      const access = await getBasicUserAccess(user.id);
      plan = access.plan;
      roundsUsed =
        access.remainingRounds === Infinity ? 0 : 25 - access.remainingRounds;
    }

    // Check access based on JWT claims
    if (!plan) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Check premium routes
    const isPremiumRoute = PREMIUM_PATHS.some((path) =>
      pathname.startsWith(path)
    );

    if (isPremiumRoute) {
      const hasPremiumAccess =
        plan === "premium" || plan === "unlimited" || plan === "lifetime";

      if (!hasPremiumAccess) {
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }
    }

    // Optional: Warn if claims are stale (>1 hour old)
    const claimsAge = billing?.updated_at
      ? Date.now() / 1000 - billing.updated_at
      : Infinity;

    if (claimsAge > 3600) {
      console.warn(
        `Stale billing claims for user ${user.id}: ${Math.floor(
          claimsAge / 60
        )} minutes old`
      );
    }
  }

  return supabaseResponse;
}
```

#### 3. Create JWT Refresh Endpoint

For immediate claim updates after checkout or subscription changes:

```typescript
// app/api/auth/refresh-claims/route.ts

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The database trigger will have already updated auth.users metadata
  // Force a token refresh by updating user (no-op that triggers refresh)
  const { data, error } = await supabase.auth.updateUser({
    data: {
      last_refresh: new Date().toISOString(),
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    billing: data.user?.app_metadata?.billing,
  });
}
```

#### 4. Update Webhook Handlers (Optional Enhancement)

Optionally trigger immediate JWT refresh after webhook updates:

```typescript
// app/api/stripe/webhook/route.ts

async function updatePlanAndNotifyUser(userId: string, plan: string) {
  // Database update (trigger handles JWT sync automatically)
  await db
    .update(profile)
    .set({
      planSelected: plan,
      planSelectedAt: new Date(),
    })
    .where(eq(profile.id, userId));

  // Optional: Notify any active sessions to refresh claims
  // (This could be done via WebSocket, SSE, or polling)
  // For now, claims will update on next natural token refresh

  logWebhookSuccess(`Updated plan to '${plan}' for user: ${userId}`);
}
```

#### 5. Update Checkout Success Page

Trigger immediate claim refresh after successful checkout:

```typescript
// app/billing/success/page.tsx

export default function BillingSuccessPage() {
  useEffect(() => {
    // Refresh JWT claims immediately
    fetch("/api/auth/refresh-claims", { method: "POST" })
      .then(() => {
        // Claims refreshed, redirect to dashboard
        router.push("/dashboard");
        router.refresh();
      })
      .catch((error) => {
        console.error("Failed to refresh claims:", error);
        // Continue anyway - claims will refresh naturally
      });
  }, []);

  return <div>Processing your subscription...</div>;
}
```

### **Dependencies**

- `supabase/migrations/*_sync_billing_to_jwt_claims.sql` - NEW migration
- `utils/supabase/middleware.ts` - MODIFY to read JWT claims
- `app/api/auth/refresh-claims/route.ts` - NEW endpoint
- `app/billing/success/page.tsx` - MODIFY to trigger refresh
- `utils/billing/access-control.ts` - UPDATE documentation
- Database trigger on `profile` table - NEW

### **Integration Points**

- Supabase Auth JWT tokens
- Database trigger system
- Webhook handlers (already update database, trigger handles JWT sync)
- Middleware access control
- Frontend checkout flow

## 🔍 **Implementation Notes**

### Performance Comparison

**Before (Current):**

```
Request → Middleware
  ↓ (50-200ms)
Supabase SELECT query
  ↓
Check plan_selected
  ↓
Continue to page
```

**Total added latency: 50-200ms per request**

**After (JWT Claims):**

```
Request → Middleware
  ↓ (<1ms)
Decode JWT (CPU only)
  ↓
Check app_metadata.billing.plan
  ↓
Continue to page
```

**Total added latency: <1ms per request**

**~200x faster!**

### Staleness Considerations

**When are claims updated?**

1. Webhook fires → DB updated → Trigger updates auth.users → New claims on next token refresh
2. User logs out/in → Fresh JWT with latest claims
3. Token refresh (automatic ~1 hour) → New claims
4. Manual refresh endpoint → Immediate update

**Staleness window:**

- Typical: 1-60 minutes (until next token refresh)
- Worst case: Until user logs out/in
- Mitigation: Call refresh endpoint after critical operations

**Is this acceptable?**
Yes, because:

- Middleware is a coarse filter, not source of truth
- Page components still verify with Stripe for critical actions
- Most users won't notice 1-60 minute delay on downgrades
- Upgrades can trigger immediate refresh

### Migration Strategy

1. **Phase 1: Add trigger** (backward compatible)

   - Deploy migration
   - Backfill existing users
   - Verify claims appear in JWT

2. **Phase 2: Update middleware** (with fallback)

   - Read from JWT claims first
   - Fall back to database if claims missing
   - Log warnings for missing claims

3. **Phase 3: Add refresh endpoint** (optional but recommended)

   - Create refresh endpoint
   - Update checkout success page
   - Test immediate refresh flow

4. **Phase 4: Remove fallback** (after monitoring)
   - Once confident all users have claims
   - Remove database fallback
   - Full JWT-only implementation

### Edge Cases

**Missing claims:**

- New users might not have claims immediately
- Fallback to database query (graceful degradation)
- Log warning for investigation

**Stale claims:**

- Detect claims older than 1 hour
- Log warning (for monitoring)
- Consider redirect to refresh endpoint
- Not a security issue (page components verify with Stripe)

**Trigger failure:**

- Database trigger might fail in rare cases
- Monitor for users with missing/stale claims
- Manual backfill script available

## 📊 **Definition of Done**

- [ ] Database trigger created and deployed
- [ ] Existing users backfilled with JWT claims
- [ ] Middleware reads from JWT claims (with fallback)
- [ ] JWT refresh endpoint created and tested
- [ ] Checkout success page triggers refresh
- [ ] Documentation updated with new architecture
- [ ] Performance improvement measured and verified
- [ ] Monitoring added for missing/stale claims
- [ ] Zero regressions in access control behavior

## 🧪 **Testing Requirements**

### Unit Tests

- [ ] Test JWT claim decoding in middleware
- [ ] Test fallback to database when claims missing
- [ ] Test stale claim detection
- [ ] Test refresh endpoint success/failure cases

### Integration Tests

- [ ] Complete checkout → verify JWT claims updated
- [ ] Webhook updates plan → verify JWT claims updated
- [ ] Login with existing user → verify claims present
- [ ] New user signup → verify claims created
- [ ] Token refresh → verify claims stay current

### Performance Tests

- [ ] Measure middleware latency before migration
- [ ] Measure middleware latency after migration
- [ ] Verify ~200x improvement (or ~150ms reduction)
- [ ] Load test: 1000 req/s should not hit database

### Manual Tests

- [ ] Upgrade to premium → immediate access granted
- [ ] Downgrade to free → access revoked (within 1 hour)
- [ ] Subscription expires → access revoked (within 1 hour)
- [ ] Force refresh endpoint → immediate claim update
- [ ] Logout/login → fresh claims loaded

## 🚫 **Out of Scope**

- Real-time claim updates (WebSocket/SSE)
- Redis/KV caching layer
- Subscription status tracking (separate ticket)
- Missing webhook events (separate ticket)
- Page-level Stripe verification audit (separate ticket)
- Reconciliation job (separate ticket)

## 📝 **Notes**

**Related Documentation:**

- `.claude/plans/0004-refactor-stripe-billing-code/JWT_CLAIMS_MIGRATION.md`
- `.claude/plans/0004-refactor-stripe-billing-code/SECURITY_NOTES.md`

**Related Tickets:**

- #0004 - Refactor and Clean Up Stripe Billing Code (completed)
- #0008 - Evaluate Stripe as Source of Truth (related discussion)

**Supabase Resources:**

- [Supabase Auth JWT Claims](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Database Triggers](https://supabase.com/docs/guides/database/postgres/triggers)
- [Auth Metadata](https://supabase.com/docs/guides/auth/managing-user-data#using-custom-claims)

**Alternative Approach:**
If JWT claims don't work (e.g., Supabase limitations), consider Redis/KV cache:

- Upstash Redis for edge-compatible KV store
- Webhooks update cache
- Middleware reads from cache (~5-10ms)
- More infrastructure, but still 20-40x faster than database

**Monitoring Recommendations:**

```typescript
// Add to middleware
if (!billing) {
  // Send to monitoring service (e.g., Sentry, LogRocket)
  console.error("METRIC: missing_jwt_claims", { userId: user.id });
}

if (claimsAge > 3600) {
  console.warn("METRIC: stale_jwt_claims", {
    userId: user.id,
    ageMinutes: Math.floor(claimsAge / 60),
  });
}
```

## 🏷️ **Labels**

- `priority: high`
- `type: enhancement`
- `component: billing`
- `component: auth`
- `performance`
- `scalability`
- `technical-improvement`
