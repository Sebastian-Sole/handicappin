# 0019 - Add Webhook Metadata Correlation Check

## 🎯 **Description**

Verify that the `supabase_user_id` in webhook metadata actually owns the Stripe customer ID to prevent cross-account privilege escalation attacks. Currently, webhooks trust metadata without verifying the customer-user relationship, which could allow an attacker with Stripe dashboard access to assign subscriptions to arbitrary users.

## 📋 **User Story**

As a security-conscious platform owner, I want to ensure subscription webhooks only update the correct user account so that attackers cannot grant premium access to arbitrary users by manipulating Stripe metadata.

## 🔧 **Technical Context**

**Current State:**
- Webhooks trust `subscription.metadata.supabase_user_id` without validation ❌
- No verification that Stripe customer belongs to that user ❌
- Assumes metadata integrity (dangerous assumption) ❌

**Vulnerability:**

```typescript:app/api/stripe/webhook/route.ts
// Line 211-243
async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id; // ❌ Trusted without validation

  if (!userId) {
    logWebhookError("No supabase_user_id in subscription metadata");
    return;
  }

  // ❌ Directly updates user account without verifying customer ownership
  await db.update(profile).set({
    planSelected: plan,
    // ...
  }).where(eq(profile.id, userId));
}
```

**Attack Scenario:**

**Requirements:** Attacker needs Stripe dashboard access OR compromised Stripe API key

**Attack Steps:**
1. Attacker creates subscription via Stripe API with custom metadata:
   ```typescript
   await stripe.subscriptions.create({
     customer: 'cus_attacker',
     items: [{ price: 'price_premium' }],
     metadata: {
       supabase_user_id: 'victim-user-id' // ❌ Points to victim's account
     }
   });
   ```

2. Webhook fires for `subscription.created`
3. Handler reads `metadata.supabase_user_id = 'victim-user-id'`
4. Handler updates victim's profile with premium plan ❌
5. Victim gets free premium access paid by attacker
6. Attacker could also downgrade/cancel victim's legitimate subscription

**Real-World Likelihood:** 🟡 **MEDIUM-LOW**
- Requires Stripe dashboard access (insider threat)
- OR compromised Stripe API key (high-value target)
- BUT consequences are severe (complete billing bypass)

**Security Impact:** 🟡 **MEDIUM**
- Privilege escalation via metadata manipulation
- Cross-account subscription assignment
- Revenue loss from unauthorized access grants
- Data integrity violations

**References:**
- Security Assessment: Lines 271-311 (security-assessment.md)
- Webhook Handler: app/api/stripe/webhook/route.ts:210-252, 257-284
- Stripe Customers Table: db/schema.ts

## ✅ **Acceptance Criteria**

- [ ] Webhook handlers verify `stripe_customer_id` belongs to `supabase_user_id`
- [ ] Query `stripe_customers` table for correlation before updating profile
- [ ] Metadata mismatches are logged as security warnings
- [ ] Metadata mismatches do NOT update user profile
- [ ] All webhook handlers with user_id metadata are protected
- [ ] Add database constraint ensuring one customer per user
- [ ] Manual testing: Create subscription with wrong metadata
- [ ] Manual testing: Verify webhook rejects metadata mismatch

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Add Helper Function for Correlation Check**

```typescript:lib/stripe-security.ts
import { db } from '@/db';
import { stripeCustomers } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Verify that a Stripe customer ID belongs to the specified user
 * Returns true if customer belongs to user, false otherwise
 */
export async function verifyCustomerOwnership(
  stripeCustomerId: string,
  supabaseUserId: string
): Promise<{ valid: boolean; actualUserId?: string }> {
  try {
    const customerRecord = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, stripeCustomerId))
      .limit(1);

    if (customerRecord.length === 0) {
      // Customer not in database - this is suspicious
      console.warn('⚠️ Stripe customer not found in database', {
        stripeCustomerId,
        claimedUserId: supabaseUserId,
      });
      return { valid: false };
    }

    const actualUserId = customerRecord[0].userId;

    if (actualUserId !== supabaseUserId) {
      // Customer belongs to different user - SECURITY ISSUE
      console.error('🚨 SECURITY: Customer-User mismatch detected', {
        stripeCustomerId,
        claimedUserId: supabaseUserId,
        actualUserId,
      });
      return { valid: false, actualUserId };
    }

    // Valid: customer belongs to claimed user
    return { valid: true, actualUserId };
  } catch (error) {
    console.error('Error verifying customer ownership:', error);
    return { valid: false };
  }
}
```

