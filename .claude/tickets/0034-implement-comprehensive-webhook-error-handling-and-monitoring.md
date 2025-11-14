# 0034 - Implement Comprehensive Webhook Error Handling and Monitoring System

## 🎯 **Description**

Fix critical webhook error handling issues where users pay for subscriptions but don't receive access due to silent failures. Currently, webhook errors are logged but return void, causing the handler to fall through to a 200 (success) response. This prevents Stripe from retrying failed webhooks, resulting in permanent data loss and paying users without access.

Implement a complete monitoring, alerting, and recovery system to ensure zero revenue loss and excellent user experience.

## 📋 **User Story**

**As a paying customer**, I want my subscription to be activated immediately after payment so that I can access premium features without delays or manual intervention.

**As a business owner**, I want to be immediately notified when webhooks fail so that I can manually recover revenue and maintain customer trust.

**As a developer**, I want comprehensive monitoring and observability so that I can debug webhook issues and improve system reliability.

## 🔧 **Technical Context**

### Current Problem

The webhook handler in `app/api/stripe/webhook/route.ts` has a critical architectural flaw:

```typescript
// ❌ CURRENT (BROKEN)
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("Missing userId in metadata");
    return; // ❌ Returns void, falls through to 200 success!
  }

  // ... rest of handler
}

// In main POST handler:
await handleCheckoutCompleted(session); // ✅ No error thrown
return NextResponse.json({ received: true }, { status: 200 }); // ❌ Stripe thinks it succeeded!
```

**Result:** Stripe receives HTTP 200, marks webhook as delivered, never retries. User paid but has no access.

### Impact

- **Revenue at Risk**: Users pay but don't get access (unknown quantity - not tracked)
- **Customer Trust**: Users think the system is broken
- **No Visibility**: Admins don't know failures are happening
- **Manual Recovery**: Requires direct database edits to fix
- **False Success Page**: Users see "Welcome to Premium!" even when webhook failed

### Root Cause

30+ early returns in webhook handlers that should throw errors but return void instead.

## ✅ **Acceptance Criteria**

### Core Webhook Fixes
- [ ] All early returns in webhook handlers throw errors (not return void)
- [ ] Webhook failures return HTTP 500 (triggers Stripe retry)
- [ ] Webhook successes return HTTP 200
- [ ] All failures recorded in `webhook_events` table with retry count
- [ ] `getUserIdOrThrow` helper created with customer table fallback

### Monitoring & Alerting
- [ ] PostHog server-side tracking integrated for all webhook events
- [ ] Admin email alerts sent after 3 failed webhook attempts
- [ ] Slack notifications sent for critical failures (optional but recommended)
- [ ] Console logs include high-visibility formatting for critical failures

### User Experience
- [ ] Success page polls webhook status API (not JWT claims)
- [ ] Four distinct UI states: loading, success, delayed, failed
- [ ] No false "success" messages when webhook hasn't processed
- [ ] Clear user guidance with support contact email (sebastiansole@handicappin.com)
- [ ] "Check Again" button for delayed state

### Manual Recovery
- [ ] Admin API endpoint to manually grant access (`POST /api/admin/grant-access`)
- [ ] Verifies payment in Stripe before granting access
- [ ] Logs admin actions for audit trail
- [ ] Returns clear error if payment not confirmed

### Documentation
- [ ] Production readiness checklist created
- [ ] PostHog setup guide created (Product Analytics only)
- [ ] Testing scripts provided (Stripe CLI)
- [ ] Emergency runbook created

## 🚨 **Technical Requirements**

### Implementation Details

#### 1. Fix Webhook Error Handling

**File:** `app/api/stripe/webhook/route.ts`

**Create helper function:**

