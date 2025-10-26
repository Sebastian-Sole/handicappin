# 0021 - Add Missing Stripe Webhook Event Handlers

## 🎯 **Description**

Add handlers for critical Stripe webhook events that are currently unhandled, including payment failures, refunds, disputes, and customer updates. The current webhook implementation only handles basic subscription lifecycle events but misses important events that affect billing integrity and user experience.

## 📋 **User Story**

As a platform owner, I want to handle all critical Stripe events so that users' billing states remain accurate even when payments fail, refunds occur, or disputes are filed.

## 🔧 **Technical Context**

**Current Webhook Handlers:**
```typescript:app/api/stripe/webhook/route.ts
// Lines 39-58
switch (event.type) {
  case "customer.created":
    await handleCustomerCreated(event.data.object);
    break;
  case "checkout.session.completed":
    await handleCheckoutCompleted(event.data.object);
    break;
  case "customer.subscription.created":
  case "customer.subscription.updated":
    await handleSubscriptionChange(event.data.object);
    break;
  case "customer.subscription.deleted":
    await handleSubscriptionDeleted(event.data.object);
    break;
  default:
    logWebhookInfo(`Unhandled event type: ${event.type}`);
}
```

**Missing Critical Events:**

1. **Payment Intent Events** (for lifetime purchases)
   - `payment_intent.succeeded` - Payment confirms after delay
   - `payment_intent.payment_failed` - Payment fails

2. **Invoice Events** (for subscriptions)
   - `invoice.payment_succeeded` - Monthly payment succeeds
   - `invoice.payment_failed` - Monthly payment fails (card declined, etc.)
   - `invoice.payment_action_required` - 3D Secure or other action needed

3. **Charge Events** (for refunds and disputes)
   - `charge.refunded` - Full or partial refund issued
   - `charge.dispute.created` - Customer disputes charge
   - `charge.dispute.closed` - Dispute resolved

4. **Customer Events**
   - `customer.updated` - Email or metadata changes
   - `customer.deleted` - Customer deleted in Stripe

5. **Subscription Events** (additional)
   - `customer.subscription.paused` - Subscription paused
   - `customer.subscription.resumed` - Subscription resumed

**Impact of Missing Handlers:**

| Missing Event | Current Behavior | Correct Behavior |
|--------------|------------------|------------------|
| `payment_intent.succeeded` | Lifetime access never granted for delayed payments | Grant access when payment confirms |
| `payment_intent.payment_failed` | Pending purchase stays "pending" forever | Mark as failed, notify user |
| `invoice.payment_failed` | Subscription shows "active" despite failed payment | Update status to "past_due" |
| `charge.refunded` | User keeps access after refund | Revoke access on refund |
| `charge.dispute.created` | No notification of dispute | Alert admin, flag account |

**Security Impact:** 🟡 **MEDIUM**
- Data integrity issues from unhandled events
- Revenue loss from unhandled refunds
- User access continues after payment failures

## ✅ **Acceptance Criteria**

- [ ] Add handler for `payment_intent.succeeded`
- [ ] Add handler for `payment_intent.payment_failed`
- [ ] Add handler for `invoice.payment_failed`
- [ ] Add handler for `charge.refunded`
- [ ] Add handler for `charge.dispute.created` (optional)
- [ ] All handlers update database with appropriate status
- [ ] Failed payments update `subscription_status` to reflect reality
- [ ] Refunds revoke premium access
- [ ] Webhook logs clearly show which events are handled
- [ ] Manual testing: Trigger each event via Stripe CLI

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Add Payment Intent Handlers**

