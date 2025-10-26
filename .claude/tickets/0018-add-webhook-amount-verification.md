# 0018 - Add Webhook Amount Verification

## 🎯 **Description**

Validate payment amounts in webhook handlers to prevent granting premium access for incorrect or fraudulent payment amounts. Currently, webhooks trust the price ID from environment variables without verifying the actual amount charged matches expected prices, which could allow users to purchase premium plans for pennies if environment variables are misconfigured or test prices are used in production.

## 📋 **User Story**

As a business owner, I want to ensure users only receive premium access when they pay the correct amount so that I don't lose revenue from misconfigured pricing or pricing attacks.

## 🔧 **Technical Context**

**Current State:**
- Checkout creates sessions using environment variable price IDs ✅
- Webhooks map price IDs to plans ✅
- NO verification that charged amount matches expected amount ❌
- Trust that environment variables point to correct prices ❌

**Vulnerability:**

```typescript:app/api/stripe/checkout/route.ts
// Line 26-27
const priceId = PLAN_TO_PRICE_MAP[plan as "premium" | "unlimited" | "lifetime"];
// ❌ Trusts env var STRIPE_PREMIUM_PRICE_ID points to correct price
```

```typescript:app/api/stripe/webhook/route.ts
// Line 172-188
const plan = mapPriceToPlan(priceId);
if (plan) {
  await db.update(profile).set({ planSelected: plan });
  // ❌ No amount verification!
}
```

**Attack Scenarios:**

1. **Misconfigured Environment Variables:**
   ```bash
   # .env
   STRIPE_PREMIUM_PRICE_ID=price_test_123  # Points to $0.01 test price
   STRIPE_UNLIMITED_PRICE_ID=price_test_456 # Points to $1 price
   ```
   - User purchases "premium" for $0.01
   - Webhook grants premium access
   - No detection of incorrect amount

2. **Price ID Swap Attack (Unlikely but Possible):**
   - Attacker creates custom Stripe integration
   - Uses legitimate price ID but manipulates amount in Stripe API call
   - If Stripe API accepts it, webhook grants access without amount check

3. **Test Mode → Production Migration:**
   - Developer accidentally deploys with test price IDs
   - Users purchase premium plans for test amounts
   - Revenue loss until discovered

**Security Impact:** 🟡 **MEDIUM**
- Revenue loss from incorrect pricing
- No detection mechanism for pricing errors
- Delayed discovery of misconfiguration

**References:**
- Security Assessment: Lines 315-358 (security-assessment.md)
- Checkout Handler: app/api/stripe/checkout/route.ts
- Webhook Handler: app/api/stripe/webhook/route.ts:159-204

## ✅ **Acceptance Criteria**

- [ ] Define expected amounts for each plan in constants
- [ ] Webhook handler verifies `amount_total` matches expected amount
- [ ] Subscriptions verify `amount` on first invoice
- [ ] Amount mismatches are logged as critical errors
- [ ] Amount mismatches do NOT grant access (security first)
- [ ] Allow small variance (±1 cent) for currency rounding
- [ ] Support multiple currencies (USD, EUR, etc.)
- [ ] Manual testing: Attempt checkout with test price ID
- [ ] Manual testing: Verify webhook rejects incorrect amounts

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Define Expected Amounts**