```typescript
/**
 * Attempts to get userId from metadata, falls back to customer lookup
 * @throws Error if userId cannot be determined
 */
async function getUserIdOrThrow(
  metadata: Record<string, any> | undefined,
  customerId: string | null | undefined,
  context: string
): Promise<string> {
  // First, try metadata
  const userId = metadata?.supabase_user_id;
  if (userId) {
    return userId;
  }

  // If no metadata and no customer, throw
  if (!customerId) {
    throw new Error(
      `Missing supabase_user_id in metadata and no customer ID available (${context})`
    );
  }

  // Try to lookup user from customer table
  const customerRecord = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId as string))
    .limit(1);

  if (customerRecord.length === 0) {
    throw new Error(
      `No user found for customer ${customerId} (${context})`
    );
  }

  const recoveredUserId = customerRecord[0].userId;
  logWebhookInfo(`✅ Recovered userId from customer table: ${recoveredUserId}`);
  return recoveredUserId;
}
```

**Update all handlers to throw instead of return:**

```typescript
// ✅ NEW (FIXED)
async function handleCheckoutCompleted(session: any) {
  const userId = await getUserIdOrThrow(
    session.metadata,
    session.customer,
    "handleCheckoutCompleted"
  ); // Throws if missing

  // ... rest of handler
}
```

**Replace early returns with throws in:**
- `handleCustomerCreated` - Missing userId
- `handleCheckoutCompleted` - Missing userId, subscriptionId, priceId
- `handleInvoicePaymentFailed` - Missing userId, subscriptionId
- `handleChargeRefunded` - Missing userId, customerId
- `handleDisputeCreated` - Missing userId, customerId
- `handleSubscriptionChange` - Missing userId, priceId
- `handleSubscriptionDeleted` - Missing userId

**Update error handler to record failures:**

```typescript
} catch (error) {
  // Record processing failure
  if (event?.id) {
    const userId = extractUserId(event);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Get retry count
    const existingEvent = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);

    const retryCount = existingEvent.length > 0
      ? (existingEvent[0].retryCount || 0) + 1
      : 1;

    await db.insert(webhookEvents).values({
      eventId: event.id,
      eventType: event.type,
      status: "failed",
      errorMessage: errorMessage,
      retryCount: retryCount,
      userId: userId,
    }).onConflictDoUpdate({
      target: webhookEvents.eventId,
      set: {
        retryCount: sql`${webhookEvents.retryCount} + 1`,
        errorMessage: errorMessage,
        processedAt: sql`CURRENT_TIMESTAMP`,
      },
    });

    // Track in PostHog
    await trackWebhookFailure({...});

    // Alert admins if retry count >= 3
    if (shouldAlertAdmin(retryCount)) {
      await alertCriticalWebhookFailure({...});
    }
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

#### 2. PostHog Integration

**Create file:** `lib/posthog-server.ts`

```typescript
import { PostHog } from 'posthog-node';

const posthog = new PostHog(
  process.env.NEXT_PUBLIC_POSTHOG_KEY!,
  {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  }
);

