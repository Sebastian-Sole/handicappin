import { db } from '@/db';
import { stripeCustomers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logWebhookWarning, logWebhookError } from './webhook-logger';

/**
 * Verify that a Stripe customer ID belongs to the specified user
 *
 * Security: Prevents privilege escalation via metadata manipulation
 *
 * @param stripeCustomerId - Stripe customer ID from webhook event
 * @param claimedUserId - User ID from webhook metadata (untrusted)
 * @returns Object with validation result and actual user ID if found
 */
export async function verifyCustomerOwnership(
  stripeCustomerId: string,
  claimedUserId: string
): Promise<{ valid: boolean; actualUserId?: string }> {
  try {
    // Query database for actual customer-user mapping
    const customerRecord = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, stripeCustomerId))
      .limit(1);

    // Case 1: Customer not in database
    if (customerRecord.length === 0) {
      logWebhookWarning('Stripe customer not found in database', {
        stripeCustomerId,
        claimedUserId,
      });
      return { valid: false };
    }

    const actualUserId = customerRecord[0].userId;

    // Case 2: Customer belongs to different user (SECURITY ISSUE)
    if (actualUserId !== claimedUserId) {
      logWebhookError('🚨 SECURITY: Customer-User mismatch detected', {
        stripeCustomerId,
        claimedUserId,
        actualUserId,
        severity: 'HIGH',
      });
      return { valid: false, actualUserId };
    }

    // Case 3: Valid - customer belongs to claimed user
    return { valid: true, actualUserId };
  } catch (error) {
    logWebhookError('Error verifying customer ownership', error);
    return { valid: false };
  }
}
