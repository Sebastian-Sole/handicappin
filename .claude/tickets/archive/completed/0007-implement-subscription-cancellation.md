# 0007 - Implement Subscription Cancellation

## 🎯 **Description**

Allow users to cancel their recurring subscriptions (Premium/Unlimited) with proper handling of cancellation timing, data retention, and user experience considerations.

## 📋 **User Story**

As a subscribed user, I want to cancel my subscription so that I'm not charged in future billing cycles while retaining access until the end of my paid period.

## 🔧 **Technical Context**

**Current State:**
- Users can manage subscriptions via Stripe Customer Portal
- Webhook handles `customer.subscription.deleted` event
- Database updates `plan_selected` to 'free' on cancellation
- No in-app cancellation UI

**Desired Behavior:**
- Subscription cancels at end of current billing period
- User retains premium access until period ends
- Database reflects cancellation status
- User can reactivate before period ends
- Clear communication about when access ends

## ✅ **Acceptance Criteria**

- [ ] "Cancel Subscription" button appears for Premium/Unlimited users
- [ ] Cancellation confirmation modal explains timing
- [ ] Subscription set to `cancel_at_period_end` in Stripe
- [ ] Database tracks cancellation status
- [ ] User retains premium access until period ends
- [ ] Cancelled status shown in UI with reactivation option
- [ ] After period ends, user reverts to free tier automatically
- [ ] Webhook handles cancellation and reactivation events
- [ ] Email confirmation sent (via Stripe)
- [ ] Billing page shows cancellation date

## 🚨 **Technical Requirements**

### **Implementation Details**

1. **Cancellation API**
```typescript
// server/api/routers/billing.ts
cancelSubscription: protectedProcedure
  .mutation(async ({ ctx }) => {
    const { user } = ctx;

    // Get subscription from Stripe
    const customer = await ctx.db.query.stripeCustomers.findFirst({
      where: eq(stripeCustomers.userId, user.id),
    });

    if (!customer) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No subscription found',
      });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    const subscription = subscriptions.data[0];
    if (!subscription) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active subscription found',
      });
    }

    // Cancel at period end (don't immediately revoke access)
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    return {
      success: true,
      endsAt: new Date(subscription.current_period_end * 1000),
    };
  }),

reactivateSubscription: protectedProcedure
  .mutation(async ({ ctx }) => {
    // Similar logic but set cancel_at_period_end: false
  }),
```

2. **Cancel Button Component**
```typescript
// components/billing/cancel-subscription-button.tsx
export function CancelSubscriptionButton({
  subscriptionEndDate
}: {
  subscriptionEndDate: Date
}) {
  const [showModal, setShowModal] = useState(false);
  const cancelMutation = api.billing.cancelSubscription.useMutation();

  const handleCancel = async () => {
    const result = await cancelMutation.mutateAsync();
    toast({
      title: 'Subscription Cancelled',
      description: `Access continues until ${format(result.endsAt, 'PPP')}`,
    });
    setShowModal(false);
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setShowModal(true)}
      >
        Cancel Subscription
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Your subscription will be cancelled, but you'll keep premium access until:</p>
            <p className="text-lg font-semibold">
              {format(subscriptionEndDate, 'MMMM d, yyyy')}
            </p>
            <p className="text-sm text-gray-600">
              After this date, you'll be moved to the free tier. You can reactivate anytime before then.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel Subscription'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Keep Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

3. **Reactivation Component**
```typescript
// components/billing/reactivate-subscription-button.tsx
export function ReactivateSubscriptionButton() {
  const reactivateMutation = api.billing.reactivateSubscription.useMutation();

  const handleReactivate = async () => {
    await reactivateMutation.mutateAsync();
    toast({
      title: 'Subscription Reactivated',
      description: 'Your subscription will continue automatically',
    });
  };

  return (
    <Button onClick={handleReactivate}>
      Reactivate Subscription
    </Button>
  );
}
```

4. **Billing Page Update**
```typescript
// app/billing/page.tsx
{subscription.cancelAtPeriodEnd ? (
  <Card className="border-yellow-500">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-yellow-500" />
        Subscription Ending
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p>Your subscription will end on {format(subscription.currentPeriodEnd, 'PPP')}</p>
      <p className="text-sm text-gray-600 mt-2">
        After this date, you'll be moved to the free tier (25 rounds limit)
      </p>
      <div className="mt-4 space-x-2">
        <ReactivateSubscriptionButton />
      </div>
    </CardContent>
  </Card>
) : (
  <Card>
    <CardHeader>
      <CardTitle>Active Subscription</CardTitle>
    </CardHeader>
    <CardContent>
      <p>Next billing date: {format(subscription.currentPeriodEnd, 'PPP')}</p>
      <div className="mt-4">
        <CancelSubscriptionButton subscriptionEndDate={subscription.currentPeriodEnd} />
      </div>
    </CardContent>
  </Card>
)}
```

5. **Webhook Enhancement**
```typescript
// app/api/stripe/webhook/route.ts
case 'customer.subscription.updated':
  await handleSubscriptionChange(event.data.object);
  break;

