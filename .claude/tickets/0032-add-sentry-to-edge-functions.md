# 0032 - Add Sentry to Edge Functions

## 🎯 **Description**

Integrate Sentry error tracking into Supabase Edge Functions (Deno runtime) to capture and monitor errors in production. Currently, edge functions only use console logging, making it difficult to track, debug, and alert on errors in production environments.

## 📋 **User Story**

As a platform maintainer, I want error tracking in edge functions so that I can quickly identify, debug, and respond to production issues before they impact users.

## 🔧 **Technical Context**

**Current State:**
- Edge functions run in Deno runtime (not Node.js)
- Currently use `console.log`, `console.warn`, `console.error` for logging
- No centralized error tracking or alerting
- Errors are only visible in Supabase logs or local development

**Existing Sentry Setup:**
- Main Next.js app uses `@sentry/nextjs` (see `lib/sentry-utils.ts`)
- PII redaction utilities already exist (`lib/logging.ts`)
- Sentry configuration exists for server and edge contexts in Next.js

**Edge Functions to Instrument:**
- `process-handicap-queue/index.ts` - Background job processor (high priority)
- `handicap-engine/index.ts` - Handicap calculation engine
- `check-email/index.ts` - Email validation
- `create-profile/index.ts` - User profile creation
- `reset-password/index.ts` - Password reset
- `send-verification-email/index.ts` - Email verification
- `update-password/index.ts` - Password update

**Why This Matters:**
- Production debugging without proper error tracking is time-consuming
- Silent failures in background jobs (like `process-handicap-queue`) can cause data inconsistencies
- Manual log searching doesn't scale
- No alerting mechanism for critical errors

## ✅ **Acceptance Criteria**

- [ ] Sentry SDK or HTTP client integrated into Deno edge functions
- [ ] Error capturing utility created for edge functions with PII redaction
- [ ] Critical error paths instrumented (at minimum: `process-handicap-queue`)
- [ ] Environment variable `SENTRY_DSN` configured in Supabase
- [ ] Errors include relevant context (user_id redacted, function name, error type)
- [ ] Test error capture in development environment
- [ ] Documentation for adding Sentry to new edge functions

## 🚨 **Technical Requirements**

### **Implementation Details**

**Option 1: Use Sentry HTTP API (Recommended for simplicity)**

```typescript:supabase/functions/_shared/sentry.ts
/**
 * Sentry error tracking for Deno edge functions
 * Uses HTTP API to send errors to Sentry
 */

import { hashPII, redactEmail } from "./logging.ts";

interface SentryErrorContext {
  level?: "fatal" | "error" | "warning";
  userId?: string;
  email?: string;
  eventType?: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

/**
 * Capture error to Sentry via HTTP API
 * Automatically redacts PII before sending
 */
export async function captureSentryError(
  error: Error,
  context: SentryErrorContext = {}
): Promise<void> {
  const sentryDsn = Deno.env.get("SENTRY_DSN");

  if (!sentryDsn) {
    console.warn("SENTRY_DSN not configured, skipping Sentry error capture");
    return;
  }

  try {
    // Parse DSN to get project ID and auth token
    const dsnMatch = sentryDsn.match(/https:\/\/(.+)@(.+)\/(.+)/);
    if (!dsnMatch) {
      console.error("Invalid SENTRY_DSN format");
      return;
    }

    const [, key, host, projectId] = dsnMatch;
    const sentryUrl = `https://${host}/api/${projectId}/store/`;

    // Build Sentry event payload
    const payload = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: Math.floor(Date.now() / 1000),
      platform: "javascript",
      level: context.level || "error",
      exception: {
        values: [
          {
            type: error.name || "Error",
            value: error.message,
            stacktrace: {
              frames: parseStackTrace(error.stack),
            },
          },
        ],
      },
      tags: {
        environment: Deno.env.get("ENVIRONMENT") || "production",
        runtime: "deno",
        function_name: Deno.env.get("FUNCTION_NAME") || "unknown",
        event_type: context.eventType || "unknown",
        ...context.tags,
      },
      user: context.userId
        ? {
            id: `user_${hashPII(context.userId)}`, // Redacted user ID
          }
        : undefined,
      contexts: {
        user_context: {
          user_id: context.userId ? `user_${hashPII(context.userId)}` : "N/A",
          email: context.email ? redactEmail(context.email) : "N/A",
        },
        runtime: {
          name: "deno",
          version: Deno.version.deno,
        },
      },
      extra: context.extra,
    };

    // Send to Sentry
    const response = await fetch(sentryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}, sentry_client=deno-edge-function/1.0.0`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `Failed to send error to Sentry: ${response.status} ${response.statusText}`
      );
    }
  } catch (sentryError) {
    // Don't let Sentry errors crash the function
    console.error("Error sending to Sentry:", sentryError);
  }
}

/**
 * Parse error stack trace into Sentry format
 */
function parseStackTrace(stack?: string): Array<{
  filename: string;
  function?: string;
  lineno?: number;
}> {
  if (!stack) return [];

  return stack
    .split("\n")
    .slice(1) // Skip first line (error message)
    .map((line) => {
      // Simple parsing - can be enhanced
      const match = line.match(/at (.+?) \((.+):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3]),
        };
      }
      return { filename: line.trim() };
    });
}
```

