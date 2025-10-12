# 0008 - Evaluate Stripe as Source of Truth for Access Control

## 🎯 **Description**

Investigate whether middleware should query Stripe API directly for subscription status instead of relying solely on database plan_selected field, and determine the optimal balance between performance and data accuracy.

## 📋 **User Story**

As a developer, I want to understand the tradeoffs of using Stripe as the source of truth for subscription data so that we can make an informed decision about access control architecture.

## 🔧 **Technical Context**

**Current Implementation:**
- Middleware uses `getBasicUserAccess()` which only queries database
- Database `plan_selected` field updated via webhooks
- Fast but potentially stale if webhooks fail or are delayed
- No Stripe API calls in middleware (Edge Runtime compatible)

**Alternative Approach:**
- Middleware queries Stripe API for subscription status
- Real-time subscription data
- Slower due to external API call on every request
- Potential rate limiting concerns
- May not work in Edge Runtime

**Hybrid Approach:**
- Database as primary source
- Periodic Stripe verification
- Stripe check only on sensitive operations
- Background job to sync database with Stripe

## ✅ **Acceptance Criteria**

- [ ] Document current webhook reliability
- [ ] Measure middleware performance with database-only checks
- [ ] Test Stripe API latency and rate limits
- [ ] Analyze webhook failure scenarios
- [ ] Document edge cases where database could be stale
- [ ] Recommend approach with justification
- [ ] If changing, implement new approach
- [ ] Update documentation with decision rationale

## 🚨 **Technical Requirements**

### **Investigation Areas**

1. **Webhook Reliability Analysis**
```typescript
// Questions to answer:
// - What happens if webhook fails?
// - How long until webhook processes?
// - What's Stripe's retry policy?
// - How can we detect missed webhooks?
// - Can webhooks arrive out of order?
```

2. **Performance Testing**
```typescript
// Test scenarios:
// 1. Database-only check (current)
const start = Date.now();
const access = await getBasicUserAccess(userId);
const dbTime = Date.now() - start;

// 2. Stripe API check (proposed)
const start2 = Date.now();
const subscription = await stripe.subscriptions.retrieve(subId);
const stripeTime = Date.now() - start2;

// Compare: dbTime vs stripeTime
// Typical results:
// - Database: 5-20ms
// - Stripe API: 200-500ms
```

3. **Edge Runtime Compatibility**
```typescript
// Current middleware runs in Edge Runtime
// Stripe SDK may not be fully compatible
// Test if Stripe API calls work in Edge Runtime
// May need to move middleware to Node.js runtime
```

4. **Rate Limiting Assessment**
```typescript
// Stripe rate limits:
// - Standard: 100 req/sec
// - Burst: 200 req/sec
//
// Calculate: requests per second with current traffic
// Consider: every authenticated request hits middleware
// Determine: would we hit rate limits?
```

### **Proposed Solutions**

**Option 1: Database Only (Current)**
```typescript
// Pros:
// - Fast (< 20ms)
// - Edge Runtime compatible
// - No rate limit concerns
// - Simple architecture

// Cons:
// - Potentially stale (webhook delay)
// - Vulnerable to webhook failures
// - No immediate sync with Stripe

// Best for:
// - High traffic applications
// - Edge deployments
// - When webhook reliability is good
```

**Option 2: Stripe as Source of Truth**
```typescript
// Pros:
// - Always up-to-date
// - No webhook dependency
// - Catches payment failures immediately

// Cons:
// - Slow (200-500ms per request)
// - Rate limit concerns
// - Expensive (network cost)
// - May not work in Edge Runtime

// Best for:
// - Low traffic applications
// - Critical financial data
// - When immediate accuracy is required
```

**Option 3: Hybrid Approach (Recommended)**
```typescript
// Database for general access control
export async function getBasicUserAccess(userId: string) {
  return await checkDatabase(userId);
}

// Stripe verification for sensitive operations
export async function getVerifiedUserAccess(userId: string) {
  const dbAccess = await checkDatabase(userId);

  // Only verify if user has paid plan
  if (dbAccess.plan === 'premium' || dbAccess.plan === 'unlimited') {
    const stripeAccess = await checkStripe(userId);

    // If mismatch, trust Stripe and update database
    if (dbAccess.plan !== stripeAccess.plan) {
      console.warn('Database/Stripe mismatch detected', {
        database: dbAccess.plan,
        stripe: stripeAccess.plan,
      });

      await syncDatabaseWithStripe(userId, stripeAccess);
      return stripeAccess;
    }
  }

  return dbAccess;
}

// Use basic check in middleware (every request)
// Use verified check for:
// - Creating rounds (prevent abuse)
// - Accessing premium features
// - Billing operations
```

