# 0015 - Implement Webhook Idempotency Tracking

## 🎯 **Description**

Add idempotency tracking for Stripe webhook events to prevent duplicate event processing and ensure data consistency. Currently, webhooks can be processed multiple times due to network retries, manual replays, or multiple webhook endpoints, leading to data corruption and inconsistent billing states.

## 📋 **User Story**

As a system administrator, I want webhook events to be processed exactly once so that billing data remains consistent and duplicate operations (like cancellations or upgrades) don't corrupt user accounts.

## 🔧 **Technical Context**

**Current State:**
- Webhook handler at `app/api/stripe/webhook/route.ts` has signature verification ✅
- NO event ID tracking or duplicate detection ❌
- Stripe can send the same event multiple times (retries, manual replays)
- Critical events like `subscription.deleted` or `checkout.session.completed` could fire multiple times

**Security Impact:** 🔴 **CRITICAL**
- Data corruption from duplicate processing
- Incorrect billing version increments
- Race conditions with concurrent webhook deliveries
- Potential privilege escalation via replay attacks

**References:**
- Security Assessment: Lines 195-218 (security-assessment.md)
- Webhook Handler: app/api/stripe/webhook/route.ts:17-79

## ✅ **Acceptance Criteria**

- [ ] Database table `webhook_events` created with `event_id` as primary key
- [ ] Webhook handler checks for existing event ID before processing
- [ ] Duplicate events return 200 OK with `{received: true, duplicate: true}`
- [ ] Successfully processed events are stored with timestamp and status
- [ ] Old webhook events are cleaned up after 30 days (retention policy)
- [ ] All webhook event types are tracked (checkout, subscription, customer)
- [ ] Error handling preserves idempotency (failed events can be retried)

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Database Schema**

