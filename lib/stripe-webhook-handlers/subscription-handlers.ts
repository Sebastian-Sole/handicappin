import Stripe from "stripe";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { mapPriceToPlan } from "@/lib/stripe";
import {
  logWebhookSuccess,
  logWebhookError,
  logWebhookDebug,
  logWebhookInfo,
} from "@/lib/webhook-logger";
import { verifyCustomerOwnership } from "@/lib/stripe-security";
import { verifyPaymentAmount, formatAmount } from "@/utils/billing/pricing";
import { logger } from "@/lib/logging";
import type { WebhookContext, WebhookResult } from "./types";

/**
 * Handle subscription changes - update plan_selected
 */
export async function handleSubscriptionChange(
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const subscription = ctx.event.data.object as Stripe.Subscription;
  const userId = subscription.metadata?.supabase_user_id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!userId) {
    // Subscription from another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping subscription ${subscription.id} - no supabase_user_id in metadata (likely from another application)`,
    );
    return { success: true, message: "Skipped - no supabase_user_id" };
  }

  if (!customerId) {
    throw new Error(`Missing customer ID in subscription ${subscription.id}`);
  }

  // Verify customer belongs to this user
  const ownership = await verifyCustomerOwnership(customerId, userId);

  if (!ownership.valid) {
    logWebhookError(
      "Customer-User correlation check failed - NOT updating plan",
      {
        handler: "handleSubscriptionChange",
        claimedUserId: userId,
        actualUserId: ownership.actualUserId,
        stripeCustomerId: customerId,
        subscriptionId: subscription.id,
        severity: "HIGH",
      },
    );
    throw new Error(
      `Customer-User mismatch for subscription ${subscription.id}`,
    );
  }

  logWebhookDebug("Customer-User correlation verified", {
    userId,
    customerId,
  });

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error(
      `No price ID in subscription ${subscription.id} for user ${userId}`,
    );
  }

  const plan = mapPriceToPlan(priceId);
  if (!plan) {
    throw new Error(
      `Unknown price ID ${priceId} in subscription ${subscription.id} for user ${userId}`,
    );
  }

  // Verify subscription amount
  const price = subscription.items.data[0]?.price;
  if (!price) {
    throw new Error(
      `No price object in subscription ${subscription.id} for user ${userId}`,
    );
  }

  const amount = price.unit_amount || 0;
  const currency = price.currency || "usd";

  const verification = verifyPaymentAmount(
    plan,
    currency,
    amount,
    true, // subscription is recurring
  );

  if (!verification.valid) {
    logWebhookError(
      "CRITICAL: Subscription amount verification failed - NOT updating plan",
      {
        handler: "handleSubscriptionChange",
        plan,
        expected: formatAmount(verification.expected),
        actual: formatAmount(verification.actual),
        variance: verification.variance,
        currency: verification.currency,
        subscriptionId: subscription.id,
        userId,
        priceId,
        severity: "HIGH",
        action: "Check environment variables and Stripe price configuration",
      },
    );
    throw new Error(
      `Amount verification failed for subscription ${subscription.id}`,
    );
  }

  logWebhookSuccess("Subscription amount verification passed", {
    plan,
    amount: formatAmount(verification.actual),
    currency: verification.currency,
  });

  // Log subscription details BEFORE condition check
  logger.debug("[Webhook] Subscription change details", {
    subscriptionId: subscription.id,
    userId,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at,
    isCancelling: subscription.cancel_at_period_end || !!subscription.cancel_at,
    currentPeriodEnd: subscription.items.data[0]?.current_period_end,
    plan,
  });

  // Only update if subscription is active
  if (subscription.status === "active" || subscription.status === "trialing") {
    try {
      logWebhookDebug("Subscription update details", {
        userId,
        plan,
        status: subscription.status,
        currentPeriodEnd: subscription.items.data[0]?.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });

      logger.debug("RECEIVED SUB", { subscription });

      // Check if subscription is set to cancel
      const isCancelling =
        subscription.cancel_at_period_end || !!subscription.cancel_at;

      const updateData = {
        planSelected: plan,
        planSelectedAt: new Date(),
        subscriptionStatus: subscription.status,
        currentPeriodEnd: subscription.items.data[0]?.current_period_end,
        cancelAtPeriodEnd: isCancelling,
        billingVersion: sql`billing_version + 1`,
      };

      logger.debug("[Webhook] About to update profile with", {
        userId,
        cancelAtPeriodEnd_DB_Value: isCancelling,
        stripe_cancel_at_period_end: subscription.cancel_at_period_end,
        stripe_cancel_at: subscription.cancel_at,
        updateData: {
          ...updateData,
          billingVersion: "incremented",
        },
      });

      const result = await db
        .update(profile)
        .set(updateData)
        .where(eq(profile.id, userId));

      logger.debug("[Webhook] Database update result", { result });

      // Verify the update actually happened
      const verifyProfile = await db
        .select({
          cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
          subscriptionStatus: profile.subscriptionStatus,
          currentPeriodEnd: profile.currentPeriodEnd,
        })
        .from(profile)
        .where(eq(profile.id, userId))
        .limit(1);

      logger.debug("[Webhook] Verified database state after update", {
        userId,
        dbState: verifyProfile[0],
      });

      logWebhookSuccess(
        `Updated plan_selected to '${plan}' for user: ${userId} (status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}, cancel_at: ${subscription.cancel_at}, isCancelling: ${isCancelling})`,
      );
    } catch (error) {
      logWebhookError("Error updating plan", error);
      throw error;
    }
  } else {
    logger.warn(
      "[Webhook] Skipping database update - subscription status not active/trialing",
      {
        subscriptionId: subscription.id,
        userId,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    );
  }

  return { success: true };
}

/**
 * Handle subscription deletion - revert to free tier
 */
export async function handleSubscriptionDeleted(
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const subscription = ctx.event.data.object as Stripe.Subscription;
  const userId = subscription.metadata?.supabase_user_id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!userId) {
    // Subscription from another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping deleted subscription ${subscription.id} - no supabase_user_id in metadata (likely from another application)`,
    );
    return { success: true, message: "Skipped - no supabase_user_id" };
  }

  if (!customerId) {
    throw new Error(
      `Missing customer ID in deleted subscription ${subscription.id}`,
    );
  }

  // Verify customer belongs to this user
  const ownership = await verifyCustomerOwnership(customerId, userId);

  if (!ownership.valid) {
    logWebhookError(
      "Customer-User correlation check failed - NOT reverting plan",
      {
        handler: "handleSubscriptionDeleted",
        claimedUserId: userId,
        actualUserId: ownership.actualUserId,
        stripeCustomerId: customerId,
        severity: "HIGH",
      },
    );
    throw new Error(
      `Customer-User mismatch in subscription deletion ${subscription.id}`,
    );
  }

  // Revert to free tier
  try {
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

    logWebhookSuccess(`Reverted to free tier for user: ${userId}`);
    logger.debug(
      `[Webhook] Billing version incremented for user ${userId} - BillingSync should detect within seconds`,
    );
  } catch (error) {
    logWebhookError("Error reverting user to free tier", error);
    throw error;
  }

  return { success: true };
}
