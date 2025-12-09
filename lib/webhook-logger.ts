/**
 * Centralized logging utility for Stripe webhook events
 * Provides consistent emoji-based logging patterns
 */

/**
 * Log webhook receipt
 */
export function logWebhookReceived(eventType: string) {
  console.log(`📥 Received webhook event: ${eventType}`);
}

/**
 * Log successful webhook operation
 */
export function logWebhookSuccess(
  message: string,
  context?: Record<string, any>
) {
  if (context) {
    console.log(`✅ ${message}`, context);
  } else {
    console.log(`✅ ${message}`);
  }
}

/**
 * Log webhook error
 */
export function logWebhookError(message: string, error?: any) {
  if (error) {
    console.error(`❌ ${message}`, error);
  } else {
    console.error(`❌ ${message}`);
  }
}

/**
 * Log webhook warning
 */
export function logWebhookWarning(
  message: string,
  context?: Record<string, any>
) {
  if (context) {
    console.warn(`⚠️ ${message}`, context);
  } else {
    console.warn(`⚠️ ${message}`);
  }
}

/**
 * Log webhook debug info
 */
export function logWebhookDebug(message: string, data: Record<string, any>) {
  console.log(`🔍 ${message}`, data);
}

/**
 * Log webhook info
 */
export function logWebhookInfo(message: string) {
  console.log(`ℹ️ ${message}`);
}

/**
 * Log payment-specific events
 */
export function logPaymentEvent(message: string) {
  console.log(`💳 ${message}`);
}

/**
 * Log subscription-specific events
 */
export function logSubscriptionEvent(message: string) {
  console.log(`📝 ${message}`);
}