**Option 4: Background Sync**
```typescript
// Cron job runs every 5 minutes
async function syncSubscriptions() {
  const activeSubscriptions = await db.query.stripeCustomers.findMany();

  for (const customer of activeSubscriptions) {
    const stripeStatus = await stripe.subscriptions.list({
      customer: customer.stripeCustomerId,
      status: 'all',
      limit: 1,
    });

    // Update database if mismatch
    await reconcileSubscription(customer.userId, stripeStatus);
  }
}

// Pros: Regular sync without per-request overhead
// Cons: Still has delay (up to 5 minutes)
```

### **Dependencies**

- `utils/billing/access-control.ts` - current implementation
- `utils/supabase/middleware.ts` - where access check happens
- Stripe API reliability
- Database query performance
- Webhook infrastructure

### **Integration Points**

- Middleware access control
- Webhook system
- Database sync
- Error monitoring/alerting
- Performance metrics

## 🔍 **Implementation Notes**

**Webhook Failure Scenarios:**
1. **Stripe servers down**: Rare but possible
2. **Our webhook endpoint down**: Deploy issues, server crash
3. **Database write failure**: DB connection issues
4. **Network issues**: Timeouts, packet loss
5. **Processing errors**: Code bugs in webhook handler

**Detection Mechanisms:**
- Stripe Dashboard webhook logs
- Application error monitoring
- Subscription status verification endpoint
- Admin dashboard showing sync status

**Recovery Strategies:**
- Manual webhook replay from Stripe Dashboard
- Background sync job
- User-initiated "Refresh Subscription" button
- Automatic retry on webhook failures

**Edge Runtime Limitations:**
```typescript
// Edge Runtime restrictions:
// - Limited Node.js APIs
// - No native crypto modules
// - Smaller code bundle size limits
//
// Stripe SDK compatibility:
// - May not work fully in Edge Runtime
// - Need to test specific methods
// - Consider switching to Serverless Runtime for middleware
```

**Performance Impact:**
Adding Stripe API call to every authenticated request:
- Current: ~10ms per request
- With Stripe: ~250ms per request (25x slower)
- With 1000 req/min: Would use ~40% of rate limit
- User experience: Noticeable delay on every page load

## 📊 **Definition of Done**

- [ ] Webhook reliability documented
- [ ] Performance benchmarks completed
- [ ] Rate limit analysis done
- [ ] Edge Runtime compatibility tested
- [ ] Recommendation made with data
- [ ] Decision documented
- [ ] If implementation needed, completed
- [ ] Monitoring/alerting configured

## 🧪 **Testing Requirements**

- [ ] Load test with database-only approach
- [ ] Load test with Stripe API approach
- [ ] Test Edge Runtime with Stripe SDK
- [ ] Simulate webhook failure scenarios
- [ ] Test recovery mechanisms
- [ ] Measure end-to-end latency
- [ ] Test with concurrent users
- [ ] Monitor Stripe rate limit headers

## 🚫 **Out of Scope**

- Building custom webhook queue system
- Implementing Stripe Connect
- Multi-region Stripe deployments
- Advanced caching strategies (Redis, etc.)
- Real-time websocket updates
- Building subscription analytics
- Implementing idempotency beyond Stripe's built-in support

## 📝 **Notes**

**Industry Best Practices:**
Most SaaS applications use webhooks as primary sync mechanism with periodic verification:
- **GitHub**: Webhooks + background sync
- **Slack**: Webhooks + status verification API
- **Stripe's own recommendation**: Webhooks for updates, API for verification

**Recommendation Bias:**
Current hybrid approach (database with webhook sync) is likely optimal because:
1. **Performance**: Fast enough for good UX
2. **Reliability**: Webhooks are very reliable (>99.9%)
3. **Recovery**: Background sync can catch missed webhooks
4. **Cost**: No additional Stripe API usage
5. **Complexity**: Simple architecture

**When to Use Stripe API Directly:**
- Admin operations (manual verification)
- Billing dashboard (show real-time status)
- Support tools (troubleshooting)
- One-off checks (not every request)

**Monitoring Setup:**
```typescript
// Alert on webhook failures
if (webhookError) {
  await alerting.send({
    channel: '#engineering',
    message: 'Stripe webhook failed',
    severity: 'high',
  });
}

// Track sync status
await metrics.gauge('stripe.database.sync_lag', {
  value: syncLagSeconds,
});
```

## 🏷️ **Labels**

- `priority: medium`
- `type: investigation`
- `component: billing`
- `component: infrastructure`
- `technical-decision`
- `architecture`