**Option 2: Use npm:@sentry/deno package**

```typescript:supabase/functions/_shared/sentry.ts
import * as Sentry from "npm:@sentry/deno";

export function initSentry() {
  const sentryDsn = Deno.env.get("SENTRY_DSN");

  if (!sentryDsn) {
    console.warn("SENTRY_DSN not configured");
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: Deno.env.get("ENVIRONMENT") || "production",
    tracesSampleRate: 0.1, // Sample 10% of transactions
    beforeSend(event) {
      // Redact PII before sending
      if (event.user?.id) {
        event.user.id = `user_${hashPII(event.user.id)}`;
      }
      return event;
    },
  });
}

export { Sentry };
```

**2. Update `process-handicap-queue/index.ts`**

```typescript:supabase/functions/process-handicap-queue/index.ts
import { captureSentryError } from "../_shared/sentry.ts";

async function processUserHandicap(
  supabase: any,
  job: QueueJob
): Promise<void> {
  try {
    // ... existing logic ...
  } catch (error: unknown) {
    console.error(`Failed to process user ${job.user_id}:`, error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const newAttempts = job.attempts + 1;
    const newStatus = newAttempts >= MAX_RETRIES ? "failed" : "pending";

    // 🆕 Capture error to Sentry
    if (error instanceof Error) {
      await captureSentryError(error, {
        level: newStatus === "failed" ? "error" : "warning",
        userId: job.user_id,
        eventType: job.event_type,
        tags: {
          job_id: job.id.toString(),
          attempt: newAttempts.toString(),
          queue_status: newStatus,
        },
        extra: {
          job_details: {
            id: job.id,
            user_id: `user_${hashPII(job.user_id)}`, // Redacted
            event_type: job.event_type,
            attempts: newAttempts,
          },
        },
      });
    }

    try {
      await supabase
        .from("handicap_calculation_queue")
        .update({
          attempts: newAttempts,
          error_message: errorMessage,
          status: newStatus,
          last_updated: new Date().toISOString(),
        })
        .eq("id", job.id);
    } catch (updateError) {
      console.error(
        `Failed to update error status for job ${job.id}:`,
        updateError
      );

      // 🆕 Also capture queue update failures
      if (updateError instanceof Error) {
        await captureSentryError(updateError, {
          level: "warning",
          tags: {
            error_type: "queue_update_failure",
            job_id: job.id.toString(),
          },
        });
      }
    }

    throw error;
  }
}
```

**3. Create shared logging utility**

```typescript:supabase/functions/_shared/logging.ts
/**
 * PII redaction utilities for edge functions
 * Reused from main app's lib/logging.ts
 */

/**
 * Hash a string to create a pseudonymized identifier
 */
export function hashPII(value: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);

  // Use Web Crypto API (available in Deno)
  return crypto.subtle
    .digest("SHA-256", data)
    .then((hash) => {
      const hashArray = Array.from(new Uint8Array(hash));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex.slice(0, 8);
    });
}

/**
 * Redact email address (show domain, hide local part)
 */
export function redactEmail(email: string): string {
  const [, domain] = email.split("@");
  return `***@${domain || "unknown"}`;
}

/**
 * Redact Stripe customer ID
 */
export function redactCustomerId(customerId?: string): string {
  if (!customerId) return "N/A";
  const idPart = customerId.substring(4); // Remove "cus_"
  return idPart.length <= 3
    ? customerId
    : `cus_${idPart.substring(0, 3)}...`;
}
```

### **Dependencies**

- Sentry account and DSN (already exists for main app)
- Environment variable `SENTRY_DSN` in Supabase Edge Function secrets
- Shared utilities directory: `supabase/functions/_shared/`
- PII redaction utilities

### **Integration Points**

- All Supabase Edge Functions
- Existing Sentry project (or create new project for edge functions)
- Environment configuration in Supabase dashboard

## 🔍 **Implementation Notes**

### **Deno vs Node.js Considerations:**

**Key Differences:**
- Deno uses Web Standards (no Node.js APIs like `crypto` module)
- Use `crypto.subtle` instead of Node's `crypto.createHash`
- Use `fetch` API (built-in in Deno)
- Import packages with `npm:` specifier

**Recommendation:** Start with HTTP API approach (Option 1) for maximum control and minimal dependencies. If more features are needed, migrate to `npm:@sentry/deno`.

