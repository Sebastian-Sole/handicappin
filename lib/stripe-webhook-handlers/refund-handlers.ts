import Stripe from "stripe";
import { db } from "@/db";
import { profile, stripeCustomers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  logWebhookSuccess,
  logWebhookError,
  logWebhookWarning,
  logWebhookDebug,
  logWebhookInfo,
  logPaymentEvent,
} from "@/lib/webhook-logger";
import { formatAmount } from "@/utils/billing/pricing";
import type { WebhookContext, WebhookResult } from "./types";

/**
 * Handle charge refunds (full or partial)
 * Revokes access for full refunds of lifetime purchases
 */
export async function handleChargeRefunded(
  ctx: WebhookContext
): Promise<WebhookResult> {
  const charge = ctx.event.data.object as Stripe.Charge;
  const chargeId = charge.id;
  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  const amountRefunded = charge.amount_refunded; // In cents
  const amountCharged = charge.amount; // In cents
  const currency = charge.currency;
  const isFullRefund = amountRefunded === amountCharged;

  logPaymentEvent(
    `Charge refunded: ${chargeId} (${formatAmount(
      amountRefunded,
      currency
    )} refunded)`
  );

  if (!customerId) {
    logWebhookWarning("Charge has no customer ID", { chargeId });
    return { success: true, message: "No customer ID" };
  }

  try {
    // Find user by customer ID
    const customerRecord = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, customerId))
      .limit(1);

    if (customerRecord.length === 0) {
      logWebhookWarning(`No user found for customer ${customerId}`, {
        chargeId,
        customerId,
      });
      return { success: true, message: "No user found for customer" };
    }

    const userId = customerRecord[0].userId;

    // Get user's current plan
    const userProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, userId))
      .limit(1);

    if (userProfile.length === 0) {
      throw new Error(`No profile found for user in charge refund ${chargeId}`);
    }

    const currentPlan = userProfile[0].planSelected;

    // Log refund details
    logWebhookDebug("Refund details", {
      userId,
      currentPlan,
      isFullRefund,
      amountRefunded: formatAmount(amountRefunded, currency),
      amountCharged: formatAmount(amountCharged, currency),
    });

    // For lifetime plans, full refund = revoke access
    if (currentPlan === "lifetime" && isFullRefund) {
      logPaymentEvent(
        `Full refund detected - revoking lifetime access for user ${userId}`
      );

      await db
        .update(profile)
        .set({
          planSelected: "free",
          planSelectedAt: new Date(),
          subscriptionStatus: "canceled",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          billingVersion: sql`billing_version + 1`,
        })
        .where(eq(profile.id, userId));

      logWebhookSuccess(
        `Revoked lifetime access for user ${userId} due to full refund`
      );
    } else if (isFullRefund) {
      // Full refund for subscription - let subscription.deleted handle it
      logWebhookInfo(
        `Full refund for non-lifetime plan (user ${userId}, plan ${currentPlan}) - subscription cancellation will be handled by subscription.deleted event`
      );
    } else {
      // Partial refund - no action needed
      logWebhookInfo(
        `Partial refund (${formatAmount(
          amountRefunded,
          currency
        )}) for user ${userId} - no access changes`
      );
    }
  } catch (error) {
    logWebhookError("Error processing charge refund", error);
    throw error; // Trigger Stripe retry
  }

  return { success: true };
}
