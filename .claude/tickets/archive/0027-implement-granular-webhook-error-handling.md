# 0027 - Implement Granular Webhook Error Handling

## 🎯 **Description**

Implement proper HTTP status code differentiation in webhook error responses to distinguish between client errors (bad data - don't retry) and server errors (system failures - retry). Currently, all webhook errors return 500, causing Stripe to retry requests that will never succeed and hiding the root cause of failures.

## 📋 **User Story**

As a platform owner, I want webhook errors to return appropriate status codes so that Stripe stops retrying unrecoverable errors, I can monitor real system failures separately from data issues, and I can debug webhook problems efficiently.

## 🔧 **Technical Context**

**Current Error Handling:**

```typescript:app/api/stripe/webhook/route.ts
// All errors return 500
export async function POST(request: NextRequest) {
  try {
    // ... webhook processing ...
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 } // ❌ Always 500, even for bad data
    );
  }
}
```

**Problem Scenarios:**

**Scenario 1: Missing Metadata (Client Error)**
```typescript
// Webhook has no user_id in metadata
const userId = session.metadata?.supabase_user_id;
if (!userId) {
  // Currently returns 500
  // Should return 400 (Stripe shouldn't retry - data won't magically appear)
}
```

**Scenario 2: Database Connection Failure (Server Error)**
```typescript
try {
  await db.update(profiles).set({ plan: 'premium' });
} catch (error) {
  // Correctly returns 500 (Stripe should retry - transient failure)
}
```

**Scenario 3: Already Processed (Success)**
```typescript
// Event already processed (idempotency check)
const existing = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, event.id));
if (existing.length > 0) {
  // Should return 200 (already processed successfully)
  // Currently might return 500 or early exit
}
```

**Stripe's Retry Behavior:**
- **200-299**: Success, stop retrying
- **400-499**: Client error, stop retrying (permanent failure)
- **500-599**: Server error, retry with exponential backoff (up to 3 days)

**Security Assessment Reference:**
- Lines 525-535 (security-assessment-evaluation.md)
- "Webhook error handling could be more granular"

**Operational Impact:** 🟡 **MEDIUM-HIGH**
- Unnecessary retries waste resources
- Can't distinguish real failures from expected errors
- Makes monitoring/alerting ineffective
- Hides root cause of integration issues

## ✅ **Acceptance Criteria**

- [ ] Webhook returns 200 for successful processing
- [ ] Webhook returns 200 for duplicate events (already processed)
- [ ] Webhook returns 400 for missing/invalid metadata
- [ ] Webhook returns 400 for unknown event types
- [ ] Webhook returns 400 for signature verification failures (invalid webhook)
- [ ] Webhook returns 500 for database errors
- [ ] Webhook returns 500 for Stripe API errors
- [ ] Webhook returns 500 for unexpected exceptions
- [ ] Error responses include descriptive error messages (for logging)
- [ ] Manual testing: Verify Stripe stops retrying 400 errors
- [ ] Manual testing: Verify Stripe retries 500 errors

## 🚨 **Technical Requirements**

### **Error Classification:**

| Error Type | Status Code | Retry? | Example |
|------------|-------------|--------|---------|
| Success | 200 | No | Webhook processed successfully |
| Already processed | 200 | No | Duplicate event (idempotency) |
| Missing metadata | 400 | No | No `supabase_user_id` in metadata |
| Invalid metadata | 400 | No | Malformed user ID format |
| Unknown event type | 400 | No | Unsupported webhook event |
| Invalid signature | 401 | No | Webhook signature verification failed |
| Database error | 500 | Yes | Connection timeout, query failure |
| Stripe API error | 500 | Yes | Failed to fetch customer details |
| Unexpected error | 500 | Yes | Uncaught exception |

### **Implementation Details**

**1. Create Error Types**

```typescript:lib/webhook-errors.ts
export class WebhookError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public shouldRetry: boolean
  ) {
    super(message);
    this.name = 'WebhookError';
  }
}

export class BadRequestError extends WebhookError {
  constructor(message: string) {
    super(message, 400, false);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends WebhookError {
  constructor(message: string) {
    super(message, 401, false);
    this.name = 'UnauthorizedError';
  }
}

export class ServerError extends WebhookError {
  constructor(message: string) {
    super(message, 500, true);
    this.name = 'ServerError';
  }
}

/**
 * Helper to determine if error is transient (should retry)
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof WebhookError) {
    return error.shouldRetry;
  }

  // Database connection errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('network')
    ) {
      return true; // Transient - should retry
    }
  }

  // Default: treat unknown errors as transient
  return true;
}
```

**2. Update Webhook Signature Verification**

```typescript:app/api/stripe/webhook/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      throw new UnauthorizedError("Missing Stripe signature");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      // ✅ Signature verification failure = 401 (don't retry)
      throw new UnauthorizedError(`Invalid webhook signature: ${err.message}`);
    }

    // ... rest of processing ...

  } catch (error) {
    return handleWebhookError(error);
  }
}
```

**3. Update Event Handlers with Proper Errors**

```typescript:app/api/stripe/webhook/route.ts
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;

  if (!userId) {
    // ✅ Missing metadata = 400 (don't retry - data won't appear)
    throw new BadRequestError(
      "Missing supabase_user_id in checkout session metadata"
    );
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    // ✅ Invalid format = 400 (don't retry - format won't fix itself)
    throw new BadRequestError(
      `Invalid supabase_user_id format: ${userId}`
    );
  }

  try {
    // Database operations...
    await db.update(profiles).set({ plan: 'premium' }).where(eq(profiles.id, userId));
  } catch (error) {
    // ✅ Database error = 500 (retry - might be transient)
    throw new ServerError(
      `Failed to update user profile: ${error.message}`
    );
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    // ✅ Try to get user from customer record
    try {
      const customer = await db
        .select()
        .from(stripeCustomers)
        .where(eq(stripeCustomers.stripeCustomerId, subscription.customer as string))
        .limit(1);

      if (customer.length === 0) {
        // ✅ No customer found = 400 (don't retry - missing data)
        throw new BadRequestError(
          `No user found for customer ${subscription.customer}`
        );
      }

      // Use customer's user ID
      userId = customer[0].userId;
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error; // Re-throw client errors
      }
      // ✅ Database error = 500 (retry)
      throw new ServerError(
        `Failed to lookup customer: ${error.message}`
      );
    }
  }

  // ... rest of handler ...
}
```

**4. Implement Central Error Handler**

```typescript:app/api/stripe/webhook/route.ts
import {
  WebhookError,
  BadRequestError,
  UnauthorizedError,
  ServerError,
  isTransientError,
} from '@/lib/webhook-errors';

function handleWebhookError(error: unknown): NextResponse {
  // Handle custom webhook errors
  if (error instanceof WebhookError) {
    logWebhookError(error.message, {
      statusCode: error.statusCode,
      shouldRetry: error.shouldRetry,
      errorType: error.name,
    });

    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  // Handle database errors
  if (error instanceof Error && error.message.includes('database')) {
    logWebhookError('Database error in webhook', {
      error: error.message,
      statusCode: 500,
      shouldRetry: true,
    });

    return NextResponse.json(
      { error: 'Database error - will retry' },
      { status: 500 }
    );
  }

  // Handle unknown errors
  logWebhookError('Unexpected error in webhook', {
    error: error instanceof Error ? error.message : String(error),
    statusCode: 500,
    shouldRetry: true,
  });

  return NextResponse.json(
    { error: 'Internal server error - will retry' },
    { status: 500 }
  );
}
```

**5. Update Idempotency Check**

```typescript:app/api/stripe/webhook/route.ts
// Check if already processed
const existing = await db
  .select()
  .from(webhookEvents)
  .where(eq(webhookEvents.eventId, event.id))
  .limit(1);

if (existing.length > 0) {
  // ✅ Already processed = 200 (success, don't retry)
  logWebhookSuccess(`Event ${event.id} already processed (idempotent)`);
  return NextResponse.json({ received: true, alreadyProcessed: true });
}
```

**6. Handle Unknown Event Types**

```typescript:app/api/stripe/webhook/route.ts
switch (event.type) {
  case "checkout.session.completed":
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    break;
  case "customer.subscription.created":
  case "customer.subscription.updated":
    await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    break;
  // ... other handlers ...
  default:
    // ✅ Unknown event type = 200 (not an error, just not implemented)
    logWebhookSuccess(`Unhandled event type: ${event.type} (ignoring)`);
    return NextResponse.json({ received: true, ignored: true });
}

// ✅ Success
logWebhookSuccess(`Successfully processed ${event.type}`);
return NextResponse.json({ received: true });
```

### **Response Format:**

```typescript
// Success (200)
{
  "received": true,
  "alreadyProcessed": false // or true for duplicates
}

// Client Error (400)
{
  "error": "Missing supabase_user_id in checkout session metadata"
}

// Server Error (500)
{
  "error": "Database error - will retry"
}
```

### **Logging Updates:**

```typescript:lib/webhook-logger.ts
export function logWebhookError(
  message: string,
  details?: {
    error?: string;
    statusCode?: number;
    shouldRetry?: boolean;
    errorType?: string;
  }
) {
  console.error(`❌ WEBHOOK ERROR: ${message}`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}

export function logWebhookSuccess(message: string, details?: Record<string, any>) {
  console.log(`✅ WEBHOOK SUCCESS: ${message}`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}
```

### **Dependencies**

- `lib/webhook-errors.ts` - New error classes
- `app/api/stripe/webhook/route.ts` - Updated with granular errors
- Webhook idempotency (Ticket #0015) - Already processed check

### **Integration Points**

- All webhook event handlers
- Webhook signature verification
- Idempotency checking
- Database operations
- Stripe API calls

## 🔍 **Implementation Notes**

### **Why 400 vs 500 Matters:**

**400 (Bad Request):**
- Stripe stops retrying immediately
- Logs the error permanently
- Allows manual investigation
- Prevents infinite retry loops

**500 (Server Error):**
- Stripe retries with exponential backoff
- Up to 3 days of retries
- Good for transient failures
- Bad for permanent issues

### **Retry Schedule (Stripe):**

```
Initial failure: immediate
1st retry: 5 minutes
2nd retry: 15 minutes
3rd retry: 1 hour
4th retry: 6 hours
5th retry: 24 hours
Final retry: 72 hours
```

### **Best Practices:**

1. **Be Conservative with 400s**: Only use when CERTAIN the error is permanent
2. **Default to 500**: When in doubt, allow retries
3. **Log Everything**: Both 400s and 500s should be logged for investigation
4. **Monitor 400 Rate**: High 400 rate indicates integration issues
5. **Alert on 500 Rate**: High 500 rate indicates system issues

### **Edge Cases:**

**Database Constraint Violation:**
```typescript
try {
  await db.insert(stripeCustomers).values({ userId, stripeCustomerId });
} catch (error) {
  if (error.code === '23505') { // Unique constraint violation
    // Already exists = Success (idempotent)
    return NextResponse.json({ received: true, alreadyExists: true });
  }
  // Other DB errors = 500
  throw new ServerError('Database error');
}
```

**Temporary Network Issues:**
```typescript
try {
  const customer = await stripe.customers.retrieve(customerId);
} catch (error) {
  if (error.type === 'StripeConnectionError') {
    // Network issue = 500 (retry)
    throw new ServerError('Stripe API connection error');
  }
  if (error.statusCode === 404) {
    // Customer not found = 400 (don't retry)
    throw new BadRequestError('Customer not found in Stripe');
  }
  throw new ServerError('Stripe API error');
}
```

## 📊 **Definition of Done**

- [ ] `lib/webhook-errors.ts` created with error classes
- [ ] Signature verification returns 401 for invalid signatures
- [ ] Missing metadata returns 400
- [ ] Invalid metadata format returns 400
- [ ] Unknown event types return 200 (ignored)
- [ ] Database errors return 500
- [ ] Duplicate events return 200 (already processed)
- [ ] Central error handler implemented
- [ ] All error responses include descriptive messages
- [ ] Webhook logger updated to log status codes
- [ ] Manual testing: Verify Stripe retry behavior
- [ ] Manual testing: Trigger each error type

## 🧪 **Testing Requirements**

### **Unit Tests:**

```typescript
import { BadRequestError, ServerError, isTransientError } from '@/lib/webhook-errors';

describe('Webhook Error Handling', () => {
  test('should return 400 for missing metadata', async () => {
    const response = await POST(createMockRequest({
      event: {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {}, // Missing supabase_user_id
          },
        },
      },
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Missing supabase_user_id');
  });

  test('should return 401 for invalid signature', async () => {
    const response = await POST(createMockRequest({
      signature: 'invalid',
    }));

    expect(response.status).toBe(401);
  });

  test('should return 200 for duplicate events', async () => {
    // Insert event first
    await db.insert(webhookEvents).values({ eventId: 'evt_123', status: 'processed' });

    const response = await POST(createMockRequest({
      event: { id: 'evt_123', type: 'checkout.session.completed' },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alreadyProcessed).toBe(true);
  });

  test('should return 200 for unknown event types', async () => {
    const response = await POST(createMockRequest({
      event: { type: 'invoice.finalized', data: {} },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ignored).toBe(true);
  });

  test('should identify transient errors', () => {
    expect(isTransientError(new ServerError('DB error'))).toBe(true);
    expect(isTransientError(new BadRequestError('Bad data'))).toBe(false);
  });
});
```

### **Manual Testing with Stripe CLI:**

```bash
# Test missing metadata (should return 400)
stripe trigger checkout.session.completed --override metadata='{}'

# Test invalid signature (should return 401)
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Stripe-Signature: invalid" \
  -d '{}'

# Test duplicate event (should return 200)
stripe events resend evt_123

# Check Stripe dashboard - 400 events should NOT retry
# Check Stripe dashboard - 500 events should retry
```

### **Monitoring Queries:**

```sql
-- Count webhook errors by status code (last 24 hours)
SELECT
  status_code,
  COUNT(*) as error_count,
  MAX(created_at) as last_occurrence
FROM webhook_events
WHERE status != 'processed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY status_code
ORDER BY error_count DESC;
```

## 🚫 **Out of Scope**

- Dead letter queue for failed webhooks
- Webhook replay UI
- Custom retry logic (use Stripe's built-in)
- Webhook event filtering/routing
- Webhook performance optimization

## 📝 **Notes**

**HTTP Status Code Standards (RFC 7231):**

- **200 OK**: Successfully processed
- **400 Bad Request**: Client error (malformed request, missing data)
- **401 Unauthorized**: Authentication failure
- **404 Not Found**: Resource doesn't exist
- **500 Internal Server Error**: Server failure
- **503 Service Unavailable**: Temporarily unavailable (maintenance)

**Stripe's Webhook Best Practices:**

> "Return a 2xx status code quickly. Avoid waiting for processing to complete. Use job queues for long-running tasks."

**Our Approach:**

We process synchronously (simple operations) but return appropriate status codes immediately. For future optimization, we could:
1. Accept webhook (200)
2. Queue processing job
3. Job handles retries internally

**Related Tickets:**

- Ticket #0015: Webhook Idempotency (already processed = 200)
- Ticket #0021: Missing Webhook Handlers (more event types to handle)
- Ticket #0026: Billing Audit Logger (log all webhook errors)

**Real-World Examples:**

**GitHub Webhooks:**
- 400: Invalid payload
- 401: Invalid signature
- 500: Database error

**Shopify Webhooks:**
- 200: Success
- 400: Malformed JSON
- 401: Invalid HMAC

## 🏷️ **Labels**

- `priority: medium-high`
- `type: reliability`
- `component: webhooks`
- `component: stripe`
- `error-handling`
- `operational-excellence`
