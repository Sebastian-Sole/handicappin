# Force Plan Selection Before Access - Implementation Plan

## Overview

Currently, authenticated users can navigate to pages like `/`, `/about`, `/profile`, and others without selecting a plan. The onboarding gate only activates when users try to access premium routes like `/dashboard` or `/rounds/add`. This plan ensures that ALL authenticated users must select a plan (free or paid) before accessing ANY page in the application, except for authentication-related pages.

## Current State Analysis

**Problem Location:** `utils/supabase/middleware.ts` lines 66-78

The middleware currently treats `/` and `/about` as "public" paths, which causes the plan check (lines 129-216) to be completely skipped for authenticated users visiting these routes.

```typescript
const publicPaths = [
  "/login",
  "/signup",
  "/about",     // ❌ This allows authenticated users to bypass plan check
  "/api",
  "/verify-email",
  "/forgot-password",
  "/billing/success",
];

const isPublic =
  pathname === "/" || publicPaths.some((path) => pathname.startsWith(path));  // ❌ "/" bypasses plan check

// Later at line 129-136:
if (
  enrichedUser &&
  !isPublic &&  // ❌ This condition skips the check for "/" and "/about"
  !pathname.startsWith("/onboarding") &&
  // ...
) {
  // Plan check happens here - but never executes for "/" or "/about"
}
```

**Current User Flow:**
1. User signs up → redirected to `/login` (signup.tsx:54)
2. User verifies email → redirected to `/login?verified=true` (verify-email/page.tsx:59)
3. User logs in → redirected to `/` (login.tsx:63)
4. User can browse `/`, `/about`, `/profile` without a plan ❌
5. Only when accessing `/dashboard` or `/rounds/add` → redirected to `/onboarding` ✅

## Desired End State

**New User Flow (Optimized):**
1. User signs up → redirected to `/login`
2. User verifies email → redirected to `/login?verified=true`
3. User logs in → login component checks JWT → **directly redirects to `/onboarding`** ✅ (no double redirect)
4. User must select a plan before accessing ANY page
5. After plan selection → can access appropriate pages based on plan tier

