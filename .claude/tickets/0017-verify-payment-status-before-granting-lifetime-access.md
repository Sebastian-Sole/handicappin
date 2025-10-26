# 0017 - Verify Payment Status Before Granting Lifetime Access

## 🎯 **Description**

Add payment_status verification for lifetime plan purchases to prevent granting access before payment completes. Currently, the webhook grants lifetime access immediately upon `checkout.session.completed` without checking if the payment actually succeeded, which could allow access for delayed payment methods (bank transfers, pending cards).

## 📋 **User Story**

As a business owner, I want to ensure users only receive lifetime access after payment confirmation so that I don't give away premium access to users who haven't paid yet or whose payments fail.

## 🔧 **Technical Context**

**Current State:**
- Webhook listens for `checkout.session.completed` ✅
- Grants lifetime access immediately on session completion ❌
- Does NOT check `session.payment_status` ❌
- Assumes payment succeeded if session completed ❌

**Stripe Payment Flow:**

```
checkout.session.completed → payment_status: 'unpaid' | 'paid' | 'no_payment_required'
                           ↓
                    payment_intent.succeeded (for delayed methods)
```

**The Problem:**

For **immediate payment methods** (most cards):
- `checkout.session.completed` fires with `payment_status: 'paid'` ✅
- Current code works correctly by accident

For **delayed payment methods** (bank transfers, some cards):
- `checkout.session.completed` fires with `payment_status: 'unpaid'` ❌
- Current code grants access immediately (WRONG!)
- `payment_intent.succeeded` fires later when payment confirms
- User could get free lifetime access if webhook fails or payment fails

**Current Code (VULNERABLE):**

```typescript:app/api/stripe/webhook/route.ts
// Line 159-204
if (session.mode === "payment") {
  // ❌ NO CHECK FOR session.payment_status!

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
  const priceId = lineItems.data[0]?.price?.id;
  const plan = mapPriceToPlan(priceId);

  if (plan) {
    await db.update(profile).set({
      planSelected: plan, // ✅ Grants lifetime access
      subscriptionStatus: 'active',
    });
  }
}
```

**Security Impact:** 🟡 **MEDIUM-HIGH**
- Revenue loss from unpaid lifetime access
- Potential abuse via payment method selection
- Data integrity issues if payment fails after access granted

