# 0026 - Implement Billing Audit Logger

## 🎯 **Description**

Create comprehensive audit logging for all billing-related database changes to detect unauthorized modifications, support forensic investigations, and meet compliance requirements (SOC 2, GDPR). Currently, there is no audit trail for profile table changes, making it impossible to detect or investigate database tampering, privilege escalation, or suspicious billing changes.

## 📋 **User Story**

As a platform owner, I want detailed audit logs of all billing changes so that I can detect unauthorized access, investigate security incidents, meet compliance requirements, and have a complete forensic trail for dispute resolution.

## 🔧 **Technical Context**

**Current State:**
- NO audit trail for profile table modifications ❌
- NO logging of who changed what, when ❌
- NO detection of suspicious billing patterns ❌
- NO forensic data for security investigations ❌

**Security Assessment Reference:**
- Lines 248-270 (security-assessment.md) - "Privilege Escalation Risks"
- Recommendation #1: "Add database audit logging for all profile table modifications"
- Recommendation #4: "Alert on suspicious changes (e.g., free → lifetime without Stripe event)"

**Attack Scenarios Without Audit Logging:**

**Scenario 1: SQL Injection**
```sql
-- Attacker exploits SQL injection
UPDATE profile SET
  plan_selected = 'lifetime',
  subscription_status = 'active'
WHERE id = 'attacker-id';

-- No audit trail exists ❌
-- Can't detect when it happened
-- Can't identify who did it
-- Can't see what changed
```

**Scenario 2: Compromised Admin Account**
```sql
-- Rogue admin grants free lifetime access to friends
UPDATE profile SET plan_selected = 'lifetime' WHERE email IN (
  'friend1@example.com',
  'friend2@example.com'
);

-- No audit trail ❌
-- Goes undetected for months
-- Significant revenue loss
```

**Scenario 3: Database Backup Manipulation**
```sql
-- Attacker modifies backup and restores it
-- Changes 1000 users from free to premium

-- No audit trail ❌
-- Can't determine what was changed
-- Can't roll back to correct state
```

**Compliance Requirements:**

**SOC 2 (Security Trust Principle):**
> "The entity maintains audit logs of system activities"

**GDPR Article 30 (Records of Processing):**
> "Controller shall maintain records of processing activities"

**CCPA:**
> "Businesses must maintain audit trails for data access/modification"

**Security Impact:** 🔴 **HIGH**
- Cannot detect unauthorized database modifications
- No forensic data for investigations
- Compliance violations (SOC 2, GDPR)
- No accountability for billing changes

## ✅ **Acceptance Criteria**

- [ ] Audit log table created for billing changes
- [ ] All profile table changes logged automatically
- [ ] Logs include: who, what, when, before/after values
- [ ] Webhook events logged with correlation to DB changes
- [ ] Stripe API calls logged (customer creation, subscription changes)
- [ ] Suspicious patterns detected and alerted
- [ ] Audit logs immutable (append-only)
- [ ] 90-day retention minimum for compliance
- [ ] Query interface for audit log investigation
- [ ] Manual testing: Modify profile, verify audit entry

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Create Audit Log Table**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_billing_audit_log.sql

CREATE TABLE billing_audit_log (
  id BIGSERIAL PRIMARY KEY,

  -- Event identification
  event_id UUID DEFAULT gen_random_uuid() NOT NULL,
  event_type TEXT NOT NULL, -- 'profile_update', 'webhook_received', 'api_call', 'manual_change'
  event_source TEXT NOT NULL, -- 'webhook', 'admin_api', 'user_api', 'direct_sql', 'reconciliation'

  -- Timing
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  -- Actor (who made the change)
  actor_id TEXT, -- User ID or 'system' for webhooks
  actor_type TEXT NOT NULL, -- 'user', 'admin', 'webhook', 'system', 'unknown'
  actor_ip_address INET,

  -- Target (what was changed)
  target_user_id TEXT NOT NULL,
  target_table TEXT DEFAULT 'profile' NOT NULL,
  target_record_id TEXT NOT NULL,

  -- Change details
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,

  -- Context
  stripe_event_id TEXT, -- Link to webhook event
  stripe_customer_id TEXT,
  metadata JSONB, -- Additional context

  -- Severity classification
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  flagged_as_suspicious BOOLEAN DEFAULT FALSE,

  -- Immutability protection
  checksum TEXT -- SHA-256 hash of row for tamper detection
);

