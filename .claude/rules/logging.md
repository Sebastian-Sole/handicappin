# Logging Standards

## Core Rule

**Never use `console.log`, `console.error`, `console.warn`, or `console.debug` in server-side code.** Always use the structured logger from `@/lib/logging`.

```typescript
import { logger } from "@/lib/logging";
```

The only exception is **Supabase Edge Functions** (`supabase/functions/`), which run in Deno and should use `console` directly.

## Logger API

The logger has four severity levels, each accepting a message string and an optional structured context object:

```typescript
logger.debug(message: string, context?: LogContext)  // Dev only, skipped in production
logger.info(message: string, context?: LogContext)    // Informational events
logger.warn(message: string, context?: LogContext)    // Degraded states, fallbacks
logger.error(message: string, context?: LogContext)   // Failures requiring attention
```

## When to Use Each Level

| Level   | Use For                                                    |
|---------|------------------------------------------------------------|
| `debug` | Database query results, intermediate state, cache behavior |
| `info`  | Successful operations, auth events, completed workflows    |
| `warn`  | Rate limits hit, Redis unavailable (failing open), retries |
| `error` | Caught exceptions, failed API calls, critical mismatches   |

## Error Formatting

Always extract the error message safely. Never pass raw Error objects as context values:

```typescript
// Correct
logger.error("Failed to process request", {
  error: error instanceof Error ? error.message : String(error),
});

// Wrong - don't pass Error objects directly
logger.error("Failed", { error });

// Wrong - don't use console
console.error("Failed:", error);
```

For richer error context (e.g., in webhooks), include stack and cause:

```typescript
logger.error("Webhook processing failed", {
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  cause: error instanceof Error && error.cause instanceof Error
    ? error.cause.message
    : undefined,
});
```

## Structured Context

Always pass relevant identifiers and metadata as structured context, not interpolated into the message string:

```typescript
// Correct - structured context
logger.info("Subscription updated", {
  userId,
  subscriptionId: subscription.id,
  status: subscription.status,
  plan: priceId,
});

// Wrong - interpolated message
logger.info(`Subscription ${subscription.id} updated for user ${userId} to ${subscription.status}`);
```

Common context fields by domain:

- **Auth**: `userId`, `provider`, `identifier`
- **Billing/Stripe**: `userId`, `subscriptionId`, `customerId`, `status`, `priceId`, `cancelAtPeriodEnd`
- **Rate limiting**: `prefix`, `identifier`, `limit`, `remaining`, `reset`
- **Rounds/Handicap**: `userId`, `roundId`, `courseId`, `scoreDifferential`
- **Reconciliation**: `checked`, `drift_detected`, `auto_fixed`, `duration_seconds`

## PII Redaction

The logger automatically redacts PII via `redactObject()` for fields matching known patterns (emails, Stripe customer/session/subscription IDs). However, when logging PII in ad-hoc context keys that won't match the auto-redactor, use the redaction helpers explicitly:

```typescript
import { redactEmail, redactCustomerId } from "@/lib/logging";

logger.info("Customer lookup", {
  email: redactEmail(email),           // "***@example.com"
  stripeCustomer: redactCustomerId(customerId), // "cus_ABC..."
});
```

UUIDs (user IDs, round IDs, etc.) are **not redacted** — they are pseudonymous and needed for debugging.

## Webhook Logging

For Stripe webhook handlers, use the specialized helpers from `@/lib/webhook-logger`:

```typescript
import {
  logWebhookReceived,
  logWebhookSuccess,
  logWebhookError,
  logSubscriptionEvent,
} from "@/lib/webhook-logger";

logWebhookReceived(event.type);
logSubscriptionEvent("Plan upgraded to premium");
logWebhookSuccess("Checkout completed", { userId, plan });
logWebhookError("Failed to process invoice", error);
```

These add emoji prefixes for visual scanning in logs and handle error extraction automatically.

## What NOT to Do

- Do not use `console.log` / `console.error` / `console.warn` in `app/`, `server/`, `lib/`, or `utils/` directories
- Do not interpolate variables into the message string — use the context object
- Do not pass raw Error objects as context values — extract `.message` first
- Do not log full request/response bodies — log relevant fields only
- Do not skip error logging in catch blocks — at minimum log the error message
- Do not use `logger.debug` for information needed in production debugging — use `logger.info`
