---
date: 2025-11-23T18:20:47+0000
git_commit: 5f06f5821a14fe3523cc20eb41714c24b27270a6
branch: feat/payments
repository: handicappin
topic: "Webhook Error Handling and Sentry Integration Status"
tags: [research, codebase, webhooks, sentry, monitoring, billing, payments]
status: complete
last_updated: 2025-11-23
---

# Research: Webhook Error Handling and Sentry Integration Status

**Date**: 2025-11-23T18:20:47+0000
**Git Commit**: 5f06f5821a14fe3523cc20eb41714c24b27270a6
**Branch**: feat/payments
**Repository**: handicappin

## Research Question

Research the current state of adding Sentry to payment APIs, and the state of `.claude/tickets/0034-implement-comprehensive-webhook-error-handling-and-monitoring.md`. Is it adequately implemented? Can we improve?

## Executive Summary

**Overall Assessment**: Ticket #0034 is **PARTIALLY IMPLEMENTED** (approximately 65% complete)

### What's Working Well:
- ✅ **Webhook error handling** is production-ready (throws errors, returns correct HTTP status codes)
- ✅ **Database tracking** of webhook events with retry counting
- ✅ **Success page polling** correctly checks API status (not JWT claims)
- ✅ **Sentry infrastructure** is fully configured with PII protection
- ✅ **Email infrastructure** exists (Resend) for user notifications
- ✅ **Admin alerts** send to Sentry after 3 webhook failures

### Critical Gaps:
- ❌ **Sentry NOT integrated** into webhook error handling (configured but unused)
- ❌ **Admin grant-access API** not implemented (empty directory)
- ❌ **Admin email alerts** not implemented (only Sentry)
- ❌ **PostHog** not implemented (but marked optional in ticket)
- ❌ **Admin authentication system** missing (no way to verify admin users)

## Detailed Findings

### 1. Webhook Error Handling Implementation

**File**: `app/api/stripe/webhook/route.ts` (1449 lines)
**Status**: ✅ **EXCELLENT** - Production-ready

#### Error Handling Pattern:
All webhook handlers **throw errors** (not return void) for critical failures:

```typescript
// Example from handleCheckoutCompleted (lines 327-330)
if (!userId) {
  throw new Error(
    `Missing supabase_user_id in checkout session ${session.id} - cannot grant access`
  );
}
```

#### HTTP Status Codes:
- **200**: Success or duplicate event already processed
- **400**: Client errors (invalid signature, missing signature)
- **429**: Rate limit exceeded
- **500**: Server errors (triggers Stripe retry)

#### Database Recording:
All webhook events recorded in `webhook_events` table with:
- Event ID (for idempotency)
- Event type
- Status (success/failed)
- Error message
- Retry count
- User ID

**Reference**: Lines 156-173 (success recording), 184-240 (failure recording)

#### Admin Alerting on Failure:
After 3 failed retry attempts, system calls `sendAdminWebhookAlert()` which:
- Logs to console with high-visibility formatting
- Sends to Sentry with `fatal` severity level
- Includes full context (userId, eventId, sessionId, customerId, etc.)

**Reference**: Lines 224-236 (webhook/route.ts), Lines 33-69 (lib/admin-alerts.ts)

### 2. Sentry Integration Status

**Status**: ⚠️ **CONFIGURED BUT NOT INTEGRATED IN WEBHOOKS**

#### Configuration Files (FULLY IMPLEMENTED):
- `sentry.server.config.ts` - Server-side configuration
- `sentry.edge.config.ts` - Edge runtime configuration
- `instrumentation.ts` - Server instrumentation
- `instrumentation-client.ts` - Client instrumentation
- `lib/sentry-utils.ts` - Centralized error capture with PII redaction

#### Sentry DSN:
```
https://9a6fb68c482da78fb51302d8388950f1@o4510365767303168.ingest.de.sentry.io/4510365768613968
```

#### PII Protection Features:
- Automatic redaction of emails, Stripe IDs
- Removes Authorization headers, cookies, IP addresses
- Message sanitization for customer/session/subscription IDs
- Custom fingerprinting for error grouping

#### Current Usage:
- ✅ Used in `lib/admin-alerts.ts` for webhook failure alerts (after 3 retries)
- ❌ **NOT used directly in webhook error handler** (`app/api/stripe/webhook/route.ts`)
- ✅ Available via `captureSentryError()` utility

