# 0011 - Fix Lifetime User Dashboard Lockout

## 🎯 **Description**

Fix critical bug where lifetime plan users are locked out of the dashboard and all premium features despite having completed payment. The access control system incorrectly queries Stripe for subscriptions when lifetime is a one-time payment, not a subscription.

## 📋 **User Story**

As a lifetime plan user, I want to access the dashboard and premium features after completing my one-time payment so that I can use the application without restrictions.

## 🔧 **Technical Context**

**Current Broken Flow:**
1. User purchases lifetime plan ($199 one-time payment)
2. Webhook receives `checkout.session.completed` event (NO subscription events)
3. Database updates `plan_selected='lifetime'` ✅
4. User tries to access `/dashboard`
5. Middleware reads JWT claims → `plan='lifetime'` ✅
6. Middleware calls `getComprehensiveUserAccess()`
7. Function calls `getUserAccess()` for ALL paid plans (lines 175-186)
8. `getUserAccess()` queries `stripe.subscriptions.list` (line 103)
9. **Returns null** because lifetime has NO subscription
10. Falls back to `createNoAccessResponse()` (line 195)
11. User locked out! ❌

**Root Cause:**
- File: `utils/billing/access-control.ts`
- Lines 175-186: Treats lifetime same as premium/unlimited
- Lifetime is a **one-time payment**, NOT a subscription
- Should verify payment completion, NOT query subscriptions

**Evidence from Webhook Logs:**
```
Lifetime purchase:
  checkout.session.completed ✅
  charge.succeeded ✅
  payment_intent.succeeded ✅
  NO subscription.created ❌

Premium/Unlimited purchase:
  checkout.session.completed ✅
  customer.subscription.created ✅
  invoice.paid ✅
```

## ✅ **Acceptance Criteria**

- [ ] Lifetime users can access `/dashboard` immediately after payment
- [ ] Lifetime users can access all premium routes (`/calculators`, `/dashboard`)
- [ ] `getComprehensiveUserAccess()` returns correct access for lifetime users
- [ ] Access check does NOT query Stripe subscriptions for lifetime plans
- [ ] Middleware correctly identifies lifetime users as having premium access
- [ ] Free tier users still correctly blocked from premium routes
- [ ] Premium/Unlimited subscription users unaffected by changes

## 🚨 **Technical Requirements**

### **Implementation Details**

**File: `utils/billing/access-control.ts`**

Modify `getComprehensiveUserAccess()` function (lines 153-196):

```typescript
export async function getComprehensiveUserAccess(
  userId: string
): Promise<FeatureAccess> {
  const supabase = await createServerComponentClient();

  // 1. Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("plan_selected, rounds_used")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return createNoAccessResponse();
  }

  // 2. Free plan
  if (profile.plan_selected === "free") {
    return createFreeTierResponse(profile.rounds_used || 0);
  }

  // 3. LIFETIME plan (one-time payment, NOT subscription)
  if (profile.plan_selected === "lifetime") {
    // Lifetime: Just verify payment was completed (already in DB from webhook)
    // No need to query Stripe - if plan_selected='lifetime', payment succeeded
    return {
      plan: "lifetime",
      hasAccess: true,
      hasPremiumAccess: true,
      hasUnlimitedRounds: true,
      remainingRounds: Infinity,
      status: "active",
      isLifetime: true,
      currentPeriodEnd: new Date("2099-12-31T23:59:59.000Z"), // Never expires
    };
  }

  // 4. PREMIUM/UNLIMITED plans (recurring subscriptions)
  if (
    profile.plan_selected === "premium" ||
    profile.plan_selected === "unlimited"
  ) {
    const subscriptionAccess = await getUserAccess(userId);

    if (subscriptionAccess?.hasAccess) {
      return subscriptionAccess;
    }

    // Subscription expired/cancelled - fall back to free
    console.log("Subscription expired, falling back to free tier");
  }

  // 5. No plan selected yet
  return createNoAccessResponse();
}
```

**Optional Enhancement** (verify lifetime payment if paranoid):

