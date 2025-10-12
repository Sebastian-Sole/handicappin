# Migration Plan: Move to JWT Claims for Billing Access

## Why JWT Claims?

Current approach hits Supabase DB on every request in middleware. This adds:
- 50-200ms latency per request
- Database as single point of failure
- Connection pool pressure under load

**JWT claims are stored in the auth token itself** - no DB lookup needed!

---

## Architecture

### Current Flow:
```
Request → Middleware → Supabase Query (slow!) → Check plan_selected → Continue
```

### New Flow:
```
Request → Middleware → Decode JWT (fast!) → Check app_metadata.billing → Continue
```

---

## Implementation Steps

### Step 1: Update Supabase Auth Hooks

Supabase allows setting custom claims via database triggers or Auth Hooks.

**Option A: Database Trigger (Recommended)**

```sql
-- Create function to sync billing metadata to auth.users
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
      'updated_at', extract(epoch from NOW())::bigint
    )
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profile updates
CREATE TRIGGER sync_billing_metadata_trigger
  AFTER INSERT OR UPDATE OF plan_selected, rounds_used
  ON profile
  FOR EACH ROW
  EXECUTE FUNCTION sync_billing_to_auth_metadata();
```

**Option B: Auth Hook (Requires Supabase Edge Function)**

Create edge function at `supabase/functions/auth-hook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { event, user_id } = await req.json();

  // Only run on login or token refresh
  if (event === "token.refresh" || event === "login") {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch latest billing info
    const { data: profile } = await supabase
      .from("profile")
      .select("plan_selected, rounds_used")
      .eq("id", user_id)
      .single();

    // Return custom claims
    return new Response(
      JSON.stringify({
        app_metadata: {
          billing: {
            plan: profile?.plan_selected || "free",
            rounds_used: profile?.rounds_used || 0,
            updated_at: Math.floor(Date.now() / 1000),
          },
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({}), {
    headers: { "Content-Type": "application/json" },
  });
});
```

---

### Step 2: Update Webhook Handlers to Refresh JWT

When Stripe webhooks update billing, we need to force a JWT refresh:

```typescript
// app/api/stripe/webhook/route.ts

async function updatePlanAndRefreshJWT(userId: string, plan: string) {
  // Update database
  await db.update(profile).set({
    planSelected: plan,
    planSelectedAt: new Date(),
  }).where(eq(profile.id, userId));

  // Option 1: Database trigger handles it automatically ✅
  // (No additional code needed if using Step 1 Option A)

  // Option 2: Manually update auth.users
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key!
  );

  await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      billing: {
        plan,
        rounds_used: 0, // Fetch current value if needed
        updated_at: Math.floor(Date.now() / 1000),
      },
    },
  });

  logWebhookSuccess(`Updated plan and JWT claims for user: ${userId}`);
}
```

---

### Step 3: Update Middleware to Read JWT Claims

```typescript
// utils/supabase/middleware.ts

export async function updateSession(request: NextRequest) {
  // ... existing session setup ...

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Read billing info from JWT claims (NO DATABASE QUERY!)
    const billing = user.app_metadata?.billing as {
      plan?: string;
      rounds_used?: number;
      updated_at?: number;
    } | undefined;

    const plan = billing?.plan || null;
    const roundsUsed = billing?.rounds_used || 0;

    // Check access based on JWT claims
    if (!plan) {
      // No plan selected - redirect to onboarding
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Check premium routes
    const premiumPaths = PREMIUM_PATHS;
    const isPremiumRoute = premiumPaths.some((path) =>
      pathname.startsWith(path)
    );

    if (isPremiumRoute) {
      const hasPremiumAccess =
        plan === "premium" ||
        plan === "unlimited" ||
        plan === "lifetime";

      if (!hasPremiumAccess) {
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }
    }

    // Optional: Check if claims are stale (older than 1 hour)
    const claimsAge = billing?.updated_at
      ? Date.now() / 1000 - billing.updated_at
      : Infinity;

    if (claimsAge > 3600) {
      // Claims are stale - could redirect to refresh endpoint
      // OR just log and continue (refresh happens on next login)
      console.warn(`Stale billing claims for user ${user.id}: ${claimsAge}s old`);
    }
  }

  return supabaseResponse;
}
```

---

### Step 4: Add JWT Refresh Endpoint (Optional)

For immediate claim updates (e.g., after checkout):

```typescript
// app/api/auth/refresh-claims/route.ts

import { createServerComponentClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerComponentClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch latest billing info from database
  const { data: profile } = await supabase
    .from("profile")
    .select("plan_selected, rounds_used")
    .eq("id", user.id)
    .single();

  // Update JWT claims
  const { data, error } = await supabase.auth.updateUser({
    data: {
      billing: {
        plan: profile?.plan_selected || "free",
        rounds_used: profile?.rounds_used || 0,
        updated_at: Math.floor(Date.now() / 1000),
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, billing: data.user?.app_metadata?.billing });
}
```

Call this after successful checkout:

```typescript
// In checkout success page
await fetch("/api/auth/refresh-claims", { method: "POST" });
```

---

## Performance Comparison

### Before (Current):
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

### After (JWT Claims):
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

---

## Staleness Considerations

### When are claims updated?

1. **Webhook fires** → Database updated → Trigger updates auth.users → New claims on next token refresh
2. **User logs out/in** → Fresh JWT with latest claims
3. **Token refresh** (happens automatically every ~1 hour) → New claims
4. **Manual refresh** (optional endpoint) → Immediate update

### Staleness window:

- **Typical**: 1-60 minutes (until next token refresh)
- **Worst case**: Until user logs out/in
- **Mitigation**: Call refresh endpoint after critical operations (checkout, cancellation)

### Is this acceptable?

**Yes!** Because:
- Middleware is a **coarse filter**, not source of truth
- Page components still do Stripe verification for critical actions
- Most users won't notice 1-60 minute delay on downgrades
- Upgrades can trigger immediate refresh

---

## Migration Checklist

- [ ] Add database trigger or auth hook (Step 1)
- [ ] Update webhook handlers to update JWT claims (Step 2)
- [ ] Refactor middleware to read from JWT (Step 3)
- [ ] Add refresh endpoint (Step 4 - optional)
- [ ] Test: Checkout flow updates JWT claims
- [ ] Test: Webhook updates JWT claims
- [ ] Test: Middleware reads from JWT (no DB query)
- [ ] Test: Stale claims eventually refresh
- [ ] Remove old `getBasicUserAccess()` function
- [ ] Deploy and monitor latency improvements

---

## Rollback Plan

If issues arise:
1. Middleware can fall back to `getBasicUserAccess()` if JWT claims missing
2. Keep both approaches running in parallel initially
3. Monitor error rates and latency

```typescript
// Graceful fallback
const billing = user.app_metadata?.billing;
if (!billing) {
  // JWT claims not yet migrated - fall back to DB
  console.warn("Missing JWT claims, falling back to DB");
  return await getBasicUserAccess(user.id);
}
```

---

## Expected Results

- ⚡ **200x faster middleware** (~1ms vs ~200ms)
- 📉 **90% reduction in database queries**
- 🎯 **Better user experience** (faster page loads)
- 🔒 **Same security** (still verify with Stripe on critical actions)
- 💪 **Better scalability** (no DB connection pool pressure)

---

## Alternative: Redis/KV Cache

If you can't use JWT claims (e.g., need real-time updates), Redis is the next best option:

```typescript
// Middleware
const billing = await redis.get(`billing:${userId}`);
// Still fast (~5-10ms), but adds Redis as dependency
```

**Recommendation: Start with JWT claims** (simpler, no new infrastructure)
