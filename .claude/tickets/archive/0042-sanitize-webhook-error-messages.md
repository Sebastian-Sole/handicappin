# 0042 - Sanitize Webhook Error Messages (Remove Stripe IDs)

## 🎯 **Description**

Remove Stripe IDs and other sensitive information from webhook error messages before logging to prevent potential PII leakage and improve GDPR compliance.

## 📋 **User Story**

As a platform owner, I want error messages to be sanitized so that sensitive Stripe IDs cannot be used to correlate users even if logs are compromised.

## 🔧 **Technical Context**

**Current Implementation (LEAKS STRIPE IDs):**

```typescript
// lib/webhook-logger.ts - CURRENT
export function logWebhookError(message: string, error?: any): void {
  console.error(`❌ Webhook Error: ${message}`, error);
}

// Example usage in webhook handler:
throw new Error(
  `Missing supabase_user_id in customer ${customer.id} metadata - cannot link customer to user`
);
// ❌ Logs: "Missing supabase_user_id in customer cus_abc123 metadata..."
// Problem: "cus_abc123" can be used to identify user in Stripe dashboard
```

**Problems:**

1. **Stripe IDs in Error Messages:**
   ```typescript
   // ❌ Current error messages include:
   - Customer IDs: cus_abc123
   - Session IDs: cs_test_abc123
   - Subscription IDs: sub_abc123
   - Price IDs: price_abc123
   - Invoice IDs: in_abc123
   ```

2. **Correlation Risk:**
   - If logs leak, attacker can:
     1. Search logs for Stripe customer ID
     2. Look up customer in Stripe dashboard
     3. See customer email, payment history
     4. Correlate with database user

3. **GDPR Compliance:**
   - Stripe IDs are considered "personal data" under GDPR
   - Must be pseudonymized or redacted in logs
   - Same requirements as user IDs

4. **Sentry Context:**
   - Error messages sent to Sentry
   - Sentry contexts may include Stripe IDs
   - Need to redact before sending

**Security Impact:** 🟡 **MEDIUM**
- Lower risk than direct user ID exposure
- Still allows correlation with external systems (Stripe)
- GDPR Article 32 requires pseudonymization of ALL personal data

## ✅ **Acceptance Criteria**

### **Error Message Sanitization**
- [ ] All Stripe IDs redacted in error messages before logging
- [ ] Redaction uses HMAC (same as user IDs)
- [ ] Error messages remain actionable (enough context to debug)
- [ ] Sanitization applied automatically in error handler

### **Stripe ID Types Covered**
- [ ] Customer IDs (`cus_`)
- [ ] Session IDs (`cs_`, `cs_test_`)
- [ ] Subscription IDs (`sub_`)
- [ ] Price IDs (`price_`)
- [ ] Invoice IDs (`in_`)
- [ ] Payment Intent IDs (`pi_`)
- [ ] Charge IDs (`ch_`)

### **Error Context**
- [ ] Original Stripe IDs stored in database (for admin debugging)
- [ ] Redacted IDs shown in logs (for pattern analysis)
- [ ] Mapping between redacted ↔ original stored securely

### **Backward Compatibility**
- [ ] Existing error messages still work
- [ ] Logging functions accept both plain and Stripe IDs
- [ ] No breaking changes to webhook handler

## 🚨 **Technical Requirements**

### **1. Stripe ID Redaction Functions**

