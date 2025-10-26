# 0024 - Remove PII from Logs

## 🎯 **Description**

Remove Personally Identifiable Information (PII) from application logs to comply with privacy regulations (GDPR, CCPA) and security best practices. Currently, user IDs, emails, and other sensitive data are logged in plaintext throughout the codebase, creating privacy risks and potential compliance violations.

## 📋 **User Story**

As a privacy-conscious platform owner, I want to ensure user data is not exposed in logs so that I comply with privacy regulations and protect user privacy even in the event of log access by unauthorized parties.

## 🔧 **Technical Context**

**Current PII Logging Examples:**

```typescript:app/api/stripe/checkout/route.ts
// Lines 36-39
console.log("Price ID:", priceId);
console.log("User ID:", user.id); // ❌ PII
console.log("User Email:", user.email); // ❌ PII
console.log("Plan:", plan);
```

```typescript:app/api/stripe/webhook/route.ts
// Throughout the file
logWebhookSuccess(`Checkout completed for user: ${userId}`); // ❌ PII
logWebhookSuccess(`Stripe customer created for user: ${userId}`); // ❌ PII
```

```typescript:utils/supabase/middleware.ts
// Lines 143-145
console.warn(
  `⚠️ Missing JWT claims for user ${user.id}, falling back to database` // ❌ PII
);
```

**Types of PII Being Logged:**
- User IDs (UUIDs) - Can be used to identify users
- Email addresses - Direct PII
- Stripe customer IDs - Can be linked to users
- Price IDs - Business logic exposure (minor)

**Security Assessment Reference:**
- Lines 492-505 (security-assessment.md)
- "Sensitive Data in Logs" - MEDIUM priority

**Compliance Impact:** 🟡 **MEDIUM-HIGH**
- **GDPR Article 32:** Requires "pseudonymization" of personal data
- **CCPA:** Requires "reasonable security" including log protection
- **SOC 2:** Logs must not contain unencrypted PII
- **PCI DSS:** (If storing cards) Logs must not contain cardholder data

**Security Impact:** 🟡 **MEDIUM**
- Log aggregation services (DataDog, Sentry) may see PII
- Server compromise exposes all historical PII
- Developer access to logs exposes user data
- Third-party log viewers see unredacted PII

## ✅ **Acceptance Criteria**

- [ ] Create utility function to redact/hash PII in logs
- [ ] Replace all user ID logs with hashed versions
- [ ] Replace all email logs with redacted versions
- [ ] Remove or redact Stripe customer IDs in logs
- [ ] Audit all `console.log`, `console.warn`, `console.error` statements
- [ ] Update logging library to auto-redact PII fields
- [ ] Document which fields should never be logged
- [ ] Add ESLint rule to catch PII in logs (optional)
- [ ] Manual audit: Search codebase for email/userId logging

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Create PII Redaction Utility**

```typescript:lib/logging.ts
import crypto from 'crypto';

/**
 * Hash a string to create a pseudonymized identifier
 * Same input always produces same hash (for correlation)
 * But hash cannot be reversed to original value
 */
export function hashPII(value: string): string {
  // Use first 8 chars of SHA-256 hash
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 8);
}

/**
 * Redact email address (show domain, hide local part)
 * Example: john.doe@example.com → ***@example.com
 */
export function redactEmail(email: string): string {
  const [, domain] = email.split('@');
  return `***@${domain || 'unknown'}`;
}

/**
 * Create a safe user identifier for logging
 * Uses hash of user ID for correlation without exposing actual ID
 */
export function safeUserId(userId: string): string {
  return `user_${hashPII(userId)}`;
}

/**
 * Safe logging wrapper that auto-redacts common PII fields
 */
export const safeLog = {
  info: (message: string, data?: Record<string, any>) => {
    console.log(message, sanitizeLogData(data));
  },
  warn: (message: string, data?: Record<string, any>) => {
    console.warn(message, sanitizeLogData(data));
  },
  error: (message: string, error?: any, data?: Record<string, any>) => {
    console.error(message, error, sanitizeLogData(data));
  },
};

/**
 * Sanitize log data by redacting known PII fields
 */
function sanitizeLogData(data?: Record<string, any>): Record<string, any> | undefined {
  if (!data) return data;

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Auto-redact common PII field names
      if (key.toLowerCase().includes('userid') || key === 'id') {
        sanitized[key] = safeUserId(value);
      } else if (key.toLowerCase().includes('email')) {
        sanitized[key] = redactEmail(value);
      } else if (key.toLowerCase().includes('customer')) {
        sanitized[key] = `cus_${hashPII(value)}`;
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
```

**2. Update Checkout Endpoint**

