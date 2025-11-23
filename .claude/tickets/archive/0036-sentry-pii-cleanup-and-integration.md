# 0036 - Comprehensive Sentry Integration and PII Cleanup

## 🎯 **Description**

Fix PII leaks in Sentry error tracking, implement comprehensive error capture strategy, and ensure proper Sentry integration across the application for production-grade observability.

## 📋 **User Story**

As a platform owner, I want comprehensive error tracking in Sentry without exposing PII so that I can debug production issues quickly while maintaining GDPR compliance.

## 🔧 **Technical Context**

**Current Implementation Issues:**

```typescript
// lib/admin-alerts.ts - CURRENT (HAS PII LEAKS)
Sentry.captureException(new Error(`Webhook failed...`), {
  contexts: {
    stripe: {
      session_id: failure.sessionId || 'N/A',        // ❌ PII: Can identify user
      customer_id: failure.customerId || 'N/A',      // ❌ PII: Stripe customer ID
      subscription_id: failure.subscriptionId || 'N/A', // ❌ PII: Subscription ID
    },
  },
});
```

**Problems:**

1. ❌ **PII Leaks in Sentry**
   - Raw `sessionId`, `customerId`, `subscriptionId` sent to Sentry
   - These can be correlated with Stripe dashboard to identify users
   - Violates GDPR Article 32 pseudonymization requirements

2. ❌ **Limited Error Capture**
   - Only critical webhook failures sent to Sentry (retry count >= 3)
   - Many important errors never reach Sentry:
     - Checkout failures
     - Reconciliation errors
     - Database connection issues
     - Stripe API errors
   - No structured error context (request IDs, timestamps, environment)

3. ❌ **Missing Performance Monitoring**
   - No transaction tracing
   - No performance metrics (API response times, database queries)
   - Cannot identify slow endpoints or bottlenecks

4. ❌ **Poor Error Grouping**
   - Fingerprinting only uses `eventId` (too specific)
   - Each webhook retry creates new Sentry issue
   - Alert fatigue from duplicate issues

5. ❌ **No Source Maps**
   - Stack traces show minified code in production
   - Cannot map errors to original TypeScript source

**Security Impact:** 🟡 **MEDIUM**
- Sentry logs could be used to correlate users with Stripe records
- GDPR compliance risk if Sentry data is subpoenaed
- Potential privacy violation if Sentry account is compromised

**GDPR Compliance:**
> Article 32: "Pseudonymisation and encryption of personal data" requires appropriate technical measures. Stripe IDs must be redacted before sending to third-party services like Sentry.

## ✅ **Acceptance Criteria**