```typescript
// For extra security, verify lifetime payment in Stripe (optional)
if (profile.plan_selected === "lifetime") {
  const { data: stripeCustomer } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (stripeCustomer) {
    // Check payment history for successful charge
    const charges = await stripe.charges.list({
      customer: stripeCustomer.stripe_customer_id,
      limit: 10,
    });

    const lifetimePayment = charges.data.find(
      charge => charge.amount === 19900 && charge.paid
    );

    if (!lifetimePayment) {
      console.error("Lifetime plan selected but no payment found");
      return createNoAccessResponse();
    }
  }

  return { /* lifetime access */ };
}
```

### **Dependencies**

- `utils/billing/access-control.ts` - Main fix
- `utils/billing/access-helpers.ts` - Helper functions (no changes)
- `utils/supabase/middleware.ts` - Uses access-control (no changes needed)
- `lib/stripe.ts` - Stripe SDK (no changes)

### **Integration Points**

- Middleware reads JWT claims and calls `getComprehensiveUserAccess()`
- tRPC procedures call `getComprehensiveUserAccess()` for authorization
- Webhook sets `plan_selected='lifetime'` on payment completion

## 🔍 **Implementation Notes**

**Why This is Safe:**
1. Webhook already validates payment (Stripe signature verification)
2. If `plan_selected='lifetime'` is in DB, payment MUST have succeeded
3. Webhook would have failed/retried if payment didn't complete
4. No risk of false positives - plan only set after successful webhook

**Alternative Approaches Considered:**
1. ❌ Query Stripe for payment history every time → Too slow
2. ❌ Store payment_intent_id in database → Extra complexity
3. ✅ Trust database value set by webhook → Simple, fast, secure

**Performance Impact:**
- **Before**: Database query + Stripe API call → ~200-500ms
- **After**: Database query only → ~20-50ms
- **Improvement**: 4-10x faster for lifetime users

## 📊 **Definition of Done**

- [ ] Code changes implemented in `access-control.ts`
- [ ] Lifetime users can access dashboard after payment
- [ ] All premium routes accessible to lifetime users
- [ ] Middleware correctly grants access
- [ ] Manual testing: Create lifetime account, verify access
- [ ] Verify no regression for premium/unlimited users
- [ ] Verify free tier users still blocked

## 🧪 **Testing Requirements**

### **Manual Testing**
- [ ] Purchase lifetime plan with test card
- [ ] Verify immediate dashboard access after payment
- [ ] Check access to `/calculators` and other premium routes
- [ ] Verify profile page shows correct plan info
- [ ] Test after logout/login (JWT refresh)

### **Edge Cases**
- [ ] User with lifetime plan but deleted Stripe customer
- [ ] User changes browser mid-payment
- [ ] Session expires during payment flow
- [ ] Multiple concurrent lifetime purchases (same user)

### **Regression Testing**
- [ ] Free tier users still blocked from dashboard
- [ ] Premium users can access dashboard
- [ ] Unlimited users can access dashboard
- [ ] Users without plan redirected to onboarding

## 🚫 **Out of Scope**

- Refactoring entire access control system
- Adding payment verification for premium/unlimited
- Migrating to different billing provider
- Adding subscription management features
- UI/UX improvements to billing flow
- Analytics or tracking enhancements

## 📝 **Notes**

**Related Files:**
- `app/api/stripe/webhook/route.ts:159-204` - Lifetime payment handling
- `utils/supabase/middleware.ts:224-230` - Onboarding redirect logic
- `types/billing.ts` - FeatureAccess type definition

**Testing Tip:**
Use Stripe test cards for manual testing:
- `4242 4242 4242 4242` - Successful payment
- Any future expiry date
- Any 3-digit CVC

**Webhook Events to Monitor:**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Watch for:
# ✅ checkout.session.completed (mode=payment)
# ✅ charge.succeeded
# ❌ customer.subscription.created (should NOT appear for lifetime)
```

## 🏷️ **Labels**

- `priority: critical`
- `type: bug`
- `component: billing`
- `component: access-control`
- `severity: blocking`
- `user-facing`
