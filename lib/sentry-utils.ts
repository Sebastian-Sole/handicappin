/**
 * Sentry Utilities with PII Protection
 *
 * Centralized utilities for capturing errors and events to Sentry
 * with automatic PII redaction (industry-standard approach).
 *
 * User IDs (UUIDs) are logged directly - they're pseudonymous and needed for debugging.
 * Emails and sensitive Stripe IDs are partially redacted.
 */

import * as Sentry from "@sentry/nextjs";
import {
  redactEmail,
  redactCustomerId,
  redactSessionId,
  redactSubscriptionId,
} from "./logging";

/**
 * Sanitize error message by redacting Stripe IDs before sending to Sentry
 *
 * This ensures error messages don't leak full Stripe IDs to Sentry.
 * Applies the same partial redaction strategy as our logging utils.
 */
function sanitizeErrorMessage(message: string): string {
  return message
    // Customer IDs: cus_ABC123DEF → cus_ABC...
    .replace(/cus_[a-zA-Z0-9]+/g, (match) => {
      const idPart = match.substring(4); // Remove "cus_"
      return idPart.length <= 3 ? match : `cus_${idPart.substring(0, 3)}...`;
    })
    // Session IDs: cs_test_abc123... → cs_test_abc...
    .replace(/cs_[a-zA-Z0-9_]+/g, (match) => {
      // Extract the ID part after the prefix
      const parts = match.match(/^(cs_(?:test_|live_)?)(.+)$/);
      if (!parts) return match;
      const prefix = parts[1];
      const idPart = parts[2];
      return idPart.length <= 3 ? match : `${prefix}${idPart.substring(0, 3)}...`;
    })
    // Subscription IDs: sub_123456 → sub_123...
    .replace(/sub_[a-zA-Z0-9]+/g, (match) => {
      const idPart = match.substring(4);
      return idPart.length <= 3 ? match : `sub_${idPart.substring(0, 3)}...`;
    })
    // Payment Intent IDs: pi_123456 → pi_123...
    .replace(/pi_[a-zA-Z0-9]+/g, (match) => {
      const idPart = match.substring(3);
      return idPart.length <= 3 ? match : `pi_${idPart.substring(0, 3)}...`;
    })
    // Invoice IDs: in_123456 → in_123...
    .replace(/in_[a-zA-Z0-9]+/g, (match) => {
      const idPart = match.substring(3);
      return idPart.length <= 3 ? match : `in_${idPart.substring(0, 3)}...`;
    })
    // Charge IDs: ch_123456 → ch_123...
    .replace(/ch_[a-zA-Z0-9]+/g, (match) => {
      const idPart = match.substring(3);
      return idPart.length <= 3 ? match : `ch_${idPart.substring(0, 3)}...`;
    })
    // Price IDs: price_123456 → price_123...
    .replace(/price_[a-zA-Z0-9]+/g, (match) => {
      const idPart = match.substring(6);
      return idPart.length <= 3 ? match : `price_${idPart.substring(0, 3)}...`;
    });
}

/**
 * Capture error to Sentry with standardized context and PII redaction
 *
 * This is the RECOMMENDED way to send errors to Sentry with proper context.
 *
 * @param error - Error to capture
 * @param context - Contextual information (emails/Stripe IDs will be redacted)
 *
 * @example
 * captureSentryError(new Error("Payment failed"), {
 *   level: "error",
 *   userId: "550e8400-e29b-41d4-a716-446655440000",  // Logged as-is (pseudonymous)
 *   customerId: "cus_ABC123",                         // Redacted to "cus_ABC..."
 *   tags: { payment_method: "stripe" }
 * });
 */
export function captureSentryError(
  error: Error,
  context: {
    level?: "fatal" | "error" | "warning";
    userId?: string;
    email?: string;
    sessionId?: string;
    customerId?: string;
    subscriptionId?: string;
    eventType?: string;
    eventId?: string;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
): void {
  // Sanitize error message to redact Stripe IDs before sending to Sentry
  const sanitizedError = new Error(sanitizeErrorMessage(error.message));
  sanitizedError.name = error.name;
  sanitizedError.stack = error.stack; // Preserve stack trace

  // Include original error message in extra context (for debugging, but not in primary error.message)
  const extraContext = {
    ...context.extra,
    original_error_message: error.message, // Original message already sanitized above
  };

  Sentry.captureException(sanitizedError, {
    level: context.level || "error",
    tags: {
      event_type: context.eventType || "unknown",
      ...context.tags,
    },
    contexts: {
      user_context: {
        user_id: context.userId || "N/A", // UUIDs logged directly
        email: context.email ? redactEmail(context.email) : "N/A", // Emails redacted
      },
      stripe: {
        session_id: redactSessionId(context.sessionId),
        customer_id: context.customerId
          ? redactCustomerId(context.customerId)
          : "N/A",
        subscription_id: redactSubscriptionId(context.subscriptionId),
      },
      event: {
        event_id: context.eventId || "N/A",
        timestamp: new Date().toISOString(),
      },
    },
    fingerprint: [
      // Group by error type and location, NOT by event ID
      error.name,
      context.eventType || "unknown",
      error.stack?.split("\n")[1]?.trim() || "unknown-location",
    ],
    user: context.userId
      ? {
          id: context.userId, // UUID logged directly for Sentry user tracking
        }
      : undefined,
    extra: extraContext,
  });
}