```typescript:app/api/stripe/webhook/route.ts
// Add to switch statement
case "payment_intent.succeeded":
  await handlePaymentIntentSucceeded(event.data.object);
  break;
case "payment_intent.payment_failed":
  await handlePaymentIntentFailed(event.data.object);
  break;

/**
 * Handle successful payment intent (for lifetime purchases with delayed payment)
 * This is covered in Ticket #0017 but included here for completeness
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const paymentIntentId = paymentIntent.id;

  logPaymentEvent(`Payment intent succeeded: ${paymentIntentId}`);

  // Check if this is for a pending lifetime purchase
  const pending = await db
    .select()
    .from(pendingLifetimePurchases)
    .where(eq(pendingLifetimePurchases.paymentIntentId, paymentIntentId))
    .limit(1);

  if (pending.length === 0) {
    // Not a tracked lifetime purchase (might be subscription)
    logWebhookInfo(`No pending lifetime purchase for payment intent ${paymentIntentId}`);
    return;
  }

  const purchase = pending[0];

  // Grant lifetime access
  logPaymentEvent(`Granting ${purchase.plan} access to user ${purchase.userId}`);

  await db.update(profile).set({
    planSelected: purchase.plan,
    planSelectedAt: new Date(),
    subscriptionStatus: 'active',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    billingVersion: sql`billing_version + 1`,
  }).where(eq(profile.id, purchase.userId));

  // Mark purchase as paid
  await db.update(pendingLifetimePurchases).set({
    status: 'paid',
    updatedAt: new Date(),
  }).where(eq(pendingLifetimePurchases.id, purchase.id));

  logWebhookSuccess(`Granted ${purchase.plan} access after payment confirmation`);
}

/**
 * Handle failed payment intent (payment declined, expired, etc.)
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  const paymentIntentId = paymentIntent.id;
  const failureReason = paymentIntent.last_payment_error?.message || 'Unknown';

  logPaymentEvent(`Payment intent failed: ${paymentIntentId} - ${failureReason}`);

  // Check if this is for a pending lifetime purchase
  const pending = await db
    .select()
    .from(pendingLifetimePurchases)
    .where(eq(pendingLifetimePurchases.paymentIntentId, paymentIntentId))
    .limit(1);

  if (pending.length === 0) {
    return;
  }

  const purchase = pending[0];

  // Mark purchase as failed
  await db.update(pendingLifetimePurchases).set({
    status: 'failed',
    updatedAt: new Date(),
  }).where(eq(pendingLifetimePurchases.id, purchase.id));

  logWebhookWarning(`Payment failed for user ${purchase.userId} - lifetime purchase canceled`);

  // TODO: Send email notification to user
  // await sendPaymentFailureEmail({
  //   userId: purchase.userId,
  //   reason: failureReason,
  //   plan: purchase.plan,
  // });
}
```

**2. Add Invoice Payment Handlers**

```typescript:app/api/stripe/webhook/route.ts
// Add to switch statement
case "invoice.payment_failed":
  await handleInvoicePaymentFailed(event.data.object);
  break;

/**
 * Handle failed invoice payment (subscription payment declined)
 * This updates the user's subscription status to reflect payment failure
 */
async function handleInvoicePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;
  const attemptCount = invoice.attempt_count;
  const nextPaymentAttempt = invoice.next_payment_attempt;

  logPaymentEvent(`Invoice payment failed for subscription ${subscriptionId} (attempt ${attemptCount})`);

  if (!subscriptionId) {
    logWebhookWarning("Invoice has no subscription ID");
    return;
  }

  // Get subscription to find user ID
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("No user ID in subscription metadata");
    return;
  }

  // Update subscription status to past_due
  await db.update(profile).set({
    subscriptionStatus: 'past_due',
    billingVersion: sql`billing_version + 1`,
  }).where(eq(profile.id, userId));

  logWebhookSuccess(`Updated subscription status to past_due for user ${userId}`);

  // After 3 failed attempts, Stripe will cancel the subscription
  // That will trigger subscription.deleted webhook
  if (attemptCount >= 3) {
    logWebhookWarning(`Final payment attempt failed for user ${userId} - subscription will be canceled`);
  }

  // TODO: Send email notification
  // await sendPaymentFailureEmail({
  //   userId,
  //   attemptCount,
  //   nextAttemptDate: nextPaymentAttempt ? new Date(nextPaymentAttempt * 1000) : null,
  // });
}
```

**3. Add Refund Handler**

```typescript:app/api/stripe/webhook/route.ts
// Add to switch statement
case "charge.refunded":
  await handleChargeRefunded(event.data.object);
  break;

/**
 * Handle charge refunds (full or partial)
 * Revokes access for full refunds of lifetime purchases
 */
async function handleChargeRefunded(charge: any) {
  const chargeId = charge.id;
  const customerId = charge.customer;
  const amountRefunded = charge.amount_refunded; // In cents
  const amountCharged = charge.amount; // In cents
  const isFullRefund = amountRefunded === amountCharged;

  logPaymentEvent(`Charge refunded: ${chargeId} (${amountRefunded / 100} ${charge.currency})`);

  if (!customerId) {
    logWebhookWarning("Charge has no customer ID");
    return;
  }

  // Find user by customer ID
  const customerRecord = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId))
    .limit(1);

  if (customerRecord.length === 0) {
    logWebhookWarning(`No user found for customer ${customerId}`);
    return;
  }

  const userId = customerRecord[0].userId;

  // Get user's current plan
  const userProfile = await db
    .select()
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);

  if (userProfile.length === 0) {
    logWebhookError(`No profile found for user ${userId}`);
    return;
  }

  const currentPlan = userProfile[0].planSelected;

  // For lifetime plans, full refund = revoke access
  if (currentPlan === 'lifetime' && isFullRefund) {
    logPaymentEvent(`Full refund detected - revoking lifetime access for user ${userId}`);

    await db.update(profile).set({
      planSelected: 'free',
      planSelectedAt: new Date(),
      subscriptionStatus: 'canceled',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      billingVersion: sql`billing_version + 1`,
    }).where(eq(profile.id, userId));

    logWebhookSuccess(`Revoked lifetime access for user ${userId} due to full refund`);

    // TODO: Send email notification
    // await sendRefundNotificationEmail({ userId, amount: amountRefunded });
  } else if (isFullRefund) {
    logWebhookInfo(`Full refund for non-lifetime plan - subscription cancellation will be handled by subscription.deleted event`);
  } else {
    logWebhookInfo(`Partial refund (${amountRefunded / 100} ${charge.currency}) - no access changes`);
  }
}
```