-- Indexes for fast queries
CREATE INDEX idx_billing_audit_user ON billing_audit_log(target_user_id);
CREATE INDEX idx_billing_audit_created ON billing_audit_log(created_at DESC);
CREATE INDEX idx_billing_audit_severity ON billing_audit_log(severity) WHERE severity IN ('warning', 'critical');
CREATE INDEX idx_billing_audit_suspicious ON billing_audit_log(flagged_as_suspicious) WHERE flagged_as_suspicious = TRUE;
CREATE INDEX idx_billing_audit_field ON billing_audit_log(field_name);
CREATE INDEX idx_billing_audit_event_source ON billing_audit_log(event_source);

-- Prevent updates/deletes (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_log_changes
  BEFORE UPDATE OR DELETE ON billing_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- Add comment
COMMENT ON TABLE billing_audit_log IS
  'Immutable audit trail for all billing-related changes. Records who changed what, when, and why.';
```

**2. Create Audit Logger Service**

```typescript:lib/audit/billing-audit-logger.ts
import { db } from '@/db';
import { billingAuditLog } from '@/db/schema';
import crypto from 'crypto';

type AuditEventType =
  | 'profile_update'
  | 'webhook_received'
  | 'stripe_api_call'
  | 'manual_change'
  | 'reconciliation_fix';

type AuditEventSource =
  | 'webhook'
  | 'admin_api'
  | 'user_api'
  | 'direct_sql'
  | 'reconciliation'
  | 'cron_job';

type AuditActorType =
  | 'user'
  | 'admin'
  | 'webhook'
  | 'system'
  | 'unknown';

type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditLogEntry {
  eventType: AuditEventType;
  eventSource: AuditEventSource;
  actorId?: string;
  actorType: AuditActorType;
  actorIpAddress?: string;
  targetUserId: string;
  targetTable?: string;
  targetRecordId: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  stripeEventId?: string;
  stripeCustomerId?: string;
  metadata?: Record<string, any>;
  severity?: AuditSeverity;
}

/**
 * Main audit logger for billing changes
 */
export class BillingAuditLogger {
  /**
   * Log a billing-related change
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Determine severity if not provided
      const severity = entry.severity || this.determineSeverity(entry);

      // Check if change is suspicious
      const flaggedAsSuspicious = this.isSuspicious(entry);

      // Create checksum for tamper detection
      const checksum = this.createChecksum(entry);

      await db.insert(billingAuditLog).values({
        eventType: entry.eventType,
        eventSource: entry.eventSource,
        actorId: entry.actorId || 'system',
        actorType: entry.actorType,
        actorIpAddress: entry.actorIpAddress,
        targetUserId: entry.targetUserId,
        targetTable: entry.targetTable || 'profile',
        targetRecordId: entry.targetRecordId,
        fieldName: entry.fieldName,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        stripeEventId: entry.stripeEventId,
        stripeCustomerId: entry.stripeCustomerId,
        metadata: entry.metadata,
        severity,
        flaggedAsSuspicious,
        checksum,
      });

      // Alert on critical/suspicious changes
      if (severity === 'critical' || flaggedAsSuspicious) {
        await this.sendSecurityAlert(entry, severity, flaggedAsSuspicious);
      }
    } catch (error) {
      // NEVER fail the main operation due to audit logging
      console.error('❌ Audit logging failed:', error);
      console.error('Original audit entry:', entry);
    }
  }

  /**
   * Determine severity based on change type
   */
  private static determineSeverity(entry: AuditLogEntry): AuditSeverity {
    // Critical: Plan changes, status changes
    if (entry.fieldName === 'plan_selected' || entry.fieldName === 'subscription_status') {
      return 'critical';
    }

    // Warning: Billing metadata changes
    if (entry.fieldName.startsWith('billing_') || entry.fieldName.includes('stripe')) {
      return 'warning';
    }

    // Info: Everything else
    return 'info';
  }

  /**
   * Detect suspicious changes
   */
  private static isSuspicious(entry: AuditLogEntry): boolean {
    // Suspicious: Direct SQL changes (not via webhook/API)
    if (entry.eventSource === 'direct_sql') {
      return true;
    }

    // Suspicious: Free → Lifetime without webhook
    if (
      entry.fieldName === 'plan_selected' &&
      entry.oldValue === 'free' &&
      entry.newValue === 'lifetime' &&
      !entry.stripeEventId
    ) {
      return true;
    }

    // Suspicious: Status change without webhook
    if (
      entry.fieldName === 'subscription_status' &&
      entry.eventSource !== 'webhook' &&
      entry.eventSource !== 'reconciliation'
    ) {
      return true;
    }

    // Suspicious: Unknown actor making critical changes
    if (
      entry.actorType === 'unknown' &&
      (entry.fieldName === 'plan_selected' || entry.fieldName === 'subscription_status')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Create checksum for tamper detection
   */
  private static createChecksum(entry: AuditLogEntry): string {
    const data = JSON.stringify({
      eventType: entry.eventType,
      targetUserId: entry.targetUserId,
      fieldName: entry.fieldName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      timestamp: new Date().toISOString(),
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Send security alert for critical/suspicious changes
   */
  private static async sendSecurityAlert(
    entry: AuditLogEntry,
    severity: AuditSeverity,
    suspicious: boolean
  ): Promise<void> {
    console.error('🚨 SECURITY ALERT: Suspicious billing change detected', {
      severity,
      suspicious,
      eventType: entry.eventType,
      eventSource: entry.eventSource,
      actorType: entry.actorType,
      targetUserId: entry.targetUserId,
      fieldName: entry.fieldName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      stripeEventId: entry.stripeEventId,
    });

    // TODO: Send to alerting service (Slack, PagerDuty, email)
  }

  /**
   * Query audit logs for a user
   */
  static async getUserAuditLog(userId: string, limit = 100) {
    return await db
      .select()
      .from(billingAuditLog)
      .where(eq(billingAuditLog.targetUserId, userId))
      .orderBy(desc(billingAuditLog.createdAt))
      .limit(limit);
  }

  /**
   * Query suspicious changes
   */
  static async getSuspiciousChanges(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await db
      .select()
      .from(billingAuditLog)
      .where(
        and(
          eq(billingAuditLog.flaggedAsSuspicious, true),
          gte(billingAuditLog.createdAt, since)
        )
      )
      .orderBy(desc(billingAuditLog.createdAt));
  }
}

/**
 * Helper: Log profile field change
 */
export async function logProfileChange(
  userId: string,
  fieldName: string,
  oldValue: any,
  newValue: any,
  context: {
    eventSource: AuditEventSource;
    actorId?: string;
    actorType: AuditActorType;
    stripeEventId?: string;
    stripeCustomerId?: string;
    metadata?: Record<string, any>;
  }
) {
  await BillingAuditLogger.log({
    eventType: 'profile_update',
    targetUserId: userId,
    targetRecordId: userId,
    fieldName,
    oldValue: String(oldValue),
    newValue: String(newValue),
    ...context,
  });
}
```

**3. Update Drizzle Schema**

```typescript:db/schema.ts
export const billingAuditLog = pgTable("billing_audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  eventId: uuid("event_id").defaultRandom().notNull(),
  eventType: text("event_type").notNull(),
  eventSource: text("event_source").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  actorId: text("actor_id"),
  actorType: text("actor_type").notNull(),
  actorIpAddress: text("actor_ip_address"),
  targetUserId: text("target_user_id").notNull(),
  targetTable: text("target_table").default("profile").notNull(),
  targetRecordId: text("target_record_id").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  stripeEventId: text("stripe_event_id"),
  stripeCustomerId: text("stripe_customer_id"),
  metadata: jsonb("metadata"),
  severity: text("severity").notNull(),
  flaggedAsSuspicious: boolean("flagged_as_suspicious").default(false),
  checksum: text("checksum"),
});
```

**4. Integrate with Webhook Handlers**

```typescript:app/api/stripe/webhook/route.ts
import { logProfileChange } from '@/lib/audit/billing-audit-logger';

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;
  const customerId = session.customer;

  // ... existing logic ...

  if (plan) {
    // Get current plan before update
    const currentProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, userId))
      .limit(1);

    const oldPlan = currentProfile[0]?.planSelected || 'none';

    // Update profile
    await db.update(profile).set({
      planSelected: plan,
      planSelectedAt: new Date(),
      subscriptionStatus: 'active',
      billingVersion: sql`billing_version + 1`,
    }).where(eq(profile.id, userId));

    // ✅ NEW: Audit log
    await logProfileChange(
      userId,
      'plan_selected',
      oldPlan,
      plan,
      {
        eventSource: 'webhook',
        actorType: 'webhook',
        stripeEventId: session.id,
        stripeCustomerId: customerId,
        metadata: {
          checkoutSessionId: session.id,
          mode: session.mode,
          paymentStatus: session.payment_status,
        },
      }
    );

    logWebhookSuccess(`Updated plan_selected to '${plan}' for user: ${userId}`);
  }
}
```

**5. Add Admin Audit Log Viewer**

```typescript:app/api/admin/audit-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { BillingAuditLogger } from '@/lib/audit/billing-audit-logger';
import { createServerComponentClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Check admin role
  // if (!isAdmin(user.id)) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  const userId = request.nextUrl.searchParams.get('userId');
  const suspicious = request.nextUrl.searchParams.get('suspicious') === 'true';

  try {
    if (suspicious) {
      const logs = await BillingAuditLogger.getSuspiciousChanges(7);
      return NextResponse.json({ logs });
    }

    if (userId) {
      const logs = await BillingAuditLogger.getUserAuditLog(userId);
      return NextResponse.json({ logs });
    }

    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
```

**6. Database Trigger for Direct SQL Detection (Optional)**

```sql
-- Detect changes made outside webhook/API
CREATE OR REPLACE FUNCTION log_direct_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if change came from direct SQL (not via application)
  IF current_setting('application_name', true) NOT LIKE '%webhook%'
     AND current_setting('application_name', true) NOT LIKE '%api%' THEN

    INSERT INTO billing_audit_log (
      event_type,
      event_source,
      actor_type,
      target_user_id,
      target_record_id,
      field_name,
      old_value,
      new_value,
      severity,
      flagged_as_suspicious
    ) VALUES (
      'profile_update',
      'direct_sql',
      'unknown',
      NEW.id,
      NEW.id,
      'plan_selected',
      OLD.plan_selected,
      NEW.plan_selected,
      'critical',
      TRUE
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_direct_profile_changes
  AFTER UPDATE OF plan_selected, subscription_status ON profile
  FOR EACH ROW
  WHEN (OLD.plan_selected IS DISTINCT FROM NEW.plan_selected
        OR OLD.subscription_status IS DISTINCT FROM NEW.subscription_status)
  EXECUTE FUNCTION log_direct_profile_changes();
```

### **Dependencies**

- Database migration for `billing_audit_log` table
- `lib/audit/billing-audit-logger.ts` - New service
- `db/schema.ts` - Add audit log table definition
- All webhook handlers
- Reconciliation service
- Admin API for viewing logs

### **Integration Points**

- All profile table updates
- All webhook handlers
- Stripe API calls (optional)
- Reconciliation jobs
- Admin dashboard (future)

## 🔍 **Implementation Notes**

### **What to Audit:**

**Critical (Always Log):**
- `plan_selected` changes
- `subscription_status` changes
- `stripe_customer_id` changes
- Direct SQL modifications

**Important (Usually Log):**
- `billing_version` increments
- `current_period_end` changes
- `cancel_at_period_end` changes

**Optional (Log for completeness):**
- `rounds_used` changes (high volume)
- Other profile fields

### **Immutability Protection:**

**Why Audit Logs Must Be Immutable:**
- Attackers could delete evidence
- Compliance requires tamper-proof logs
- Forensic integrity depends on it

**How We Ensure Immutability:**
1. **Database trigger** prevents UPDATE/DELETE
2. **Checksum** detects tampering if trigger bypassed
3. **Append-only** table design
4. **Separate table** (not part of main schema)

### **Performance Considerations:**

**Impact:**
- Each profile change adds ~2ms for audit insert
- Negligible for webhook handlers (already async)
- Uses separate table (no locking profile table)

**Optimization:**
- Async logging (don't block main operation)
- Indexed queries for fast searches
- Partition table by date for large volumes

### **Retention Policy:**

**Compliance Requirements:**
- SOC 2: 1 year minimum
- GDPR: Varies by use case
- Internal: 90 days minimum

**Implementation:**
```sql
-- Delete logs older than 90 days
DELETE FROM billing_audit_log
WHERE created_at < NOW() - INTERVAL '90 days';
```

Run via cron monthly.

## 📊 **Definition of Done**

- [ ] `billing_audit_log` table created with immutability protection
- [ ] Audit logger service implemented
- [ ] Webhook handlers log all profile changes
- [ ] Reconciliation jobs log fixes
- [ ] Suspicious changes flagged automatically
- [ ] Critical changes trigger security alerts
- [ ] Admin API endpoint for viewing logs
- [ ] Database trigger for direct SQL detection (optional)
- [ ] 90-day retention policy configured
- [ ] Manual testing: Change plan, verify audit entry
- [ ] Manual testing: Attempt to delete audit log (should fail)

## 🧪 **Testing Requirements**

### **Integration Tests:**

```typescript
test('should log profile change from webhook', async () => {
  const userId = 'user-123';

  // Simulate webhook profile update
  await db.update(profile).set({
    planSelected: 'premium',
  }).where(eq(profile.id, userId));

  await logProfileChange(
    userId,
    'plan_selected',
    'free',
    'premium',
    {
      eventSource: 'webhook',
      actorType: 'webhook',
      stripeEventId: 'evt_123',
    }
  );

  // Verify audit log entry
  const logs = await db.select().from(billingAuditLog)
    .where(eq(billingAuditLog.targetUserId, userId));

  expect(logs.length).toBe(1);
  expect(logs[0].fieldName).toBe('plan_selected');
  expect(logs[0].oldValue).toBe('free');
  expect(logs[0].newValue).toBe('premium');
  expect(logs[0].eventSource).toBe('webhook');
});

test('should flag suspicious change', async () => {
  // Simulate direct SQL change (suspicious)
  await logProfileChange(
    'user-123',
    'plan_selected',
    'free',
    'lifetime',
    {
      eventSource: 'direct_sql',
      actorType: 'unknown',
    }
  );

  const logs = await BillingAuditLogger.getSuspiciousChanges(1);

  expect(logs.length).toBe(1);
  expect(logs[0].flaggedAsSuspicious).toBe(true);
  expect(logs[0].severity).toBe('critical');
});

test('should prevent audit log deletion', async () => {
  const log = await db.insert(billingAuditLog).values({
    eventType: 'profile_update',
    eventSource: 'webhook',
    actorType: 'webhook',
    targetUserId: 'user-123',
    targetRecordId: 'user-123',
    fieldName: 'plan_selected',
    oldValue: 'free',
    newValue: 'premium',
    severity: 'critical',
  }).returning();

  // Attempt to delete should throw error
  await expect(
    db.delete(billingAuditLog).where(eq(billingAuditLog.id, log[0].id))
  ).rejects.toThrow('Audit logs are immutable');
});
```

### **Manual Testing:**

```bash
# 1. Make a profile change via webhook
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Stripe-Signature: $SIG" \
  -d "$WEBHOOK_PAYLOAD"

# 2. Query audit logs
curl http://localhost:3000/api/admin/audit-logs?userId=user-123

# Should show audit entry with:
# - eventType: profile_update
# - eventSource: webhook
# - fieldName: plan_selected
# - oldValue/newValue
# - stripeEventId

# 3. Attempt direct SQL change
psql $DATABASE_URL -c "UPDATE profile SET plan_selected = 'lifetime' WHERE id = 'user-123';"

# 4. Check for suspicious flag
curl http://localhost:3000/api/admin/audit-logs?suspicious=true

# Should show flagged entry

# 5. Attempt to delete audit log (should fail)
psql $DATABASE_URL -c "DELETE FROM billing_audit_log WHERE id = 1;"
# Error: Audit logs are immutable and cannot be modified or deleted
```

## 🚫 **Out of Scope**

- Real-time audit log streaming (future feature)
- Audit log visualization dashboard
- Machine learning anomaly detection
- Audit log export to external systems (SIEM)
- Full database change data capture (CDC)
- Audit logs for non-billing tables

## 📝 **Notes**

**Why Audit Logging is Critical:**

1. **Security:** Detect unauthorized database access
2. **Compliance:** SOC 2, GDPR, CCPA requirements
3. **Forensics:** Investigate incidents after the fact
4. **Accountability:** Know who changed what, when
5. **Trust:** Demonstrate security posture to customers

**Industry Standards:**

**AWS CloudTrail:**
- Logs all API calls
- Immutable, tamper-proof
- Retention: 90 days default

**Google Cloud Audit Logs:**
- Admin activity logs (400 days)
- Data access logs (30 days)
- System event logs (400 days)

**Stripe's Audit Logs:**
- Logs all dashboard/API actions
- Immutable and searchable
- Used for compliance and forensics

**Real-World Examples:**

**Capital One Breach (2019):**
- Without proper audit logging, breach went undetected for months
- Audit logs would have shown unusual database access patterns

**Uber Data Breach (2016):**
- Attackers deleted audit logs to cover tracks
- Immutable audit logs would have prevented this

**Related Tickets:**
- Ticket #0025: Periodic Reconciliation (uses audit logs to track fixes)
- Ticket #0024: Remove PII from Logs (complementary security control)

## 🏷️ **Labels**

- `priority: high`
- `type: security`
- `component: audit`
- `component: compliance`
- `soc2`
- `gdpr`
- `forensics`
- `data-integrity`