**2. Update `handleSubscriptionChange` Handler**

```typescript:app/api/stripe/webhook/route.ts
import { verifyCustomerOwnership } from '@/lib/stripe-security';

async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;
  const customerId = subscription.customer; // Stripe customer ID

  if (!userId) {
    logWebhookError("No supabase_user_id in subscription metadata");
    return;
  }

  // ✅ NEW: Verify customer belongs to this user
  const ownership = await verifyCustomerOwnership(customerId, userId);

  if (!ownership.valid) {
    logWebhookError('Customer-User correlation check failed - NOT updating plan', {
      claimedUserId: userId,
      actualUserId: ownership.actualUserId,
      stripeCustomerId: customerId,
      subscriptionId: subscription.id,
    });

    // 🚨 SECURITY: Send alert to admin
    // await sendSecurityAlert({
    //   type: 'customer_user_mismatch',
    //   severity: 'high',
    //   details: { userId, customerId, actualUserId: ownership.actualUserId }
    // });

    return; // ❌ DO NOT UPDATE PROFILE
  }

  logWebhookInfo('Customer-User correlation verified', {
    userId,
    customerId,
  });

  // Continue with existing logic...
  const priceId = subscription.items.data[0]?.price.id;
  const plan = mapPriceToPlan(priceId);

  if (!plan) {
    logWebhookError(`Unknown price ID: ${priceId}`);
    return;
  }

  // Only update if subscription is active
  if (subscription.status === "active" || subscription.status === "trialing") {
    await db.update(profile).set({
      planSelected: plan,
      planSelectedAt: new Date(),
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      billingVersion: sql`billing_version + 1`,
    }).where(eq(profile.id, userId));

    logWebhookSuccess(`Updated plan_selected to '${plan}' for user: ${userId}`);
  }
}
```

**3. Update `handleSubscriptionDeleted` Handler**

```typescript:app/api/stripe/webhook/route.ts
async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;
  const customerId = subscription.customer;

  if (!userId) {
    logWebhookError("No supabase_user_id in subscription metadata");
    return;
  }

  // ✅ NEW: Verify customer belongs to this user
  const ownership = await verifyCustomerOwnership(customerId, userId);

  if (!ownership.valid) {
    logWebhookError('Customer-User correlation check failed - NOT reverting plan', {
      claimedUserId: userId,
      actualUserId: ownership.actualUserId,
      stripeCustomerId: customerId,
    });
    return;
  }

  // Revert to free tier
  try {
    await db.update(profile).set({
      planSelected: "free",
      planSelectedAt: new Date(),
      subscriptionStatus: 'canceled',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      billingVersion: sql`billing_version + 1`,
    }).where(eq(profile.id, userId));

    logWebhookSuccess(`Reverted to free tier for user: ${userId}`);
  } catch (error) {
    logWebhookError(`Error reverting user ${userId} to free tier`, error);
    throw error;
  }
}
```

**4. Update `handleCheckoutCompleted` Handler**

```typescript:app/api/stripe/webhook/route.ts
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;
  const customerId = session.customer;

  if (!userId) {
    logWebhookError("No supabase_user_id in checkout session metadata");
    return;
  }

  // ✅ NEW: For payment mode (lifetime), verify customer if exists
  if (session.mode === "payment" && customerId) {
    const ownership = await verifyCustomerOwnership(customerId, userId);

    if (!ownership.valid) {
      logWebhookError('Customer-User correlation check failed for lifetime purchase', {
        claimedUserId: userId,
        actualUserId: ownership.actualUserId,
        stripeCustomerId: customerId,
        sessionId: session.id,
      });
      return; // ❌ DO NOT GRANT LIFETIME ACCESS
    }
  }

  // Continue with existing logic...
  // ... rest of handleCheckoutCompleted
}
```

**5. Add Database Constraint (Optional but Recommended)**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_stripe_customer_unique_constraint.sql

