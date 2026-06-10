import Stripe from "stripe";
import { db } from "@/db";
import { profile, stripeCustomers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import {
  logWebhookWarning,
  logWebhookInfo,
  logPaymentEvent,
} from "@/lib/webhook-logger";
import { formatAmount } from "@/utils/billing/pricing";
import { logger } from "@/lib/logging";
import type { WebhookContext, WebhookResult } from "./types";

/**
 * Handle charge disputes (chargebacks)
 * Logs security alert for manual review - does NOT automatically revoke access
 */
export async function handleDisputeCreated(
  ctx: WebhookContext
): Promise<WebhookResult> {
  const dispute = ctx.event.data.object as Stripe.Dispute;
  const disputeId = dispute.id;
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  const amount = dispute.amount;
  const reason = dispute.reason;
  const status = dispute.status;
  const currency = dispute.currency || "usd";

  logPaymentEvent(
    `Dispute created: ${disputeId} for charge ${chargeId} (${formatAmount(
      amount,
      currency
    )})`
  );

  if (!chargeId) {
    logWebhookWarning("Dispute has no charge ID", { disputeId });
    return { success: true, message: "No charge ID" };
  }

  try {
    // Get charge details to find customer
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId = charge.customer;

    if (!customerId) {
      logWebhookWarning("Disputed charge has no customer ID", {
        disputeId,
        chargeId,
      });
      return { success: true, message: "No customer ID" };
    }

    // Find user by customer ID
    const customerRecord = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, customerId as string))
      .limit(1);

    if (customerRecord.length === 0) {
      logWebhookWarning(`No user found for disputed customer ${customerId}`, {
        disputeId,
        chargeId,
        customerId,
      });
      return { success: true, message: "No user found for customer" };
    }

    const userId = customerRecord[0].userId;

    // Get user details for logging
    const userProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, userId))
      .limit(1);

    const currentPlan = userProfile[0]?.planSelected || "unknown";

    // Log security alert for manual review
    logger.error("SECURITY ALERT: Charge dispute filed", {
      disputeId,
      chargeId,
      userId,
      currentPlan,
      amount: formatAmount(amount, currency),
      currency,
      reason,
      status,
      timestamp: new Date().toISOString(),
      action: "MANUAL_REVIEW_REQUIRED",
      severity: "HIGH",
    });

    logWebhookWarning(
      `Dispute filed for user ${userId} - requires manual review`,
      {
        disputeId,
        amount: formatAmount(amount, currency),
        reason,
        currentPlan,
      }
    );

    // IMPORTANT: Do NOT automatically revoke access
    // Wait for dispute resolution (charge.dispute.closed)
    logWebhookInfo(
      "No automatic action taken - waiting for dispute resolution"
    );
  } catch (error) {
    logger.error("Error processing dispute notification", { error });
    throw error; // Trigger Stripe retry
  }

  return { success: true };
}