**References:**
- Security Assessment Evaluation: Lines 114-164 (security-assessment-evaluation.md)
- Webhook Handler: app/api/stripe/webhook/route.ts:159-204
- Stripe Docs: [Payment Status](https://stripe.com/docs/api/checkout/sessions/object#checkout_session_object-payment_status)

## ✅ **Acceptance Criteria**

- [ ] Webhook checks `session.payment_status` before granting lifetime access
- [ ] Only grant access if `payment_status === 'paid'`
- [ ] For `payment_status === 'unpaid'`, wait for `payment_intent.succeeded`
- [ ] Add handler for `payment_intent.succeeded` event
- [ ] Store pending lifetime purchases in database
- [ ] Handle payment failures gracefully (send email, log event)
- [ ] Manual testing: Test with delayed payment method (bank transfer)
- [ ] Manual testing: Verify access NOT granted until payment confirms

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Add Pending Lifetime Purchases Table**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_pending_lifetime_purchases.sql
CREATE TABLE pending_lifetime_purchases (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profile(id),
  checkout_session_id TEXT NOT NULL UNIQUE,
  payment_intent_id TEXT,
  price_id TEXT NOT NULL,
  plan TEXT NOT NULL, -- 'lifetime'
  status TEXT NOT NULL, -- 'pending' | 'paid' | 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pending_lifetime_user ON pending_lifetime_purchases(user_id);
CREATE INDEX idx_pending_lifetime_status ON pending_lifetime_purchases(status);
```

**2. Update Drizzle Schema**

```typescript:db/schema.ts
export const pendingLifetimePurchases = pgTable("pending_lifetime_purchases", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => profile.id),
  checkoutSessionId: text("checkout_session_id").notNull().unique(),
  paymentIntentId: text("payment_intent_id"),
  priceId: text("price_id").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull(), // 'pending' | 'paid' | 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**3. Update `handleCheckoutCompleted` Handler**

```typescript:app/api/stripe/webhook/route.ts
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;
  const customerId = session.customer;

  if (!userId) {
    logWebhookError("No supabase_user_id in checkout session metadata");
    return;
  }

  // Store Stripe customer ID
  if (customerId) {
    await db.insert(stripeCustomers).values({
      userId,
      stripeCustomerId: customerId,
    }).onConflictDoNothing();
  }

  // For subscription mode, wait for subscription.created event
  if (session.mode === "subscription") {
    logSubscriptionEvent("Subscription checkout - will update plan on subscription.created");
    return;
  }

  // For payment mode (lifetime), CHECK PAYMENT STATUS FIRST
  if (session.mode === "payment") {
    logPaymentEvent("Payment mode detected - checking payment status");

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;

    if (!priceId) {
      logWebhookError("No price ID found in line items");
      return;
    }

    const plan = mapPriceToPlan(priceId);

    if (!plan) {
      logWebhookError(`Unknown price ID: ${priceId}`);
      return;
    }

    // ✅ NEW: Check payment status
    const paymentStatus = session.payment_status;

    if (paymentStatus === 'paid') {
      // Payment already confirmed - grant access immediately
      logPaymentEvent(`Payment confirmed - granting ${plan} access to user ${userId}`);

      await db.update(profile).set({
        planSelected: plan,
        planSelectedAt: new Date(),
        subscriptionStatus: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingVersion: sql`billing_version + 1`,
      }).where(eq(profile.id, userId));

      logWebhookSuccess(`Granted ${plan} access to user ${userId}`);

    } else if (paymentStatus === 'unpaid') {
      // Payment pending - store for later processing
      logPaymentEvent(`Payment pending for user ${userId} - waiting for payment_intent.succeeded`);

      await db.insert(pendingLifetimePurchases).values({
        userId,
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent,
        priceId,
        plan,
        status: 'pending',
      }).onConflictDoUpdate({
        target: pendingLifetimePurchases.checkoutSessionId,
        set: { updatedAt: new Date() },
      });

      logWebhookInfo(`Stored pending lifetime purchase for user ${userId}`);

    } else if (paymentStatus === 'no_payment_required') {
      // Free checkout or 100% coupon - grant access
      logPaymentEvent(`No payment required - granting ${plan} access to user ${userId}`);

      await db.update(profile).set({
        planSelected: plan,
        planSelectedAt: new Date(),
        subscriptionStatus: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingVersion: sql`billing_version + 1`,
      }).where(eq(profile.id, userId));

    } else {
      logWebhookWarning(`Unknown payment status: ${paymentStatus}`);
    }
  }
}
```

**4. Add `payment_intent.succeeded` Handler**

```typescript:app/api/stripe/webhook/route.ts
// Add to switch statement in POST handler
switch (event.type) {
  case "customer.created":
    await handleCustomerCreated(event.data.object);
    break;
  case "checkout.session.completed":
    await handleCheckoutCompleted(event.data.object);
    break;
  case "payment_intent.succeeded": // ✅ NEW
    await handlePaymentIntentSucceeded(event.data.object);
    break;
  // ... other handlers
}

async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const paymentIntentId = paymentIntent.id;

  logPaymentEvent(`Payment intent succeeded: ${paymentIntentId}`);

  // Find pending lifetime purchase
  const pending = await db
    .select()
    .from(pendingLifetimePurchases)
    .where(eq(pendingLifetimePurchases.paymentIntentId, paymentIntentId))
    .limit(1);

  if (pending.length === 0) {
    // Not a lifetime purchase or already processed
    logWebhookInfo(`No pending lifetime purchase found for payment intent ${paymentIntentId}`);
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

  logWebhookSuccess(`Granted ${purchase.plan} access to user ${purchase.userId} after payment confirmation`);
}
```

**5. Add `payment_intent.payment_failed` Handler (Optional)**

```typescript:app/api/stripe/webhook/route.ts
async function handlePaymentIntentFailed(paymentIntent: any) {
  const paymentIntentId = paymentIntent.id;

  logPaymentEvent(`Payment intent failed: ${paymentIntentId}`);

  // Find pending lifetime purchase
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
}
```

### **Dependencies**

- `db/schema.ts` - Add `pendingLifetimePurchases` table
- `app/api/stripe/webhook/route.ts` - Update handlers
- Supabase migration - Create pending purchases table
- Stripe webhook configuration - Add `payment_intent.succeeded` event

### **Integration Points**

- Stripe webhook endpoint (add new event types)
- Database via Drizzle ORM
- Email notification system (for payment failures)

## 🔍 **Implementation Notes**

### **Edge Cases:**

1. **Immediate Card Payments:**
   - Most card payments have `payment_status: 'paid'` immediately
   - Access granted on `checkout.session.completed` (current flow)
   - No change in UX for majority of users

2. **Bank Transfers / ACH:**
   - `payment_status: 'unpaid'` on checkout completion
   - User sees "Payment pending" message
   - Access granted when `payment_intent.succeeded` fires (days later)

3. **Failed Payments:**
   - `payment_intent.payment_failed` fires
   - Mark purchase as failed
   - Send email notification to user

4. **100% Discount Coupons:**
   - `payment_status: 'no_payment_required'`
   - Grant access immediately (legitimate free purchase)

5. **Duplicate Events:**
   - Protected by idempotency tracking (Ticket #0015)
   - Use `onConflictDoUpdate` for pending purchases table

### **Payment Status Values:**

From Stripe API:
- `paid` - Payment succeeded
- `unpaid` - Payment pending
- `no_payment_required` - Free checkout (100% coupon)

### **Performance Considerations:**

- Add index on `payment_intent_id` for fast lookups
- Add index on `status` for cleanup queries
- Cleanup old pending purchases after 30 days

## 📊 **Definition of Done**

- [ ] Database migration created for `pending_lifetime_purchases` table
- [ ] Drizzle schema updated
- [ ] `handleCheckoutCompleted` checks `payment_status`
- [ ] `handlePaymentIntentSucceeded` grants access after payment confirms
- [ ] `handlePaymentIntentFailed` handles failed payments
- [ ] Manual testing: Test with immediate payment method (card)
- [ ] Manual testing: Test with delayed payment method (bank transfer)
- [ ] Stripe webhook configured to receive `payment_intent.*` events

## 🧪 **Testing Requirements**

### **Unit Tests:**

```typescript
test('should grant lifetime access immediately for paid sessions', async () => {
  const session = createMockCheckoutSession({
    mode: 'payment',
    payment_status: 'paid',
    metadata: { supabase_user_id: 'user-123' },
  });

  await handleCheckoutCompleted(session);

  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].planSelected).toBe('lifetime');
});

test('should store pending purchase for unpaid sessions', async () => {
  const session = createMockCheckoutSession({
    mode: 'payment',
    payment_status: 'unpaid',
    payment_intent: 'pi_123',
  });

  await handleCheckoutCompleted(session);

  const pending = await db.select().from(pendingLifetimePurchases);
  expect(pending[0].status).toBe('pending');
  expect(pending[0].paymentIntentId).toBe('pi_123');
});

test('should grant access after payment_intent.succeeded', async () => {
  // Setup pending purchase
  await db.insert(pendingLifetimePurchases).values({
    userId: 'user-123',
    paymentIntentId: 'pi_123',
    plan: 'lifetime',
    status: 'pending',
  });

  const paymentIntent = createMockPaymentIntent({ id: 'pi_123' });
  await handlePaymentIntentSucceeded(paymentIntent);

  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].planSelected).toBe('lifetime');
});
```

### **Manual Testing:**

```bash
# Test immediate payment (card)
stripe trigger checkout.session.completed

# Test delayed payment
# 1. Create manual checkout session in Stripe Dashboard
# 2. Select bank transfer payment method
# 3. Verify checkout.session.completed has payment_status: 'unpaid'
# 4. Manually mark payment as succeeded in Stripe Dashboard
# 5. Verify payment_intent.succeeded fires and grants access
```

### **Stripe CLI Testing:**

```bash
# Forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger events
stripe trigger checkout.session.completed
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
```

## 🚫 **Out of Scope**

- Email notifications for pending payments (separate ticket)
- Admin dashboard for monitoring pending purchases
- Automatic payment retry logic (handled by Stripe)
- Partial refunds for failed payments
- User-facing "payment pending" UI (separate ticket)

## 📝 **Notes**

**Stripe Payment Flow:**

```
User submits payment
       ↓
checkout.session.completed
       ↓
payment_status check:
  - 'paid' → grant access immediately ✅
  - 'unpaid' → store pending, wait for payment_intent.succeeded
  - 'no_payment_required' → grant access (100% coupon) ✅
       ↓
[For unpaid sessions only]
       ↓
payment_intent.succeeded → grant access ✅
payment_intent.payment_failed → mark failed, notify user
```

**Why This Matters:**
- Prevents revenue loss from unpaid lifetime access
- Ensures compliance with payment processing rules
- Handles edge cases (bank transfers, delayed card verification)
- Improves data integrity (plan matches actual payment status)

**Stripe Documentation:**
- [Checkout Session Payment Status](https://stripe.com/docs/api/checkout/sessions/object#checkout_session_object-payment_status)
- [Payment Intents](https://stripe.com/docs/payments/payment-intents)

**Related Tickets:**
- Ticket #0015: Webhook Idempotency Tracking
- Ticket #0016: JWT Refresh After Webhook Updates
- Ticket #0018: Add Webhook Amount Verification

## 🏷️ **Labels**

- `priority: high`
- `type: security`
- `component: billing`
- `component: webhooks`
- `revenue-protection`
- `stripe-integration`
- `payment-verification`