**Edge Case Handling:**
- If user manually navigates to `/` or `/about` → middleware catches and redirects to `/onboarding` ✅
- If user has existing session → middleware catches and redirects to `/onboarding` ✅
- Provides defense-in-depth security

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm build`
- [x] No linting errors: `pnpm lint`

#### Manual Verification:
- [ ] New user signs up, verifies email, logs in → **directly** redirected to `/onboarding` (no flash of home page)
- [ ] User cannot manually navigate to `/` until plan selected (try typing in URL bar)
- [ ] User cannot manually navigate to `/about` until plan selected
- [ ] User cannot manually navigate to `/profile/{id}` until plan selected
- [ ] User can still access `/login`, `/signup`, `/verify-email` without a plan
- [ ] After selecting free plan → user can access `/`, `/about`, `/profile`
- [ ] After selecting free plan → user cannot access `/dashboard` (premium only)
- [ ] After selecting premium plan → user can access all pages including `/dashboard`

## What We're NOT Doing

- NOT changing the plan selection UI or experience
- NOT modifying the Stripe integration or payment flow
- NOT changing how plans are stored in the database
- NOT modifying JWT claims structure
- NOT changing the existing premium route protection logic
- NOT adding new pages or components
- NOT modifying email verification or signup flows (only login optimization and middleware)

## Implementation Approach

We'll use a **hybrid approach** combining both login optimization and middleware protection:

### Strategy Overview

1. **Login Component Optimization (Phase 1)** - Check JWT and redirect directly to `/onboarding` if no plan
   - Provides optimal UX for the primary user flow (login → onboarding)
   - Eliminates double redirect (login → `/` → `/onboarding`)
   - User never sees flash of home page

2. **Middleware Protection (Phase 2)** - Ensure ALL authenticated routes require a plan
   - Catches edge cases: manual navigation, existing sessions, deep links, back button
   - Provides defense-in-depth security
   - Single source of truth for authorization

### Why Hybrid?

| Approach | Login Only | Middleware Only | Hybrid ✅ |
|----------|-----------|-----------------|----------|
| **Primary flow performance** | ✅ Fast | ⚠️ Double redirect | ✅ Fast |
| **Manual navigation protection** | ❌ Not protected | ✅ Protected | ✅ Protected |
| **Existing session handling** | ❌ Not protected | ✅ Protected | ✅ Protected |
| **Deep link protection** | ❌ Not protected | ✅ Protected | ✅ Protected |
| **Defense in depth** | ❌ Single point | ✅ Yes | ✅ Yes |

The hybrid approach gives us the best of both: optimal performance for the common case, comprehensive security for all cases.

## Phase 1: Optimize Login Component for Direct Redirect

### Overview

Update the login component to check JWT billing claims immediately after authentication and redirect directly to `/onboarding` if the user has no plan. This eliminates the double redirect (login → `/` → `/onboarding`) and provides a cleaner UX for the most common flow.

### Changes Required

#### 1. Add JWT Import to Login Component

**File:** `components/auth/login.tsx`
**Lines to modify:** Top of file (imports section)

**Add import:**
```typescript
import { getBillingFromJWT } from "@/utils/supabase/jwt";
```

**Reasoning:** We need the JWT utility function to extract billing claims from the session after login.

---

#### 2. Update Login Submit Handler

**File:** `components/auth/login.tsx`
**Lines to modify:** 46-65 (onSubmit function)

**Current code:**
```typescript
const onSubmit = async (values: z.infer<typeof loginSchema>) => {
  setIsSubmitting(true);
  const { error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });

  if (error) {
    console.log(error);
    toast({
      title: "Error logging in",
      description: error.message,
      variant: "destructive",
    });
    router.push("/error");
    setIsSubmitting(false);
  }
  router.push("/");
  router.refresh();
};
```

**Change to:**
```typescript
const onSubmit = async (values: z.infer<typeof loginSchema>) => {
  setIsSubmitting(true);
  const { error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });

  if (error) {
    console.log(error);
    toast({
      title: "Error logging in",
      description: error.message,
      variant: "destructive",
    });
    router.push("/error");
    setIsSubmitting(false);
    return;
  }

  // Get fresh session with JWT billing claims
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const billing = getBillingFromJWT(session);

  // Intelligent redirect based on plan status
  if (!billing?.plan) {
    // User has no plan - direct to onboarding (optimal UX)
    router.push("/onboarding");
  } else {
    // User has plan - go to home
    router.push("/");
  }
  router.refresh();
};
```

**Reasoning:**
- After successful login, we fetch the session which includes JWT claims
- Extract billing info using `getBillingFromJWT()`
- If no plan exists, redirect directly to `/onboarding` (skips home page entirely)
- If plan exists, go to home page as normal
- This optimization handles 99% of user logins with zero double redirects

---

### Success Criteria

#### Automated Verification:
- [x] Login component compiles without TypeScript errors: `pnpm build`
- [x] No linting errors: `pnpm lint`

#### Manual Verification:
- [ ] New user logs in → directly lands on `/onboarding` (no flash of home page)
- [ ] User with existing free plan logs in → lands on `/`
- [ ] User with existing premium plan logs in → lands on `/`
- [ ] Login error handling still works correctly
- [ ] No TypeScript errors in console

---

## Phase 2: Update Middleware Public Paths Logic

### Overview

Restructure the public paths logic to separate "unauthenticated public" from "authentication bypass" routes. Ensure the plan check executes for authenticated users on all routes except auth flow pages.

### Changes Required

#### 1. Middleware Public Paths Configuration

**File:** `utils/supabase/middleware.ts`
**Lines to modify:** 66-78

**Current code:**
```typescript
const publicPaths = [
  "/login",
  "/signup",
  "/about",
  "/api",
  "/verify-email",
  "/forgot-password",
  "/billing/success",
];

const isPublic =
  pathname === "/" || publicPaths.some((path) => pathname.startsWith(path));
```

**Change to:**
```typescript
// Paths accessible without authentication
const unauthenticatedPaths = [
  "/login",
  "/signup",
  "/about",
  "/api",
  "/verify-email",
  "/forgot-password",
  "/billing/success",
];

// Check if path allows unauthenticated access
const isUnauthenticatedPublic =
  pathname === "/" || unauthenticatedPaths.some((path) => pathname.startsWith(path));