-- Ensure one Stripe customer per user
-- This prevents multiple customer records for same user
CREATE UNIQUE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);

-- Add comment for documentation
COMMENT ON INDEX idx_stripe_customers_user_id IS
  'Ensures each user has only one Stripe customer ID. Prevents duplicate customer records.';
```

**6. Add Security Alert Helper (Optional)**

```typescript:lib/security-alerts.ts
export async function sendSecurityAlert({
  type,
  severity,
  details,
}: {
  type: 'customer_user_mismatch' | 'metadata_corruption' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}) {
  console.error(`🚨 SECURITY ALERT [${severity.toUpperCase()}]: ${type}`, details);

  // TODO: Integrate with monitoring service (Sentry, DataDog, etc.)
  // TODO: Send email to security team
  // TODO: Log to security audit table

  // For now, just log to console
  // In production, send to alerting service
}
```

### **Dependencies**

- `lib/stripe-security.ts` - New file for security helpers
- `app/api/stripe/webhook/route.ts` - Update all handlers
- `lib/security-alerts.ts` - Optional security alerting
- `stripe_customers` table - Already exists
- Database migration - Add unique constraint (optional)

### **Integration Points**

- All webhook handlers that process subscriptions
- `stripe_customers` table for correlation lookups
- Security monitoring/alerting system (optional)

## 🔍 **Implementation Notes**

### **Edge Cases:**

1. **New Customers (Not Yet in Database):**
   ```typescript
   // During checkout.session.completed
   if (customerRecord.length === 0) {
     // Customer not in database - this is expected for new users
     // Insert customer record first, then continue
     await db.insert(stripeCustomers).values({
       userId,
       stripeCustomerId: customerId,
     }).onConflictDoNothing();
   }
   ```

2. **Customer Created Before User ID Stored:**
   - Possible during migration or legacy data
   - Log warning but allow update if customer has no user_id
   - Backfill customer records with user IDs

3. **Multiple Customers Per User:**
   - Can happen if user creates account multiple times
   - Database constraint prevents this going forward
   - For existing duplicates, use most recent customer

4. **Null Customer ID:**
   - Some webhook events might not include customer
   - Skip correlation check if customer is null
   - Log warning for investigation

### **Performance Considerations:**

- Correlation check adds ~10ms to webhook processing (acceptable)
- Query uses index on `stripe_customer_id` (fast)
- Cache customer-user mappings in Redis for high volume (optional)

### **Security Benefits:**

1. **Prevents Privilege Escalation:**
   - Attacker can't assign subscriptions to other users
   - Metadata manipulation detected and blocked

2. **Data Integrity:**
   - Ensures billing records match actual customer ownership
   - Prevents cross-account contamination

3. **Audit Trail:**
   - Security alerts log suspicious activity
   - Failed correlation checks tracked in logs

## 📊 **Definition of Done**

- [ ] `lib/stripe-security.ts` created with `verifyCustomerOwnership()`
- [ ] All subscription webhook handlers updated with correlation check
- [ ] Checkout webhook handler updated for lifetime purchases
- [ ] Database unique constraint added (optional)
- [ ] Security alerts implemented (optional)
- [ ] Metadata mismatches are logged as security warnings
- [ ] Metadata mismatches do NOT update user profiles
- [ ] Manual testing: Create subscription with wrong metadata
- [ ] Manual testing: Verify webhook rejects correlation failure

## 🧪 **Testing Requirements**

### **Unit Tests:**

```typescript
import { verifyCustomerOwnership } from '@/lib/stripe-security';

test('should return valid for matching customer-user pair', async () => {
  // Setup: Insert customer record
  await db.insert(stripeCustomers).values({
    userId: 'user-123',
    stripeCustomerId: 'cus_123',
  });

  const result = await verifyCustomerOwnership('cus_123', 'user-123');

  expect(result.valid).toBe(true);
  expect(result.actualUserId).toBe('user-123');
});

test('should return invalid for mismatched customer-user pair', async () => {
  await db.insert(stripeCustomers).values({
    userId: 'user-123',
    stripeCustomerId: 'cus_123',
  });

  const result = await verifyCustomerOwnership('cus_123', 'user-456'); // Wrong user

  expect(result.valid).toBe(false);
  expect(result.actualUserId).toBe('user-123');
});