```typescript:lib/logging.ts
import crypto from 'crypto';

/**
 * Redact Stripe customer ID using HMAC
 * @example redactStripeId("cus_abc123") → "cus_a1b2c3d4"
 */
export function redactStripeId(stripeId: string | null | undefined): string {
  if (!stripeId) return 'stripe_unknown';

  // Extract prefix (cus_, sub_, etc.)
  const prefixMatch = stripeId.match(/^([a-z_]+)_/);
  const prefix = prefixMatch ? prefixMatch[1] : 'stripe';

  const secret = process.env.LOG_REDACTION_SECRET;

  if (!secret) {
    console.warn('⚠️ LOG_REDACTION_SECRET not set - using default (INSECURE)');
    const defaultSecret = 'dev-only-insecure-default';
    const hmac = crypto
      .createHmac('sha256', defaultSecret)
      .update(stripeId)
      .digest('hex')
      .slice(0, 8);
    return `${prefix}_${hmac}`;
  }

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(stripeId)
    .digest('hex')
    .slice(0, 8);

  return `${prefix}_${hmac}`;
}

/**
 * Auto-detect and redact all Stripe IDs in a string
 * @example sanitizeErrorMessage("Customer cus_123 not found") → "Customer cus_a1b2c3d4 not found"
 */
export function sanitizeErrorMessage(message: string): string {
  // Regex to match Stripe IDs
  const stripeIdRegex = /\b(cus|cs|cs_test|sub|price|in|pi|ch|pm|si)_[a-zA-Z0-9]+\b/g;

  return message.replace(stripeIdRegex, (match) => redactStripeId(match));
}

/**
 * Sanitize error object before logging
 */
export function sanitizeError(error: any): any {
  if (!error) return error;

  const sanitized = { ...error };

  // Sanitize message
  if (sanitized.message) {
    sanitized.message = sanitizeErrorMessage(sanitized.message);
  }

  // Sanitize stack trace
  if (sanitized.stack) {
    sanitized.stack = sanitizeErrorMessage(sanitized.stack);
  }

  // Sanitize nested error properties
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeErrorMessage(sanitized[key]);
    }
  });

  return sanitized;
}
```

### **2. Update Error Throwing in Webhook Handler**

```typescript:app/api/stripe/webhook/route.ts
import { sanitizeErrorMessage } from '@/lib/logging';

async function handleCustomerCreated(
  customer: Stripe.Customer
): Promise<void> {
  const userId = customer.metadata?.supabase_user_id;

  if (!userId) {
    // ❌ BEFORE: Logs raw customer ID
    // throw new Error(`Missing supabase_user_id in customer ${customer.id} metadata`);

    // ✅ AFTER: Redact customer ID before throwing
    const errorMessage = sanitizeErrorMessage(
      `Missing supabase_user_id in customer ${customer.id} metadata - cannot link customer to user`
    );
    throw new Error(errorMessage);
  }

  // Check for duplicate customer (security issue)
  const existingCustomer = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1);

  if (existingCustomer.length > 0) {
    // ❌ BEFORE: Logs both customer IDs
    // throw new Error(
    //   `Duplicate customer: User ${userId} already has customer ${existingCustomer[0].stripeCustomerId}, received new customer ${customer.id}`
    // );

    // ✅ AFTER: Redact all Stripe IDs
    const errorMessage = sanitizeErrorMessage(
      `Duplicate customer: User already has customer ${existingCustomer[0].stripeCustomerId}, received new customer ${customer.id}`
    );
    throw new Error(errorMessage);
  }

  // ... rest of handler
}
```

### **3. Update Webhook Logger**

```typescript:lib/webhook-logger.ts
import { sanitizeErrorMessage, sanitizeError } from './logging';

export function logWebhookError(message: string, error?: any): void {
  // Sanitize message
  const sanitizedMessage = sanitizeErrorMessage(message);

  // Sanitize error object
  const sanitizedError = error ? sanitizeError(error) : undefined;

  console.error(`❌ Webhook Error: ${sanitizedMessage}`, sanitizedError);
}

export function logWebhookSuccess(message: string, context?: any): void {
  // Sanitize success messages too (may contain Stripe IDs)
  const sanitizedMessage = sanitizeErrorMessage(message);

  // Sanitize context
  const sanitizedContext = context ? sanitizeError(context) : undefined;

  console.log(`✅ Webhook Success: ${sanitizedMessage}`, sanitizedContext);
}
```

