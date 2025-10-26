# 0020 - Remove Middleware Database Fallback

## 🎯 **Description**

Remove the database fallback in middleware when JWT claims are missing and instead force token refresh to eliminate the authorization window where users could access features with stale/incorrect billing data. Currently, middleware falls back to querying the database when JWT claims are absent, which bypasses Stripe verification and could allow unauthorized access.

## 📋 **User Story**

As a security-conscious platform owner, I want middleware to always use fresh JWT claims with verified billing data so that users cannot bypass Stripe verification by manipulating their token state.

## 🔧 **Technical Context**

**Current State:**
- Middleware reads billing data from JWT claims ✅
- Falls back to database query if claims missing ❌
- Database fallback uses `getBasicUserAccess()` which doesn't verify with Stripe ❌

**The Problem:**

```typescript:utils/supabase/middleware.ts
// Lines 142-150
if (!billing) {
  console.warn(
    `⚠️ Missing JWT claims for user ${user.id}, falling back to database`
  );

  // ❌ VULNERABILITY: Database fallback bypasses Stripe verification
  const access = await getBasicUserAccess(user.id);
  plan = access.plan;
  hasPremiumAccess = access.hasPremiumAccess;
}
```

**What `getBasicUserAccess()` Does:**

```typescript:utils/billing/access-control.ts
// Lines 74-88
// Paid plan (trust database, Stripe verification happens in page components)
return {
  plan: profile.plan_selected as "premium" | "unlimited" | "lifetime",
  hasAccess: true,
  hasPremiumAccess: true,
  hasUnlimitedRounds: hasUnlimitedRounds(profile.plan_selected),
  remainingRounds: Infinity,
  status: "active", // ❌ Always returns "active" without checking Stripe!
  // ...
};
```

**Attack Scenarios:**

