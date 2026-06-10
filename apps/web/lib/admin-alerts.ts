/**
 * Admin alerting for critical webhook failures
 * Sends Sentry alerts when webhooks fail 3+ times
 */

import * as Sentry from "@sentry/nextjs";
import { captureSentryError } from "@/lib/sentry-utils";
import { logger } from "@/lib/logging";

export interface WebhookFailureAlert {
  userId: string;
  eventId: string;
  eventType: string;
  sessionId?: string;
  customerId?: string;
  subscriptionId?: string;
  errorMessage: string;
  retryCount: number;
  timestamp: Date;
}

/**
 * Determine if admin should be alerted
 * Alert on 3rd failure (Stripe will retry ~4 times total)
 */
export function shouldAlertAdmin(retryCount: number): boolean {
  return retryCount >= 3;
}

/**
 * Send Sentry alert to admin for critical webhook failure
 * Captures exception with full context for debugging
 */
export async function sendAdminWebhookAlert(failure: WebhookFailureAlert): Promise<void> {
  // Log critical failure with structured data (PII will be redacted by logger)
  logger.error("CRITICAL WEBHOOK FAILURE - ADMIN ALERT", {
    userId: failure.userId,
    eventType: failure.eventType,
    eventId: failure.eventId,
    retryCount: failure.retryCount,
    errorMessage: failure.errorMessage,
    customerId: failure.customerId,
    subscriptionId: failure.subscriptionId,
  });

  // Use centralized Sentry utility with PII redaction
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
        webhook_event_id: failure.eventId,
      },
      extra: {
        remediation: {
          database_table: 'webhook_events',
          reconciliation_eta: '24 hours',
        },
      },
    }
  );

  logger.info("Critical webhook failure sent to Sentry", { eventId: failure.eventId });
}
