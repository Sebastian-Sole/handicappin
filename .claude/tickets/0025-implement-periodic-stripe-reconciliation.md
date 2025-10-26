# 0025 - Implement Periodic Stripe Reconciliation

## 🎯 **Description**

Create periodic reconciliation jobs that verify database billing states match Stripe's source of truth to detect and correct data drift caused by failed webhooks, manual changes in Stripe dashboard, or database corruption. This provides a safety net for webhook reliability issues and ensures long-term data integrity.

## 📋 **User Story**

As a platform owner, I want automated verification that billing data in my database matches Stripe so that webhook failures or manual Stripe changes don't cause permanent billing inconsistencies.

## 🔧 **Technical Context**

**Current State:**
- Webhooks update database when events occur ✅
- NO verification that database matches Stripe ❌
- NO recovery mechanism for failed webhooks ❌
- NO detection of manual Stripe changes ❌

**How Data Drift Can Occur:**

1. **Webhook Failures:**
   ```
   Stripe: User cancels subscription
   Webhook: Fails due to database downtime
   Database: Still shows "active" subscription ❌
   Result: User gets free access
   ```

2. **Manual Stripe Changes:**
   ```
   Admin: Cancels subscription in Stripe dashboard
   Webhook: May or may not fire (dashboard behavior inconsistent)
   Database: Still shows "active" subscription ❌
   Result: User locked out despite paying
   ```

3. **Partial Webhook Processing:**
   ```
   Stripe: Sends subscription.updated
   Webhook: Updates plan but errors before updating status
   Database: Partially updated ❌
   Result: Inconsistent state
   ```

4. **Database Corruption:**
   ```
   Someone: Manually updates database
   Stripe: Still shows correct state
   Database: Incorrect data ❌
   Result: Billing chaos
   ```

**Security Assessment Reference:**
- Lines 20-55 (security-assessment.md) - "Webhook Reliability Gap"
- Lines 557 (security-assessment.md) - Recommendation #2: "Implement periodic Stripe reconciliation job"

**Security Impact:** 🟡 **MEDIUM**
- Revenue loss from undetected cancellations
- Free access from drift toward "active"
- User frustration from drift toward "canceled"
- Data integrity violations

## ✅ **Acceptance Criteria**

- [ ] Daily reconciliation job verifies all subscriptions
- [ ] Job compares database state vs Stripe state
- [ ] Mismatches are logged as critical alerts
- [ ] Auto-correct minor drift (status updates)
- [ ] Manual review required for major drift (plan changes)
- [ ] Reconciliation metrics tracked (drift rate, fix count)
- [ ] Job runs via cron/scheduled task
- [ ] Handles API rate limits gracefully
- [ ] Can run on-demand via admin API
- [ ] Manual testing: Create drift, verify detection

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Create Reconciliation Service**