```typescript:app/api/stripe/checkout/route.ts
import { safeLog, safeUserId } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await request.json();

    // ✅ BEFORE (with PII):
    // console.log("User ID:", user.id);
    // console.log("User Email:", user.email);

    // ✅ AFTER (without PII):
    safeLog.info("Creating checkout session", {
      userId: user.id, // Auto-redacted by safeLog
      plan,
      priceId: PLAN_TO_PRICE_MAP[plan],
    });

    // ... rest of logic ...

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
```

**3. Update Webhook Handlers**

```typescript:app/api/stripe/webhook/route.ts
import { safeLog, safeUserId } from '@/lib/logging';

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("No supabase_user_id in checkout session metadata");
    return;
  }

  // ✅ BEFORE (with PII):
  // logWebhookSuccess(`Checkout completed for user: ${userId}`);

  // ✅ AFTER (without PII):
  logWebhookSuccess(`Checkout completed for user: ${safeUserId(userId)}`);

  // ... rest of handler ...
}

async function handleCustomerCreated(customer: any) {
  const userId = customer.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("No supabase_user_id in customer metadata");
    return;
  }

  try {
    await db.insert(stripeCustomers).values({
      userId,
      stripeCustomerId: customer.id,
    }).onConflictDoNothing();

    // ✅ AFTER (without PII):
    logWebhookSuccess(`Stripe customer created for user: ${safeUserId(userId)}`);
  } catch (error) {
    logWebhookError("Error creating stripe customer record", error);
  }
}
```

**4. Update Middleware**

```typescript:utils/supabase/middleware.ts
import { safeUserId } from '@/lib/logging';

if (!billing) {
  console.warn(
    // ✅ BEFORE (with PII):
    // `⚠️ Missing JWT claims for user ${user.id}, falling back to database`

    // ✅ AFTER (without PII):
    `⚠️ Missing JWT claims for user ${safeUserId(user.id)}, falling back to database`
  );

  // ... rest of logic ...
}
```

**5. Update Webhook Logger**

```typescript:lib/webhook-logger.ts
import { safeUserId } from './logging';

export function logWebhookSuccess(message: string, data?: Record<string, any>) {
  console.log(`✅ WEBHOOK SUCCESS: ${message}`, sanitizeWebhookData(data));
}

export function logWebhookError(message: string, error?: any) {
  console.error(`❌ WEBHOOK ERROR: ${message}`, error);
}

function sanitizeWebhookData(data?: Record<string, any>): Record<string, any> | undefined {
  if (!data) return data;

  // Apply PII redaction to webhook log data
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === 'userId' && typeof value === 'string') {
      sanitized[key] = safeUserId(value);
    } else if (key === 'sessionId' || key === 'customerId') {
      // Keep these as-is (not PII, needed for debugging)
      sanitized[key] = value;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
```

**6. Add ESLint Rule (Optional)**

```javascript:.eslintrc.js
module.exports = {
  rules: {
    // Custom rule to catch PII in logs
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.object.name="console"][callee.property.name=/log|warn|error/] MemberExpression[property.name="email"]',
        message: 'Do not log email addresses. Use redactEmail() instead.',
      },
      {
        selector: 'CallExpression[callee.object.name="console"][callee.property.name=/log|warn|error/] MemberExpression[property.name="id"]',
        message: 'Do not log user IDs directly. Use safeUserId() instead.',
      },
    ],
  },
};
```

### **PII Classification:**

| Data Type | Classification | Action |
|-----------|---------------|--------|
| User UUID | PII (identifier) | Hash with `safeUserId()` |
| Email | PII (direct) | Redact with `redactEmail()` |
| Stripe Customer ID | PII (linkable) | Hash or keep (needed for debugging) |
| Price ID | Business Data | Keep (not PII) |
| Plan Name | Business Data | Keep (not PII) |
| Session ID | System Data | Keep (not PII) |
| IP Address | PII (GDPR) | Redact or hash |

### **Dependencies**

- `crypto` (Node.js built-in) for hashing
- `lib/logging.ts` - New utility file
- All files with `console.log` statements

### **Integration Points**

- All API endpoints
- Webhook handlers
- Middleware
- Background jobs
- Error tracking services (Sentry, DataDog)

## 🔍 **Implementation Notes**

### **Hashing vs Redaction:**

**Hashing (Pseudonymization):**
```typescript
// Same user always gets same hash
hashPII("user-123") // → "a1b2c3d4"
hashPII("user-123") // → "a1b2c3d4" (consistent)

// Different users get different hashes
hashPII("user-456") // → "e5f6g7h8"
```

**Benefits:**
- Can correlate logs for same user
- Cannot reverse hash to original ID
- GDPR-compliant pseudonymization