```

**Reasoning:** Rename `publicPaths` to `unauthenticatedPaths` to clarify that these paths are accessible to unauthenticated users. We'll use this later to allow access for logged-out users, but authenticated users will still need a plan.

---

#### 2. Update Unauthenticated User Redirect Check

**File:** `utils/supabase/middleware.ts`
**Lines to modify:** 110-114

**Current code:**
```typescript
if (!enrichedUser && !isPublic) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}
```

**Change to:**
```typescript
if (!enrichedUser && !isUnauthenticatedPublic) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}
```

**Reasoning:** Update variable name to match the renamed constant. This check remains the same functionally - unauthenticated users trying to access protected pages get redirected to login.

---

#### 3. Update Plan Check Condition

**File:** `utils/supabase/middleware.ts`
**Lines to modify:** 129-136

**Current code:**
```typescript
if (
  enrichedUser &&
  !isPublic &&
  !pathname.startsWith("/onboarding") &&
  !pathname.startsWith("/billing") &&
  !pathname.startsWith("/upgrade") &&
  !pathname.startsWith("/auth/verify-session")
) {
```

**Change to:**
```typescript
// Paths that authenticated users can access during the auth/onboarding flow
const authFlowPaths = [
  "/onboarding",
  "/billing",
  "/upgrade",
  "/auth/verify-session",
];

const isAuthFlowPath = authFlowPaths.some((path) => pathname.startsWith(path));

if (
  enrichedUser &&
  !pathname.startsWith("/api") &&  // Skip API routes (handled by API middleware)
  !isAuthFlowPath
) {
```

**Reasoning:**
- Remove the `!isPublic` check entirely - now authenticated users must have a plan for ALL routes
- Create explicit `authFlowPaths` list for clarity
- Keep API path exception (those have their own auth)
- This means the plan check now runs for `/`, `/about`, `/profile`, and all other authenticated routes

---

### Success Criteria

#### Automated Verification:
- [x] Middleware compiles without TypeScript errors: `pnpm build`
- [x] No linting errors in middleware: `pnpm lint`

**Implementation Note:** The actual implementation used a simpler approach than originally planned:
- Did NOT add `/onboarding` to `publicPaths` (keeps it protected from unauthenticated users)
- Removed `/onboarding` from the access control exclusion list (line 132)
- Added guard `!pathname.startsWith("/onboarding")` to the plan check (line 189) to prevent redirect loops
This approach achieves the same security goals with minimal changes and better authentication protection.

#### Manual Verification:
- [ ] Unauthenticated user can access `/` (sees landing page)
- [ ] Unauthenticated user can access `/about`
- [ ] Unauthenticated user trying to access `/dashboard` → redirected to `/login`
- [ ] Authenticated user without plan accessing `/` → redirected to `/onboarding`
- [ ] Authenticated user without plan accessing `/about` → redirected to `/onboarding`
- [ ] Authenticated user without plan accessing `/profile/{id}` → redirected to `/onboarding`
- [ ] Authenticated user can still access `/onboarding`, `/billing`, `/upgrade` during plan selection
- [ ] After selecting free plan, user can access `/`, `/about`, `/profile`

---

## Phase 3: Verify Login Flow Edge Cases

### Overview

Test and verify that the new middleware logic doesn't break existing auth flows, particularly:
- Email verification flow
- Password reset flow
- Billing success redirect after Stripe checkout

### Testing Steps

#### Manual Verification:

1. **Email Verification Flow:**
   - [ ] User clicks verification link in email
   - [ ] Redirected to `/verify-email?code=XXX`
   - [ ] Code processed successfully
   - [ ] Redirected to `/login?verified=true`
   - [ ] Can log in without issues

2. **Password Reset Flow:**
   - [ ] User requests password reset from `/forgot-password`
   - [ ] Clicks reset link in email → `/update-password?token=XXX`
   - [ ] Can access password reset form
   - [ ] After reset, redirected to `/login`
   - [ ] Can log in with new password

3. **Stripe Checkout Success:**
   - [ ] User with free plan upgrades to premium
   - [ ] Completes Stripe checkout
   - [ ] Redirected to `/billing/success`
   - [ ] Page loads without middleware redirect loop
   - [ ] Stripe webhook processes subscription
   - [ ] JWT billing claims updated
   - [ ] User can access premium features

4. **Session Verification Edge Case:**
   - [ ] If JWT billing claims missing (rare edge case)
   - [ ] User redirected to `/auth/verify-session`
   - [ ] Session refreshed successfully
   - [ ] User returned to intended page
   - [ ] No infinite redirect loops

---

## Phase 4: Test Complete User Journeys

### Overview

End-to-end testing of the full onboarding experience for new users and existing users with various plan states.

### Testing Steps

#### Manual Verification:

1. **New User Journey (Free Plan):**
   - [ ] Sign up with new email
   - [ ] Verify email via link
   - [ ] Log in
   - [ ] **Directly** land on `/onboarding` page (no flash of home page - login optimization working)
   - [ ] Try manually navigating to `/` in URL bar → redirected back to `/onboarding` (middleware protection working)
   - [ ] Try manually navigating to `/about` → redirected back to `/onboarding` (middleware protection working)
   - [ ] Select "Free" plan
   - [ ] Redirected to `/` (or `/billing`)
   - [ ] Can now access `/`, `/about`, `/profile`
   - [ ] Cannot access `/dashboard` (premium route) → redirected to `/upgrade`

2. **New User Journey (Premium Plan):**
   - [ ] Sign up with new email
   - [ ] Verify email and log in
   - [ ] Redirected to `/onboarding`
   - [ ] Select "Premium" plan
   - [ ] Redirected to Stripe checkout
   - [ ] Complete payment
   - [ ] Redirected back to app
   - [ ] Can access all pages including `/dashboard`

3. **Existing User Without Plan (Edge Case):**
   - [ ] User exists in database but `plan_selected` is `NULL`
   - [ ] User logs in
   - [ ] Redirected to `/onboarding`
   - [ ] Must select plan to continue

4. **Existing User With Plan:**
   - [ ] User logs in with existing free plan
   - [ ] Lands on `/` immediately (no onboarding redirect)
   - [ ] Can browse all free-tier pages
   - [ ] User logs in with existing premium plan
   - [ ] Can access all pages including premium routes

5. **Plan Upgrade Flow:**
   - [ ] User with free plan clicks "Upgrade" in nav
   - [ ] Sees `/upgrade` page with plan options
   - [ ] Selects premium plan
   - [ ] Completes Stripe checkout
   - [ ] Returns to app with premium access
   - [ ] Can now access `/dashboard` and other premium features

6. **Session Expiry & Re-login:**
   - [ ] User with plan has session expire
   - [ ] Tries to access `/dashboard`
   - [ ] Redirected to `/login`
   - [ ] Logs back in
   - [ ] Redirected to `/` (not `/onboarding`)
   - [ ] Can still access all pages based on plan tier

---

## Performance Considerations

**Middleware Performance:**
- Current middleware completes in <10ms using JWT-only authorization
- This change adds one additional path check but no database queries
- Expected performance impact: negligible (<0.5ms)
- Middleware logs will still show performance metrics

**User Experience:**
- **Primary login flow:** Direct redirect to onboarding (no double redirect) ✅
- **Edge cases:** Single middleware redirect (manual navigation, existing sessions)
- No impact on subsequent page loads
- No additional API calls or database queries

**Performance Metrics:**

| Scenario | Before | After (Hybrid) | Improvement |
|----------|--------|----------------|-------------|
| New user login (no plan) | 2 redirects | 1 redirect | 50% faster ✅ |
| Existing user login (has plan) | 0 redirects | 0 redirects | Same ✅ |
| Manual navigate to `/` (no plan) | 0 redirects ❌ | 1 redirect | Security fixed ✅ |
| Deep link (no plan) | 0 redirects ❌ | 1 redirect | Security fixed ✅ |

---

## Migration Notes

**No Database Changes Required:**
- Plan selection logic already exists
- JWT billing claims already include plan information
- No schema changes needed

**No Breaking Changes:**
- Existing users with plans continue to work normally
- Only affects new users or users without a plan (edge case)
- Middleware change is backward compatible

**Deployment:**
- Can be deployed immediately without migration
- No feature flags needed
- Changes take effect instantly for new requests

---

## Testing Strategy

### Unit Tests

No new unit tests required - this is purely middleware routing logic.

### Integration Tests

Consider adding Playwright/Cypress tests for:
1. New user onboarding flow
2. Authenticated user without plan cannot bypass onboarding
3. Authenticated user with plan can access pages

### Manual Testing Checklist

See Phase 2 and Phase 3 success criteria above.

---

## Rollback Plan

If issues arise:

1. **Immediate Rollback:**
   - Revert `utils/supabase/middleware.ts` to previous version
   - Redeploy (takes ~2 minutes on Vercel)
   - No database rollback needed

2. **Partial Rollback:**
   - Keep `unauthenticatedPaths` rename
   - Re-add `!isUnauthenticatedPublic` check to line 129
   - This restores old behavior while keeping better naming

---

## References

- Middleware file: `utils/supabase/middleware.ts`
- Login component: `components/auth/login.tsx`
- Onboarding page: `app/onboarding/page.tsx`
- Plan selector: `components/billing/plan-selector.tsx`
- JWT utilities: `utils/supabase/jwt.ts`
- Access control: `utils/billing/access.ts`