```typescript:lib/reconciliation/stripe-reconciliation.ts
import { stripe } from '@/lib/stripe';
import { db } from '@/db';
import { profile, stripeCustomers } from '@/db/schema';
import { eq } from 'drizzle-orm';

type ReconciliationResult = {
  checked: number;
  drift_detected: number;
  auto_fixed: number;
  manual_review: number;
  errors: number;
  issues: DriftIssue[];
};

type DriftIssue = {
  userId: string;
  field: string;
  database_value: any;
  stripe_value: any;
  severity: 'low' | 'medium' | 'high';
  action: 'auto_fixed' | 'manual_review' | 'error';
};

/**
 * Main reconciliation function
 * Verifies all paid users' billing data matches Stripe
 */
export async function reconcileStripeSubscriptions(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    checked: 0,
    drift_detected: 0,
    auto_fixed: 0,
    manual_review: 0,
    errors: 0,
    issues: [],
  };

  // Get all users with paid plans
  const paidUsers = await db
    .select()
    .from(profile)
    .where(
      sql`plan_selected IN ('premium', 'unlimited', 'lifetime')`
    );

  console.log(`🔍 Reconciliation: Checking ${paidUsers.length} paid users`);

  for (const user of paidUsers) {
    result.checked++;

    try {
      const issue = await reconcileUser(user);

      if (issue) {
        result.drift_detected++;
        result.issues.push(issue);

        if (issue.action === 'auto_fixed') {
          result.auto_fixed++;
        } else if (issue.action === 'manual_review') {
          result.manual_review++;
        }
      }
    } catch (error) {
      result.errors++;
      console.error(`Error reconciling user ${user.id}:`, error);
    }

    // Rate limiting: 100 requests/second to Stripe
    // Sleep 10ms between users = ~100 req/sec
    await sleep(10);
  }

  console.log(`✅ Reconciliation complete:`, result);

  // Send alert if critical drift detected
  if (result.manual_review > 0) {
    await sendReconciliationAlert(result);
  }

  return result;
}

/**
 * Reconcile a single user's billing data
 */
async function reconcileUser(user: typeof profile.$inferSelect): Promise<DriftIssue | null> {
  // Get user's Stripe customer ID
  const customerRecord = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, user.id))
    .limit(1);

  if (!customerRecord[0]) {
    // No Stripe customer - this is okay for lifetime users who paid once
    if (user.planSelected === 'lifetime') {
      // TODO: Verify lifetime payment exists in Stripe charges
      return null;
    }

    // Premium/unlimited without customer is drift
    return {
      userId: user.id,
      field: 'stripe_customer_id',
      database_value: null,
      stripe_value: 'missing',
      severity: 'high',
      action: 'manual_review',
    };
  }

  const stripeCustomerId = customerRecord[0].stripeCustomerId;

  // For subscription plans, check active subscriptions
  if (user.planSelected === 'premium' || user.planSelected === 'unlimited') {
    return await reconcileSubscription(user, stripeCustomerId);
  }

  // For lifetime plans, verify payment exists
  if (user.planSelected === 'lifetime') {
    return await reconcileLifetimePurchase(user, stripeCustomerId);
  }

  return null;
}

/**
 * Reconcile subscription plan
 */
async function reconcileSubscription(
  user: typeof profile.$inferSelect,
  stripeCustomerId: string
): Promise<DriftIssue | null> {
  // Get active subscriptions from Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all', // Include canceled, past_due, etc.
    limit: 10,
  });

  const activeSubscription = subscriptions.data.find(
    s => s.status === 'active' || s.status === 'trialing'
  );

  // Case 1: Database says active, Stripe says no subscription
  if (!activeSubscription && user.subscriptionStatus === 'active') {
    console.warn(`⚠️ Drift detected: User ${user.id} has active status but no Stripe subscription`);

    // Auto-fix: Revert to free tier
    await db.update(profile).set({
      planSelected: 'free',
      subscriptionStatus: 'canceled',
      currentPeriodEnd: null,
      billingVersion: sql`billing_version + 1`,
    }).where(eq(profile.id, user.id));

    return {
      userId: user.id,
      field: 'subscription_status',
      database_value: 'active',
      stripe_value: 'none',
      severity: 'high',
      action: 'auto_fixed',
    };
  }

  // Case 2: Database says canceled, Stripe says active
  if (activeSubscription && user.subscriptionStatus !== 'active') {
    console.warn(`⚠️ Drift detected: User ${user.id} canceled in DB but active in Stripe`);

    // Auto-fix: Restore active status
    const priceId = activeSubscription.items.data[0]?.price.id;
    const plan = mapPriceToPlan(priceId);

    if (plan) {
      await db.update(profile).set({
        planSelected: plan,
        subscriptionStatus: 'active',
        currentPeriodEnd: activeSubscription.current_period_end,
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
        billingVersion: sql`billing_version + 1`,
      }).where(eq(profile.id, user.id));

      return {
        userId: user.id,
        field: 'subscription_status',
        database_value: user.subscriptionStatus,
        stripe_value: 'active',
        severity: 'high',
        action: 'auto_fixed',
      };
    }
  }

  // Case 3: Status mismatch (past_due, paused, etc.)
  if (activeSubscription && activeSubscription.status !== user.subscriptionStatus) {
    console.warn(`⚠️ Drift detected: Status mismatch for user ${user.id}`);

    // Auto-fix: Update status to match Stripe
    await db.update(profile).set({
      subscriptionStatus: activeSubscription.status,
      billingVersion: sql`billing_version + 1`,
    }).where(eq(profile.id, user.id));

    return {
      userId: user.id,
      field: 'subscription_status',
      database_value: user.subscriptionStatus,
      stripe_value: activeSubscription.status,
      severity: 'medium',
      action: 'auto_fixed',
    };
  }

  return null;
}

/**
 * Reconcile lifetime plan purchase
 */
async function reconcileLifetimePurchase(
  user: typeof profile.$inferSelect,
  stripeCustomerId: string
): Promise<DriftIssue | null> {
  // Verify lifetime payment exists in Stripe
  const charges = await stripe.charges.list({
    customer: stripeCustomerId,
    limit: 100, // Check last 100 charges
  });

  const lifetimePayment = charges.data.find(
    charge =>
      charge.metadata?.plan_type === 'lifetime' &&
      charge.status === 'succeeded' &&
      charge.refunded === false
  );

  if (!lifetimePayment) {
    console.error(`🚨 CRITICAL: User ${user.id} has lifetime plan but no payment in Stripe`);

    // Do NOT auto-fix - this requires manual review
    // Could be legitimate (legacy user) or fraud
    return {
      userId: user.id,
      field: 'lifetime_payment',
      database_value: 'lifetime',
      stripe_value: 'no_payment',
      severity: 'high',
      action: 'manual_review',
    };
  }

  // Check if payment was refunded
  if (lifetimePayment.refunded) {
    console.warn(`⚠️ Drift detected: User ${user.id} has refunded lifetime payment`);

    // Auto-fix: Revoke lifetime access
    await db.update(profile).set({
      planSelected: 'free',
      subscriptionStatus: 'canceled',
      billingVersion: sql`billing_version + 1`,
    }).where(eq(profile.id, user.id));

    return {
      userId: user.id,
      field: 'lifetime_payment',
      database_value: 'lifetime',
      stripe_value: 'refunded',
      severity: 'high',
      action: 'auto_fixed',
    };
  }

  return null;
}

/**
 * Send alert for critical drift requiring manual review
 */
async function sendReconciliationAlert(result: ReconciliationResult) {
  const criticalIssues = result.issues.filter(i => i.action === 'manual_review');

  console.error('🚨 CRITICAL: Billing drift requires manual review', {
    total_issues: result.drift_detected,
    critical: criticalIssues.length,
    issues: criticalIssues,
  });

  // TODO: Send email to admin
  // TODO: Post to Slack/Discord
  // TODO: Create support ticket
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**2. Create Cron Endpoint**

```typescript:app/api/cron/reconcile-stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { reconcileStripeSubscriptions } from '@/lib/reconciliation/stripe-reconciliation';