**Redaction (Anonymization):**
```typescript
redactEmail("john@example.com") // → "***@example.com"
```

**Benefits:**
- Completely removes PII
- Shows useful context (domain)
- Simpler than hashing

**Recommendation:** Use hashing for user IDs (need correlation), redaction for emails (don't need correlation).

### **What to Log vs Not Log:**

**✅ Safe to Log:**
- Hashed user IDs
- Redacted emails
- Event types (subscription.created)
- Plan names (premium, unlimited)
- Error messages (generic)
- Request counts, durations

**❌ Never Log:**
- Raw user IDs (UUIDs)
- Full email addresses
- Payment card details
- API keys / secrets
- Passwords (obviously)
- Full session tokens

### **Logging Best Practices:**

1. **Structured Logging:** Use JSON format with consistent fields
2. **Log Levels:** Use appropriate levels (info, warn, error)
3. **Correlation IDs:** Use request IDs to trace requests (not user IDs)
4. **Sampling:** Don't log every request (use sampling for high-volume)
5. **Retention:** Delete logs after 30-90 days

## 📊 **Definition of Done**

- [ ] `lib/logging.ts` created with PII redaction utilities
- [ ] All checkout logs updated to use `safeUserId()`
- [ ] All webhook logs updated to redact PII
- [ ] Middleware logs updated to redact PII
- [ ] Email logging removed or redacted
- [ ] Codebase audit: Search for `user.id` and `user.email` in logs
- [ ] ESLint rule added to catch new PII logging (optional)
- [ ] Documentation: List of fields that should never be logged
- [ ] Manual testing: Verify logs don't contain raw user IDs

## 🧪 **Testing Requirements**

### **Manual Audit:**

```bash
# Search for potential PII in logs
grep -r "console.log.*user\.id" app/
grep -r "console.log.*user\.email" app/
grep -r "console.log.*userId" app/
grep -r "console\.log.*email" app/

# Should find zero matches after implementation
```

### **Log Output Verification:**

```typescript
// Before (with PII):
console.log("User ID:", "550e8400-e29b-41d4-a716-446655440000");
// Output: User ID: 550e8400-e29b-41d4-a716-446655440000 ❌

// After (without PII):
console.log("User:", safeUserId("550e8400-e29b-41d4-a716-446655440000"));
// Output: User: user_a1b2c3d4 ✅
```

### **Unit Tests:**

```typescript
import { hashPII, redactEmail, safeUserId } from '@/lib/logging';

test('should hash user ID consistently', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const hash1 = hashPII(userId);
  const hash2 = hashPII(userId);

  expect(hash1).toBe(hash2); // Same hash for same input
  expect(hash1).not.toBe(userId); // Hash != original
  expect(hash1).toHaveLength(8); // 8 chars
});

test('should redact email address', () => {
  expect(redactEmail('john.doe@example.com')).toBe('***@example.com');
  expect(redactEmail('admin@test.org')).toBe('***@test.org');
});

test('should create safe user ID', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const safe = safeUserId(userId);

  expect(safe).toMatch(/^user_[a-f0-9]{8}$/);
  expect(safe).not.toContain(userId);
});
```

## 🚫 **Out of Scope**

- Encryption of logs at rest (infrastructure concern)
- Log aggregation service configuration
- Centralized logging platform (Datadog, Splunk)
- Log retention policies (separate ticket)
- Error tracking service integration (Sentry redaction)
- Compliance audit/certification

## 📝 **Notes**

**GDPR Requirements (Article 32):**
> "Pseudonymisation and encryption of personal data"

**Pseudonymization Definition:**
> Processing personal data in such a way that it can no longer be attributed to a specific data subject without the use of additional information.

**Why Hashing is Compliant:**
- One-way function (cannot reverse)
- Deterministic (same input → same output)
- Allows correlation within logs
- Reduces GDPR scope (pseudonymous data has lighter requirements)

**Real-World Examples:**

**GitHub:**
- Logs request IDs, not user IDs
- Uses hashed identifiers for correlation

**Stripe:**
- Logs Stripe IDs (okay, because they're their domain)
- Redacts card numbers in logs
- Uses request IDs for tracing

**AWS:**
- Account IDs are okay (part of their system)
- Email addresses are redacted in CloudTrail

**Related Tickets:**
- None directly, but general security hygiene

**Compliance Resources:**
- [GDPR Article 32](https://gdpr-info.eu/art-32-gdpr/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [CIS Logging Best Practices](https://www.cisecurity.org/insights/blog/logging-best-practices)

## 🏷️ **Labels**

- `priority: medium`
- `type: compliance`
- `component: logging`
- `gdpr`
- `privacy`
- `pii`
- `security-hygiene`