async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;

  // Check if subscription is set to cancel
  if (subscription.cancel_at_period_end) {
    console.log(`🔔 Subscription will cancel at period end for user: ${userId}`);
    // Optionally store cancellation status in database
    // Don't change plan_selected yet - user still has access
  }

  // Existing logic for active subscriptions...
}
```

### **Dependencies**

- `server/api/routers/billing.ts` - add cancel/reactivate procedures
- `components/billing/cancel-subscription-button.tsx` - new component
- `components/billing/reactivate-subscription-button.tsx` - new component
- `app/billing/page.tsx` - show cancellation status
- `app/api/stripe/webhook/route.ts` - handle cancellation events
- Stripe Subscriptions API

### **Integration Points**

- Stripe Subscriptions API (cancel_at_period_end)
- Database subscription status tracking
- Webhook system
- Access control (still grants access until period ends)
- UI notifications (toast/alerts)

## 🔍 **Implementation Notes**

**Cancellation Flow:**
1. User clicks "Cancel Subscription"
2. Confirmation modal shows
3. On confirm, API sets `cancel_at_period_end: true`
4. Stripe sends `customer.subscription.updated` webhook
5. User sees "Subscription Ending" status
6. User retains premium access until `current_period_end`
7. At period end, Stripe sends `customer.subscription.deleted` webhook
8. Webhook handler sets `plan_selected: 'free'`
9. User loses premium access, keeps round history

**Reactivation Flow:**
1. User clicks "Reactivate Subscription"
2. API sets `cancel_at_period_end: false`
3. Stripe sends `customer.subscription.updated` webhook
4. Billing continues normally

**Access Control During Cancellation:**
Even with `cancel_at_period_end: true`, Stripe subscription status is still "active" until the period ends. Access control should continue to grant premium access.

**Important Stripe Behavior:**
- `cancel_at_period_end: true` does NOT immediately cancel
- Subscription stays active until `current_period_end`
- No refunds issued (user paid for full period)
- User can reactivate before period ends
- After period ends, subscription status becomes "canceled"

**Database Considerations:**
Current implementation updates `plan_selected` only when subscription is fully deleted. This is correct - don't update it when just setting cancel flag. User still has active plan.

## 📊 **Definition of Done**

- [ ] Cancel button appears for active subscriptions
- [ ] Confirmation modal implemented
- [ ] Cancellation sets `cancel_at_period_end` in Stripe
- [ ] UI shows cancellation status with end date
- [ ] Reactivation button works
- [ ] Webhook handles subscription.updated event
- [ ] User retains access until period ends
- [ ] After period ends, user reverts to free tier
- [ ] Toast notifications for cancel/reactivate
- [ ] Error handling for edge cases

## 🧪 **Testing Requirements**

- [ ] Cancel active Premium subscription
- [ ] Verify `cancel_at_period_end: true` in Stripe
- [ ] Verify user still has premium access
- [ ] Verify cancellation status shown in UI
- [ ] Test reactivation before period ends
- [ ] Use Stripe test clock to fast-forward to period end
- [ ] Verify user reverts to free tier after period ends
- [ ] Test cancelling then immediately reactivating
- [ ] Test error cases (no subscription, already canceled, etc.)
- [ ] Verify webhook logs correctly

## 🚫 **Out of Scope**

- Immediate cancellation (always use `cancel_at_period_end`)
- Refund processing
- Partial refunds
- Cancellation surveys/feedback
- Retention offers or discounts
- Cancellation reasons tracking
- Email campaigns to win back users
- Pausing subscriptions (Stripe feature, but not implementing UI)

## 📝 **Notes**

**Why Cancel at Period End:**
- Industry standard: users paid for the full period
- Better UX: no immediate access revocation
- Allows reactivation without repurchasing
- Reduces support tickets about refunds

**Lifetime Plan:**
Lifetime plans cannot be cancelled (one-time purchase). Don't show cancel button for these users.

**Free Tier Transition:**
When subscription cancels:
- User moves to free tier
- `rounds_used` counter starts tracking
- User limited to 25 rounds
- Can upgrade again anytime

**Customer Portal:**
Stripe Customer Portal also allows cancellation. Both methods should work and stay in sync via webhooks.

## 🏷️ **Labels**

- `priority: high`
- `type: feature`
- `component: billing`
- `user-facing`
- `subscription-management`