```typescript:utils/billing/pricing.ts
// Define expected amounts in cents (USD)
export const PLAN_PRICING = {
  premium: {
    monthly: {
      usd: 999, // $9.99/month
      eur: 999, // €9.99/month
    },
  },
  unlimited: {
    monthly: {
      usd: 1999, // $19.99/month
      eur: 1999, // €19.99/month
    },
  },
  lifetime: {
    oneTime: {
      usd: 9999, // $99.99 one-time
      eur: 9999, // €99.99 one-time
    },
  },
} as const;

// Variance tolerance for rounding (1 cent)
const AMOUNT_VARIANCE_TOLERANCE = 1;

/**
 * Verify payment amount matches expected price for plan
 * Returns true if amount is within acceptable range
 */
export function verifyPaymentAmount(
  plan: "premium" | "unlimited" | "lifetime",
  currency: string,
  actualAmount: number,
  isRecurring: boolean
): { valid: boolean; expected: number; actual: number; variance: number } {
  const currencyLower = currency.toLowerCase();

  let expectedAmount: number;

  if (plan === "lifetime") {
    expectedAmount = PLAN_PRICING.lifetime.oneTime[currencyLower as 'usd' | 'eur'] || PLAN_PRICING.lifetime.oneTime.usd;
  } else {
    expectedAmount = PLAN_PRICING[plan].monthly[currencyLower as 'usd' | 'eur'] || PLAN_PRICING[plan].monthly.usd;
  }

  const variance = Math.abs(actualAmount - expectedAmount);
  const valid = variance <= AMOUNT_VARIANCE_TOLERANCE;

  return { valid, expected: expectedAmount, actual: actualAmount, variance };
}
```

**2. Update Checkout Handler (Optional - Defense in Depth)**

```typescript:app/api/stripe/checkout/route.ts
import { verifyPaymentAmount } from '@/utils/billing/pricing';

export async function POST(request: NextRequest) {
  // ... existing code ...

  const priceId = PLAN_TO_PRICE_MAP[plan as "premium" | "unlimited" | "lifetime"];

  // ✅ NEW: Verify price ID points to correct amount
  try {
    const price = await stripe.prices.retrieve(priceId);

    const verification = verifyPaymentAmount(
      plan as "premium" | "unlimited" | "lifetime",
      price.currency,
      price.unit_amount || 0,
      price.type === 'recurring'
    );

    if (!verification.valid) {
      console.error('❌ Price verification failed:', {
        plan,
        priceId,
        expected: verification.expected,
        actual: verification.actual,
        variance: verification.variance,
      });

      return NextResponse.json(
        { error: 'Pricing configuration error. Please contact support.' },
        { status: 500 }
      );
    }

    console.log('✅ Price verification passed:', {
      plan,
      amount: verification.actual,
      currency: price.currency,
    });
  } catch (error) {
    console.error('❌ Failed to verify price:', error);
    return NextResponse.json(
      { error: 'Failed to verify pricing' },
      { status: 500 }
    );
  }

  // ... continue with checkout session creation ...
}
```

**3. Update Webhook Handler (Critical - Primary Defense)**

```typescript:app/api/stripe/webhook/route.ts
import { verifyPaymentAmount } from '@/utils/billing/pricing';

async function handleCheckoutCompleted(session: any) {
  // ... existing code ...

  if (session.mode === "payment") {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;
    const plan = mapPriceToPlan(priceId);

    if (plan) {
      // ✅ NEW: Verify amount charged
      const amountTotal = session.amount_total; // Total in cents
      const currency = session.currency;

      const verification = verifyPaymentAmount(
        plan,
        currency,
        amountTotal,
        false // lifetime is one-time
      );

      if (!verification.valid) {
        logWebhookError('Amount verification failed - NOT granting access', {
          plan,
          expected: verification.expected,
          actual: verification.actual,
          variance: verification.variance,
          currency,
          sessionId: session.id,
          userId,
        });

        // ❌ DO NOT GRANT ACCESS
        // TODO: Send alert to admin
        return;
      }

      logWebhookSuccess('Amount verification passed', {
        plan,
        amount: verification.actual,
        currency,
      });

      // Grant access (existing code)
      await db.update(profile).set({
        planSelected: plan,
        planSelectedAt: new Date(),
        subscriptionStatus: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingVersion: sql`billing_version + 1`,
      }).where(eq(profile.id, userId));
    }
  }
}

async function handleSubscriptionChange(subscription: any) {
  // ... existing code ...

  const priceId = subscription.items.data[0]?.price.id;
  const plan = mapPriceToPlan(priceId);

  if (!plan) {
    logWebhookError(`Unknown price ID: ${priceId}`);
    return;
  }

  // ✅ NEW: Verify subscription amount
  const price = subscription.items.data[0]?.price;
  const amount = price?.unit_amount || 0;
  const currency = price?.currency || 'usd';

  const verification = verifyPaymentAmount(
    plan,
    currency,
    amount,
    true // subscription is recurring
  );

  if (!verification.valid) {
    logWebhookError('Subscription amount verification failed - NOT updating plan', {
      plan,
      expected: verification.expected,
      actual: verification.actual,
      variance: verification.variance,
      currency,
      subscriptionId: subscription.id,
    });

    // ❌ DO NOT GRANT ACCESS
    return;
  }

  logWebhookSuccess('Subscription amount verification passed', {
    plan,
    amount: verification.actual,
    currency,
  });

  // Only update if subscription is active AND amount is correct
  if (subscription.status === "active" || subscription.status === "trialing") {
    await db.update(profile).set({
      planSelected: plan,
      planSelectedAt: new Date(),
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      billingVersion: sql`billing_version + 1`,
    }).where(eq(profile.id, userId));
  }
}
```

