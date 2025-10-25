# 0014 - Investigate Missing current_period_end for Subscriptions

## 🎯 **Description**

Investigate why `profile.current_period_end` is NULL for premium/unlimited subscription users despite webhooks successfully firing and returning 200. The webhook handler should be setting this value from Stripe subscription data.

## 📋 **User Story**

As a premium/unlimited user, I want the system to track my subscription period correctly so that access control and billing information is accurate.

## 🔧 **Technical Context**

**Observed Behavior:**
- Webhooks firing correctly (all 200 responses) ✅
- `customer.subscription.created` events received ✅
- `profile.plan_selected` updated correctly ✅
- `profile.current_period_end` remains NULL ❌

**Expected Behavior:**
- Webhook receives `customer.subscription.created` event
- Handler extracts `subscription.current_period_end` (unix timestamp)
- Database updated with timestamp value
- Middleware can read period end for access control

**Webhook Evidence:**
```
Premium/Unlimited purchase flow:
✅ customer.subscription.created [evt_xxx]
✅ [200] POST http://localhost:3000/api/stripe/webhook

Database check:
❌ profile.current_period_end = NULL (expected: unix timestamp)
```

**Possible Causes:**
1. Webhook handler not reading subscription correctly
2. Database column type mismatch
3. Timezone/timestamp conversion issue
4. Subscription object missing period_end field
5. Silent error in webhook handler (caught but not logged)
6. Database trigger or constraint blocking update

## ✅ **Acceptance Criteria**

- [ ] Root cause identified and documented
- [ ] current_period_end populated for new subscriptions
- [ ] Existing subscriptions backfilled if needed
- [ ] Webhook handler logs relevant debug info
- [ ] Database column type verified correct
- [ ] Manual test confirms value is set
- [ ] Lifetime users still have NULL (expected)

## 🚨 **Technical Requirements**

### **Investigation Steps**

**1. Add Debug Logging to Webhook Handler**

File: `app/api/stripe/webhook/route.ts` (lines 210-252)

```typescript
async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("No supabase_user_id in subscription metadata");
    return;
  }

  // ADD DEBUG LOGGING
  console.log("🔍 Subscription object received:", {
    subscriptionId: subscription.id,
    status: subscription.status,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    items: subscription.items.data.length,
    priceId: subscription.items.data[0]?.price.id,
  });

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    logWebhookError("No price ID in subscription");
    return;
  }

  const plan = mapPriceToPlan(priceId);
  if (!plan) {
    logWebhookError(`Unknown price ID: ${priceId}`);
    return;
  }

  if (subscription.status === "active" || subscription.status === "trialing") {
    try {
      // ADD DEBUG LOGGING
      const updateData = {
        planSelected: plan,
        planSelectedAt: new Date(),
        subscriptionStatus: subscription.status,
        currentPeriodEnd: subscription.current_period_end, // ← CHECK THIS VALUE
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        billingVersion: sql`billing_version + 1`,
      };

      console.log("🔍 About to update profile with:", {
        userId,
        updateData: {
          ...updateData,
          currentPeriodEnd: `${subscription.current_period_end} (${new Date(subscription.current_period_end * 1000).toISOString()})`,
        },
      });

      await db
        .update(profile)
        .set(updateData)
        .where(eq(profile.id, userId));

      // ADD DEBUG LOGGING - Verify update
      const [updatedProfile] = await db
        .select({
          current_period_end: profile.currentPeriodEnd,
          subscription_status: profile.subscriptionStatus,
        })
        .from(profile)
        .where(eq(profile.id, userId));

      console.log("🔍 Profile after update:", updatedProfile);

      logWebhookSuccess(`Updated plan_selected to '${plan}' for user: ${userId}`);
    } catch (error) {
      logWebhookError(`Error updating plan for user ${userId}`, error);
      throw error;
    }
  }
}
```

**2. Verify Database Column Type**

```sql
-- Check column definition
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profile'
AND column_name = 'current_period_end';
-- Expected: integer (for unix timestamp)

-- Check actual values
SELECT id, email, plan_selected, current_period_end,
       CASE
         WHEN current_period_end IS NULL THEN 'NULL'
         ELSE TO_TIMESTAMP(current_period_end)::text
       END as period_end_human
FROM profile
WHERE plan_selected IN ('premium', 'unlimited')
LIMIT 10;
```

**3. Test Subscription Object Structure**

Add temporary webhook logging:

```typescript
// At top of POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "No signature provided" },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // TEMPORARY: Log full event for debugging
    if (event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated") {
      console.log("🔍 FULL SUBSCRIPTION EVENT:", JSON.stringify(event.data.object, null, 2));
    }

    logWebhookReceived(event.type);

    // ... rest of handler
  }
}
```

**4. Check Stripe Subscription Object**

Use Stripe CLI to inspect:

```bash
# List recent subscriptions
stripe subscriptions list --limit 3

# Get specific subscription
stripe subscriptions retrieve sub_xxx

# Check for current_period_end field
# Should be present and look like: 1735209600 (unix timestamp)
```

**5. Verify Schema Match**

File: `db/schema.ts` (line 50)

```typescript
currentPeriodEnd: integer("current_period_end"), // bigint stored as integer

// Check if this should be bigint instead?
// Unix timestamps are ~1.7 billion (fits in integer)
// But double-check migration:
```

File: `supabase/migrations/20251012205144_quick_morgan_stark.sql` (line 9)

```sql
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "current_period_end" integer;
```

### **Diagnosis Checklist**

- [ ] Webhook logs show subscription.current_period_end value
- [ ] Value is a valid unix timestamp (10 digits)
- [ ] Database column type is integer
- [ ] No database constraints blocking update
- [ ] Update query executes without error
- [ ] SELECT query after update shows NULL
- [ ] Check if Drizzle ORM mapping is correct
- [ ] Verify no middleware or trigger interfering