#### Gap Identified:
The main webhook catch block (lines 242-247) does **NOT** call Sentry:

```typescript
// Current implementation (webhook/route.ts lines 242-247)
} catch (error) {
  logWebhookError("Webhook handler failed", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

**Missing**: No `captureSentryError()` call in main catch block

### 3. PostHog Integration Status

**Status**: ❌ **NOT IMPLEMENTED**

- No PostHog packages in `package.json`
- No PostHog configuration files found
- No `NEXT_PUBLIC_POSTHOG_KEY` in environment variables
- No `lib/posthog-server.ts` file exists

**Ticket Assessment**: PostHog was marked as optional in the ticket ("Product Analytics only, free tier"). The current Sentry-based monitoring may be sufficient.

### 4. Webhook Status API

**File**: `app/api/billing/webhook-status/route.ts`
**Status**: ✅ **FULLY IMPLEMENTED**

#### Functionality:
- Authenticates user via Supabase
- Queries `profile` table for current plan and subscription status
- Queries `webhook_events` table for recent events (last 5 minutes)
- Returns status: `processing`, `success`, `delayed`, or `failed`

#### Status Determination Logic:
```typescript
// Success: Plan updated, subscription active, webhook succeeded
if (currentPlan !== 'free' &&
    subscriptionStatus === 'active' &&
    lastSuccess) {
  status = 'success'
}

// Failed: 3+ webhook failures
if (recentFailures.length >= 3) {
  status = 'failed'
}

// Delayed: 1-2 webhook failures
if (recentFailures.length > 0 && recentFailures.length < 3) {
  status = 'delayed'
}

// Default: No plan update yet, no failures
else {
  status = 'processing'
}
```

**Reference**: Lines 54-81 (route.ts)

### 5. Billing Success Page

**File**: `app/billing/success/page.tsx`
**Status**: ✅ **FULLY IMPLEMENTED**

#### Polling Strategy:
- Polls `/api/billing/webhook-status` every 2 seconds
- Maximum 10 attempts (20 seconds total)
- Stops immediately on `success` or `failed` states

#### UI States (5 total):
1. **Loading**: Initial state before polling starts
2. **Processing**: During polling (shows attempt counter)
3. **Success**: Webhook completed, refreshes JWT session, redirects to dashboard
4. **Delayed**: Timeout or 1-2 webhook failures (shows "Check Again" button)
5. **Failed**: 3+ webhook failures (shows support email with session ID)

#### Session Refresh on Success:
```typescript
// Lines 92-100: Critical for JWT claim updates
await supabase.auth.refreshSession()
// Wait 1 second for middleware to pick up new claims
await new Promise(resolve => setTimeout(resolve, 1000))
router.push('/dashboard')
```

**Note**: Correctly polls API instead of reading JWT claims directly (per ticket requirements).

### 6. Admin Alert System

**File**: `lib/admin-alerts.ts`
**Status**: ⚠️ **PARTIALLY IMPLEMENTED**

#### What Works:
- ✅ `shouldAlertAdmin(retryCount)` - Returns true after 3 failures
- ✅ `sendAdminWebhookAlert()` - Sends to Sentry with full context
- ✅ High-visibility console logging
- ✅ PII redaction via `captureSentryError()`

#### What's Missing:
- ❌ **Email alerts** - Not implemented (infrastructure exists via Resend)
- ❌ **Slack webhooks** - Not implemented (no Slack integration)

#### Environment Variables:
```bash
# Current (in docs but not used)
ADMIN_ALERT_EMAILS="sebastiansole@handicappin.com"