### **Error Severity Levels:**

| Scenario | Level | Example |
|----------|-------|---------|
| Job permanently failed (max retries) | `error` | User handicap calculation failed after 3 attempts |
| Job temporarily failed (will retry) | `warning` | Database timeout, will retry |
| Queue update failure | `warning` | Failed to log error status |
| Critical system failure | `fatal` | Database completely unavailable |

### **PII Redaction Strategy:**

**Always Redact:**
- User IDs → `user_abc12345` (hashed)
- Emails → `***@example.com`
- Stripe Customer IDs → `cus_ABC...`

**Safe to Log:**
- Job IDs (internal system IDs)
- Event types (`round.inserted`)
- Error messages (non-PII)
- Timestamps
- Attempt counts

### **Environment Setup:**

```bash
# Set Sentry DSN in Supabase
supabase secrets set SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]

# Set environment name
supabase secrets set ENVIRONMENT=production

# Set function name (auto-set by Supabase, but can override)
supabase secrets set FUNCTION_NAME=process-handicap-queue
```

## 📊 **Definition of Done**

- [ ] Sentry utility created in `supabase/functions/_shared/sentry.ts`
- [ ] PII redaction utility created in `supabase/functions/_shared/logging.ts`
- [ ] `process-handicap-queue` instrumented with Sentry error capture
- [ ] `SENTRY_DSN` environment variable configured in Supabase
- [ ] Test error sent to Sentry from development environment
- [ ] Errors appear in Sentry dashboard with correct context
- [ ] PII is properly redacted in Sentry events
- [ ] Documentation added to edge function README

## 🧪 **Testing Requirements**

### **Manual Testing:**

```typescript
// Add test error endpoint to process-handicap-queue
Deno.serve(async (req) => {
  // Test route for Sentry
  if (req.url.includes("/test-sentry")) {
    try {
      throw new Error("Test Sentry error from edge function");
    } catch (error) {
      await captureSentryError(error as Error, {
        level: "warning",
        userId: "test-user-id",
        tags: { test: "true" },
      });
      return new Response("Error sent to Sentry", { status: 200 });
    }
  }

  // ... normal handler ...
});
```

**Test Steps:**
1. Deploy edge function with Sentry integration
2. Call test endpoint: `POST /test-sentry`
3. Check Sentry dashboard for error event
4. Verify user_id is redacted: `user_abc12345` (not raw UUID)
5. Verify tags and context are correct

### **Production Validation:**

- [ ] Trigger actual handicap queue error (invalid data)
- [ ] Verify error appears in Sentry within 1 minute
- [ ] Check error details include: job_id, attempt count, redacted user_id
- [ ] Verify no PII in Sentry event

### **Performance Testing:**

- [ ] Measure impact of Sentry calls on function execution time
- [ ] Ensure Sentry errors don't block main function logic
- [ ] Verify errors in Sentry capture don't crash function

## 🚫 **Out of Scope**

- Sentry performance monitoring/tracing (focus on error tracking only)
- Migrating main Next.js app's Sentry config
- Custom Sentry dashboards or alerts configuration
- Source map uploads for edge functions
- Sentry integration for other services (only edge functions)
- Historical error migration to Sentry

## 📝 **Notes**

**Why Not Use Console Logs?**
- Console logs are ephemeral (limited retention in Supabase)
- No alerting mechanism
- Difficult to search and analyze at scale
- No error grouping or deduplication
- No context aggregation

**Why HTTP API vs SDK?**

| Approach | Pros | Cons |
|----------|------|------|
| HTTP API | Full control, minimal deps, lightweight | Manual payload construction |
| npm:@sentry/deno | Feature-rich, auto-context, official | Larger bundle, potential compatibility issues |

**Recommendation:** Start with HTTP API, migrate to SDK if needed.

**Related Files:**
- `lib/sentry-utils.ts` - Next.js Sentry utilities (reference)
- `lib/logging.ts` - PII redaction for main app
- `supabase/functions/process-handicap-queue/index.ts:389-417` - Current error handling

**Sentry Project Options:**
1. **Option A:** Use existing Sentry project (same as Next.js app)
   - Pros: Unified error view, single Sentry account
   - Cons: Mixed Next.js and edge function errors

2. **Option B:** Create separate Sentry project for edge functions
   - Pros: Isolated error tracking, cleaner separation
   - Cons: Multiple Sentry projects to monitor

**Recommendation:** Use same project, differentiate with `runtime: deno` tag.

**Security Considerations:**
- Never log `SENTRY_DSN` (contains auth key)
- Sentry errors should never crash function (always wrapped in try-catch)
- PII redaction is critical (GDPR compliance)

## 🏷️ **Labels**

- `priority: medium`
- `type: enhancement`
- `component: edge-functions`
- `observability`
- `error-tracking`
- `sentry`
- `monitoring`
