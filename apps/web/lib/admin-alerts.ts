/**
 * Admin alerting for critical webhook failures
 * Sends Sentry alerts when webhooks fail 3+ times
 */

import * as Sentry from "@sentry/nextjs";
import { captureSentryError } from "@/lib/sentry-utils";
import { logger } from "@/lib/logging";
import type { DoubleContractAlert } from "@/utils/billing/apply-billing-event";

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

/**
 * Double-contract alert (decision ledger D-precedence): a user appears to
 * hold ACTIVE contracts with BOTH providers. We keep max entitlement and
 * never auto-cancel the other side — a human resolves the double billing.
 */
export async function sendDoubleContractAlert(
  userId: string,
  alert: DoubleContractAlert,
): Promise<void> {
  logger.error("BILLING DOUBLE-CONTRACT - ADMIN ALERT", {
    userId,
    ...alert,
  });

  captureSentryError(
    new Error(
      `Billing double-contract for user: ${alert.currentProvider}(${alert.currentPlan}) vs incoming ${alert.incomingProvider}(${alert.incomingPlan}) — kept ${alert.keptProvider}`,
    ),
    {
      level: "fatal",
      userId,
      eventType: "billing.double_contract",
      eventId: alert.eventId,
      tags: {
        billing_alert: "double_contract",
        kept_provider: alert.keptProvider,
      },
      extra: {
        remediation: {
          action:
            "User is paying two providers. Refund/cancel ONE manually — never auto-cancel.",
          currentProvider: alert.currentProvider,
          incomingProvider: alert.incomingProvider,
        },
      },
    },
  );
}

/**
 * RevenueCat TRANSFER alert (D-status-mapping: no entitlement write).
 * Entitlements moved between app user ids — needs a human eye because our
 * app_user_id IS the Supabase user id and transfers can mean account
 * switching or family-share edge cases.
 */
export async function sendTransferAlert(params: {
  eventId: string;
  transferredFrom: string[];
  transferredTo: string[];
}): Promise<void> {
  logger.error("BILLING TRANSFER EVENT - ADMIN ALERT", params);

  captureSentryError(
    new Error(
      `RevenueCat TRANSFER: entitlements moved between app users (no automatic write performed)`,
    ),
    {
      level: "error",
      eventType: "billing.transfer",
      eventId: params.eventId,
      tags: { billing_alert: "transfer" },
      extra: {
        transferredFrom: params.transferredFrom,
        transferredTo: params.transferredTo,
        remediation: {
          action:
            "Verify which Supabase users are involved and reconcile entitlement manually if needed.",
        },
      },
    },
  );
}