**4. Add Dispute Handler (Optional)**

```typescript:app/api/stripe/webhook/route.ts
// Add to switch statement
case "charge.dispute.created":
  await handleDisputeCreated(event.data.object);
  break;

/**
 * Handle charge disputes (chargebacks)
 * Logs security alert for manual review
 */
async function handleDisputeCreated(dispute: any) {
  const disputeId = dispute.id;
  const chargeId = dispute.charge;
  const amount = dispute.amount;
  const reason = dispute.reason;
  const status = dispute.status;

  logPaymentEvent(`Dispute created: ${disputeId} for charge ${chargeId}`);

  // Get charge details to find customer
  const charge = await stripe.charges.retrieve(chargeId);
  const customerId = charge.customer;

  if (!customerId) {
    logWebhookWarning("Disputed charge has no customer ID");
    return;
  }

  // Find user by customer ID
  const customerRecord = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId as string))
    .limit(1);

  if (customerRecord.length === 0) {
    logWebhookWarning(`No user found for disputed customer ${customerId}`);
    return;
  }

  const userId = customerRecord[0].userId;

  // Log security alert for manual review
  console.error('🚨 SECURITY ALERT: Charge dispute filed', {
    disputeId,
    chargeId,
    userId,
    amount: amount / 100,
    reason,
    status,
    timestamp: new Date().toISOString(),
  });

  // TODO: Send alert to admin
  // await sendDisputeAlert({
  //   userId,
  //   disputeId,
  //   amount,
  //   reason,
  // });

  // TODO: Flag user account for review
  // await flagUserAccountForReview(userId, 'dispute_filed');

  // Note: Do NOT automatically revoke access
  // Wait for dispute resolution (charge.dispute.closed)
}
```

**5. Update Switch Statement**

```typescript:app/api/stripe/webhook/route.ts
// Complete switch statement with all handlers
switch (event.type) {
  // Customer events
  case "customer.created":
    await handleCustomerCreated(event.data.object);
    break;

  // Checkout events
  case "checkout.session.completed":
    await handleCheckoutCompleted(event.data.object);
    break;

  // Subscription events
  case "customer.subscription.created":
  case "customer.subscription.updated":
    await handleSubscriptionChange(event.data.object);
    break;
  case "customer.subscription.deleted":
    await handleSubscriptionDeleted(event.data.object);
    break;

  // Payment intent events (lifetime purchases)
  case "payment_intent.succeeded":
    await handlePaymentIntentSucceeded(event.data.object);
    break;
  case "payment_intent.payment_failed":
    await handlePaymentIntentFailed(event.data.object);
    break;

  // Invoice events (subscription payments)
  case "invoice.payment_failed":
    await handleInvoicePaymentFailed(event.data.object);
    break;

  // Charge events (refunds, disputes)
  case "charge.refunded":
    await handleChargeRefunded(event.data.object);
    break;
  case "charge.dispute.created":
    await handleDisputeCreated(event.data.object);
    break;

  default:
    logWebhookInfo(`Unhandled event type: ${event.type}`);
}
```

### **Dependencies**