test('should return invalid for non-existent customer', async () => {
  const result = await verifyCustomerOwnership('cus_nonexistent', 'user-123');

  expect(result.valid).toBe(false);
  expect(result.actualUserId).toBeUndefined();
});
```

### **Integration Tests:**

```typescript
test('should reject subscription webhook with wrong metadata', async () => {
  // Setup: Create customer for user-123
  await db.insert(stripeCustomers).values({
    userId: 'user-123',
    stripeCustomerId: 'cus_123',
  });

  // Create subscription with wrong user_id in metadata
  const subscription = createMockSubscription({
    customer: 'cus_123',
    metadata: {
      supabase_user_id: 'user-456', // ❌ Wrong user
    },
  });

  await handleSubscriptionChange(subscription);

  // Should NOT update user-456's profile
  const user456 = await db.select().from(profile).where(eq(profile.id, 'user-456'));
  expect(user456[0].planSelected).not.toBe('premium');

  // Should NOT update user-123's profile either (metadata mismatch)
  const user123 = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user123[0].planSelected).not.toBe('premium');
});

test('should accept subscription webhook with correct metadata', async () => {
  await db.insert(stripeCustomers).values({
    userId: 'user-123',
    stripeCustomerId: 'cus_123',
  });

  const subscription = createMockSubscription({
    customer: 'cus_123',
    metadata: {
      supabase_user_id: 'user-123', // ✅ Correct user
    },
  });

  await handleSubscriptionChange(subscription);

  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].planSelected).toBe('premium');
});
```

### **Manual Testing:**

```bash
# 1. Create Stripe customer via CLI
stripe customers create \
  --email=test@example.com \
  --metadata[supabase_user_id]=user-123

# 2. Create subscription with WRONG metadata
stripe subscriptions create \
  --customer=cus_xxx \
  --items[0][price]=price_premium \
  --metadata[supabase_user_id]=user-456

# 3. Check webhook logs
# Should see: "Customer-User correlation check failed"

# 4. Verify user-456 profile NOT updated
# Should still be on free plan

# 5. Create subscription with CORRECT metadata
stripe subscriptions create \
  --customer=cus_xxx \
  --items[0][price]=price_premium \
  --metadata[supabase_user_id]=user-123

# 6. Verify user-123 profile IS updated
# Should now have premium plan
```

## 🚫 **Out of Scope**

- Automatic remediation of metadata mismatches
- Admin dashboard for viewing correlation failures
- Historical audit of all customer-user relationships
- Automated backfill of missing customer records
- Customer ID migration for users with multiple customers
- Monitoring dashboard for security alerts

## 📝 **Notes**

**Why This Matters:**

1. **Defense in Depth:**
   - Even with webhook signature verification, metadata can be manipulated
   - This adds an additional layer of verification

2. **Insider Threat Protection:**
   - Prevents malicious employees with Stripe access from granting unauthorized access
   - Detects compromised Stripe API keys

3. **Data Integrity:**
   - Ensures billing records match actual customer ownership
   - Prevents "ghost subscriptions" assigned to wrong users

**Threat Model:**

**Attacker Profile:**
- Has Stripe dashboard access (employee, contractor)
- OR has compromised Stripe API key
- Wants to grant premium access to specific users

**Attack Method:**
1. Create subscription via Stripe API/dashboard
2. Set `metadata.supabase_user_id` to target user
3. Wait for webhook to fire
4. Current code grants access without verification

**Mitigation:**
- Correlation check prevents attack
- Security alerts notify admins
- Audit trail enables investigation

**Stripe Best Practices:**
- Always verify webhook signatures (already implemented ✅)
- Never trust metadata without correlation (this ticket)
- Use idempotency keys (Ticket #0015)
- Verify payment amounts (Ticket #0018)

**Related Tickets:**
- Ticket #0015: Webhook Idempotency Tracking
- Ticket #0017: Verify Payment Status Before Granting Access
- Ticket #0018: Add Webhook Amount Verification

## 🏷️ **Labels**

- `priority: medium`
- `type: security`
- `component: billing`
- `component: webhooks`
- `privilege-escalation`
- `stripe-integration`
- `metadata-verification`
