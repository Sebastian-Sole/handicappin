# 0006 - Implement Plan Upgrade/Downgrade Page

## 🎯 **Description**

Create a functional `/upgrade` page that allows existing subscribers to upgrade or downgrade their subscription plans with proper billing logic, distinct from the onboarding flow for new users.

## 📋 **User Story**

As a subscribed user, I want to upgrade or downgrade my subscription plan so that I can adjust my service level based on my needs without canceling and resubscribing.

## 🔧 **Technical Context**

**Current State:**
- `/upgrade` page exists but just renders the onboarding page
- No distinction between new users and existing subscribers
- Users without plans should go to `/onboarding`, not `/upgrade`
- No upgrade/downgrade logic in place

**Desired State:**
- `/upgrade` is for existing subscribers only
- New users redirect to `/onboarding`
- Upgrade takes effect immediately (prorate current billing)
- Downgrade takes effect at next billing cycle
- Clear UI showing current plan and available changes

## ✅ **Acceptance Criteria**

- [ ] Users without a plan are redirected to `/onboarding`
- [ ] Free tier users see upgrade options (Premium, Unlimited, Lifetime)
- [ ] Premium users can upgrade to Unlimited/Lifetime or downgrade to Free
- [ ] Unlimited users can downgrade to Premium/Free
- [ ] Lifetime users see "no changes available" message
- [ ] Upgrade charges prorated amount immediately
- [ ] Downgrade schedules change for next billing cycle
- [ ] Current plan is clearly highlighted
- [ ] Confirmation modal shows before plan changes
- [ ] Success/error messages display appropriately

## 🚨 **Technical Requirements**

### **Implementation Details**

1. **Upgrade Page Component**
```typescript
// app/upgrade/page.tsx
export default async function UpgradePage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const access = await getComprehensiveUserAccess(user.id);

  // No plan selected - go to onboarding
  if (!access.hasAccess) {
    redirect('/onboarding');
  }

  // Get current subscription details
  let subscriptionDetails = null;
  if (access.plan !== 'free' && access.plan !== 'lifetime') {
    subscriptionDetails = await getSubscriptionDetails(user.id);
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <h1>Manage Your Subscription</h1>
      <CurrentPlanCard plan={access.plan} details={subscriptionDetails} />
      <UpgradeOptions currentPlan={access.plan} />
    </div>
  );
}
```

2. **Stripe Upgrade Logic**
```typescript
// lib/stripe-subscription.ts
export async function upgradeSubscription({
  customerId,
  subscriptionId,
  newPriceId,
}: {
  customerId: string;
  subscriptionId: string;
  newPriceId: string;
}) {
  // Update subscription with proration
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscriptionId,
      price: newPriceId,
    }],
    proration_behavior: 'always_invoice', // Charge immediately
  });

  return updated;
}

export async function downgradeSubscription({
  subscriptionId,
  newPriceId,
}: {
  subscriptionId: string;
  newPriceId: string;
}) {
  // Schedule change for end of billing period
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscriptionId,
      price: newPriceId,
    }],
    proration_behavior: 'none', // No immediate charge
    billing_cycle_anchor: 'unchanged', // Keep current cycle
  });

  return updated;
}
```

3. **UI Components**
```typescript
// components/billing/upgrade-options.tsx
interface UpgradeOptionsProps {
  currentPlan: 'free' | 'premium' | 'unlimited' | 'lifetime';
}

export function UpgradeOptions({ currentPlan }: UpgradeOptionsProps) {
  const upgradeOptions = getAvailableUpgrades(currentPlan);
  const downgradeOptions = getAvailableDowngrades(currentPlan);

  return (
    <div className="space-y-8">
      {upgradeOptions.length > 0 && (
        <section>
          <h2>Upgrade Your Plan</h2>
          <p>Changes take effect immediately. You'll be charged the prorated difference.</p>
          <PlanGrid plans={upgradeOptions} action="upgrade" />
        </section>
      )}

      {downgradeOptions.length > 0 && (
        <section>
          <h2>Downgrade Your Plan</h2>
          <p>Changes take effect at the end of your current billing cycle.</p>
          <PlanGrid plans={downgradeOptions} action="downgrade" />
        </section>
      )}

      {upgradeOptions.length === 0 && downgradeOptions.length === 0 && (
        <div className="text-center py-12">
          <p>You're on the best plan! No changes available.</p>
        </div>
      )}
    </div>
  );
}
```