/**
 * Daily reconciliation job
 * Run via cron: 0 2 * * * (2 AM daily)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🔄 Starting Stripe reconciliation...');

    const result = await reconcileStripeSubscriptions();

    console.log('✅ Reconciliation complete', result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Reconciliation failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
```

**3. Vercel Cron Configuration**

```json:vercel.json
{
  "crons": [
    {
      "path": "/api/cron/reconcile-stripe",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**4. Manual Reconciliation Endpoint (Admin)**

```typescript:app/api/admin/reconcile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { reconcileStripeSubscriptions } from '@/lib/reconciliation/stripe-reconciliation';
import { createServerComponentClient } from '@/utils/supabase/server';

/**
 * Manual reconciliation trigger (admin only)
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Check if user is admin
  // const isAdmin = await checkAdminRole(user.id);
  // if (!isAdmin) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  try {
    const result = await reconcileStripeSubscriptions();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

### **Dependencies**

- `lib/reconciliation/stripe-reconciliation.ts` - New service
- `app/api/cron/reconcile-stripe/route.ts` - Cron endpoint
- `app/api/admin/reconcile/route.ts` - Manual trigger
- `vercel.json` - Cron configuration
- Stripe API
- Database (profile, stripe_customers tables)

### **Integration Points**

- Stripe API (subscriptions, charges)
- Database (read + write)
- Cron scheduler (Vercel Cron, GitHub Actions, etc.)
- Alerting system (email, Slack)

## 🔍 **Implementation Notes**

### **Reconciliation Frequency:**

**Daily (Recommended):**
- Balances detection speed vs API costs
- 2 AM (low traffic time)
- ~1000 users = ~10 seconds runtime

**Weekly:**
- Lower API costs
- Slower drift detection
- Acceptable for low-risk apps

**Hourly (Overkill):**
- Expensive (lots of Stripe API calls)
- Only for high-value subscriptions
- Not needed with idempotent webhooks

### **Auto-Fix vs Manual Review:**

**Auto-Fix (Safe):**
- Status updates (active ↔ past_due)
- Cancellations (Stripe canceled → revoke access)
- Refunds (charge refunded → revoke access)

**Manual Review (Unsafe):**
- Plan changes (premium ↔ unlimited)
- Lifetime without payment
- Subscription without customer
- Large discrepancies

### **Rate Limiting Strategy:**

```typescript
// Process 100 users/second = 6000 users/minute
// For 10,000 users = ~2 minutes runtime
for (const user of users) {
  await checkUser(user);
  await sleep(10); // 10ms delay = 100 req/sec
}
```

### **Monitoring Metrics:**

Track these metrics in reconciliation logs:
- `checked` - Total users verified
- `drift_detected` - Users with discrepancies
- `auto_fixed` - Automatically corrected
- `manual_review` - Requiring admin action
- `errors` - API/database errors

**Alerting Thresholds:**
- `drift_detected > 5%` → Warning
- `manual_review > 0` → Critical
- `errors > 10%` → Critical

## 📊 **Definition of Done**

- [ ] Reconciliation service created with full logic
- [ ] Cron endpoint configured to run daily at 2 AM
- [ ] Auto-fix logic for common drift scenarios
- [ ] Manual review flag for critical discrepancies
- [ ] Alerting for critical drift (console errors minimum)
- [ ] Manual trigger endpoint for admin testing
- [ ] Rate limiting to avoid Stripe API limits
- [ ] Metrics logging for drift detection rates
- [ ] Manual testing: Create drift, verify detection + fix
- [ ] Documentation: How to interpret reconciliation reports

## 🧪 **Testing Requirements**

### **Integration Tests:**

```typescript
test('should detect and fix canceled subscription drift', async () => {
  // Setup: User with active status in DB
  await db.insert(profile).values({
    id: 'user-123',
    planSelected: 'premium',
    subscriptionStatus: 'active',
  });

  // Mock: Stripe has no active subscription
  mockStripe.subscriptions.list.mockResolvedValue({
    data: [],
  });

  // Run reconciliation
  const result = await reconcileStripeSubscriptions();

  // Verify: Drift detected and fixed
  expect(result.drift_detected).toBe(1);
  expect(result.auto_fixed).toBe(1);

  // Verify: User reverted to free tier
  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].planSelected).toBe('free');
  expect(user[0].subscriptionStatus).toBe('canceled');
});

test('should detect lifetime without payment', async () => {
  await db.insert(profile).values({
    id: 'user-123',
    planSelected: 'lifetime',
  });

  await db.insert(stripeCustomers).values({
    userId: 'user-123',
    stripeCustomerId: 'cus_123',
  });

  // Mock: No charges found
  mockStripe.charges.list.mockResolvedValue({ data: [] });

  const result = await reconcileStripeSubscriptions();

  // Verify: Requires manual review
  expect(result.manual_review).toBe(1);
  expect(result.issues[0].severity).toBe('high');
  expect(result.issues[0].action).toBe('manual_review');
});
```

### **Manual Testing:**

```bash
# 1. Create test drift manually
psql $DATABASE_URL -c "UPDATE profile SET subscription_status = 'active' WHERE id = 'test-user' AND plan_selected = 'premium';"

# 2. Cancel subscription in Stripe dashboard
stripe subscriptions cancel sub_xxx

# 3. Run reconciliation manually
curl -X POST http://localhost:3000/api/admin/reconcile \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Verify drift detected and fixed
psql $DATABASE_URL -c "SELECT plan_selected, subscription_status FROM profile WHERE id = 'test-user';"

# Should show: free | canceled
```

## 🚫 **Out of Scope**

- Real-time reconciliation (webhooks are primary source)
- Automatic plan changes (too risky)
- Historical reconciliation (past states)
- Reconciliation dashboard/UI
- Per-user reconciliation endpoint
- Reconciliation analytics/reporting

## 📝 **Notes**

**Why Reconciliation is Important:**

Even with perfect webhook handling (idempotency, verification), things can go wrong:
1. **Network partitions** - Webhooks lost in transit
2. **Database failures** - Webhooks succeed but DB write fails
3. **Manual changes** - Admin changes in Stripe dashboard
4. **Bugs** - Code bugs in webhook handlers
5. **Race conditions** - Concurrent webhook processing

**Reconciliation is the safety net** that catches these edge cases.

**Industry Examples:**

**Stripe's Own Recommendation:**
> "While webhooks are reliable, we recommend building a reconciliation process that periodically verifies your database matches Stripe's records."

**How Other Companies Do It:**
- **GitHub:** Daily reconciliation of billing data
- **Shopify:** Hourly reconciliation for high-value merchants
- **AWS:** Real-time + daily reconciliation

**Reconciliation vs Webhooks:**

| Aspect | Webhooks | Reconciliation |
|--------|----------|----------------|
| Speed | Real-time (seconds) | Delayed (hours/days) |
| Reliability | 99.9% | 100% (eventually) |
| Cost | Low (only when events occur) | Higher (periodic Stripe API calls) |
| Purpose | Primary sync mechanism | Safety net + drift detection |

**Related Tickets:**
- Ticket #0015: Webhook Idempotency (prevents many reconciliation issues)
- Ticket #0021: Missing Webhook Handlers (reduces drift causes)

## 🏷️ **Labels**

- `priority: medium`
- `type: reliability`
- `component: billing`
- `component: cron`
- `data-integrity`
- `stripe-integration`
- `reconciliation`
