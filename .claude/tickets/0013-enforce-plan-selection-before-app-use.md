# 0013 - Enforce Plan Selection Before App Use

## 🎯 **Description**

Strengthen access control to prevent users from using the application before explicitly selecting a plan during onboarding. Currently, users can add up to 25 rounds before selecting any plan because `hasAccess=false` is not checked in round submission.

## 📋 **User Story**

As a product owner, I want users to explicitly select a plan (including free) during onboarding so that they understand their tier limits before using the application.

## 🔧 **Technical Context**

**Current Behavior (WRONG):**
1. User signs up, creates account
2. `profile.plan_selected` = NULL
3. `profile.subscription_status` = 'active' (DEFAULT from migration)
4. Middleware redirects to `/onboarding` ✅
5. User ignores redirect, navigates directly to round submission
6. `getComprehensiveUserAccess()` returns:
   - `plan='free'`, `hasAccess=false`, `remainingRounds=25`
7. Round submission only checks `remainingRounds > 0` ❌
8. **User can add 25 rounds without selecting a plan!**

**Expected Behavior:**
1. User signs up
2. `profile.plan_selected` = NULL
3. `profile.subscription_status` = NULL (not 'active')
4. Middleware redirects to `/onboarding` ✅
5. Round submission checks `hasAccess` flag ✅
6. If `hasAccess=false`, reject with "Please select a plan" error
7. User MUST visit onboarding and select plan
8. After plan selection, `hasAccess=true`, can use app

**Root Causes:**
1. `server/api/routers/round.ts:173` - Only checks `plan` and `remainingRounds`, not `hasAccess`
2. `supabase/migrations/20251012205144_quick_morgan_stark.sql:5` - Sets DEFAULT 'active' for subscription_status
3. `utils/billing/access-control.ts:55-56` - Returns `hasAccess=false` but not enforced

## ✅ **Acceptance Criteria**

- [ ] Users cannot submit rounds before selecting a plan
- [ ] Round submission checks `hasAccess` flag
- [ ] Middleware redirects work correctly
- [ ] New users have `subscription_status=NULL` (not 'active')
- [ ] After selecting free plan, user can add rounds
- [ ] After paying for plan, user can add rounds
- [ ] Clear error message: "Please select a plan to continue"

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Fix subscription_status Default**

Create migration:
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_fix_subscription_status_default.sql

-- Remove DEFAULT 'active' from subscription_status
ALTER TABLE profile
ALTER COLUMN subscription_status DROP DEFAULT;

-- Set subscription_status to NULL for users without plan
UPDATE profile
SET subscription_status = NULL
WHERE plan_selected IS NULL;

-- Add comment explaining behavior
COMMENT ON COLUMN profile.subscription_status IS
  'Subscription status from Stripe. NULL for users who have not selected a plan. Set to ''active'' when user selects free plan or completes payment.';
```

**2. Update Round Submission Guard**

File: `server/api/routers/round.ts` (lines 153-180)

```typescript
// BEFORE:
const access = await getComprehensiveUserAccess(userId);

if (access.plan === "free" && access.remainingRounds <= 0) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `You've reached your free tier limit of 25 rounds...`,
  });
}

// AFTER:
const access = await getComprehensiveUserAccess(userId);

// 1. Check if user has access at all (plan selected)
if (!access.hasAccess) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Please select a plan to continue. Visit the onboarding page to get started.",
  });
}

// 2. Check free tier limit (only if free plan)
if (access.plan === "free" && access.remainingRounds <= 0) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `You've reached your free tier limit of 25 rounds. Please upgrade to continue tracking rounds.`,
  });
}

console.log("✅ Access checks passed", {
  plan: access.plan,
  hasAccess: access.hasAccess,
  remainingRounds: access.remainingRounds,
});
```

**3. Update Free Plan Selection**

File: `app/onboarding/actions.ts` (or new tRPC procedure)

```typescript
// When user selects free plan, set subscription_status
export async function createFreeTierSubscription(userId: string) {
  const supabase = await createServerComponentClient();

  const { error } = await supabase
    .from("profile")
    .update({
      plan_selected: "free",
      plan_selected_at: new Date().toISOString(),
      subscription_status: "active", // Explicitly set to 'active'
    })
    .eq("id", userId);

  if (error) {
    throw new Error("Failed to select free plan");
  }

  return { success: true };
}
```

**4. Update Webhook Handler**

File: `app/api/stripe/webhook/route.ts`

Ensure all webhook handlers set `subscription_status`:

```typescript
// checkout.session.completed (lifetime)
await db.update(profile).set({
  planSelected: plan,
  planSelectedAt: new Date(),
  subscriptionStatus: 'active', // Set explicitly
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  billingVersion: sql`billing_version + 1`,
});

// customer.subscription.created/updated
await db.update(profile).set({
  planSelected: plan,
  planSelectedAt: new Date(),
  subscriptionStatus: subscription.status, // From Stripe
  currentPeriodEnd: subscription.current_period_end,
  cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
  billingVersion: sql`billing_version + 1`,
});
```

**5. Update Schema Type**

File: `db/schema.ts`

```typescript
subscriptionStatus: text("subscription_status")
  .$type<"active" | "trialing" | "past_due" | "canceled" | "paused" | "incomplete" | "incomplete_expired" | "unpaid" | null>()
  // REMOVED: .default("active")
  // REMOVED: .notNull()