**Scenario 1: Canceled Subscription with Missing Claims**
1. User has premium subscription
2. User cancels subscription in Stripe
3. Webhook updates database (delayed/failed)
4. User somehow triggers missing JWT claims (token corruption, cache issue)
5. Middleware falls back to database
6. Database still shows "premium" (webhook hasn't updated yet)
7. User gets premium access without Stripe verification ❌

**Scenario 2: Token Manipulation**
1. Attacker finds way to strip JWT billing claims from token
2. Middleware falls back to database
3. Database shows canceled subscription as "premium"
4. Attacker gets access without Stripe check ❌

**Scenario 3: Database-First Attack**
1. Attacker compromises database (SQL injection, backup manipulation)
2. Sets `plan_selected = 'lifetime'`
3. Attacker forces missing JWT claims
4. Middleware falls back to database
5. Attacker gets lifetime access without ever paying ❌

**Security Impact:** 🟡 **MEDIUM**
- Authorization bypass via JWT manipulation
- Stale database data grants unauthorized access
- No Stripe verification in fallback path
- Creates window for privilege escalation

**References:**
- Security Assessment: Lines 428-477 (security-assessment.md)
- Security Assessment Evaluation: Lines 216-270 (security-assessment-evaluation.md)
- Middleware: utils/supabase/middleware.ts:142-151
- Access Control: utils/billing/access-control.ts:74-88

## ✅ **Acceptance Criteria**

- [ ] Remove database fallback from middleware
- [ ] Missing JWT claims trigger token refresh redirect
- [ ] Create `/api/auth/refresh-claims` endpoint
- [ ] Middleware redirects to refresh endpoint when claims missing
- [ ] After refresh, redirect back to original destination
- [ ] Failed refresh attempts redirect to login
- [ ] Add maximum retry limit (prevent infinite loops)
- [ ] Manual testing: Strip JWT claims, verify forced refresh
- [ ] Manual testing: Verify no database queries in middleware

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Create JWT Claims Refresh Endpoint**

```typescript:app/api/auth/refresh-claims/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('No valid session for refresh:', sessionError);

      // Redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(loginUrl);
    }

    // Force token refresh (this triggers JWT hook)
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      console.error('Failed to refresh session:', error);

      // Redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'refresh_failed');
      return NextResponse.redirect(loginUrl);
    }

    console.log('✅ JWT claims refreshed successfully');

    // Get return URL from query params
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';

    // Validate returnTo is a safe path (prevent open redirect)
    const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/';

    return NextResponse.redirect(new URL(safeReturnTo, request.url));
  } catch (error) {
    console.error('Error refreshing claims:', error);

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'unexpected_error');
    return NextResponse.redirect(loginUrl);
  }
}
```

**2. Update Middleware to Remove Database Fallback**

```typescript:utils/supabase/middleware.ts
// Lines 134-210 - REPLACE ENTIRE SECTION

if (
  user &&
  !isPublic &&
  !pathname.startsWith("/onboarding") &&
  !pathname.startsWith("/billing") &&
  !pathname.startsWith("/upgrade")
) {
  const startTime = performance.now();

  try {
    // Read billing info from JWT claims (NO DATABASE FALLBACK!)
    const billing = user.app_metadata?.billing as BillingClaims | undefined;

    // ✅ NEW: If claims missing, force token refresh
    if (!billing) {
      console.error(
        `❌ Missing JWT claims for user ${user.id} - forcing token refresh`
      );

      const url = request.nextUrl.clone();
      url.pathname = "/api/auth/refresh-claims";
      url.searchParams.set('returnTo', pathname);

      return NextResponse.redirect(url);
    }

    // JWT claims present - use them!
    const plan = billing.plan;
    const status = billing.status;
    let hasPremiumAccess: boolean = false;

    // Check for edge cases using status and period_end
    if (
      status === "past_due" ||
      status === "incomplete" ||
      status === "paused"
    ) {
      console.warn(`⚠️ Subscription ${status} for user ${user.id}`);
      hasPremiumAccess = false;
    }
    else if (status === "canceled") {
      if (billing.cancel_at_period_end && billing.current_period_end) {
        const nowSeconds = Date.now() / 1000;
        const isExpired =
          nowSeconds > billing.current_period_end + EXPIRY_LEEWAY_SECONDS;

        if (isExpired) {
          console.warn(`⚠️ Canceled subscription expired for user ${user.id}`);
          hasPremiumAccess = false;
        } else {
          hasPremiumAccess =
            plan === "premium" ||
            plan === "unlimited" ||
            plan === "lifetime";
        }
      } else {
        console.warn(`⚠️ Subscription canceled (immediate) for user ${user.id}`);
        hasPremiumAccess = false;
      }
    }
    else if (
      billing.current_period_end &&
      Date.now() / 1000 > billing.current_period_end + EXPIRY_LEEWAY_SECONDS
    ) {
      console.warn(`⚠️ Subscription expired for user ${user.id}`);
      hasPremiumAccess = false;
    }
    else {
      hasPremiumAccess =
        plan === "premium" || plan === "unlimited" || plan === "lifetime";
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Alert if middleware is slow (should be < 10ms with JWT-only)
    if (duration > 10) {
      console.warn(
        `🐌 Slow middleware detected: ${duration.toFixed(2)}ms (threshold: 10ms)`,
        {
          userId: user.id,
          pathname,
        }
      );
    }

    // Check if user needs onboarding (no plan selected)
    if (!plan) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Check premium routes
    const isPremiumRoute = premiumPaths.some((path) =>
      pathname.startsWith(path)
    );

    if (isPremiumRoute && !hasPremiumAccess) {
      const url = request.nextUrl.clone();
      url.pathname = "/upgrade";
      return NextResponse.redirect(url);
    }

    // Check if user is trying to add a round when at limit (free tier only)
    if (pathname.startsWith("/rounds/add") && plan === "free") {
      // Count rounds from database (fast query due to index)
      const { count: roundCount, error: countError } = await supabase
        .from("round")
        .select("*", { count: "exact", head: true })
        .eq("userId", user.id);

      if (countError) {
        console.error("❌ Middleware: Error counting rounds:", countError);
      } else {
        if (roundCount !== null && roundCount >= FREE_TIER_ROUND_LIMIT) {
          const url = request.nextUrl.clone();
          url.pathname = "/upgrade";
          url.searchParams.set("reason", "round_limit");
          return NextResponse.redirect(url);
        }
      }
    }
  } catch (error) {
    // On error, force token refresh (don't fall back to database!)
    console.error('❌ Middleware error - forcing token refresh:', error);

    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/refresh-claims";
    url.searchParams.set('returnTo', pathname);

    return NextResponse.redirect(url);
  }
}
```

**3. Update `getBasicUserAccess()` Documentation**

```typescript:utils/billing/access-control.ts
/**
 * ⚠️ DEPRECATED: This function should NOT be used for authorization decisions!
 *
 * Lightweight version of access control for Edge Runtime (middleware).
 * Reads MINIMAL billing info from database WITHOUT Stripe verification.
 *
 * ⚠️ SECURITY WARNING: This function does NOT verify with Stripe and should
 * ONLY be used for non-critical operations like displaying UI elements.
 *
 * ✅ USE INSTEAD:
 * - Middleware: Read billing data from JWT claims (user.app_metadata.billing)
 * - Server Actions: Use getComprehensiveUserAccess() which verifies with Stripe
 *
 * This function is kept for backward compatibility but will be removed in future.
 *
 * @deprecated Use JWT claims in middleware or getComprehensiveUserAccess() in server actions
 */
export async function getBasicUserAccess(
  userId: string
): Promise<FeatureAccess> {
  console.warn(
    '⚠️ DEPRECATED: getBasicUserAccess() called - use JWT claims or getComprehensiveUserAccess() instead'
  );

  // ... existing implementation ...
}
```

**4. Add Retry Protection**

```typescript:app/api/auth/refresh-claims/route.ts
// Add at top of file
const MAX_REFRESH_RETRIES = 3;
const REFRESH_RETRY_COOKIE = 'refresh_retry_count';

export async function GET(request: NextRequest) {
  // Check retry count
  const retryCount = parseInt(request.cookies.get(REFRESH_RETRY_COOKIE)?.value || '0');

  if (retryCount >= MAX_REFRESH_RETRIES) {
    console.error(`❌ Max refresh retries exceeded (${MAX_REFRESH_RETRIES})`);

    // Clear retry cookie and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(REFRESH_RETRY_COOKIE);
    return response;
  }

  try {
    // ... existing refresh logic ...

    // Success - clear retry count
    const response = NextResponse.redirect(new URL(safeReturnTo, request.url));
    response.cookies.delete(REFRESH_RETRY_COOKIE);
    return response;
  } catch (error) {
    // Increment retry count
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set(REFRESH_RETRY_COOKIE, String(retryCount + 1), {
      httpOnly: true,
      maxAge: 300, // 5 minutes
    });
    return response;
  }
}
```

### **Dependencies**

- `app/api/auth/refresh-claims/route.ts` - New endpoint for JWT refresh
- `utils/supabase/middleware.ts` - Remove database fallback
- `utils/billing/access-control.ts` - Add deprecation warning

### **Integration Points**

- Middleware authentication flow
- JWT Custom Access Token Hook (already exists)
- Supabase auth session management

## 🔍 **Implementation Notes**

### **Edge Cases:**

1. **First-Time Users (No JWT Claims Yet):**
   - New users won't have billing claims on first login
   - Redirect to `/api/auth/refresh-claims` triggers JWT hook
   - JWT hook reads profile table, populates claims
   - User gets redirected back to original page

2. **JWT Hook Failure:**
   - If JWT hook fails to populate claims, refresh also fails
   - Redirect to login with error message
   - User can retry login to fix

3. **Infinite Redirect Loops:**
   - Protected by retry count cookie
   - After 3 retries, force login
   - Cookie expires after 5 minutes

4. **Concurrent Requests During Refresh:**
   - Multiple tabs/requests might trigger multiple refreshes
   - Supabase handles concurrent refresh gracefully
   - All requests get new token with claims

### **User Experience:**

**Before (With Database Fallback):**
```
User visits /dashboard
  ↓
Middleware checks JWT claims
  ↓
Claims missing → Query database ❌
  ↓
Database says "premium" (stale)
  ↓
User sees dashboard (bypassed Stripe verification)
```

**After (No Database Fallback):**
```
User visits /dashboard
  ↓
Middleware checks JWT claims
  ↓
Claims missing → Redirect to /api/auth/refresh-claims
  ↓
Refresh token (triggers JWT hook)
  ↓
JWT hook reads profile + verifies with Stripe ✅
  ↓
Redirect back to /dashboard
  ↓
User sees dashboard (with verified billing data)
```

**Impact:** One-time redirect (< 500ms) for users with missing claims

### **Performance Considerations:**

- JWT claims check is instant (in-memory)
- No database query in middleware path ✅
- Refresh redirect adds ~500ms on first request
- Subsequent requests are instant (claims cached in token)

## 📊 **Definition of Done**

- [ ] `/api/auth/refresh-claims` endpoint created
- [ ] Middleware database fallback removed
- [ ] Middleware redirects to refresh endpoint when claims missing
- [ ] Retry protection implemented (max 3 retries)
- [ ] Return URL properly encoded and validated (prevent open redirect)
- [ ] `getBasicUserAccess()` marked as deprecated with warning
- [ ] Manual testing: Strip JWT claims, verify forced refresh
- [ ] Manual testing: Verify no database queries in middleware
- [ ] Manual testing: Test retry protection (max 3 attempts)

## 🧪 **Testing Requirements**

### **Unit Tests:**

```typescript
test('should redirect to refresh endpoint when JWT claims missing', async () => {
  const request = createMockRequest({
    pathname: '/dashboard',
    user: { id: 'user-123', app_metadata: {} }, // No billing claims
  });

  const response = await updateSession(request);

  expect(response.status).toBe(307); // Redirect
  expect(response.headers.get('location')).toContain('/api/auth/refresh-claims');
  expect(response.headers.get('location')).toContain('returnTo=%2Fdashboard');
});

test('should allow access when JWT claims present', async () => {
  const request = createMockRequest({
    pathname: '/dashboard',
    user: {
      id: 'user-123',
      app_metadata: {
        billing: {
          plan: 'premium',
          status: 'active',
          current_period_end: null,
          cancel_at_period_end: false,
          billing_version: 1,
        },
      },
    },
  });

  const response = await updateSession(request);

  expect(response.status).toBe(200); // Pass through
});
```

### **Integration Tests:**

```typescript
test('should refresh JWT claims and return to original page', async () => {
  // 1. Setup user with premium plan in database
  await db.insert(profile).values({
    id: 'user-123',
    planSelected: 'premium',
  });

  // 2. Make request to refresh endpoint
  const response = await GET(createMockRequest({
    searchParams: { returnTo: '/dashboard' },
    cookies: { /* valid session cookies */ },
  }));

  // 3. Verify redirect to /dashboard
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('/dashboard');

  // 4. Verify JWT claims populated
  const session = await supabase.auth.getSession();
  expect(session.data.session?.user.app_metadata.billing.plan).toBe('premium');
});

test('should prevent infinite refresh loops', async () => {
  // 1. Set retry count cookie to 3
  const response = await GET(createMockRequest({
    cookies: { refresh_retry_count: '3' },
  }));

  // 2. Verify redirect to login
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toContain('/login');

  // 3. Verify retry cookie deleted
  expect(response.cookies.get('refresh_retry_count')).toBeUndefined();
});
```

### **Manual Testing:**

```bash
# 1. Start dev server
pnpm dev

# 2. Login to app
open http://localhost:3000/login

# 3. Use browser dev tools to corrupt JWT claims
# In Application > Cookies, edit supabase.auth.token
# Remove billing data from app_metadata

# 4. Navigate to /dashboard
# Should see redirect to /api/auth/refresh-claims
# Then redirect back to /dashboard

# 5. Verify console logs
# Should see: "✅ JWT claims refreshed successfully"

# 6. Verify no database queries in middleware
# Check logs for "⚠️ Missing JWT claims for user"
# Should NOT see any database fallback messages
```

## 🚫 **Out of Scope**

- Automatic background JWT refresh (separate ticket)
- Client-side refresh trigger mechanism
- Admin dashboard for monitoring refresh failures
- Metrics/analytics for refresh frequency
- Retry backoff strategy (exponential delay)

## 📝 **Notes**

**Why This Matters:**

1. **Security:**
   - Eliminates authorization bypass via database fallback
   - Ensures all access decisions use Stripe-verified data
   - Prevents stale database data from granting access

2. **Consistency:**
   - Single source of truth (JWT claims)
   - No divergence between JWT and database
   - Reduces complexity and edge cases

3. **Performance:**
   - JWT-only middleware is faster (no database queries)
   - Refresh is one-time cost per token lifecycle
   - Better scaling characteristics

**Migration Plan:**

1. Deploy refresh endpoint first
2. Update middleware to redirect (not fail)
3. Monitor refresh rate and failures
4. After stable period, mark `getBasicUserAccess()` as deprecated
5. Eventually remove database fallback entirely

**Rollback Plan:**

If refresh endpoint causes issues:
1. Revert middleware changes
2. Keep database fallback temporarily
3. Fix refresh endpoint issues
4. Redeploy with fixes

**Related Tickets:**
- Ticket #0016: JWT Refresh After Webhook Updates
- Ticket #0010: Migrate to JWT Claims Access Control (implemented)

## 🏷️ **Labels**

- `priority: medium`
- `type: security`
- `component: auth`
- `component: middleware`
- `authorization`
- `jwt-claims`
- `stripe-integration`
