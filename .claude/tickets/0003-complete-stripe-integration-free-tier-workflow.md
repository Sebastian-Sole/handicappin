# 0003 - Complete Stripe Integration: Free Tier Access & Workflow

## 🎯 **Description**

Complete the Stripe integration implementation by fixing free tier access control, implementing proper route restrictions, and ensuring the complete user workflow functions correctly. The current implementation has a partial Stripe integration but free users cannot access the application due to middleware blocking them. This ticket resolves access control issues and implements the required workflow: signup → verify email → (user has restricted access and must go through onboarding) → choose plan.

## 📋 **User Story**

**As a free tier user**, I want to access most of the application features (except dashboard and calculators) so that I can experience the basic functionality before upgrading.

**As a premium/unlimited user**, I want exclusive access to the dashboard and advanced calculators so that I receive value from my paid subscription.

**As a new user**, I want a smooth onboarding flow where I verify my email, then choose a plan, so that I can start using the application immediately.

## 🔧 **Technical Context**

### Current Implementation State

The codebase has a **partial Stripe integration** following the Checkout + Portal approach (Ticket #0002):

**✅ What's Working:**
- Stripe client library (`lib/stripe.ts`) with checkout session creation
- Webhook handler receiving and logging Stripe events (`app/api/stripe/webhook/route.ts`)
- Customer portal integration (`app/api/stripe/portal/route.ts`)
- Onboarding page with plan selection UI (`app/onboarding/page.tsx`)
- Access control utilities that query Stripe directly (`utils/billing/access-control.ts`)
- Middleware performing authentication and entitlement checks

**❌ What's Broken:**

1. **Free Tier Access Control Bug**:
   - `getFreeAccess()` in `access-control.ts` returns `hasAccess: false` (line 181)
   - Middleware checks `if (!access.hasAccess)` and redirects to onboarding (line 129)
   - **Result**: Free users are stuck in redirect loop, can't access app

2. **Middleware Route Configuration**:
   - `/calculators` is in `publicPaths` array (line 49), making it accessible to everyone
   - **Requirement**: `/calculators` should be **premium-only**
   - `/dashboard` has no explicit protection in middleware
   - **Requirement**: `/dashboard` should be **paid users only**

3. **Access Control Logic Confusion**:
   - `hasAccess` is conflated with "has paid plan"
   - **Should be**: `hasAccess` = "can use the app" (includes free tier)
   - Need separate concept: `hasPremiumAccess` for premium features

4. **Free Plan Selection Not Implemented**:
   - Onboarding UI shows "Free" plan with "Start Free" button
   - Button calls `createFreeTierSubscription()` server action
   - **This action doesn't exist yet** - need to implement it

5. **Round Limit Tracking**:
   - Free tier returns `remainingRounds: 25` (line 181)
   - **No actual tracking** of rounds used by free users
   - No enforcement when creating rounds
   - No database schema to store rounds count

6. **Post-Login Onboarding Redirect**:
   - After login, authenticated users without entitlements should be redirected to onboarding
   - Current middleware does this, but needs refinement to not redirect free tier users who already chose free plan

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Flow (Desired)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Signup (/signup)                                         │
│     ↓                                                         │
│  2. Verify Email (via email link)                           │
│     ↓                                                         │
│  3. Login (/login?verified=true)                            │
│     ↓                                                         │
│  4. Middleware detects no entitlement → /onboarding         │
│     ↓                                                         │
│  5. Choose Plan:                                             │
│     • Free → creates free entitlement → access granted      │
│     • Paid → Stripe Checkout → webhook → access granted     │
│     ↓                                                         │
│  6. Access Application:                                      │
│     • Free: All pages EXCEPT /dashboard & /calculators      │
│     • Paid: All pages including /dashboard & /calculators   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Current Access Control Implementation

**File**: `utils/billing/access-control.ts`

- Queries Stripe directly for subscription status (no local billing schema)
- Returns `FeatureAccess` object with `plan`, `hasAccess`, `remainingRounds`, etc.
- **Issue**: `hasAccess: false` for free users prevents app access

**File**: `utils/supabase/middleware.ts`

- Checks authentication first
- For authenticated users on non-public routes, calls `getComprehensiveUserAccess()`
- If `!access.hasAccess`, redirects to `/onboarding`
- **Issue**: This blocks free users entirely

### Database Schema

**Current**: Only has `stripe_customers` table with minimal mapping:
```sql
CREATE TABLE stripe_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**No local subscriptions table** - queries Stripe API directly for real-time status

**Missing**: No `rounds_used` tracking for free tier users

### Required Changes Summary

1. **Fix `getFreeAccess()`** to return `hasAccess: true`
2. **Update `FeatureAccess` interface** to separate app access from premium access
3. **Implement free tier selection** server action
4. **Add round tracking** to profile table or separate table
5. **Update middleware** to allow free tier users
6. **Restrict premium routes** (`/dashboard`, `/calculators`)
7. **Add round limit enforcement** when creating rounds
8. **Test complete workflow** end-to-end

## ✅ **Acceptance Criteria**

### User Workflow

- [ ] New user signs up and receives verification email
- [ ] User verifies email and is redirected to `/login?verified=true`
- [ ] After login, middleware redirects user without plan selection to `/onboarding`
- [ ] User can select **Free plan** and immediately access the app (no Stripe interaction)
- [ ] User can select **Paid plan** and is redirected to Stripe Checkout
- [ ] After successful Stripe payment, user can access the app with premium features

### Free Tier Access Control

- [ ] Free tier users have `hasAccess: true` (can use the app)
- [ ] Free tier users can access: `/`, `/profile`, `/rounds`, `/about`, and all other non-premium pages
- [ ] Free tier users **cannot** access: `/dashboard` or `/calculators`
- [ ] Attempting to access `/dashboard` or `/calculators` shows upgrade prompt or redirects to onboarding
- [ ] Free tier users can log up to 25 rounds total
- [ ] Free tier users see remaining rounds count in UI
- [ ] After 25 rounds, free tier users are blocked from creating more rounds with upgrade prompt

### Premium Access Control

- [ ] Premium/Unlimited users can access all pages including `/dashboard` and `/calculators`
- [ ] Premium users have unlimited rounds (no tracking needed)
- [ ] Unlimited users have unlimited rounds + access to all premium features

### Middleware Behavior

- [ ] Unauthenticated users can access public routes: `/`, `/login`, `/signup`, `/about`, `/verify-email`, `/forgot-password`, `/api/*`
- [ ] Authenticated users without plan selection are redirected to `/onboarding`
- [ ] Authenticated free tier users can access app (excluding `/dashboard` and `/calculators`)
- [ ] Authenticated paid users can access entire app
- [ ] `/onboarding` is only accessible to authenticated users without a plan

### Route Protection

- [ ] `/calculators` removed from public paths (currently on line 49 of middleware.ts)
- [ ] `/dashboard` requires paid subscription (premium or unlimited)
- [ ] `/calculators` requires paid subscription (premium or unlimited)
- [ ] Free tier users redirected to upgrade page when accessing premium routes

### Round Limit Enforcement

- [ ] Database tracks rounds used for free tier users
- [ ] Round creation checks remaining rounds for free tier
- [ ] Free tier users blocked from creating round #26 with clear error message
- [ ] Premium/unlimited users have no round limit checks
- [ ] UI displays remaining rounds for free tier users

## 🚨 **Technical Requirements**

### Implementation Files

**Files to Modify:**

1. **`utils/billing/access-control.ts`** (lines 177-183)
   - Change `getFreeAccess()` to return `hasAccess: true`
   - Update return value to include `hasPremiumAccess: false`
   - Update `FeatureAccess` interface to add `hasPremiumAccess` field

2. **`types/billing.ts`** (lines 46-54)
   - Add `hasPremiumAccess: boolean` to `FeatureAccess` interface
   - Ensure all access control functions return this field

3. **`utils/supabase/middleware.ts`** (lines 110-146)
   - Update access check logic to allow free tier users
   - Add premium route protection for `/dashboard` and `/calculators`
   - Remove `/calculators` from `publicPaths` array (line 49)
   - Check `hasPremiumAccess` for premium routes instead of `hasAccess`

4. **`app/onboarding/actions.ts`** (new file or existing)
   - Implement `createFreeTierSubscription(userId: string)` server action
   - Mark user as having chosen free plan (could use profile table flag)
   - Return success/error status

5. **Database Migration** (new file: `supabase/migrations/YYYYMMDD_add_rounds_tracking.sql`)
   - Add `rounds_used` field to `profile` table (integer, default 0)
   - Add `plan_selected` field to `profile` table (text: 'free' | 'premium' | 'unlimited' | null)
   - Add `plan_selected_at` field to `profile` table (timestamp)

6. **`server/api/routers/round.ts`** (modify round creation procedure)
   - Add round limit check for free tier users
   - Increment `rounds_used` after successful round creation
   - Return clear error message when limit exceeded

7. **`app/dashboard/[id]/page.tsx`** (add access check)
   - Server-side check for paid subscription before rendering
   - Redirect to upgrade page if free tier user

8. **`app/calculators/page.tsx`** (add access check)
   - Server-side check for paid subscription before rendering
   - Redirect to upgrade page if free tier user

**New Files to Create:**

1. **`app/onboarding/actions.ts`** (if doesn't exist)
   - Server action for free tier selection

2. **`components/billing/upgrade-prompt.tsx`** (if doesn't exist)
   - Reusable component for upgrade prompts
   - Shows when free tier users access premium features or hit round limit

3. **`app/upgrade/page.tsx`** (new page)
   - Dedicated upgrade page showing plan options
   - Redirected to when free users try to access premium features

### Database Schema Changes

**Migration**: Add to `profile` table:

```sql
-- Add plan selection tracking to profile table
ALTER TABLE profile ADD COLUMN IF NOT EXISTS rounds_used INTEGER DEFAULT 0;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS plan_selected TEXT CHECK (plan_selected IN ('free', 'premium', 'unlimited'));
ALTER TABLE profile ADD COLUMN IF NOT EXISTS plan_selected_at TIMESTAMPTZ;

-- Create index for plan queries
CREATE INDEX IF NOT EXISTS idx_profile_plan_selected ON profile(plan_selected);

-- Add comment for documentation
COMMENT ON COLUMN profile.rounds_used IS 'Tracks number of rounds used by free tier users (25 limit). Not incremented for paid users.';
COMMENT ON COLUMN profile.plan_selected IS 'Records which plan user selected during onboarding. Updated when plan changes via Stripe.';
```

**Rationale**: Using `profile` table instead of separate billing schema because:
- Current architecture queries Stripe directly (no local subscriptions table)
- Simpler implementation for MVP
- Aligns with existing `stripe_customers` minimal approach

### Access Control Logic Updates

**New Logic Flow**:

```typescript
// utils/billing/access-control.ts

interface FeatureAccess {
  plan: "free" | "premium" | "unlimited";
  hasAccess: boolean; // Can use the app at all
  hasPremiumAccess: boolean; // Can access /dashboard and /calculators
  remainingRounds: number;
  currentPeriodEnd?: Date;
  isLifetime?: boolean;
}

function getFreeAccess(): FeatureAccess {
  return {
    plan: "free",
    hasAccess: true, // ✅ Changed from false
    hasPremiumAccess: false, // ✅ New field
    remainingRounds: 25, // Will be calculated from profile.rounds_used
  };
}

async function getComprehensiveUserAccess(userId: string): Promise<FeatureAccess> {
  // 1. Check Stripe for active subscription
  const stripeAccess = await getUserAccess(userId);
  if (stripeAccess.hasAccess) {
    return {
      ...stripeAccess,
      hasPremiumAccess: true, // Paid users get premium access
    };
  }

  // 2. Check for lifetime access
  const lifetimeAccess = await getLifetimeAccess(userId);
  if (lifetimeAccess) {
    return {
      ...lifetimeAccess,
      hasPremiumAccess: true,
    };
  }

  // 3. Check if user selected free plan
  const profile = await getProfile(userId);
  if (profile.plan_selected === 'free') {
    return {
      plan: "free",
      hasAccess: true,
      hasPremiumAccess: false,
      remainingRounds: Math.max(0, 25 - (profile.rounds_used || 0)),
    };
  }

  // 4. No plan selected yet - needs onboarding
  return {
    plan: "free",
    hasAccess: false, // Redirect to onboarding
    hasPremiumAccess: false,
    remainingRounds: 25,
  };
}
```

**Middleware Logic**:

```typescript
// utils/supabase/middleware.ts

const publicPaths = [
  "/login",
  "/signup",
  "/about",
  "/api",
  "/verify-email",
  "/forgot-password",
  "/",
];
// ❌ Removed "/calculators" from public paths

const premiumPaths = ["/dashboard", "/calculators"];

if (user && !isPublic && !pathname.startsWith("/onboarding") && !pathname.startsWith("/billing")) {
  const access = await getComprehensiveUserAccess(user.id);

  // Check if user needs onboarding (no plan selected)
  if (!access.hasAccess) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Check premium routes
  const isPremiumRoute = premiumPaths.some(path => pathname.startsWith(path));
  if (isPremiumRoute && !access.hasPremiumAccess) {
    return NextResponse.redirect(new URL("/upgrade", request.url));
  }
}
```

### Round Limit Enforcement

**In round creation tRPC procedure** (`server/api/routers/round.ts`):

```typescript
// Before creating round, check limit for free tier
const access = await getComprehensiveUserAccess(ctx.user.id);

if (access.plan === 'free' && access.remainingRounds <= 0) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You have reached your free tier limit of 25 rounds. Please upgrade to continue tracking rounds.',
  });
}

// Create round...

// After successful creation, increment rounds_used for free tier
if (access.plan === 'free') {
  await ctx.db.update(profile)
    .set({ rounds_used: sql`${profile.rounds_used} + 1` })
    .where(eq(profile.id, ctx.user.id));
}
```

## 🔍 **Implementation Notes**

### Design Decisions

**1. Why use `profile` table for tracking instead of separate billing schema?**
- Current architecture queries Stripe directly (no local subscriptions table)
- Adding fields to existing `profile` table is simpler than new schema
- Consistent with existing `stripe_customers` minimal approach
- Can migrate to dedicated billing schema later if needed

**2. Why separate `hasAccess` from `hasPremiumAccess`?**
- Clear separation of concerns: app access vs feature access
- Prevents middleware redirect loops for free users
- Makes access control logic more explicit and testable
- Allows for future tiered access (e.g., bronze/silver/gold)

**3. How to handle free tier selection without Stripe?**
- Set `profile.plan_selected = 'free'` in database
- No Stripe customer/subscription needed for free tier
- Middleware checks this flag to determine if onboarding is complete

**4. Why restrict `/dashboard` and `/calculators` only?**
- User requirement: "Free users should have access to all pages except /dashboard and /calculators"
- Allows free users to explore most features (rounds, profile, etc.)
- Premium pages offer clear value proposition for conversion

### Edge Cases to Handle

1. **User selects free plan, then upgrades later**:
   - Stripe webhook updates `profile.plan_selected` to 'premium' or 'unlimited'
   - Round limit no longer enforced
   - Previous `rounds_used` count preserved for historical tracking

2. **User downgrades from paid to free**:
   - After subscription expires/cancels, `plan_selected` reverts to 'free'
   - `rounds_used` count resumes from previous value
   - If user already exceeded 25 rounds during paid period, they're blocked until upgrade

3. **User tries to access `/dashboard` before selecting plan**:
   - Middleware redirects to `/onboarding` (no plan selected)
   - After selecting free plan, middleware redirects to `/upgrade`

4. **Stripe webhook fails or delays**:
   - User completes checkout but webhook hasn't processed yet
   - Access control queries Stripe directly, so should work immediately
   - Potential 1-2 second delay before access granted

5. **User refreshes during Stripe Checkout**:
   - Checkout session still valid, can complete payment
   - On success, redirected to `/billing/success`
   - On cancel, redirected to `/onboarding`

### Testing Strategy

**Unit Tests** (optional for MVP, recommended for production):
- Test `getComprehensiveUserAccess()` for all user states
- Test round limit enforcement logic
- Test middleware route protection logic

**Manual Testing Checklist**:
1. New user signup → verify email → login → onboarding → free plan → access app
2. Free user tries `/dashboard` → redirected to `/upgrade`
3. Free user creates 25 rounds → blocked on 26th attempt
4. Free user upgrades → Stripe checkout → access granted
5. Paid user accesses `/dashboard` and `/calculators` successfully

### Security Considerations

- **Server-side access checks**: All premium routes must check access server-side (not just middleware)
- **Round limit enforcement**: Must happen in tRPC procedure, not client-side
- **Plan selection**: Server action must validate user authentication before setting plan
- **Database updates**: Use service role or RLS policies to protect profile updates

### Performance Considerations

- **Stripe API calls**: Middleware calls `getComprehensiveUserAccess()` on every request
- **Optimization**: Consider caching Stripe subscription status (with short TTL)
- **Current approach**: Acceptable for MVP, monitor latency in production
- **Future optimization**: Add Redis cache or local billing table

## 📊 **Definition of Done**

### Functional Requirements
- [ ] Free tier users can access app after selecting free plan (no Stripe interaction)
- [ ] Free tier users cannot access `/dashboard` or `/calculators`
- [ ] Free tier users can create up to 25 rounds
- [ ] Free tier users see remaining rounds count in UI
- [ ] After 25 rounds, free tier users see upgrade prompt
- [ ] Paid users can access all routes including `/dashboard` and `/calculators`
- [ ] Middleware properly redirects users based on plan selection state
- [ ] Onboarding flow completes successfully for both free and paid plans

### Technical Requirements
- [ ] Database migration created and applied
- [ ] `profile` table has `rounds_used`, `plan_selected`, `plan_selected_at` fields
- [ ] `FeatureAccess` interface updated with `hasPremiumAccess` field
- [ ] `getFreeAccess()` returns `hasAccess: true`
- [ ] `getComprehensiveUserAccess()` checks `profile.plan_selected`
- [ ] Middleware removes `/calculators` from public paths
- [ ] Middleware adds premium route protection
- [ ] Server action `createFreeTierSubscription()` implemented
- [ ] Round creation checks limit and increments counter
- [ ] Premium routes have server-side access checks

### User Experience Requirements
- [ ] Clear error messages when free tier hits round limit
- [ ] Upgrade prompts are visually clear and actionable
- [ ] No redirect loops or confusing navigation
- [ ] Dashboard and calculators show upgrade prompt for free users
- [ ] Remaining rounds count visible in UI for free tier

### Testing Requirements
- [ ] Manual test: Complete free tier workflow
- [ ] Manual test: Complete paid tier workflow
- [ ] Manual test: Free tier round limit enforcement
- [ ] Manual test: Premium route access control
- [ ] Manual test: Upgrade from free to paid
- [ ] Edge case: User without plan selection redirected to onboarding
- [ ] Edge case: Free user accessing premium route redirected to upgrade page

## 🧪 **Testing Requirements**

### Test Scenario 1: Free Tier Onboarding
```
Steps:
1. Sign up with new email
2. Verify email via link
3. Login with verified=true query param
4. Middleware redirects to /onboarding
5. Click "Start Free" on Free plan card
6. Verify redirect to / or /profile
7. Attempt to access /dashboard → redirected to /upgrade
8. Attempt to access /calculators → redirected to /upgrade
9. Access /rounds successfully
10. Create 25 rounds successfully
11. Attempt to create 26th round → error message with upgrade CTA

Expected: All steps complete without errors
```

### Test Scenario 2: Paid Tier Onboarding
```
Steps:
1. Sign up with new email
2. Verify email via link
3. Login
4. Middleware redirects to /onboarding
5. Click "Subscribe" on Premium plan card
6. Redirected to Stripe Checkout
7. Complete payment with test card 4242 4242 4242 4242
8. Redirected to /billing/success
9. Access /dashboard successfully
10. Access /calculators successfully
11. Create unlimited rounds successfully

Expected: All steps complete without errors, no round limit
```

### Test Scenario 3: Free to Paid Upgrade
```
Steps:
1. Login as free tier user with 20 rounds used
2. Attempt to access /dashboard
3. Redirected to /upgrade page
4. Select Premium plan
5. Complete Stripe Checkout
6. Access /dashboard successfully
7. Verify rounds_used still shows 20 (historical data preserved)
8. Create more rounds successfully (no limit)

Expected: Smooth upgrade flow, historical data preserved
```

### Test Scenario 4: Middleware Route Protection
```
Test cases:
1. Unauthenticated user accesses /dashboard → redirect to /login
2. Unauthenticated user accesses /calculators → redirect to /login
3. Authenticated user without plan accesses /profile → redirect to /onboarding
4. Free tier user accesses /dashboard → redirect to /upgrade
5. Free tier user accesses /rounds → access granted
6. Paid user accesses /dashboard → access granted
7. Paid user accesses /calculators → access granted

Expected: All redirects and access grants work correctly
```

## 🚫 **Out of Scope**

### NOT Included in This Ticket:

- **Advanced analytics dashboard** - Dashboard exists but detailed analytics out of scope
- **Referral system** - No referral codes or bonus rounds
- **Promo codes beyond first 100** - Early adopter promo already configured in Stripe
- **Usage-based billing** - Fixed tiers only, no metered billing
- **Team/organization accounts** - Individual users only
- **Grace period for round limit** - Hard limit at 25, no warnings before
- **Round pack purchases** - No microtransactions for additional rounds
- **Custom email campaigns** - No automated marketing emails
- **A/B testing pricing** - Fixed pricing for MVP
- **International pricing** - USD only
- **Multiple subscription tiers** - Just free/premium/unlimited as designed
- **Detailed billing history UI** - Basic Stripe portal only

### Future Enhancements (Separate Tickets):

- Add caching for Stripe API calls (Redis or similar)
- Migrate to dedicated billing schema if scaling requires
- Add more granular feature flags (beyond just premium access)
- Implement "5 rounds remaining" warning for free tier
- Add email notifications for round limit reached
- Create admin panel for manual plan adjustments
- Build usage analytics dashboard

## 📝 **Notes**

### Why This Approach?

This ticket focuses on **completing the existing Stripe integration** rather than rebuilding it. The current architecture (Ticket #0002 approach) is solid:

✅ Queries Stripe directly for real-time subscription status
✅ Uses Checkout Sessions for flexible payment flows
✅ Customer Portal for self-service management
✅ Webhook handler for event logging

The missing pieces are:
1. Free tier access control (simple logic fix)
2. Premium route protection (middleware update)
3. Round limit tracking (database + enforcement)
4. Free plan selection (server action)

### Success Metrics

**User Experience:**
- 0 redirect loops or navigation errors
- < 2 second latency for access control checks
- Clear upgrade prompts with obvious CTAs

**Business:**
- Free tier users can evaluate product (up to 25 rounds)
- Premium features are properly gated (/dashboard, /calculators)
- Smooth upgrade flow increases conversion rate

**Technical:**
- All routes properly protected
- No bypass vulnerabilities for premium features
- Round limit accurately enforced

### Related Tickets

- **#0001** - Stripe Payment Links approach (not used, superseded by #0002)
- **#0002** - Stripe Checkout + Portal approach (current implementation, incomplete)
- **#0003** - This ticket (completes the implementation from #0002)

## 🏷️ **Labels**

- `priority: critical`
- `type: bug-fix` (fixing broken free tier access)
- `type: feature` (completing stripe integration)
- `component: billing`
- `component: middleware`
- `component: access-control`
- `backend`
- `frontend`
- `database-migration`
- `user-experience`
- `mvp-blocker`

---

**Estimated Effort:** 8-12 hours (1-2 days for single developer)

**Complexity:** Medium (mostly configuration and logic fixes, minimal new code)

**Business Impact:** Critical (users currently cannot use free tier)

**User Impact:** High (affects all new user signups)

**Risk Level:** Low (changes are isolated, easy to test and verify)

**Blocked By:** None

**Blocks:** Future billing features, user growth, product launch

**Related Files:**
- `utils/billing/access-control.ts:177-183` (free tier access)
- `utils/supabase/middleware.ts:49,110-146` (route protection)
- `app/onboarding/page.tsx` (free plan button)
- `types/billing.ts:46-54` (feature access interface)
- `server/api/routers/round.ts` (round creation)