- `app/api/stripe/webhook/route.ts` - Add new handlers
- `db/schema.ts` - Already has `pendingLifetimePurchases` (from Ticket #0017)
- Email notification system (TODO)
- Admin alerting system (TODO)

### **Integration Points**

- Stripe webhook endpoint (configure new event types)
- Database via Drizzle ORM
- Email notification system (future)
- Admin dashboard (future)

## 🔍 **Implementation Notes**

### **Event Priority:**

**Must Have (High Priority):**
1. `payment_intent.succeeded` - Critical for lifetime purchases
2. `payment_intent.payment_failed` - Prevents stuck pending purchases
3. `invoice.payment_failed` - Updates subscription status accurately
4. `charge.refunded` - Revokes access after refunds

**Nice to Have (Medium Priority):**
5. `charge.dispute.created` - Security monitoring
6. `customer.updated` - Email change tracking
7. `invoice.payment_succeeded` - Confirmation logging (optional)

### **Stripe Retry Behavior:**

- **Payment failures:** Stripe retries 3-4 times over ~2 weeks
- **After final failure:** `subscription.deleted` webhook fires
- **Refunds:** Instant, no retries
- **Disputes:** Can take weeks/months to resolve

### **Webhook Configuration:**

After deployment, configure Stripe webhook to listen for these events:

```bash
# Via Stripe CLI
stripe listen --events \
  customer.created,\
  checkout.session.completed,\
  customer.subscription.created,\
  customer.subscription.updated,\
  customer.subscription.deleted,\
  payment_intent.succeeded,\
  payment_intent.payment_failed,\
  invoice.payment_failed,\
  charge.refunded,\
  charge.dispute.created
```

Or in Stripe Dashboard:
1. Go to Developers > Webhooks
2. Add endpoint: `https://yourapp.com/api/stripe/webhook`
3. Select events listed above
4. Save webhook secret to `.env`

## 📊 **Definition of Done**

- [ ] All priority event handlers implemented
- [ ] Switch statement updated with new cases
- [ ] Database updates for each event type
- [ ] Logging statements for all events
- [ ] Stripe webhook configured with new events
- [ ] Manual testing: Trigger each event via CLI
- [ ] Verify database state changes correctly
- [ ] Document event handling in README

## 🧪 **Testing Requirements**

### **Manual Testing with Stripe CLI:**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Test payment intent success
stripe trigger payment_intent.succeeded

# Test payment intent failure
stripe trigger payment_intent.payment_failed

# Test invoice payment failure
stripe trigger invoice.payment_failed

# Test refund
stripe trigger charge.refunded

# Test dispute
stripe trigger charge.dispute.created
```

### **Integration Tests:**

```typescript
test('should revoke lifetime access on full refund', async () => {
  // Setup user with lifetime plan
  await db.insert(profile).values({
    id: 'user-123',
    planSelected: 'lifetime',
  });

  await db.insert(stripeCustomers).values({
    userId: 'user-123',
    stripeCustomerId: 'cus_123',
  });

  // Simulate full refund
  const charge = createMockCharge({
    customer: 'cus_123',
    amount: 9999,
    amount_refunded: 9999, // Full refund
  });

  await handleChargeRefunded(charge);

  // Verify access revoked
  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].planSelected).toBe('free');
  expect(user[0].subscriptionStatus).toBe('canceled');
});

test('should update status to past_due on invoice failure', async () => {
  await db.insert(profile).values({
    id: 'user-123',
    planSelected: 'premium',
    subscriptionStatus: 'active',
  });

  const invoice = createMockInvoice({
    subscription: 'sub_123',
    attempt_count: 1,
  });

  // Mock subscription.retrieve
  mockStripe.subscriptions.retrieve.mockResolvedValue({
    metadata: { supabase_user_id: 'user-123' },
  });

  await handleInvoicePaymentFailed(invoice);

  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].subscriptionStatus).toBe('past_due');
});
```

## 🚫 **Out of Scope**

- Automatic dispute responses (require manual review)
- Email notifications (separate ticket)
- Retry logic for failed payments (handled by Stripe)
- Partial refund handling (complex business logic)
- Customer portal integration for disputes
- Analytics dashboard for payment failures

## 📝 **Notes**

**Why These Events Matter:**

1. **Payment Intent Events:**
   - Required for delayed payment methods (bank transfers, SEPA)
   - Without these, lifetime purchases with delayed payments never complete

2. **Invoice Failure Events:**
   - Subscriptions can fail silently without these handlers
   - Users retain access despite non-payment
   - Creates revenue loss and confused users

3. **Refund Events:**
   - Critical for revenue protection
   - Must revoke access after refunds
   - Prevents abuse (buy → refund → keep access)

4. **Dispute Events:**
   - Security monitoring for fraud
   - Early warning system for chargebacks
   - Helps investigate fraudulent accounts

**Stripe Documentation:**
- [Webhook Events](https://stripe.com/docs/api/events/types)
- [Payment Intent Lifecycle](https://stripe.com/docs/payments/intents#intent-statuses)
- [Invoice Lifecycle](https://stripe.com/docs/billing/subscriptions/overview#subscription-lifecycle)
- [Dispute Handling](https://stripe.com/docs/disputes)

**Related Tickets:**
- Ticket #0015: Webhook Idempotency Tracking (foundation)
- Ticket #0017: Payment Status Verification (uses payment_intent.succeeded)
- Ticket #0018: Amount Verification (applies to all handlers)

## 🏷️ **Labels**

- `priority: high`
- `type: enhancement`
- `component: billing`
- `component: webhooks`
- `data-integrity`
- `stripe-integration`
- `event-handling`