```

### **Dependencies**

- `supabase/migrations/` - New migration
- `server/api/routers/round.ts` - Add hasAccess check
- `app/onboarding/actions.ts` - Set subscription_status
- `app/api/stripe/webhook/route.ts` - Verify status setting
- `db/schema.ts` - Update type definition

### **Integration Points**

- Middleware onboarding redirect
- tRPC round submission
- Onboarding flow (free plan selection)
- Webhook handlers (paid plan activation)
- JWT custom access token hook

## 🔍 **Implementation Notes**

**Why hasAccess Check is Important:**
- Middleware redirects can be bypassed (direct API calls, disabled JS)
- tRPC is the **source of truth** for authorization
- Defense in depth: Multiple layers of protection

**Middleware vs tRPC Authorization:**
- **Middleware**: Coarse-grained routing (redirect to onboarding)
- **tRPC**: Fine-grained action authorization (prevent mutations)
- Both needed for complete security

**Migration Safety:**
```sql
-- Safe: Allows NULL, doesn't break existing rows
ALTER COLUMN subscription_status DROP DEFAULT;
ALTER COLUMN subscription_status DROP NOT NULL;

-- Update existing users gracefully
UPDATE profile
SET subscription_status = CASE
  WHEN plan_selected IS NULL THEN NULL
  WHEN plan_selected = 'free' THEN 'active'
  WHEN plan_selected IN ('premium', 'unlimited', 'lifetime') THEN 'active'
  ELSE 'active'
END;
```

**Edge Cases:**
1. User in middle of checkout when deployed → Will complete normally
2. User with old session (hasAccess=false in JWT) → Refresh on next request
3. User bookmarks round submission URL → Blocked, redirected to onboarding

## 📊 **Definition of Done**

- [ ] Migration applied to database
- [ ] subscription_status allows NULL
- [ ] New users have NULL status initially
- [ ] Round submission checks hasAccess
- [ ] Free plan selection sets status to 'active'
- [ ] Webhook handlers set status correctly
- [ ] Manual test: Cannot add round without plan
- [ ] Manual test: Can add round after selecting free
- [ ] Manual test: Can add round after paying

## 🧪 **Testing Requirements**

### **Manual Testing Flow**
1. **New user without plan:**
   - [ ] Sign up
   - [ ] Try to submit round → Blocked with clear error
   - [ ] Visit `/onboarding` → Shown plan selector
   - [ ] Select free plan → Success
   - [ ] Submit round → Success

2. **Free tier user:**
   - [ ] Add 24 rounds → Success
   - [ ] Add 25th round → Success
   - [ ] Try 26th round → Blocked (limit reached)

3. **Paid user:**
   - [ ] Complete payment → Redirected to success page
   - [ ] Submit round → Success immediately
   - [ ] Unlimited rounds available

### **Database Validation**
```sql
-- Check new users have NULL status
SELECT id, email, plan_selected, subscription_status
FROM profile
WHERE created_at > NOW() - INTERVAL '1 day'
AND plan_selected IS NULL;
-- Expected: subscription_status = NULL

-- Check free users have 'active' status
SELECT id, email, plan_selected, subscription_status
FROM profile
WHERE plan_selected = 'free';
-- Expected: subscription_status = 'active'
```

### **Edge Cases**
- [ ] User refreshes during onboarding
- [ ] User has multiple tabs open
- [ ] User uses browser back button
- [ ] User's JWT expires during onboarding
- [ ] Webhook arrives before user completes onboarding UI

## 🚫 **Out of Scope**

- Adding plan comparison page
- Email reminders for incomplete onboarding
- Analytics tracking for onboarding completion
- A/B testing different onboarding flows
- Social proof or testimonials on onboarding
- Payment retry logic

## 📝 **Notes**

**Why subscription_status Had DEFAULT 'active':**
- Original intent: Simplify logic by assuming 'active' for everyone
- Problem: Conflates "no plan" with "active free plan"
- Solution: Use NULL to represent "no plan selected yet"

**Related Code Paths:**
1. Signup → profile created with NULL status
2. Onboarding → user selects plan → status set to 'active'
3. Payment → webhook updates status from Stripe
4. Middleware → checks plan_selected for routing
5. tRPC → checks hasAccess for mutations

**User Experience:**
```
User signs up
↓
Redirect to /onboarding (middleware)
↓
User selects plan (free or paid)
↓
subscription_status = 'active'
hasAccess = true
↓
Can use application
```

**Alternative Considered:**
- Add `onboarding_completed` boolean flag
- **Rejected**: Redundant with plan_selected + subscription_status

## 🏷️ **Labels**

- `priority: high`
- `type: bug`
- `type: security`
- `component: billing`
- `component: onboarding`
- `user-experience`
- `data-integrity`
