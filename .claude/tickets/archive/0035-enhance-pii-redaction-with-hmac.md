# 0035 - Enhance PII Redaction with Cryptographic HMAC

## 🎯 **Description**

Replace simple truncation-based PII redaction with cryptographically secure HMAC hashing to prevent potential reversibility attacks and ensure GDPR compliance with proper pseudonymization.

## 📋 **User Story**

As a platform owner, I want user IDs to be pseudonymized using cryptographic hashing so that even if logs are compromised, attackers cannot reverse-engineer the original user IDs.

## 🔧 **Technical Context**

**Current Implementation (WEAK):**
```typescript
// lib/logging.ts - Current approach
export function redactUserId(userId: string): string {
  const truncated = userId.replace(/-/g, "").slice(0, 8);
  return `user_${truncated}`;
}
```

**Problems:**
- ❌ **Not cryptographically secure** - Simple truncation, not hashing
- ❌ **Potentially reversible** - Attacker with database access could hash all UUIDs and match first 8 chars
- ❌ **No secret key** - Deterministic but not secure
- ❌ **Shallow redaction** - `redactObject()` doesn't handle nested objects or arrays

**Security Impact:** 🟡 **MEDIUM-HIGH**
- If logs leak, attackers could potentially correlate truncated IDs with database UUIDs
- GDPR Article 32 requires "appropriate technical measures" - simple truncation may not qualify
- No defense against rainbow tables or brute force matching

**GDPR Compliance:**
> Article 32: "Pseudonymisation and encryption of personal data" requires appropriate technical measures. HMAC with a secret key is industry standard for pseudonymization.

## ✅ **Acceptance Criteria**

- [ ] PII redaction uses HMAC-SHA256 with secret key
- [ ] Secret key stored in environment variable `LOG_REDACTION_SECRET`
- [ ] Redacted values are deterministic (same input → same output)
- [ ] Redacted values are non-reversible without the secret key
- [ ] Increased entropy (12+ characters instead of 8)
- [ ] `redactObject()` handles nested objects and arrays recursively
- [ ] `redactObject()` handles arrays of objects
- [ ] Backward compatibility: existing log queries still work
- [ ] Documentation of redaction approach in code comments

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Enhanced HMAC-based Redaction**

```typescript:lib/logging.ts
import crypto from 'crypto';

/**
 * Redact user ID using HMAC for cryptographically secure pseudonymization
 *
 * Uses HMAC-SHA256 with a secret key to create deterministic but non-reversible hashes.
 * Complies with GDPR Article 32 pseudonymization requirements.
 *
 * @param userId - UUID to redact
 * @returns Redacted user ID (e.g., "user_a1b2c3d4e5f6")
 *
 * Security: HMAC prevents rainbow table attacks and brute force matching.
 * Even with database access, attacker cannot reverse without LOG_REDACTION_SECRET.
 */
export function redactUserId(userId: string | null | undefined): string {
  if (!userId) return "user_unknown";

  // Get secret from environment (required for production)
  const secret = process.env.LOG_REDACTION_SECRET;

  if (!secret) {
    // Development fallback - log warning
    console.warn("⚠️ LOG_REDACTION_SECRET not set - using default (INSECURE)");
    // Use a default for dev, but this should never happen in production
    const defaultSecret = "dev-only-insecure-default-change-in-production";
    const hmac = crypto.createHmac('sha256', defaultSecret)
      .update(userId)
      .digest('hex')
      .slice(0, 12);
    return `user_${hmac}`;
  }

  // Production: Use environment secret
  const hmac = crypto.createHmac('sha256', secret)
    .update(userId)
    .digest('hex')
    .slice(0, 12); // 12 hex chars = 48 bits of entropy

  return `user_${hmac}`;
}

/**
 * Redact email using HMAC for the local part, keep domain
 *
 * @example
 * redactEmail("john.doe@example.com") → "user_a1b2c3d4@example.com"
 */
export function redactEmail(email: string | null | undefined): string {
  if (!email) return "***@unknown";

  const atIndex = email.indexOf("@");
  if (atIndex === -1) return "***@invalid";

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  const secret = process.env.LOG_REDACTION_SECRET || "dev-only-insecure-default";
  const hmac = crypto.createHmac('sha256', secret)
    .update(localPart)
    .digest('hex')
    .slice(0, 8);

  return `user_${hmac}@${domain}`;
}

/**
 * Recursively redact PII from nested objects and arrays
 *
 * @param obj - Object to redact (can contain nested objects/arrays)
 * @returns Redacted copy of the object
 */
export function redactObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (obj === null || obj === undefined) return obj;

  const redacted: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Handle nested objects recursively
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactObject(value);
      continue;
    }

    // Handle arrays recursively
    if (Array.isArray(value)) {
      redacted[key] = value.map(item =>
        typeof item === 'object' ? redactObject(item) : item
      );
      continue;
    }

    // Redact user ID fields
    if (
      lowerKey.includes("userid") ||
      lowerKey === "id" ||
      lowerKey.includes("user_id")
    ) {
      if (typeof value === "string" && isUUID(value)) {
        redacted[key] = redactUserId(value);
        continue;
      }
    }

    // Redact email fields
    if (lowerKey.includes("email")) {
      if (typeof value === "string") {
        redacted[key] = redactEmail(value);
        continue;
      }
    }

    // Redact customer ID fields
    if (lowerKey.includes("customer")) {
      if (typeof value === "string" && value.startsWith("cus_")) {
        redacted[key] = redactCustomerId(value);
        continue;
      }
    }

    // Keep other values as-is
    redacted[key] = value;
  }

  return redacted;
}
```

