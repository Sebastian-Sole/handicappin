/**
 * Logging Utilities with Privacy-Conscious PII Redaction
 *
 * Industry-standard approach:
 * - UUIDs are logged directly (pseudonymous, GDPR-compliant)
 * - Emails are partially redacted (hide local part)
 * - Stripe IDs are partially redacted
 * - Simple implementation for easy debugging
 *
 * GDPR Compliance:
 * - UUIDs alone are considered pseudonymous data (not personal data)
 * - Email redaction prevents direct identification
 * - Complies with GDPR Article 32 requirements
 */

/**
 * Redact email address by hiding the local part
 *
 * @param email - Email to redact
 * @returns Redacted email (e.g., "***@example.com")
 *
 * @example
 * redactEmail("john.doe@example.com") // "***@example.com"
 * redactEmail("test@gmail.com")       // "***@gmail.com"
 */
export function redactEmail(email: string | null | undefined): string {
  if (!email) return "***@unknown";

  const atIndex = email.indexOf("@");
  if (atIndex === -1) return "***@invalid";

  const domain = email.slice(atIndex + 1);
  return `***@${domain}`;
}

/**
 * Mask email address for security notifications
 * Example: john.doe@example.com → jo******@example.com
 *
 * @param email - Email to mask
 * @returns Masked email with first 2 characters visible
 *
 * @example
 * maskEmail("john.doe@example.com") // "jo****@example.com"
 * maskEmail("test@gmail.com")       // "te****@gmail.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "***@***.***";

  const atIndex = email.indexOf("@");
  if (atIndex === -1) return "***@***.***";

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  // Show first 2 characters of local part
  const visibleChars = Math.min(2, localPart.length);
  const masked = localPart.slice(0, visibleChars) + "****";

  return masked + domain;
}

/**
 * Partially redact Stripe customer ID
 * Shows prefix and first few characters for debugging
 *
 * @param customerId - Stripe customer ID
 * @returns Partially redacted ID (e.g., "cus_ABC...")
 *
 * @example
 * redactCustomerId("cus_ABC123DEF456") // "cus_ABC..."
 */
export function redactCustomerId(customerId: string | null | undefined): string {
  if (!customerId) return "cus_unknown";

  const idPart = customerId.startsWith("cus_")
    ? customerId.slice(4)
    : customerId;

  if (idPart.length <= 3) {
    return `cus_${idPart}`;
  }

  return `cus_${idPart.slice(0, 3)}...`;
}

/**
 * Redact Stripe session ID
 * Shows prefix and first few characters
 *
 * @param sessionId - Stripe session ID
 * @returns Partially redacted session ID
 *
 * @example
 * redactSessionId("cs_test_a1075F4LOhybFEJ...") // "cs_test_a1075F4L..."
 */
export function redactSessionId(sessionId: string | null | undefined): string {
  if (!sessionId) return "session_unknown";

  // Extract the part after the prefix
  const parts = sessionId.split("_");
  if (parts.length < 2) return "session_invalid";

  const prefix = parts[0];
  const id = parts.slice(1).join("_");

  if (id.length <= 8) {
    return sessionId; // Too short to redact
  }

  return `${prefix}_${id.slice(0, 8)}...`;
}

/**
 * Redact Stripe subscription ID
 * Shows prefix and first few characters
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns Partially redacted subscription ID
 *
 * @example
 * redactSubscriptionId("sub_1234567890ABCDEF") // "sub_123..."
 */
export function redactSubscriptionId(
  subscriptionId: string | null | undefined
): string {
  if (!subscriptionId) return "sub_unknown";

  const idPart = subscriptionId.startsWith("sub_")
    ? subscriptionId.slice(4)
    : subscriptionId;

  if (idPart.length <= 3) {
    return `sub_${idPart}`;
  }

  return `sub_${idPart.slice(0, 3)}...`;
}

/**
 * Recursively redact PII in objects
 * Useful for logging complex objects with nested user data
 *
 * Note: UUIDs are NOT redacted (they're pseudonymous and needed for debugging)
 *
 * @param obj - Object to redact
 * @returns Object with PII redacted
 *
 * @example
 * redactObject({
 *   userId: "550e8400-e29b-41d4-a716-446655440000",  // Kept as-is
 *   email: "user@example.com",                        // Redacted to "***@example.com"
 *   customerId: "cus_ABC123"                          // Redacted to "cus_ABC..."
 * })
 */
export function redactObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item)) as T;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  const redacted: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Redact email fields
    if (lowerKey.includes("email") && typeof value === "string") {
      redacted[key] = redactEmail(value);
    }
    // Redact customer ID fields
    else if (
      lowerKey.includes("customer") &&
      typeof value === "string" &&
      value.startsWith("cus_")
    ) {
      redacted[key] = redactCustomerId(value);
    }
    // Redact session ID fields
    else if (
      (lowerKey.includes("session") || lowerKey === "sessionid") &&
      typeof value === "string" &&
      (value.startsWith("cs_") || value.startsWith("sess_"))
    ) {
      redacted[key] = redactSessionId(value);
    }
    // Redact subscription ID fields
    else if (
      lowerKey.includes("subscription") &&
      typeof value === "string" &&
      value.startsWith("sub_")
    ) {
      redacted[key] = redactSubscriptionId(value);
    }
    // Recursively handle nested objects
    else if (typeof value === "object" && value !== null) {
      redacted[key] = redactObject(value);
    }
    // Keep other values as-is (including UUIDs for debugging!)
    else {
      redacted[key] = value;
    }
  }

  return redacted as T;
}

/**
 * Log email change security events
 */
export function logEmailChangeEvent(
  event: "requested" | "verified" | "cancelled" | "expired" | "failed",
  userId: string,
  details: {
    oldEmail?: string;
    newEmail?: string;
    reason?: string;
    ip?: string;
  }
) {
  console.log("EMAIL_CHANGE_EVENT", {
    event,
    userId,
    oldEmail: redactEmail(details.oldEmail),
    newEmail: redactEmail(details.newEmail),
    reason: details.reason,
    ip: details.ip,
    timestamp: new Date().toISOString(),
  });

  // TODO: Send to Sentry or other monitoring service
  // This provides audit trail for security investigations
}
