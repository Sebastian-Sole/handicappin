# Billing Security & Sync Considerations

## TL;DR

**The current architecture uses database-first access control in middleware for performance, but this creates a window where DB and Stripe may be out of sync.** This is mitigated by:
1. Webhook retries on database failures
2. Page-level Stripe verification for critical actions
3. Stripe's reliable webhook delivery

However, there are still edge cases to be aware of.

---

## Current Architecture

### Middleware Access Control (`getBasicUserAccess`)
- **What it does**: Checks database only, no Stripe API calls
- **Why**: Performance - middleware runs on EVERY request
- **Trade-off**: May be briefly out of sync with Stripe

### Page-Level Access Control (`getComprehensiveUserAccess`)
- **What it does**: Checks database first, then verifies with Stripe API
- **Why**: Source of truth for critical access decisions
- **Trade-off**: Slower (~100-500ms latency), but accurate

---

## Potential Sync Issues

### 1. Webhook Delivery Failures ⚠️

**Scenario**: Database write fails, webhook returns 500, Stripe retries
- **Mitigation**: Throw errors in webhook handlers to trigger Stripe's automatic retry
- **Status**: ✅ **FIXED** - Errors now re-throw to trigger retries
- **Code**: `app/api/stripe/webhook/route.ts:235, 265, 189`

### 2. Missing Webhook Event Types ⚠️

**Current Coverage**:
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `checkout.session.completed`

**Missing Events**:
- ❌ `invoice.payment_failed` - Payment fails, subscription becomes `past_due`
- ❌ `customer.subscription.paused` - Subscription paused (still exists but inactive)
- ❌ `customer.subscription.resumed` - Subscription resumed after pause

**Impact**: A user with a `past_due` subscription still shows as `premium` in database

**Recommendation**: Add handlers for these events OR rely on `subscription.updated` (which fires on status changes)

### 3. Subscription Status Not Stored 🚨

**Current Schema**:
```sql
plan_selected TEXT  -- Only stores plan type, not status
```

**Missing Information**:
- Is subscription `active`, `past_due`, `canceled`, `unpaid`?
- When does trial end?
- When was payment last attempted?

**Recommendation**: Consider adding:
```sql
subscription_status TEXT  -- 'active', 'past_due', 'canceled', etc.
subscription_period_end TIMESTAMPTZ
last_payment_status TEXT
```

### 4. Race Conditions ⚠️

**Scenario**:
1. User completes checkout
2. Webhook arrives and starts DB update
3. User navigates to dashboard (middleware check)
4. DB update hasn't completed yet
5. Middleware sees old `plan_selected: null` → redirects to onboarding

**Probability**: Low (webhooks usually arrive within 1-2 seconds)

**Mitigation**: Webhook handlers should be idempotent and fast

---

## Attack Vectors

### Scenario 1: Payment Failure Exploitation

1. User signs up for premium plan
2. Card is charged, webhook updates DB to `premium`
3. User immediately requests chargeback or card expires
4. Stripe marks subscription as `past_due` or `canceled`
5. Webhook arrives but... what if it's delayed or fails?
6. User continues to have premium access via middleware check

**Current Mitigation**:
- Webhook retries (Stripe tries for 3 days)
- `getComprehensiveUserAccess()` in page components will detect expired subscription
- BUT: If page components only use middleware check, user gets free access

**Recommendation**: Audit all premium pages to ensure they use `getComprehensiveUserAccess()`

### Scenario 2: Database Corruption

If someone gains DB access and manually updates `plan_selected` to `premium`, they bypass payment entirely until next webhook event.

**Mitigation**:
- Database access controls (already in place via RLS policies)
- Periodic reconciliation job that checks DB vs Stripe

---

## Recommendations for Production

### Priority 1: Critical 🚨

1. **Audit Page Components**: Ensure all premium pages use `getComprehensiveUserAccess()` not just middleware
   ```typescript
   // ❌ BAD: Only relies on middleware
   export default function DashboardPage() {
     // Middleware already checked, assume user has access
   }

   // ✅ GOOD: Double-check with Stripe
   export default async function DashboardPage() {
     const user = await getUser();
     const access = await getComprehensiveUserAccess(user.id);
     if (!access.hasPremiumAccess) redirect('/upgrade');
   }
   ```

2. **Add Payment Failed Handler**: Handle `invoice.payment_failed` webhook
   ```typescript
   case "invoice.payment_failed":
     // Downgrade user or mark as past_due
     await handlePaymentFailed(event.data.object);
     break;
   ```

### Priority 2: Important ⚠️

3. **Store Subscription Status**: Add `subscription_status` column to track current state

4. **Add Reconciliation Job**: Periodic cron job that checks DB vs Stripe for mismatches
   ```typescript
   // Run daily
   async function reconcileSubscriptions() {
     const users = await db.select().from(profile).where(eq(profile.planSelected, 'premium'));
     for (const user of users) {
       const stripeStatus = await checkStripeSubscription(user.id);
       if (stripeStatus.status !== 'active') {
         await db.update(profile).set({ planSelected: 'free' });
       }
     }
   }
   ```

### Priority 3: Nice to Have 💡

5. **Add Monitoring**: Alert on webhook processing failures

6. **Add Idempotency Keys**: Ensure webhook handlers can be safely retried

7. **Rate Limiting**: Add rate limiting to webhook endpoint to prevent abuse

---

## Testing Recommendations

### Manual Testing

1. **Test webhook failures**:
   - Temporarily break DB connection
   - Trigger webhook
   - Verify Stripe retries and eventually succeeds

2. **Test payment failures**:
   - Use Stripe test cards that decline
   - Verify subscription becomes `past_due`
   - Verify user loses access

3. **Test race conditions**:
   - Complete checkout
   - Immediately navigate to dashboard
   - Verify access is granted (no redirect loop)

### Automated Testing

Consider adding webhook replay tests:
```typescript
describe('Webhook Handler', () => {
  it('should retry on database failure', async () => {
    // Mock DB to fail once, then succeed
    // Verify webhook returns 500 first time
    // Verify retry succeeds
  });
});
```

---

## Current Status

✅ **Webhook retry logic**: Fixed - errors now propagate to trigger Stripe retries
✅ **Documentation**: Added security notes to `getBasicUserAccess()`
⚠️ **Missing events**: Still not handling `invoice.payment_failed`
⚠️ **Page-level verification**: Needs audit
⚠️ **Reconciliation**: Not implemented

---

## Conclusion

The current architecture is **acceptable for MVP** but has known limitations. The main risk is users getting free access if webhooks fail or payment issues occur. This is mitigated by:

1. Webhook retries (now properly implemented)
2. Page-level Stripe checks (need to audit coverage)
3. Stripe's reliable webhook delivery

For production, implement the Priority 1 and Priority 2 recommendations above.