Create migration for `webhook_events` table:

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_webhook_idempotency.sql
CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL, -- 'success' | 'failed'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_webhook_events_processed_at ON webhook_events(processed_at);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
```

**2. Drizzle Schema**

Add to `db/schema.ts`:

```typescript
export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  status: text("status").notNull(), // 'success' | 'failed'
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
});
```

**3. Webhook Handler Update**

Modify `app/api/stripe/webhook/route.ts`:

```typescript
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

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // ✅ NEW: Check for duplicate event
    const existingEvent = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);

    if (existingEvent.length > 0) {
      logWebhookInfo(`Duplicate event ${event.id} - already processed`);
      return NextResponse.json({
        received: true,
        duplicate: true,
        originalProcessedAt: existingEvent[0].processedAt
      }, { status: 200 });
    }

    logWebhookReceived(event.type);

    // Process event handlers
    try {
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

      // ✅ NEW: Record successful processing
      await db.insert(webhookEvents).values({
        eventId: event.id,
        eventType: event.type,
        status: 'success',
      });

      return NextResponse.json({ received: true }, { status: 200 });
    } catch (processingError) {
      // ✅ NEW: Record failed processing (allow retry)
      await db.insert(webhookEvents).values({
        eventId: event.id,
        eventType: event.type,
        status: 'failed',
        errorMessage: processingError instanceof Error ? processingError.message : 'Unknown error',
        retryCount: 1,
      }).onConflictDoUpdate({
        target: webhookEvents.eventId,
        set: {
          retryCount: sql`${webhookEvents.retryCount} + 1`,
          errorMessage: processingError instanceof Error ? processingError.message : 'Unknown error',
        },
      });

      throw processingError; // Re-throw to trigger Stripe retry
    }
  } catch (error) {
    // Signature verification failures are client errors (400)
    if (error instanceof Error && error.message.includes("signature")) {
      logWebhookError("Invalid webhook signature", error);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // All other errors are server errors (500)
    logWebhookError("Webhook handler failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**4. Cleanup Job (Optional)**

Create cron job to clean up old events:

```typescript
// app/api/cron/cleanup-webhooks/route.ts
export async function GET() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await db
    .delete(webhookEvents)
    .where(sql`${webhookEvents.processedAt} < ${thirtyDaysAgo}`);

  return NextResponse.json({ success: true });
}
```

### **Dependencies**

- `db/schema.ts` - Add `webhookEvents` table definition
- `app/api/stripe/webhook/route.ts` - Update webhook handler
- Supabase migration - Create `webhook_events` table
- `drizzle-orm` - Already installed

### **Integration Points**

- Stripe webhook endpoint configuration (no changes needed)
- All webhook event handlers (customer, checkout, subscription)
- Database via Drizzle ORM

## 🔍 **Implementation Notes**

### **Edge Cases:**

1. **Concurrent Webhook Deliveries:**
   - Use database-level PRIMARY KEY constraint on `event_id`
   - Race condition between two simultaneous webhook deliveries will cause one to fail at INSERT
   - The failed request should re-check for existing event and return duplicate response

2. **Failed Event Retries:**
   - Store failed events with `status: 'failed'` to track retry attempts
   - Use `onConflictDoUpdate` to increment `retry_count`
   - After 3 retries, consider manual investigation

3. **Signature Verification Failures:**
   - Do NOT record these as webhook events (invalid events)
   - Return 400 immediately to prevent Stripe retries

4. **Database Errors During Idempotency Check:**
   - If SELECT fails, fail the entire webhook (return 500)
   - Stripe will retry, and database should be available next time

### **Performance Considerations:**

- Add index on `processed_at` for cleanup queries
- Add index on `event_type` for debugging/analytics
- PRIMARY KEY on `event_id` provides automatic uniqueness check

## 📊 **Definition of Done**

- [ ] Database migration created and applied to development environment
- [ ] Drizzle schema updated with `webhookEvents` table
- [ ] Webhook handler checks for duplicate events before processing
- [ ] Duplicate events return 200 OK without re-processing
- [ ] Successfully processed events are recorded with timestamp
- [ ] Failed events are recorded with error message and retry count
- [ ] Manual testing: Send duplicate webhook via Stripe CLI
- [ ] Manual testing: Verify replay protection works

## 🧪 **Testing Requirements**

### **Unit Tests:**

```typescript
// Test duplicate event detection
test('should reject duplicate webhook events', async () => {
  const event = createMockStripeEvent('checkout.session.completed');

  // First request
  const response1 = await POST(createMockRequest(event));
  expect(response1.status).toBe(200);

  // Duplicate request
  const response2 = await POST(createMockRequest(event));
  expect(response2.status).toBe(200);
  expect(await response2.json()).toMatchObject({ duplicate: true });
});

// Test failed event retry tracking
test('should track retry count for failed events', async () => {
  const event = createMockStripeEvent('subscription.created');
  mockSubscriptionHandler.mockRejectedValue(new Error('Database error'));

  await POST(createMockRequest(event));

  const stored = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, event.id));
  expect(stored[0].status).toBe('failed');
  expect(stored[0].retryCount).toBe(1);
});
```

### **Integration Tests:**

- [ ] Use Stripe CLI to send test events: `stripe trigger checkout.session.completed`
- [ ] Verify event is processed and stored in database
- [ ] Replay same event, verify duplicate response
- [ ] Check database for single event record

### **Manual Testing:**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login and forward webhooks
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed

# Trigger duplicate (copy event ID from logs)
stripe events resend evt_xxxxx
```

## 🚫 **Out of Scope**

- Webhook event replay functionality (admin feature)
- Analytics dashboard for webhook processing
- Alerting for repeated webhook failures
- Automatic recovery from failed events
- Webhook event audit logging beyond basic tracking

## 📝 **Notes**

**Why This is Critical:**
- Stripe recommends idempotency for all webhook handlers
- Network issues can cause duplicate deliveries
- Manual replays from Stripe dashboard are common during debugging
- Multiple webhook endpoints can receive the same event

**Stripe Documentation:**
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices#duplicate-events)
- [Event Idempotency](https://stripe.com/docs/api/idempotent_requests)

**Related Security Issues:**
- Ticket #0016: JWT Refresh After Webhook Updates
- Ticket #0017: Verify Payment Status Before Granting Access
- Ticket #0018: Add Webhook Metadata Correlation Check

## 🏷️ **Labels**

- `priority: high`
- `type: security`
- `component: billing`
- `component: webhooks`
- `security-critical`
- `data-integrity`
- `stripe-integration`