export async function trackWebhookSuccess(event: {
  eventId: string;
  eventType: string;
  userId: string;
}) {
  posthog.capture({
    distinctId: event.userId,
    event: 'webhook_success',
    properties: {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function trackWebhookFailure(event: {
  eventId: string;
  eventType: string;
  userId: string | null;
  errorMessage: string;
  retryCount: number;
  sessionId?: string;
  customerId?: string;
  subscriptionId?: string;
  severity: 'HIGH' | 'CRITICAL';
}) {
  posthog.capture({
    distinctId: event.userId || 'unknown',
    event: 'webhook_failure',
    properties: {
      ...event,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function shutdownPostHog() {
  await posthog.shutdown();
}
```

**Environment variables needed:**
```bash
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```

#### 3. Admin Alerting System

**Create file:** `lib/admin-alerts.ts`

```typescript
import { trackCriticalPaymentFailure } from './posthog-server';

export function shouldAlertAdmin(retryCount: number): boolean {
  return retryCount >= 3;
}

export async function alertCriticalWebhookFailure(failure: {
  userId: string;
  eventId: string;
  eventType: string;
  sessionId?: string;
  customerId?: string;
  subscriptionId?: string;
  errorMessage: string;
  retryCount: number;
  timestamp: Date;
}) {
  // 1. Track in PostHog as CRITICAL
  await trackCriticalPaymentFailure({...});

  // 2. Send email alert
  const adminEmails = process.env.ADMIN_ALERT_EMAILS?.split(',') || [];
  const emailBody = `
    🚨 CRITICAL: Webhook Failure - User Paid But No Access Granted

    User ID: ${failure.userId}
    Event Type: ${failure.eventType}
    Error: ${failure.errorMessage}
    Retry Count: ${failure.retryCount}

    Stripe Links:
    - Session: https://dashboard.stripe.com/checkout/sessions/${failure.sessionId}
    - Customer: https://dashboard.stripe.com/customers/${failure.customerId}

    Action Required: Use manual grant access API
  `;

  // Send via your email service (Resend, SendGrid, etc.)
  await fetch('/api/admin/send-alert', {
    method: 'POST',
    body: JSON.stringify({ to: adminEmails, subject: 'CRITICAL: Webhook Failure', body: emailBody }),
  });

  // 3. Send Slack alert (if configured)
  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({
        text: `🚨 CRITICAL: User ${failure.userId} paid but webhook failed ${failure.retryCount} times`,
      }),
    });
  }

  // 4. Console log with high visibility
  console.error('═══════════════════════════════════════════');
  console.error('🚨 CRITICAL: User paid but no access granted');
  console.error(`User ID: ${failure.userId}`);
  console.error(`Retry Count: ${failure.retryCount}`);
  console.error('═══════════════════════════════════════════');
}
```

#### 4. Webhook Status API

**Create file:** `app/api/billing/webhook-status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { webhookEvents, profile } from '@/db/schema';
import { createServerComponentClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  // Get user's current plan
  const userProfile = await db
    .select()
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);

  const currentPlan = userProfile[0]?.planSelected || 'free';

  // Check recent webhook events (last hour)
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentEvents = await db
    .select()
    .from(webhookEvents)
    .where(and(
      eq(webhookEvents.userId, userId),
      gte(webhookEvents.processedAt, oneHourAgo)
    ))
    .orderBy(desc(webhookEvents.processedAt));

  const recentFailures = recentEvents.filter(e => e.status === 'failed');
  const lastSuccess = recentEvents.find(e => e.status === 'success');

  // Determine status
  let status: 'processing' | 'success' | 'delayed' | 'failed';
  let message: string;

  if (currentPlan !== 'free' && lastSuccess) {
    status = 'success';
    message = 'Your subscription has been activated!';
  } else if (recentFailures.length >= 3) {
    status = 'failed';
    message = 'There was an issue activating your subscription. Our team has been notified.';
  } else if (recentFailures.length > 0) {
    status = 'delayed';
    message = 'Your payment was successful. It\'s taking longer than usual to activate.';
  } else {
    status = 'processing';
    message = 'Activating your subscription...';
  }

  return NextResponse.json({
    status,
    message,
    plan: currentPlan,
    failureCount: recentFailures.length,
    needsSupport: status === 'failed',
  });
}
```

#### 5. Improved Success Page

**Update file:** `app/billing/success/page.tsx`

Key changes:
- Poll webhook status API (not JWT claims)
- Show 4 states: loading, success, delayed, failed
- Include support email: sebastiansole@handicappin.com
- "Check Again" button for delayed state
- Clear error messaging with session ID

**Logic:**
1. Poll `/api/billing/webhook-status` every 2 seconds for up to 20 seconds
2. If `status === 'success'`: Show success, redirect to dashboard
3. If `status === 'failed'`: Show error with support contact
4. If `status === 'delayed'`: Show "Almost There" with "Check Again" button
5. If timeout: Show delayed state

#### 6. Manual Recovery API

**Create file:** `app/api/admin/grant-access/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerComponentClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  // 1. Verify admin auth
  const supabase = await createServerComponentClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();

  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Add admin role check

  // 2. Parse request
  const { userId, sessionId, reason } = await request.json();

  // 3. Verify payment in Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    return NextResponse.json(
      { error: 'Cannot grant access - payment not completed' },
      { status: 400 }
    );
  }

  // 4. Determine plan from line items
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
  const priceId = lineItems.data[0]?.price?.id;
  const plan = mapPriceToPlan(priceId);

  // 5. Update user's plan
  await db.update(profile).set({
    planSelected: plan,
    planSelectedAt: new Date(),
    subscriptionStatus: 'active',
    billingVersion: sql`billing_version + 1`,
  }).where(eq(profile.id, userId));

  // 6. Log admin action
  console.log('✅ Admin manually granted access', {
    userId,
    plan,
    adminEmail: adminUser.email,
    reason,
  });

  return NextResponse.json({ success: true });
}
```

### Dependencies

**NPM Packages:**
```bash
pnpm add posthog-node
```

**Existing packages (already installed):**
- `@supabase/ssr` (for Supabase client)
- `stripe` (for Stripe API)
- `drizzle-orm` (for database)

**Environment Variables:**
```bash
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
ADMIN_ALERT_EMAILS="sebastiansole@handicappin.com"
SLACK_WEBHOOK_URL="https://hooks.slack.com/..." # Optional
NEXT_PUBLIC_APP_URL="https://handicappin.com"
```

### Integration Points

1. **Stripe Webhook Endpoint** (`app/api/stripe/webhook/route.ts`)
   - Receives all Stripe events
   - Processes checkout, subscription, refund, dispute events
   - Records success/failure in database

2. **Database** (`webhook_events` table)
   - Stores all webhook processing attempts
   - Tracks retry counts for failures
   - Used by status API for user feedback

3. **PostHog** (External service)
   - Receives all webhook events (success + failure)
   - Provides dashboards and alerts
   - Helps debug issues

4. **Admin Alerts** (Email + Slack)
   - Triggered after 3 failed attempts
   - Includes all context needed for recovery
   - Links to Stripe dashboard and manual recovery API

5. **Success Page** (`app/billing/success/page.tsx`)
   - Polls webhook status API
   - Shows real-time feedback to user
   - Provides support contact if failed

## 🔍 **Implementation Notes**

### Critical Security Considerations

1. **Always verify payment before granting access**
   - Check `session.payment_status === 'paid'` in Stripe
   - Don't trust webhook data alone
   - Log all access grants for audit

2. **Admin API requires proper auth**
   - Verify admin role (not just logged in)
   - Log all manual access grants
   - Include reason for grant

3. **Rate limiting already in place**
   - Webhook endpoint has IP-based rate limiting
   - No changes needed

### Error Handling Patterns

**Good (throw error):**
```typescript
if (!userId) {
  throw new Error("Missing userId");
}
```

**Bad (return void):**
```typescript
if (!userId) {
  logWebhookError("Missing userId");
  return; // ❌ Falls through to 200 success
}
```

### Testing Strategy

Use Stripe CLI to test all scenarios:

**Test 1: Missing metadata (fallback recovery)**
```bash
stripe trigger checkout.session.completed \
  --override metadata='{}'
```
Expected: Uses customer table fallback, succeeds

**Test 2: Complete failure (3 retries)**
```bash
for i in {1..3}; do
  stripe trigger checkout.session.completed \
    --override metadata='{}' \
    --override customer=null
  sleep 2
done
```
Expected: 3 failures recorded, admin alert sent

**Test 3: Success flow**
```bash
stripe trigger checkout.session.completed
```
Expected: Success, user gets access

### Edge Cases

1. **Duplicate webhooks**: Already handled by `webhook_events.eventId` uniqueness check
2. **Missing customer ID**: Throws error, Stripe retries
3. **Unknown price ID**: Throws error, Stripe retries
4. **Database down**: Throws error, Stripe retries
5. **PostHog down**: Log error but don't fail webhook (tracked separately)

## 📊 **Definition of Done**

- [ ] All webhook handlers throw errors instead of returning void
- [ ] Webhook failures return HTTP 500, successes return HTTP 200
- [ ] PostHog tracking integrated and tested
- [ ] Admin alerts fire after 3 failures
- [ ] Success page shows accurate status (not false success)
- [ ] Manual recovery API works and logs admin actions
- [ ] Documentation complete (checklist, guide, runbook)
- [ ] All Stripe CLI test scripts pass
- [ ] Zero false positives (users see success only when webhook processed)
- [ ] Zero revenue loss (all failures captured and recoverable)

## 🧪 **Testing Requirements**

### Unit Tests (Manual Verification via Stripe CLI)

- [ ] Test missing userId metadata (should use customer fallback)
- [ ] Test missing customer ID (should throw error)
- [ ] Test unknown price ID (should throw error)
- [ ] Test duplicate webhook (should return 200, skip processing)
- [ ] Test successful checkout (should update plan)
- [ ] Test subscription change (should update plan)
- [ ] Test subscription deletion (should revert to free)

### Integration Tests

- [ ] Test complete payment flow (checkout → webhook → success page)
- [ ] Test delayed webhook (success page shows "Almost There")
- [ ] Test failed webhook (success page shows error + support contact)
- [ ] Test admin manual recovery (verify payment, grant access)
- [ ] Test PostHog event tracking (verify events appear in dashboard)
- [ ] Test admin alerts (verify email sent after 3 failures)

### End-to-End Tests

- [ ] Complete real checkout in test mode
- [ ] Verify webhook processes within 5 seconds
- [ ] Verify success page shows success and redirects
- [ ] Break webhook (temporarily), verify delayed UX works
- [ ] Verify admin alert fires after 3 failures
- [ ] Verify manual recovery grants access correctly

### Performance Tests

- [ ] Webhook processes in <1 second (typical)
- [ ] Database queries optimized (indexes on eventId, userId, processedAt)
- [ ] PostHog calls don't block webhook response
- [ ] Success page polling doesn't overload server (max 10 attempts)

## 🚫 **Out of Scope**

- Email notifications to users (separate ticket)
- Cleanup job for old webhook events (separate ticket)
- Admin dashboard UI (use Stripe + PostHog dashboards instead)
- Automatic refund on failure (requires manual review)
- Webhook replay functionality (use Stripe dashboard)
- Customer support chat integration (separate ticket)

## 📝 **Notes**

### PostHog Product Clarification

**Only enable:** Product Analytics (free tier)

**Do NOT enable:**
- Session Replay
- Feature Flags
- A/B Testing
- Surveys
- Error Tracking (nice to have but NOT required)
- Web Analytics (not needed for webhooks)

**Why Product Analytics only?**
- Tracks custom events (`webhook_success`, `webhook_failure`)
- Provides dashboards for monitoring
- Supports alerting
- Free tier = 1M events/month (plenty for webhook monitoring)

### Expected Costs

- **PostHog**: $0/month (free tier covers ~30k webhook events/month)
- **Development time**: ~8-12 hours
- **Testing time**: ~2-4 hours
- **Documentation**: Included in this ticket

### Success Metrics

**Before:**
- Webhook failure rate: Unknown
- User complaints: "I paid but don't have access"
- Recovery time: Hours (manual DB edits)
- Revenue at risk: Unknown

**After (Target):**
- Webhook success rate: >99%
- User complaints: ~0
- Recovery time: <5 minutes (manual grant API)
- Revenue at risk: $0 (all failures tracked and recoverable)

### Related Tickets

- #0029 - Implement admin dispute alerts (similar alerting pattern)
- #0032 - Fix paid-to-free downgrade flow (related to subscription changes)

### Reference Documentation

- Stripe Webhooks: https://stripe.com/docs/webhooks
- PostHog Server-Side: https://posthog.com/docs/libraries/node
- Supabase Server Client: https://supabase.com/docs/guides/auth/server-side

## 🏷️ **Labels**

- `priority: critical` - Revenue at risk, users paying but not getting access
- `type: bug` - Broken error handling causing data loss
- `type: feature` - New monitoring and recovery system
- `component: billing` - Stripe webhooks and payment processing
- `component: monitoring` - PostHog integration
- `component: ux` - Success page improvements
- `security: payment-verification` - Ensures payment confirmed before access
- `revenue-impact: high` - Directly affects ability to collect payment
