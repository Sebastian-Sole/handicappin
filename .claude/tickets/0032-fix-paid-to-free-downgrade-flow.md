# 0032 - Fix Paid-to-Free Downgrade Flow

## 🎯 **Description**

Fix the disconnect between database and Stripe when a paid user downgrades to the free plan. Currently, clicking "Free" on the `/upgrade` page immediately changes the database to `plan_selected = 'free'` without updating the Stripe subscription, leaving the subscription active and causing billing/access control issues.

## 📋 **User Story**

As a paid subscriber (Premium or Unlimited), I want to downgrade to the free plan so that my subscription cancels at the end of the current billing period and I'm not charged again.

## 🔧 **Technical Context**

**Current Broken Flow:**
1. Paid user on `/upgrade` page clicks "Free" plan
2. `handleFreePlan()` in `PlanSelector` calls `createFreeTierSubscription(userId)`
3. Database immediately updates: `plan_selected = 'free'`, `subscription_status = 'active'`
4. Stripe subscription remains active (not cancelled)
5. User sees "Free" plan in UI but Stripe will still charge them next billing cycle
6. Access control breaks: database says free, Stripe says paid

**Expected Flow:**
1. Paid user on `/upgrade` page clicks "Free" plan
2. Should detect upgrade mode + paid plan → call subscription update API
3. API calls Stripe: `subscription.update({ cancel_at_period_end: true })`
4. Database updates with `cancel_at_period_end = true` via webhook
5. User keeps paid access until period end
6. At period end, webhook updates database to `plan_selected = 'free'`

**Root Cause:**
The `handleFreePlan()` function in `PlanSelector` (lines 52-64) doesn't check for upgrade mode with a paid plan. It always calls `createFreeTierSubscription()` which directly updates the database, bypassing the Stripe subscription update flow.

## ✅ **Acceptance Criteria**

- [ ] Paid user clicking "Free" on `/upgrade` page schedules subscription cancellation in Stripe
- [ ] Database is NOT immediately updated to `plan_selected = 'free'`
- [ ] User sees message: "Subscription will cancel at the end of your billing period"
- [ ] User retains paid access until `current_period_end`
- [ ] Billing page shows cancellation status with date
- [ ] At period end, webhook updates database to `plan_selected = 'free'`
- [ ] New user (no plan) clicking "Free" on `/onboarding` still works immediately
- [ ] Free user stays on free plan (no-op, button disabled)

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Update `handleFreePlan()` in `components/billing/plan-selector.tsx`**

Add logic to detect upgrade mode with paid plan:

```typescript
const handleFreePlan = async () => {
  try {
    setLoading("free");

    // If in upgrade mode and user has a paid plan, use subscription update API
    if (mode === "upgrade" && currentPlan && currentPlan !== "free") {
      const response = await fetch("/api/stripe/subscription", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPlan: "free" }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update subscription");
      }

      // Show success message
      alert(result.message); // "Subscription will cancel at the end of your billing period"
      router.push("/billing");
      router.refresh();
      return;
    }

    // Otherwise, for onboarding or already-free users, use direct action
    await createFreeTierSubscription(userId);
    router.push("/");
    router.refresh();
  } catch (error) {
    console.error("Error selecting free plan:", error);
    alert("Failed to select free plan. Please try again.");
  } finally {
    setLoading(null);
  }
};
```

**2. Verify Subscription Update API** (`lib/stripe.ts` lines 179-185)

The existing code already handles this correctly:

```typescript
// Handle downgrade to free = cancel subscription
if (newPlan === "free") {
  const updated = await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: true,
  });
  return { subscription: updated, changeType: "cancel" as const };
}
```

**3. Verify API Route Message** (`app/api/stripe/subscription/route.ts`)

Ensure the message is user-friendly:

```typescript
message:
  result.changeType === "cancel"
    ? "Subscription will cancel at the end of your billing period"
    : // ... other messages
```

**4. Ensure Webhook Handles Cancellation**

The webhook handler should:
- Listen for `customer.subscription.updated` with `cancel_at_period_end = true`
- Update database: `cancel_at_period_end = true`, increment `billing_version`
- Listen for `customer.subscription.deleted` at period end
- Update database: `plan_selected = 'free'`, clear subscription fields

### **Dependencies**

