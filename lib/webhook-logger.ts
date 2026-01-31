import { logger } from "./logging";

/**
 * Centralized logging utility for Stripe webhook events
 * Provides consistent emoji-based logging patterns with automatic PII redaction
 */

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
  context?: Record<string, any>,
) {
  logger.info(`✅ ${message}`, context);
}

/**
 * Log webhook error
 */
export function logWebhookError(message: string, error?: any) {
  const errorContext = error
    ? error instanceof Error
      ? { error: error.message, stack: error.stack }
      : error
    : undefined;
  logger.error(`❌ ${message}`, errorContext);
}

/**
 * Log webhook warning
 */
export function logWebhookWarning(
  message: string,
  context?: Record<string, any>,
) {
  logger.warn(`⚠️ ${message}`, context);
}

/**
 * Log webhook debug info
 */
export function logWebhookDebug(message: string, data: Record<string, any>) {
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