4. **Confirmation Modal**
```typescript
// components/billing/plan-change-modal.tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>
        {action === 'upgrade' ? 'Upgrade' : 'Downgrade'} to {newPlan}?
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      {action === 'upgrade' ? (
        <>
          <p>You'll be charged ${proratedAmount} today</p>
          <p>Your new plan starts immediately</p>
        </>
      ) : (
        <>
          <p>Your plan will change at the end of your current billing cycle</p>
          <p>Billing cycle ends: {currentPeriodEnd}</p>
        </>
      )}
    </div>
    <DialogFooter>
      <Button onClick={handleConfirm}>Confirm</Button>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### **Dependencies**

- `app/upgrade/page.tsx` - needs complete rewrite
- `lib/stripe-subscription.ts` - new file for subscription management
- `components/billing/upgrade-options.tsx` - new component
- `components/billing/plan-change-modal.tsx` - new component
- `components/billing/current-plan-card.tsx` - new component
- `server/api/routers/billing.ts` - add upgrade/downgrade procedures

### **Integration Points**

- Stripe Subscriptions API
- Access control system
- Database (stripe_customers, profile)
- Webhook handlers (handle subscription.updated events)
- Navigation (profile dropdown, profile page links)

## 🔍 **Implementation Notes**

**Proration Calculation:**
Stripe automatically calculates proration. When upgrading:
1. Credits unused time from old plan
2. Charges for new plan from now until cycle end
3. Issues immediate invoice for the difference

**Downgrade Behavior:**
- `proration_behavior: 'none'` - no immediate charge/credit
- Plan changes at `current_period_end`
- User keeps current features until cycle ends

**Available Changes by Plan:**
- **Free**: Can upgrade to Premium, Unlimited, or Lifetime
- **Premium**: Can upgrade to Unlimited/Lifetime or downgrade to Free
- **Unlimited**: Can downgrade to Premium or Free
- **Lifetime**: No changes available (one-time purchase)

**Middleware Update:**
When middleware redirects to `/upgrade`, need to check if user has a plan first:
```typescript
if (!access.hasAccess) {
  // No plan - send to onboarding
  redirect('/onboarding');
} else if (!access.hasPremiumAccess && isPremiumRoute) {
  // Free user accessing premium route - send to upgrade
  redirect('/upgrade');
}
```

## 📊 **Definition of Done**

- [ ] `/upgrade` page functional for all user types
- [ ] Upgrade flow charges correct prorated amount
- [ ] Downgrade flow schedules change for next cycle
- [ ] Confirmation modals work correctly
- [ ] Current plan displayed accurately
- [ ] Profile dropdown links to upgrade page
- [ ] Profile page links to upgrade page
- [ ] Webhook handles subscription.updated events
- [ ] Error handling for failed upgrades/downgrades
- [ ] Loading states during API calls

## 🧪 **Testing Requirements**

- [ ] Test with user who has no plan (redirect to onboarding)
- [ ] Test free user upgrading to premium
- [ ] Test premium user upgrading to unlimited
- [ ] Test premium user downgrading to free
- [ ] Test unlimited user downgrading to premium
- [ ] Test lifetime user (no options shown)
- [ ] Verify proration calculation in Stripe dashboard
- [ ] Test downgrade scheduling (check Stripe scheduled changes)
- [ ] Test error scenarios (payment fails, invalid plan, etc.)
- [ ] Test UI states (loading, success, error)

## 🚫 **Out of Scope**

- Plan comparison charts (use existing)
- Detailed feature breakdowns (use existing)
- Billing history page
- Invoice downloads
- Refund processing
- Annual billing option
- Custom plans or enterprise pricing
- Trial periods
- Coupon/promo code support

## 📝 **Notes**

**Stripe Subscription Update Events:**
When subscription is updated, webhook receives `customer.subscription.updated` event. Handler should:
1. Check if plan changed
2. Update `profile.plan_selected` if currently active
3. Log the change with timestamp

**Navigation Integration:**
Add "Manage Subscription" link to:
- Profile picture dropdown menu
- Profile page settings section
- Billing page

**UI Copy Considerations:**
- "Upgrade" for moving to better plans
- "Downgrade" for moving to lesser plans
- "Switch to" for lateral moves (if any)
- Clear messaging about when changes take effect
- Emphasize proration benefits for upgrades

## 🏷️ **Labels**

- `priority: high`
- `type: feature`
- `component: billing`
- `user-facing`
- `subscription-management`