# Not implemented
SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
```

### 7. Admin Recovery API

**Status**: ❌ **NOT IMPLEMENTED**

#### Planned Location:
`app/api/admin/grant-access/route.ts`

#### Current State:
- Directory exists: `app/api/admin/grant-access/`
- **Empty directory** (no `route.ts` file)

#### Planned Functionality (from ticket):
- Manual grant access after webhook failure
- Verify payment in Stripe before granting
- Accept: `userId`, `sessionId`, `reason`
- Update user plan in database
- Log admin action for audit trail

#### Blocker:
No **admin authentication system** exists. Ticket notes "TODO: Add admin role check" (line 450).

### 8. Email Notification System

**File**: `lib/email-service.ts`
**Status**: ✅ **USER EMAILS IMPLEMENTED** / ❌ **ADMIN EMAILS NOT IMPLEMENTED**

#### Provider:
Resend API (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)

#### Implemented Email Types:
- ✅ Welcome email (first-time subscriptions)
- ✅ Subscription upgraded
- ✅ Subscription downgraded
- ✅ Subscription cancelled

#### Missing:
- ❌ Admin webhook failure alerts
- ❌ Admin dispute notifications

**Infrastructure is available** - just needs wiring to admin alert system.

## Architecture Insights

### Error Handling Best Practices Found:
1. **Separation of concerns**: Critical errors throw, non-critical errors (email) are caught and logged
2. **Security-first**: Customer ownership verification prevents privilege escalation
3. **Graceful degradation**: Email/logging failures don't break core webhook flow
4. **Idempotency**: Duplicate events detected and skipped (lines 86-103)
5. **Comprehensive context**: Error messages include all IDs needed for debugging

### Database Schema Design:
The `webhook_events` table is well-designed:
- Primary key on `event_id` (Stripe's unique event ID)
- Retry count tracking for alerting logic
- Status field for quick filtering
- User ID for user-scoped queries
- Indexes on `eventType`, `userId`, `processedAt` for performance

**Reference**: `db/schema.ts` lines 378-404

### Security Measures:
1. **Webhook signature verification** (Stripe SDK)
2. **Rate limiting** (100 requests/min via Upstash Redis)
3. **Customer ownership verification** (prevents user A from claiming user B's payment)
4. **Payment amount verification** (prevents price manipulation)
5. **PII redaction** in logs and Sentry

## Historical Context (from experiences/)

### Key Learnings from Past Work:

#### 1. Webhook Race Conditions (File: `supabase-jwt-hooks-billing-claims-implementation.md`)
- **Discovery**: `customer.subscription.created` webhook can arrive before `checkout.session.completed`
- **Solution**: Always update plan in `checkout.session.completed` handler (don't wait for `subscription.created`)
- **Lesson**: Webhook order is NOT guaranteed

#### 2. JWT-Based Authorization Performance (File: Same as above)
- **Problem**: Middleware was making database queries on every request
- **Solution**: Custom JWT Access Token Hook injects billing claims into JWT
- **Impact**: 10x faster authorization (< 10ms vs 50-200ms)
- **Critical Discovery**: Supabase SDK doesn't expose custom claims - must manually decode JWT

#### 3. Lifetime Plan Access Bug (File: `billing-lifetime-plan-access-fix.md`)
- **Problem**: Lifetime plan users locked out despite payment
- **Root Cause**: Code treated lifetime plans as subscriptions (queried wrong Stripe API)
- **Solution**: Separate one-time payments from subscription verification
- **Lesson**: One-time payments ≠ Subscriptions (different Stripe objects, different webhooks)

#### 4. Missing Monitoring Gaps (File: `jwt-billing-implementation-code-review.md`)
- **Testing Score**: 3/10 - "Major gaps"
- **Missing**:
  - No alerts for JWT decode failures
  - No metrics on authorization failures
  - No structured logging (only console.error)
  - No admin dashboard for debugging
- **Recommendation**: Add Sentry for JWT failures, structured logging, metrics dashboard

## Code References

### Core Webhook Handler:
- `app/api/stripe/webhook/route.ts:1-1449` - Main webhook route
- `app/api/stripe/webhook/route.ts:254-309` - handleCustomerCreated
- `app/api/stripe/webhook/route.ts:314-773` - handleCheckoutCompleted
- `app/api/stripe/webhook/route.ts:1436-1448` - extractUserId helper

### Monitoring Infrastructure:
- `lib/admin-alerts.ts:1-91` - Admin alerting system
- `lib/webhook-logger.ts:1-131` - Centralized webhook logging
- `lib/sentry-utils.ts:1-156` - Sentry error capture with PII redaction
- `lib/logging.ts:1-117` - GDPR-compliant logging utilities

### Database Schema:
- `db/schema.ts:378-404` - webhook_events table definition
- `db/schema.ts:348-375` - stripe_customers table definition
- `supabase/migrations/20251026222551_previous_nighthawk.sql` - webhook_events SQL migration

### Success Page & Status API:
- `app/billing/success/page.tsx:1-302` - Billing success page with polling
- `app/api/billing/webhook-status/route.ts:1-108` - Webhook status API

### Email System:
- `lib/email-service.ts:1-323` - Resend email integration
- `emails/welcome.tsx` - Welcome email template
- `emails/subscription-upgraded.tsx` - Upgrade email template
- `emails/subscription-downgraded.tsx` - Downgrade email template
- `emails/subscription-cancelled.tsx` - Cancellation email template

### Security:
- `lib/stripe-security.ts:15-55` - verifyCustomerOwnership
- `lib/rate-limit.ts:1-102` - Upstash Redis rate limiting

## Ticket #0034 Implementation Checklist

### Core Webhook Fixes (100% Complete)
- ✅ All early returns in webhook handlers throw errors (not return void)
- ✅ Webhook failures return HTTP 500 (triggers Stripe retry)
- ✅ Webhook successes return HTTP 200
- ✅ All failures recorded in `webhook_events` table with retry count
- ⚠️ `getUserIdOrThrow` helper NOT created, but manual checks work well

### Monitoring & Alerting (40% Complete)
- ❌ PostHog server-side tracking NOT integrated (optional per ticket)
- ❌ Admin email alerts NOT sent after 3 failed webhook attempts
- ❌ Slack notifications NOT implemented (optional)
- ✅ Console logs include high-visibility formatting for critical failures
- ✅ Sentry configured but not called in main webhook catch block

### User Experience (100% Complete)
- ✅ Success page polls webhook status API (not JWT claims)
- ✅ Five distinct UI states: loading, processing, success, delayed, failed
- ✅ No false "success" messages when webhook hasn't processed
- ✅ Clear user guidance with support contact email (sebastiansole@handicappin.com)
- ✅ "Check Again" button for delayed state

### Manual Recovery (0% Complete)
- ❌ Admin API endpoint NOT implemented (`POST /api/admin/grant-access`)
- ❌ Admin authentication system NOT implemented
- ❌ No payment verification before granting access
- ❌ No admin action logging

### Documentation (90% Complete)
- ✅ Comprehensive ticket created (#0034)
- ✅ Implementation details documented
- ✅ Testing strategy outlined
- ⚠️ Production readiness checklist exists in ticket but not as separate doc
- ⚠️ Emergency runbook NOT created

## Recommended Improvements

### Priority 1: Critical (Revenue Impact)

#### 1.1 Integrate Sentry into Main Webhook Catch Block
**File**: `app/api/stripe/webhook/route.ts`
**Location**: Lines 242-247

```typescript
// Current
} catch (error) {
  logWebhookError("Webhook handler failed", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

// Improved
} catch (error) {
  logWebhookError("Webhook handler failed", error);

  // Capture in Sentry for immediate alerting
  captureSentryError(error instanceof Error ? error : new Error(String(error)), {
    level: 'error',
    tags: {
      area: 'stripe_webhook',
      event_type: event?.type || 'unknown',
    },
    extra: {
      event_id: event?.id,
      user_id: extractUserId(event),
      timestamp: new Date().toISOString(),
    },
  });

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

**Impact**: Immediate Sentry alerts for ALL webhook failures (not just after 3 retries)

#### 1.2 Implement Admin Email Alerts
**File**: `lib/admin-alerts.ts`
**Location**: Lines 33-69 (update `sendAdminWebhookAlert` function)

```typescript
// Add email sending to existing function
export async function sendAdminWebhookAlert(failure: WebhookFailureAlert): Promise<void> {
  // ... existing console logging and Sentry capture ...

  // NEW: Send email alert
  const adminEmails = process.env.ADMIN_ALERT_EMAILS?.split(',') || [];

  if (adminEmails.length > 0) {
    try {
      await sendEmail({
        to: adminEmails,
        subject: `🚨 CRITICAL: Webhook Failed ${failure.retryCount} Times`,
        body: `
          User ID: ${failure.userId}
          Event Type: ${failure.eventType}
          Error: ${failure.errorMessage}

          Stripe Links:
          - Session: https://dashboard.stripe.com/checkout/sessions/${failure.sessionId}
          - Customer: https://dashboard.stripe.com/customers/${failure.customerId}

          Action Required: Use manual grant access API or contact user
        `,
      });
    } catch (emailError) {
      // Log but don't fail the alert
      console.error('Failed to send admin email alert', emailError);
    }
  }
}
```

**Environment Variable Needed**:
```bash
ADMIN_ALERT_EMAILS="sebastiansole@handicappin.com"
```

### Priority 2: High (Operations)

#### 2.1 Implement Admin Grant-Access API
**File**: Create `app/api/admin/grant-access/route.ts`

**Requirements**:
- Verify payment in Stripe before granting
- Require admin authentication (implement admin role check)
- Log all actions for audit trail
- Return clear errors if payment not confirmed

**Note**: Requires implementing admin authentication system first

#### 2.2 Create Admin Authentication System
**Options**:
1. Add `is_admin` boolean to profile table
2. Create separate `admin_users` table
3. Use Supabase custom claims in JWT
4. Check email against whitelist

**Recommended**: Option 1 (simplest) - Add `is_admin` boolean to profile table with RLS policies

### Priority 3: Medium (Observability)

#### 3.1 Add Structured Logging
Replace console.error with structured logging service (Logtail, Datadog, etc.)

#### 3.2 Create getUserIdOrThrow Helper
**File**: `app/api/stripe/webhook/route.ts`

```typescript
async function getUserIdOrThrow(
  metadata: Record<string, any> | undefined,
  customerId: string | null | undefined,
  context: string
): Promise<string> {
  // First, try metadata
  const userId = metadata?.supabase_user_id;
  if (userId) return userId;

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
    .where(eq(stripeCustomers.stripeCustomerId, customerId))
    .limit(1);

  if (customerRecord.length === 0) {
    throw new Error(`No user found for customer ${customerId} (${context})`);
  }

  const recoveredUserId = customerRecord[0].userId;
  logWebhookInfo(`✅ Recovered userId from customer table: ${recoveredUserId}`);
  return recoveredUserId;
}
```

**Benefit**: Reduces boilerplate, provides fallback to customer table lookup

#### 3.3 Add Unit Tests for Webhook Handlers
Currently no tests exist for critical webhook logic. Recommended test coverage:
- Missing userId scenarios
- Customer ownership verification
- Amount verification
- Retry count tracking
- Idempotency checks

### Priority 4: Optional (Nice to Have)

#### 4.1 PostHog Integration
Only implement if product analytics are needed. Current Sentry monitoring may be sufficient for error tracking.

#### 4.2 Slack Webhook Notifications
Only implement if team uses Slack actively for operations.

## Open Questions

1. **Admin Authentication**: Which approach is preferred for admin role checking?
   - Boolean flag in profile table?
   - Separate admin_users table?
   - Email whitelist?

2. **PostHog**: Is product analytics needed, or is Sentry sufficient for monitoring webhook health?

3. **Email Service**: Should admin alerts use Resend (same as user emails) or separate service?

4. **Testing Strategy**: Should we prioritize unit tests or integration tests for webhook handlers?

5. **Reconciliation System**: The `lib/reconciliation/stripe-reconciliation.ts` file exists but has no API endpoint. Should this be implemented as part of this ticket or separately?

## Conclusion

The webhook error handling system is **well-architected and production-ready** with excellent security, retry logic, and user experience. The main gaps are:

1. **Sentry integration** - Configured but not called in main webhook catch block
2. **Admin email alerts** - Infrastructure exists but not wired up
3. **Manual recovery API** - Not implemented (blocked by missing admin auth)
4. **PostHog** - Optional per ticket, may not be needed

**Recommended Next Steps**:
1. Add Sentry capture to main webhook catch block (15 minutes)
2. Wire up admin email alerts (30 minutes)
3. Implement admin authentication system (2-3 hours)
4. Implement admin grant-access API (2-3 hours)
5. Add unit tests for webhook handlers (4-6 hours)

**Estimated Time to 100% Completion**: 8-12 hours

The system is currently **production-safe** for handling webhook failures (errors are tracked, users see accurate status), but lacks the **manual recovery tools** needed for efficient operations when webhooks fail.