### **PII Redaction**
- [ ] All Stripe IDs redacted in Sentry contexts (sessionId, customerId, subscriptionId)
- [ ] User IDs redacted using HMAC (depends on ticket #0035)
- [ ] Email addresses never sent to Sentry
- [ ] Payment amounts, card details never sent to Sentry

### **Error Capture Strategy**
- [ ] Critical errors: Captured with `level: 'fatal'`
- [ ] Important errors: Captured with `level: 'error'`
- [ ] Warnings: Captured with `level: 'warning'`
- [ ] All errors include structured context (userId, eventType, timestamp)

### **Performance Monitoring**
- [ ] Sentry Performance enabled in production
- [ ] API route transactions automatically traced
- [ ] Database query performance tracked
- [ ] Custom spans for Stripe API calls

### **Error Grouping**
- [ ] Fingerprinting uses error type + location (not event ID)
- [ ] Webhook errors grouped by event type
- [ ] Maximum 1 alert per unique error type per hour

### **Source Maps**
- [ ] Source maps uploaded to Sentry on deployment
- [ ] Stack traces show original TypeScript line numbers
- [ ] Local file paths excluded from production builds

## 🚨 **Technical Requirements**

### **1. Create Centralized Sentry Utilities**

```typescript:lib/sentry-utils.ts
import * as Sentry from '@sentry/nextjs';
import { redactUserId, redactCustomerId } from './logging';

/**
 * Redact Stripe session ID for Sentry
 * @example redactSessionId("cs_test_123...") → "cs_a1b2c3d4"
 */
export function redactSessionId(sessionId: string | null | undefined): string {
  if (!sessionId) return 'N/A';

  const secret = process.env.LOG_REDACTION_SECRET || 'dev-only-insecure-default';
  const hmac = crypto.createHmac('sha256', secret)
    .update(sessionId)
    .digest('hex')
    .slice(0, 8);

  return `cs_${hmac}`;
}

/**
 * Redact Stripe subscription ID for Sentry
 */
export function redactSubscriptionId(subscriptionId: string | null | undefined): string {
  if (!subscriptionId) return 'N/A';

  const secret = process.env.LOG_REDACTION_SECRET || 'dev-only-insecure-default';
  const hmac = crypto.createHmac('sha256', secret)
    .update(subscriptionId)
    .digest('hex')
    .slice(0, 8);

  return `sub_${hmac}`;
}

/**
 * Capture error to Sentry with standardized context and PII redaction
 */
export function captureSentryError(
  error: Error,
  context: {
    level?: 'fatal' | 'error' | 'warning';
    userId?: string;
    sessionId?: string;
    customerId?: string;
    subscriptionId?: string;
    eventType?: string;
    eventId?: string;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
): void {
  Sentry.captureException(error, {
    level: context.level || 'error',
    tags: {
      event_type: context.eventType || 'unknown',
      ...context.tags,
    },
    contexts: {
      user_context: {
        user_id: context.userId ? redactUserId(context.userId) : 'N/A',
      },
      stripe: {
        session_id: redactSessionId(context.sessionId),
        customer_id: context.customerId ? redactCustomerId(context.customerId) : 'N/A',
        subscription_id: redactSubscriptionId(context.subscriptionId),
      },
      event: {
        event_id: context.eventId || 'N/A',
        timestamp: new Date().toISOString(),
      },
    },
    fingerprint: [
      // Group by error type and location, NOT by event ID
      error.name,
      context.eventType || 'unknown',
      error.stack?.split('\n')[1]?.trim() || 'unknown-location',
    ],
    user: context.userId ? {
      id: redactUserId(context.userId),
    } : undefined,
    extra: context.extra,
  });
}

/**
 * Start Sentry transaction for performance monitoring
 */
export function startSentryTransaction(
  name: string,
  op: 'webhook' | 'api' | 'reconciliation' | 'checkout'
): Sentry.Transaction {
  return Sentry.startTransaction({
    name,
    op,
    tags: {
      environment: process.env.NODE_ENV,
    },
  });
}

/**
 * Create Sentry span for tracking specific operations
 */
export function createSentrySpan(
  transaction: Sentry.Transaction,
  operation: string,
  description: string
): Sentry.Span {
  return transaction.startChild({
    op: operation,
    description,
  });
}
```

### **2. Update Admin Alerts with PII Redaction**

```typescript:lib/admin-alerts.ts
import { captureSentryError } from './sentry-utils';
import { redactUserId } from './logging';

export async function sendAdminWebhookAlert(failure: WebhookFailureAlert): Promise<void> {
  // Log to console (keep for local dev)
  console.error('═══════════════════════════════════════════');
  console.error('🚨 CRITICAL WEBHOOK FAILURE - ADMIN ALERT');
  console.error('═══════════════════════════════════════════');
  console.error(`User: ${redactUserId(failure.userId)}`);
  console.error(`Event Type: ${failure.eventType}`);
  console.error(`Retry Count: ${failure.retryCount}`);
  console.error(`Error: ${failure.errorMessage}`);
  console.error('═══════════════════════════════════════════');

  // ✅ Send to Sentry with PII redaction
  captureSentryError(
    new Error(`Webhook failed after ${failure.retryCount} retries: ${failure.errorMessage}`),
    {
      level: 'fatal',
      userId: failure.userId,
      sessionId: failure.sessionId,
      customerId: failure.customerId,
      subscriptionId: failure.subscriptionId,
      eventType: failure.eventType,
      eventId: failure.eventId,
      tags: {
        retry_count: failure.retryCount.toString(),
      },
      extra: {
        remediation: {
          database_table: 'webhook_events',
          reconciliation_eta: '24 hours',
        },
      },
    }
  );

  console.log('✅ Critical webhook failure sent to Sentry (PII redacted)');
}
```

### **3. Add Sentry to Webhook Handler**

```typescript:app/api/stripe/webhook/route.ts
import { startSentryTransaction, createSentrySpan, captureSentryError } from '@/lib/sentry-utils';

export async function POST(request: Request) {
  const transaction = startSentryTransaction('stripe.webhook', 'webhook');

  try {
    // Existing webhook processing...

    const verifySpan = createSentrySpan(transaction, 'stripe.verify', 'Verify webhook signature');
    const sig = headers().get("stripe-signature");
    const event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
    verifySpan.finish();

    const processSpan = createSentrySpan(transaction, 'stripe.process', `Process ${event.type}`);
    // Process event...
    processSpan.finish();

    transaction.finish();
    return new Response("Success", { status: 200 });

  } catch (error) {
    // ✅ Capture to Sentry with context
    captureSentryError(error as Error, {
      level: 'error',
      eventType: event?.type,
      eventId: event?.id,
      tags: {
        webhook_source: 'stripe',
      },
    });

    transaction.finish();
    return new Response("Webhook error", { status: 500 });
  }
}
```

### **4. Add Sentry to Reconciliation**

```typescript:lib/reconciliation/stripe-reconciliation.ts
import { captureSentryError, startSentryTransaction } from '@/lib/sentry-utils';

export async function reconcileAllUsers(): Promise<ReconciliationResult> {
  const transaction = startSentryTransaction('stripe.reconciliation', 'reconciliation');

  try {
    // Existing reconciliation logic...

    // Capture critical drift issues to Sentry
    if (result.drift_detected > 0) {
      const criticalIssues = result.issues.filter(i => i.action === 'manual_review');

      if (criticalIssues.length > 0) {
        captureSentryError(
          new Error(`Billing drift detected: ${criticalIssues.length} users require manual review`),
          {
            level: 'warning',
            eventType: 'reconciliation.drift',
            tags: {
              drift_count: result.drift_detected.toString(),
              auto_fixed: result.auto_fixed.toString(),
              manual_review: result.manual_review.toString(),
            },
            extra: {
              summary: {
                total_drift: result.drift_detected,
                auto_fixed: result.auto_fixed,
                manual_review: result.manual_review,
                errors: result.errors,
              },
            },
          }
        );
      }
    }

    transaction.finish();
    return result;

  } catch (error) {
    captureSentryError(error as Error, {
      level: 'fatal',
      eventType: 'reconciliation.error',
    });

    transaction.finish();
    throw error;
  }
}
```

### **5. Configure Sentry Source Maps**

```typescript:next.config.mjs
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  // Existing config...
};

export default withSentryConfig(
  nextConfig,
  {
    // Sentry webpack plugin options
    silent: true, // Suppress logs during build

    // Upload source maps to Sentry
    widenClientFileUpload: true,
    hideSourceMaps: true, // Don't serve source maps to browsers
    disableLogger: true,

    // Automatic instrumentation
    automaticVercelMonitors: true,
  },
  {
    // Sentry configuration options
    transpileClientSDK: true,
  }
);
```

```bash:.env.example
# Sentry Configuration
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-org-name
SENTRY_PROJECT=your-project-name

# Enable performance monitoring
NEXT_PUBLIC_SENTRY_SAMPLE_RATE=1.0  # 100% in dev
SENTRY_SAMPLE_RATE=0.1              # 10% in production
```

### **6. Update Sentry Initialization**

```typescript:sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay (optional)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Filter out PII
  beforeSend(event) {
    // Remove user IP addresses
    if (event.user) {
      delete event.user.ip_address;
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }

    return event;
  },

  // Ignore known errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
});
```

```typescript:sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Filter out PII (same as client)
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address;
    }

    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }

    return event;
  },
});
```

## 📊 **Error Capture Strategy**

### **Level Guidelines**

| Level | When to Use | Examples |
|-------|-------------|----------|
| `fatal` | Critical errors requiring immediate action | Webhook failed after all retries, database connection lost, payment processor down |
| `error` | Important errors that may require investigation | Checkout failed, reconciliation found drift, Stripe API error |
| `warning` | Issues that don't break functionality | User has invalid subscription status, JWT claims missing (but has fallback) |
| `info` | Informational events | Successful reconciliation, subscription upgraded |
| `debug` | Development/debugging info | Never sent to Sentry in production |

### **What to Send to Sentry**

✅ **Always Send:**
- Webhook failures (after 3rd retry)
- Reconciliation drift issues
- Database errors
- Stripe API errors
- Checkout failures
- Authentication errors

❌ **Never Send:**
- User input validation errors (handle in UI)
- Expected 404s (normal flow)
- Development/debug logs
- PII (raw user IDs, emails, payment info)

## 🧪 **Testing Requirements**

### **Unit Tests**

```typescript:lib/sentry-utils.test.ts
import { captureSentryError, redactSessionId, redactSubscriptionId } from './sentry-utils';
import * as Sentry from '@sentry/nextjs';

jest.mock('@sentry/nextjs');

describe('Sentry PII Redaction', () => {
  beforeAll(() => {
    process.env.LOG_REDACTION_SECRET = 'test-secret-key';
  });

  test('should redact session ID', () => {
    const sessionId = 'cs_test_a1b2c3d4e5f6g7h8i9j0';
    const redacted = redactSessionId(sessionId);

    expect(redacted).toMatch(/^cs_[a-f0-9]{8}$/);
    expect(redacted).not.toContain('test_a1b2c3d4');
  });

  test('should redact subscription ID', () => {
    const subscriptionId = 'sub_1234567890abcdef';
    const redacted = redactSubscriptionId(subscriptionId);

    expect(redacted).toMatch(/^sub_[a-f0-9]{8}$/);
    expect(redacted).not.toContain('1234567890');
  });

  test('should capture error with redacted context', () => {
    const error = new Error('Test error');

    captureSentryError(error, {
      level: 'error',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: 'cs_test_123',
      customerId: 'cus_123456789',
      subscriptionId: 'sub_123456789',
      eventType: 'checkout.session.completed',
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        level: 'error',
        contexts: expect.objectContaining({
          user_context: expect.objectContaining({
            user_id: expect.stringMatching(/^user_[a-f0-9]{12}$/),
          }),
          stripe: expect.objectContaining({
            session_id: expect.stringMatching(/^cs_[a-f0-9]{8}$/),
            customer_id: expect.stringMatching(/^cus_[a-f0-9]{8}$/),
            subscription_id: expect.stringMatching(/^sub_[a-f0-9]{8}$/),
          }),
        }),
      })
    );
  });
});
```

### **Manual Testing**

```bash
# 1. Trigger a webhook error and verify Sentry capture
stripe trigger checkout.session.completed

# 2. Check Sentry dashboard
# - Verify error appears with redacted IDs
# - Verify source maps show TypeScript line numbers
# - Verify no PII in context

# 3. Test performance monitoring
# - Check Sentry Performance dashboard
# - Verify webhook transactions appear
# - Verify database query spans tracked
```

## 📊 **Definition of Done**

- [ ] `lib/sentry-utils.ts` created with PII-safe utilities
- [ ] All Stripe IDs redacted in Sentry contexts
- [ ] Source maps uploaded to Sentry
- [ ] Performance monitoring enabled
- [ ] Error grouping uses fingerprints (not event IDs)
- [ ] Admin alerts updated to use `captureSentryError()`
- [ ] Webhook handler sends errors to Sentry
- [ ] Reconciliation sends drift issues to Sentry
- [ ] Unit tests pass
- [ ] Manual verification: Sentry shows redacted IDs
- [ ] Documentation updated with Sentry usage guidelines

## 🚫 **Out of Scope**

- Session replay implementation (optional feature)
- Custom Sentry alerts/notifications (use Sentry UI)
- Log aggregation platform (separate from Sentry)
- Application Performance Monitoring (APM) beyond Sentry
- Error recovery automation (separate ticket #0041)

## 📝 **Notes**

**OWASP Recommendations:**
> "Never send PII to third-party error tracking services. Use pseudonymization and ensure data processing agreements comply with GDPR."

**Sentry Best Practices:**
- Use fingerprinting to group related errors
- Set appropriate sample rates (10% in production)
- Upload source maps for readable stack traces
- Use `beforeSend` hook to filter sensitive data
- Tag errors by environment, release, user tier

**Related Tickets:**
- Ticket #0035: Enhance PII Redaction with HMAC (dependency)
- Ticket #0040: Implement Structured Logging (complementary)

**References:**
- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry PII Guidelines](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/)
- [GDPR Data Processing](https://gdpr-info.eu/art-28-gdpr/)

## 🏷️ **Labels**

- `priority: high`
- `type: security`
- `component: monitoring`
- `gdpr-compliance`
- `pii-protection`
- `observability`
- `dependencies: #0035`
