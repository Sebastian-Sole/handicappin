/**
 * Admin alerting for critical webhook failures
 * Sends Sentry alerts when webhooks fail 3+ times
 */

import * as Sentry from "@sentry/nextjs";

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
  // Log to console with high visibility (keep for local dev)
  console.error('═══════════════════════════════════════════');
  console.error('🚨 CRITICAL WEBHOOK FAILURE - ADMIN ALERT');
  console.error('═══════════════════════════════════════════');
  console.error(`User ID: ${failure.userId}`);
  console.error(`Event Type: ${failure.eventType}`);
  console.error(`Retry Count: ${failure.retryCount}`);
  console.error(`Error: ${failure.errorMessage}`);
  console.error('═══════════════════════════════════════════');

  // Send to Sentry with rich context
  Sentry.captureException(new Error(`Webhook failed after ${failure.retryCount} retries: ${failure.errorMessage}`), {
    level: 'fatal', // Critical - requires immediate attention
    tags: {
      event_type: failure.eventType,
      retry_count: failure.retryCount.toString(),
      webhook_event_id: failure.eventId,
    },
    contexts: {
      webhook: {
        event_id: failure.eventId,
        event_type: failure.eventType,
        retry_count: failure.retryCount,
        timestamp: failure.timestamp.toISOString(),
      },
      user_context: {
        user_id: failure.userId,
      },
      stripe: {
        session_id: failure.sessionId || 'N/A',
        customer_id: failure.customerId || 'N/A',
        subscription_id: failure.subscriptionId || 'N/A',
      },
      remediation: {
        stripe_session_url: failure.sessionId
          ? `https://dashboard.stripe.com/test/checkout/sessions/${failure.sessionId}`
          : 'N/A',
        stripe_customer_url: failure.customerId
          ? `https://dashboard.stripe.com/test/customers/${failure.customerId}`
          : 'N/A',
        stripe_subscription_url: failure.subscriptionId
          ? `https://dashboard.stripe.com/test/subscriptions/${failure.subscriptionId}`
          : 'N/A',
        database_table: 'webhook_events',
        reconciliation_eta: '24 hours',
      },
    },
    fingerprint: [failure.eventId], // Group by event ID to avoid duplicate alerts
    user: {
      id: failure.userId,
    },
  });

  console.log('✅ Critical webhook failure sent to Sentry');
}