**2. Environment Variable Configuration**

```bash:.env.example
# PII Redaction Secret (REQUIRED for production)
# Generate with: openssl rand -base64 32
# NEVER commit the real secret to git
LOG_REDACTION_SECRET=your-secret-key-here
```

**3. Secret Key Generation Script**

```bash:scripts/generate-redaction-secret.sh
#!/bin/bash
# Generate a secure random secret for LOG_REDACTION_SECRET

echo "Generating LOG_REDACTION_SECRET..."
SECRET=$(openssl rand -base64 32)
echo ""
echo "Add this to your .env.local file:"
echo "LOG_REDACTION_SECRET=${SECRET}"
echo ""
echo "⚠️ NEVER commit this secret to git!"
```

**4. Update Reconciliation DriftIssue Type**

```typescript:lib/reconciliation/stripe-reconciliation.ts
type DriftIssue = {
  userId: string; // ✅ Keep for internal processing
  field: string;
  database_value: any;
  stripe_value: any;
  severity: "low" | "medium" | "high";
  action: "auto_fixed" | "manual_review" | "error";
  error?: string;
};

// When logging to console or Sentry, redact first:
function sendReconciliationAlert(result: ReconciliationResult) {
  const criticalIssues = result.issues.filter(
    (i) => i.action === "manual_review"
  );

  // ✅ Redact before logging
  const redactedIssues = criticalIssues.map(issue => ({
    ...issue,
    userId: redactUserId(issue.userId),
  }));

  console.error("🚨 CRITICAL: Billing drift requires manual review", {
    total_drift: result.drift_detected,
    auto_fixed: result.auto_fixed,
    manual_review: result.manual_review,
    errors: result.errors,
    critical_issues: redactedIssues, // ✅ Redacted
  });
}
```

### **Dependencies**

- Node.js `crypto` module (built-in)
- Environment variable management (`.env.local`, Vercel environment)

### **Integration Points**

- All files currently using `redactUserId()` (no changes needed, just improved implementation)
- Sentry context objects
- Reconciliation alerting
- Admin alerts

## 🔍 **Implementation Notes**

### **Why HMAC over Simple Hashing?**

**HMAC (Hash-based Message Authentication Code):**
- ✅ Uses secret key (attacker needs key + log to reverse)
- ✅ Resistant to rainbow tables
- ✅ Industry standard for pseudonymization
- ✅ Deterministic (same input → same output for correlation)

**Simple SHA-256:**
- ❌ No secret key (attacker with database can hash all UUIDs and match)
- ❌ Vulnerable to rainbow tables
- ❌ Not recommended for PII pseudonymization

### **Entropy Calculation**

**Current (8 hex chars):**
- 8 hex chars = 32 bits of entropy
- 2^32 = 4.3 billion possible values
- **Risk:** With 100k users, collision probability ≈ 0.001% (acceptable but not ideal)

**Proposed (12 hex chars):**
- 12 hex chars = 48 bits of entropy
- 2^48 = 281 trillion possible values
- **Risk:** With 1M users, collision probability ≈ 0.0000000001% (negligible)

### **Secret Key Management**

**Development:**
- Use `.env.local` (gitignored)
- Warn if not set (fall back to insecure default)

**Production (Vercel):**
- Store in Vercel environment variables
- Different secret per environment (dev, staging, prod)
- Rotate annually or on suspected compromise