- `components/billing/plan-selector.tsx` - modify `handleFreePlan()`
- `app/api/stripe/subscription/route.ts` - verify PUT handler (already exists)
- `lib/stripe.ts` - verify `updateSubscription()` (already exists)
- `app/api/stripe/webhook/route.ts` - verify cancellation handling

### **Integration Points**

- Stripe Subscriptions API
- Database profile table (`plan_selected`, `cancel_at_period_end`)
- Access control system (should respect `cancel_at_period_end`)
- Billing page UI (should show cancellation status)

## 🔍 **Implementation Notes**

**Edge Cases:**
1. **User clicks "Free" multiple times**: Should be idempotent, already cancelled
2. **Webhook arrives before API response**: Use `billing_version` to handle race conditions
3. **User upgrades after cancelling**: Should clear `cancel_at_period_end` flag
4. **Subscription already past_due**: Handle gracefully (already inactive)

**Testing Strategy:**
1. Use Stripe test clock to advance time to period end
2. Verify webhook fires `customer.subscription.deleted`
3. Verify database updates to free plan
4. Test with both Premium and Unlimited plans

**UI Considerations:**
- Change button text from "Start Free" to "Downgrade to Free" in upgrade mode
- Show confirmation modal: "Your subscription will be cancelled at the end of the billing period. You'll keep access until [date]."
- Update billing page to show: "Cancels on [date]" instead of "Renews on [date]"

## 📊 **Definition of Done**

- [ ] Code changes implemented in `handleFreePlan()`
- [ ] Paid → Free downgrade schedules cancellation via Stripe
- [ ] Database remains paid until period end
- [ ] User retains access until period end
- [ ] Webhook updates database to free at period end
- [ ] Onboarding flow (new user → free) unchanged
- [ ] Type checking passes: `pnpm build`
- [ ] Manual testing with Stripe test data completed

## 🧪 **Testing Requirements**

### Unit Tests
- [ ] Test `handleFreePlan()` with `mode="onboarding"` → calls `createFreeTierSubscription()`
- [ ] Test `handleFreePlan()` with `mode="upgrade"` + `currentPlan="premium"` → calls subscription API
- [ ] Test `handleFreePlan()` with `mode="upgrade"` + `currentPlan="free"` → no-op (button disabled)

### Integration Tests
- [ ] Premium user downgrades to free → Stripe subscription shows `cancel_at_period_end: true`
- [ ] Unlimited user downgrades to free → same behavior
- [ ] New user selects free on onboarding → database updates immediately
- [ ] User with cancelled subscription reaches period end → database updates to free

### Manual Testing
1. **Test Paid → Free Downgrade:**
   - Create test Premium subscription
   - Go to `/upgrade`, click "Free"
   - Verify Stripe dashboard shows `cancel_at_period_end: true`
   - Verify database still shows `plan_selected = 'premium'`
   - Verify billing page shows "Cancels on [date]"
   - Verify user can still access premium features
   - Use Stripe test clock to advance to period end
   - Verify webhook fires and database updates to `plan_selected = 'free'`
   - Verify user loses premium access

2. **Test Onboarding Flow:**
   - Create new user (no plan)
   - Go to `/onboarding`, click "Free"
   - Verify database immediately updates to `plan_selected = 'free'`
   - Verify redirect to home page

## 🚫 **Out of Scope**

- Refund handling (user pays for full month)
- Immediate cancellation option (must wait for period end)
- Reactivation flow (separate ticket)
- Email notifications about cancellation
- Cancellation surveys or feedback collection
- Trial periods or grace periods

## 📝 **Notes**

**Why Not Immediate Cancellation?**
Stripe best practice is to let users keep access until period end. They've already paid for the full billing cycle, so they should get the full value. Immediate cancellation would require refund logic.

**Database Consistency:**
The webhook is the source of truth for subscription state. The database should only be updated via webhooks (except for free plan selection during onboarding, which doesn't involve Stripe).

**Access Control:**
The `getComprehensiveUserAccess()` function should check `cancel_at_period_end` and still grant access until `current_period_end`. The database plan field shouldn't change until the webhook confirms cancellation.

## 🏷️ **Labels**

- `priority: high`
- `type: bug`
- `component: billing`
- `component: stripe`
- `user-facing`
- `data-integrity`