### **4. Store Original Stripe IDs for Debugging**

```sql:migrations/0018_webhook_event_metadata.sql
-- Add metadata column to webhook_events for storing original IDs
ALTER TABLE webhook_events
ADD COLUMN metadata JSONB;

-- Store redacted → original mapping (encrypted at rest)
CREATE TABLE stripe_id_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redacted_id TEXT NOT NULL UNIQUE,
  original_id TEXT NOT NULL, -- Encrypted by Supabase RLS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days' -- Auto-delete after 90 days
);

CREATE INDEX idx_stripe_id_mappings_redacted ON stripe_id_mappings(redacted_id);

-- RLS: Only admins can access original IDs
ALTER TABLE stripe_id_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_only_stripe_id_mappings
  ON stripe_id_mappings
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
```

```typescript:lib/stripe-id-mapper.ts
import { db } from '@/db';
import { stripeIdMappings } from '@/db/schema';
import { redactStripeId } from './logging';

/**
 * Store Stripe ID with its redacted version for admin debugging
 */
export async function storeStripeIdMapping(originalId: string): Promise<string> {
  const redactedId = redactStripeId(originalId);

  // Store mapping in database
  try {
    await db
      .insert(stripeIdMappings)
      .values({
        redactedId,
        originalId,
      })
      .onConflictDoNothing(); // Skip if already exists
  } catch (error) {
    console.error('Failed to store Stripe ID mapping:', error);
  }

  return redactedId;
}

/**
 * Retrieve original Stripe ID from redacted version (admin only)
 */
export async function getOriginalStripeId(redactedId: string): Promise<string | null> {
  const result = await db
    .select()
    .from(stripeIdMappings)
    .where(eq(stripeIdMappings.redactedId, redactedId))
    .limit(1);

  return result.length > 0 ? result[0].originalId : null;
}
```

### **5. Update Sentry Error Capture**

```typescript:lib/sentry-utils.ts
import { sanitizeError, sanitizeErrorMessage } from './logging';

export function captureSentryError(
  error: Error,
  context: {
    // ... context fields
  }
): void {
  // Sanitize error before sending to Sentry
  const sanitizedError = sanitizeError(error);

  Sentry.captureException(sanitizedError, {
    level: context.level || 'error',
    tags: {
      event_type: context.eventType || 'unknown',
      ...context.tags,
    },
    contexts: {
      // ... contexts (already redacted via redactSessionId, etc.)
    },
  });
}
```

### **6. Admin Debug Tool**