**4. Add Admin Alert for Amount Mismatches (Optional)**

```typescript:lib/admin-alerts.ts
export async function sendAmountMismatchAlert({
  plan,
  expected,
  actual,
  userId,
  sessionId,
}: {
  plan: string;
  expected: number;
  actual: number;
  userId: string;
  sessionId: string;
}) {
  // Send email to admin
  console.error('🚨 CRITICAL: Amount mismatch detected', {
    plan,
    expected,
    actual,
    userId,
    sessionId,
    timestamp: new Date().toISOString(),
  });

  // TODO: Integrate with email service
  // await sendEmail({
  //   to: 'admin@yourapp.com',
  //   subject: '🚨 CRITICAL: Payment Amount Mismatch',
  //   body: `User ${userId} attempted to purchase ${plan} for incorrect amount...`
  // });
}
```

### **Dependencies**

- `utils/billing/pricing.ts` - New file for pricing constants
- `app/api/stripe/checkout/route.ts` - Update checkout handler
- `app/api/stripe/webhook/route.ts` - Update webhook handlers
- `lib/admin-alerts.ts` - Optional admin alerting

### **Integration Points**

- Stripe API (price retrieval)
- Webhook handlers (amount verification)
- Logging system (critical error logging)
- Admin alerting system (optional)

## 🔍 **Implementation Notes**

### **Edge Cases:**

1. **Currency Rounding:**
   - Some currencies don't support cents (JPY, KRW)
   - Allow ±1 unit variance for rounding errors
   - Verify currency-specific rounding rules

2. **Promotional Pricing:**
   - 100% coupons → `amount_total: 0`
   - Verify using `payment_status: 'no_payment_required'` instead
   - Don't block legitimate free checkouts

