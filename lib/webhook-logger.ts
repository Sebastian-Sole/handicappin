import { logger } from "./logging";

/**
 * Centralized logging utility for Stripe webhook events
 * Provides consistent emoji-based logging patterns with automatic PII redaction
 */

/** PostgreSQL/Drizzle errors include these additional diagnostic fields */
interface DatabaseError extends Error {
  code?: string;
  severity?: string;
  detail?: string;
  hint?: string;
}

function isDatabaseError(error: Error): error is DatabaseError {
  return "code" in error || "severity" in error || "detail" in error || "hint" in error;
}

/**
 * Log webhook receipt
 */
export function logWebhookReceived(eventType: string) {
  logger.info(`📥 Received webhook event: ${eventType}`);
}

/**
 * Log successful webhook operation
 */
export function logWebhookSuccess(
  message: string,
  context?: Record<string, unknown>,
) {
  logger.info(`✅ ${message}`, context);
}

/**
 * Log webhook error
 */
export function logWebhookError(message: string, error?: unknown) {
  const errorContext = error
    ? error instanceof Error
      ? {
          error: error.message,
          stack: error.stack,
          ...(isDatabaseError(error) && {
            code: error.code,
            severity: error.severity,
            detail: error.detail,
            hint: error.hint,
          }),
          cause: error.cause instanceof Error ? error.cause.message : error.cause,
        }
      : { error: String(error) }
    : undefined;
  logger.error(`❌ ${message}`, errorContext);
}

/**
 * Log webhook warning
 */
export function logWebhookWarning(
  message: string,
  context?: Record<string, unknown>,
) {
  logger.warn(`⚠️ ${message}`, context);
}

/**
 * Log webhook debug info
 */
export function logWebhookDebug(message: string, data: Record<string, unknown>) {
  logger.debug(`🔍 ${message}`, data);
}

/**
 * Log webhook info
 */
export function logWebhookInfo(message: string) {
  logger.info(`ℹ️ ${message}`);
}

/**
 * Log payment-specific events
 */
export function logPaymentEvent(message: string) {
  logger.info(`💳 ${message}`);
}

/**
 * Log subscription-specific events
 */
export function logSubscriptionEvent(message: string) {
  logger.info(`📝 ${message}`);
}