### **Dependencies**

- `app/api/stripe/webhook/route.ts` - Add logging
- `db/schema.ts` - Verify schema definition
- Stripe account - Check subscription object
- Database - Verify column and constraints

### **Integration Points**

- Webhook event processing
- Database updates via Drizzle ORM
- Middleware reading current_period_end for access control
- JWT custom access token hook

## 🔍 **Implementation Notes**

**Likely Culprits (Ranked by Probability):**

1. **Subscription Object Missing Field** (40% probability)
   - Stripe subscription object doesn't have current_period_end
   - Need to use subscription_items[0].current_period_end instead
   - Or use subscription.current_period_start + billing_cycle

2. **Database Type Mismatch** (30% probability)
   - Integer too small for unix timestamp
   - Should use bigint instead
   - Postgres silently fails on overflow

3. **Drizzle ORM Mapping Issue** (20% probability)
   - Schema definition doesn't match migration
   - ORM not serializing value correctly
   - Need to use raw SQL

4. **Webhook Handler Logic Error** (10% probability)
   - Wrong field accessed
   - Type conversion issue (string vs number)
   - Error swallowed silently

**Stripe Subscription Object Structure:**

```json
{
  "id": "sub_xxx",
  "object": "subscription",
  "status": "active",
  "current_period_start": 1735123200,
  "current_period_end": 1737801600,  // ← This value
  "items": {
    "data": [
      {
        "id": "si_xxx",
        "price": {
          "id": "price_xxx"
        },
        "subscription": "sub_xxx"
      }
    ]
  },
  "cancel_at_period_end": false,
  "metadata": {
    "supabase_user_id": "uuid-here"
  }
}
```

**Verification Query:**

```typescript
// Add after database update
const verification = await db
  .select()
  .from(profile)
  .where(eq(profile.id, userId))
  .limit(1);

console.log("Verification query result:", {
  userId,
  currentPeriodEnd: verification[0]?.currentPeriodEnd,
  expectedValue: subscription.current_period_end,
  match: verification[0]?.currentPeriodEnd === subscription.current_period_end,
});
```

## 📊 **Definition of Done**

- [ ] Root cause identified and documented
- [ ] Fix implemented (if code issue)
- [ ] current_period_end populates correctly for new subscriptions
- [ ] Debug logging added to webhook handler
- [ ] Manual test: Create subscription, verify value set
- [ ] Documentation updated with findings
- [ ] Backfill script created if needed (for existing users)

## 🧪 **Testing Requirements**

### **Manual Testing**
1. **Create new subscription:**
   - [ ] Sign up new user
   - [ ] Subscribe to premium plan
   - [ ] Check webhook logs for current_period_end value
   - [ ] Query database: SELECT current_period_end FROM profile WHERE id = 'xxx'
   - [ ] Verify value is unix timestamp
   - [ ] Convert to date: SELECT TO_TIMESTAMP(current_period_end) FROM profile WHERE id = 'xxx'

2. **Check existing subscriptions:**
   - [ ] Query Stripe for active subscriptions
   - [ ] Compare Stripe values to database values
   - [ ] Identify discrepancies

3. **Test webhook replay:**
   - [ ] Use Stripe CLI: stripe events resend evt_xxx
   - [ ] Watch webhook handler logs
   - [ ] Verify database updated

### **Database Queries**
```sql
-- Check all subscriptions
SELECT
  id,
  email,
  plan_selected,
  subscription_status,
  current_period_end,
  CASE
    WHEN current_period_end IS NOT NULL
    THEN TO_TIMESTAMP(current_period_end)::text
    ELSE 'NULL'
  END as period_end_human,
  billing_version
FROM profile
WHERE plan_selected IN ('premium', 'unlimited')
ORDER BY created_at DESC;

-- Check for suspicious patterns
SELECT
  plan_selected,
  COUNT(*) as count,
  COUNT(current_period_end) as with_period_end,
  COUNT(*) - COUNT(current_period_end) as missing_period_end
FROM profile
WHERE plan_selected IN ('premium', 'unlimited')
GROUP BY plan_selected;
```

### **Stripe API Verification**
```bash
# Check subscription structure
stripe subscriptions retrieve sub_xxx

# Check if current_period_end exists
stripe subscriptions retrieve sub_xxx | jq '.current_period_end'

# List recent subscriptions
stripe subscriptions list --limit 10 | jq '.data[] | {id, status, current_period_end}'
```

## 🚫 **Out of Scope**

- Backfilling historical data (unless critical)
- Changing subscription renewal logic
- Adding new subscription fields
- Modifying Stripe webhook configuration
- Adding subscription management UI
- Implementing grace periods

## 📝 **Notes**

**Hypothesis Testing Order:**
1. Add debug logging → See what values are present
2. Check Stripe object → Verify field exists
3. Test database write → Confirm type compatibility
4. Review ORM mapping → Check Drizzle schema
5. Check for errors → Look for silent failures

**If current_period_end is in subscription_items:**
```typescript
// Alternative location
const item = subscription.items.data[0];
const currentPeriodEnd = item?.current_period_end;
```

**Workaround (if needed):**
```typescript
// Calculate from start + billing cycle
const currentPeriodEnd = subscription.current_period_start +
  (subscription.billing_cycle_anchor - subscription.current_period_start);
```

**Related Issues:**
- Middleware uses current_period_end for access control
- JWT hook includes current_period_end in claims
- May affect subscription cancellation UX

## 🏷️ **Labels**

- `priority: high`
- `type: bug`
- `type: investigation`
- `component: billing`
- `component: webhooks`
- `needs-debugging`
- `data-integrity`