3. **Multi-Currency Support:**
   - Store expected amounts for each currency
   - Convert amounts if needed (use Stripe's conversion API)
   - Default to USD if currency not configured

4. **Test Mode vs Production:**
   - Use different price constants for test/production
   - Check `livemode` flag in webhook events
   - Log warnings for test mode amounts in production

### **Amount Verification Strategy:**

**Defense Layers:**
1. **Checkout Handler** (prevention) - Verify price before creating session
2. **Webhook Handler** (detection) - Verify amount before granting access
3. **Admin Alerts** (monitoring) - Notify on mismatches

### **Performance Considerations:**

- Price retrieval adds ~100ms to checkout (acceptable)
- Webhook verification is instant (in-memory comparison)
- Cache price amounts to reduce Stripe API calls

## 📊 **Definition of Done**

- [ ] `utils/billing/pricing.ts` created with expected amounts
- [ ] `verifyPaymentAmount()` function implemented and tested
- [ ] Checkout handler verifies price before creating session
- [ ] Webhook handlers verify amounts before granting access
- [ ] Amount mismatches are logged as critical errors
- [ ] Amount mismatches do NOT grant access
- [ ] Support for USD and EUR currencies
- [ ] Manual testing: Create test price with wrong amount
- [ ] Manual testing: Verify webhook rejects incorrect amount

## 🧪 **Testing Requirements**

### **Unit Tests:**

```typescript
import { verifyPaymentAmount } from '@/utils/billing/pricing';

test('should accept correct premium amount', () => {
  const result = verifyPaymentAmount('premium', 'usd', 999, true);
  expect(result.valid).toBe(true);
  expect(result.variance).toBe(0);
});

test('should reject incorrect premium amount', () => {
  const result = verifyPaymentAmount('premium', 'usd', 100, true);
  expect(result.valid).toBe(false);
  expect(result.variance).toBe(899);
});

test('should accept amount within tolerance', () => {
  const result = verifyPaymentAmount('premium', 'usd', 1000, true); // +1 cent
  expect(result.valid).toBe(true);
  expect(result.variance).toBe(1);
});

test('should reject amount outside tolerance', () => {
  const result = verifyPaymentAmount('premium', 'usd', 1002, true); // +3 cents
  expect(result.valid).toBe(false);
  expect(result.variance).toBe(3);
});

test('should verify lifetime one-time amount', () => {
  const result = verifyPaymentAmount('lifetime', 'usd', 9999, false);
  expect(result.valid).toBe(true);
});
```

### **Integration Tests:**

```typescript
test('should reject webhook with incorrect amount', async () => {
  const session = createMockCheckoutSession({
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 100, // Should be 9999 for lifetime
    currency: 'usd',
  });

  await handleCheckoutCompleted(session);

  // Should NOT grant access
  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].planSelected).not.toBe('lifetime');
});

test('should accept webhook with correct amount', async () => {
  const session = createMockCheckoutSession({
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 9999, // Correct for lifetime
    currency: 'usd',
  });

  await handleCheckoutCompleted(session);

  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].planSelected).toBe('lifetime');
});
```

### **Manual Testing:**

```bash
# 1. Create test price with wrong amount in Stripe Dashboard
stripe prices create \
  --unit-amount=100 \
  --currency=usd \
  --product=prod_xxx

# 2. Update .env with test price ID
STRIPE_PREMIUM_PRICE_ID=price_test_wrong_amount

# 3. Restart dev server and attempt checkout
pnpm dev

# 4. Verify checkout is rejected with pricing error
# 5. Check webhook logs for amount verification failure
```

## 🚫 **Out of Scope**

- Dynamic pricing based on user location
- Automatic price adjustment for currency conversion
- Promotional pricing tiers (early bird, referral discounts)
- Admin dashboard for pricing analytics
- Automatic alerts for repeated amount mismatches
- Price history tracking

## 📝 **Notes**

**Why Amount Verification is Critical:**

1. **Revenue Protection:**
   - Prevents selling premium for test prices
   - Catches environment variable misconfiguration
   - Detects Stripe dashboard errors

2. **Security:**
   - Prevents price manipulation attacks
   - Ensures pricing integrity
   - Provides audit trail for payments

3. **Compliance:**
   - Ensures users pay advertised prices
   - Prevents accidental overcharging
   - Required for financial auditing

**Common Misconfigurations:**

```bash
# Wrong: Test price in production
STRIPE_PREMIUM_PRICE_ID=price_test_123

# Wrong: Swapped prices
STRIPE_PREMIUM_PRICE_ID=price_unlimited_prod
STRIPE_UNLIMITED_PRICE_ID=price_premium_prod

# Wrong: Old/deprecated price
STRIPE_PREMIUM_PRICE_ID=price_old_999  # Should be price_new_1999
```

**Stripe Pricing Objects:**

```json
{
  "id": "price_xxx",
  "type": "recurring",
  "unit_amount": 999,
  "currency": "usd",
  "recurring": {
    "interval": "month"
  }
}
```

**Related Tickets:**
- Ticket #0015: Webhook Idempotency Tracking
- Ticket #0017: Verify Payment Status Before Granting Access
- Ticket #0019: Add Webhook Metadata Correlation Check

## 🏷️ **Labels**

- `priority: high`
- `type: security`
- `component: billing`
- `component: webhooks`
- `revenue-protection`
- `stripe-integration`
- `amount-verification`