```typescript:app/api/admin/debug-stripe-id/route.ts
import { createServerComponentClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getOriginalStripeId } from '@/lib/stripe-id-mapper';

/**
 * GET /api/admin/debug-stripe-id?redacted=cus_a1b2c3d4
 * Lookup original Stripe ID from redacted version (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Check if user has admin role

    const redactedId = request.nextUrl.searchParams.get('redacted');

    if (!redactedId) {
      return NextResponse.json({ error: 'Missing redacted parameter' }, { status: 400 });
    }

    const originalId = await getOriginalStripeId(redactedId);

    if (!originalId) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    return NextResponse.json({
      redacted: redactedId,
      original: originalId,
      stripe_url: `https://dashboard.stripe.com/test/customers/${originalId}`,
    });

  } catch (error) {
    console.error('Error looking up Stripe ID:', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
```

## 📊 **Example Sanitization**

**Before:**
```typescript
throw new Error(
  `Missing supabase_user_id in customer cus_Pq9vN8tJ2KlMnO metadata - cannot link customer to user`
);
// Logs: "Missing supabase_user_id in customer cus_Pq9vN8tJ2KlMnO metadata..."
```

**After:**
```typescript
const errorMessage = sanitizeErrorMessage(
  `Missing supabase_user_id in customer ${customer.id} metadata - cannot link customer to user`
);
throw new Error(errorMessage);
// Logs: "Missing supabase_user_id in customer cus_a1b2c3d4 metadata..."
```

**Mapping Stored:**
```json
{
  "redacted_id": "cus_a1b2c3d4",
  "original_id": "cus_Pq9vN8tJ2KlMnO",
  "created_at": "2025-01-15T10:30:00Z",
  "expires_at": "2025-04-15T10:30:00Z"
}
```

## 📊 **Definition of Done**

- [ ] `sanitizeErrorMessage()` function implemented
- [ ] `sanitizeError()` function for error objects
- [ ] All Stripe ID types covered (cus_, sub_, cs_, etc.)
- [ ] Webhook error messages sanitized before logging
- [ ] Sentry errors sanitized before capture
- [ ] Stripe ID mapping table created
- [ ] Admin debug tool for reverse lookup
- [ ] Mappings auto-expire after 90 days
- [ ] Unit tests for sanitization
- [ ] Manual verification: logs show redacted IDs

## 🧪 **Testing Requirements**

```typescript:lib/logging.test.ts
import { sanitizeErrorMessage, redactStripeId } from './logging';

describe('Stripe ID Sanitization', () => {
  beforeAll(() => {
    process.env.LOG_REDACTION_SECRET = 'test-secret';
  });

  test('should redact customer ID', () => {
    const redacted = redactStripeId('cus_abc123xyz');
    expect(redacted).toMatch(/^cus_[a-f0-9]{8}$/);
    expect(redacted).not.toContain('abc123');
  });

  test('should sanitize error message with customer ID', () => {
    const message = 'Customer cus_abc123 not found';
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).toMatch(/Customer cus_[a-f0-9]{8} not found/);
    expect(sanitized).not.toContain('abc123');
  });

  test('should sanitize multiple Stripe IDs', () => {
    const message = 'User has customer cus_abc123 with subscription sub_xyz789';
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).toMatch(/cus_[a-f0-9]{8}/);
    expect(sanitized).toMatch(/sub_[a-f0-9]{8}/);
    expect(sanitized).not.toContain('abc123');
    expect(sanitized).not.toContain('xyz789');
  });

  test('should preserve non-Stripe text', () => {
    const message = 'Error processing payment for customer cus_abc123';
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).toContain('Error processing payment');
    expect(sanitized).toContain('for customer');
  });

  test('should handle messages with no Stripe IDs', () => {
    const message = 'Database connection failed';
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).toBe(message);
  });
});
```

## 🚫 **Out of Scope**

- Redacting Stripe IDs in production database (only logs)
- Encrypting webhook event data in database
- Real-time decryption of logs (admin tool only)
- Retroactive sanitization of old logs
- Redaction of other third-party IDs (only Stripe)

## 📝 **Notes**

**Why Redact Stripe IDs?**
- Correlation risk: Can link logs → Stripe → user
- GDPR compliance: Personal data must be pseudonymized
- Defense in depth: Even if logs leak, IDs are useless

**Why Store Mapping?**
- Admin debugging: Need to look up original ID
- Temporary: Auto-expire after 90 days
- Secure: RLS ensures only admins can access

**Why Auto-Detect?**
- Developer ergonomics: Don't have to manually redact
- Consistency: All Stripe IDs automatically sanitized
- Safety: Hard to forget to redact

**Stripe ID Prefixes:**
- `cus_` - Customer
- `cs_` - Checkout Session
- `sub_` - Subscription
- `price_` - Price
- `in_` - Invoice
- `pi_` - Payment Intent
- `ch_` - Charge
- `pm_` - Payment Method
- `si_` - Setup Intent

**Related Tickets:**
- Ticket #0035: Enhance PII Redaction with HMAC (dependency)
- Ticket #0036: Sentry PII Cleanup (complementary)

## 🏷️ **Labels**

- `priority: medium`
- `type: security`
- `component: logging`
- `gdpr-compliance`
- `pii-protection`
- `dependencies: #0035`