**Key Rotation Strategy:**
If secret is compromised:
1. Generate new secret
2. Deploy with new secret
3. Old logs remain pseudonymized with old secret (acceptable)
4. New logs use new secret (correlation across rotation boundary is broken, but that's okay)

### **Backward Compatibility**

**Existing log queries:**
- Queries like `grep "user_550e8400"` will stop working
- New format: `grep "user_a1b2c3d4e5f6"`
- **Mitigation:** Document this in deployment notes

**Dashboard queries:**
- Update any log aggregation queries to expect new format
- Consider keeping both formats during transition period

## 📊 **Definition of Done**

- [ ] `lib/logging.ts` updated with HMAC-based redaction
- [ ] `LOG_REDACTION_SECRET` added to `.env.example`
- [ ] Secret generation script created in `scripts/`
- [ ] `redactObject()` handles nested objects recursively
- [ ] `redactObject()` handles arrays of objects
- [ ] Reconciliation alerts redact userIds before logging
- [ ] Environment variable documented in README
- [ ] Vercel environment variables updated
- [ ] All existing tests pass (no breaking changes)
- [ ] Manual verification: logs show new format (12 chars instead of 8)

## 🧪 **Testing Requirements**

### **Unit Tests**

```typescript:lib/logging.test.ts
import { redactUserId, redactEmail, redactObject } from './logging';

describe('HMAC-based PII Redaction', () => {
  // Set test secret
  beforeAll(() => {
    process.env.LOG_REDACTION_SECRET = 'test-secret-key';
  });

  test('should redact user ID with HMAC', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const redacted = redactUserId(userId);

    expect(redacted).toMatch(/^user_[a-f0-9]{12}$/);
    expect(redacted).not.toContain(userId);
    expect(redacted.length).toBe(17); // "user_" + 12 hex chars
  });

  test('should be deterministic', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const redacted1 = redactUserId(userId);
    const redacted2 = redactUserId(userId);

    expect(redacted1).toBe(redacted2);
  });

  test('should produce different outputs for different inputs', () => {
    const userId1 = '550e8400-e29b-41d4-a716-446655440000';
    const userId2 = '660e8400-e29b-41d4-a716-446655440001';

    const redacted1 = redactUserId(userId1);
    const redacted2 = redactUserId(userId2);

    expect(redacted1).not.toBe(redacted2);
  });

  test('should handle nested objects', () => {
    const obj = {
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
      },
      metadata: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
      }
    };

    const redacted = redactObject(obj);

    expect(redacted.user.id).toMatch(/^user_[a-f0-9]{12}$/);
    expect(redacted.user.email).toMatch(/^user_[a-f0-9]{8}@example\.com$/);
    expect(redacted.metadata.userId).toMatch(/^user_[a-f0-9]{12}$/);
  });

  test('should handle arrays of objects', () => {
    const obj = {
      issues: [
        { userId: '550e8400-e29b-41d4-a716-446655440000' },
        { userId: '660e8400-e29b-41d4-a716-446655440001' },
      ]
    };

    const redacted = redactObject(obj);

    expect(redacted.issues[0].userId).toMatch(/^user_[a-f0-9]{12}$/);
    expect(redacted.issues[1].userId).toMatch(/^user_[a-f0-9]{12}$/);
  });

  test('should warn if secret not set', () => {
    delete process.env.LOG_REDACTION_SECRET;
    const consoleWarn = jest.spyOn(console, 'warn');

    redactUserId('550e8400-e29b-41d4-a716-446655440000');

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('LOG_REDACTION_SECRET not set')
    );
  });
});
```

### **Manual Testing**

```bash
# 1. Generate secret
./scripts/generate-redaction-secret.sh

# 2. Add to .env.local
echo "LOG_REDACTION_SECRET=<generated-secret>" >> .env.local

# 3. Start dev server
pnpm dev

# 4. Trigger a webhook (use Stripe CLI)
stripe trigger checkout.session.completed

# 5. Check logs for redacted format
# Should see: "user_a1b2c3d4e5f6" (12 chars)
# NOT: "user_550e8400" (8 chars)
```

## 🚫 **Out of Scope**

- Encrypting logs at rest (infrastructure concern)
- Retroactive re-redaction of old logs
- Key rotation automation (manual process acceptable)
- Log retention policies (separate ticket)
- Client-side PII redaction (only server-side)
- Database field encryption (separate concern)

## 📝 **Notes**

**OWASP Recommendations:**
> "When logging user identifiers, use HMAC or other keyed hashing to prevent correlation attacks even if logs are compromised."

**Industry Examples:**

**GitHub:**
- Uses HMAC for pseudonymization in logs
- Rotates secrets quarterly
- Documents approach in security whitepaper

**Stripe:**
- Uses HMAC for customer ID pseudonymization in audit logs
- Never logs full email addresses
- Provides API for log redaction verification

**AWS CloudTrail:**
- Supports customer-managed encryption keys
- Recommends HMAC for PII pseudonymization
- Provides compliance validation tools

**Related Tickets:**
- Ticket #0024: Remove PII from Logs (completed)
- Ticket #0036: Add Stripe ID Redaction to Sentry Context (new)

**Security Resources:**
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) - Digital Identity Guidelines
- [GDPR Article 32](https://gdpr-info.eu/art-32-gdpr/) - Security of Processing

## 🏷️ **Labels**

- `priority: high`
- `type: security`
- `component: logging`
- `gdpr-compliance`
- `pii-protection`
- `cryptography`
- `technical-debt`
