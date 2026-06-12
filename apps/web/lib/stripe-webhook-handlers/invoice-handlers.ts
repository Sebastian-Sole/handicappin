import Stripe from "stripe";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import {
  logWebhookSuccess,
  logWebhookError,
  logWebhookWarning,
  logWebhookDebug,
  logWebhookInfo,
  logPaymentEvent,
} from "@/lib/webhook-logger";
import { verifyCustomerOwnership } from "@/lib/stripe-security";
import type { WebhookContext, WebhookResult } from "./types";

/**
 * Handle failed invoice payment (subscription payment declined)
 * Updates subscription status to reflect payment failure
 */
export async function handleInvoicePaymentFailed(
  ctx: WebhookContext
): Promise<WebhookResult> {
  const invoice = ctx.event.data.object as Stripe.Invoice;
  // Type assertion needed as invoice.subscription exists but may not be in type definitions
  const invoiceData = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId =
    typeof invoiceData.subscription === "string"
      ? invoiceData.subscription
      : invoiceData.subscription?.id;
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  const attemptCount = invoice.attempt_count;

  logPaymentEvent(
    `Invoice payment failed for subscription ${subscriptionId} (attempt ${attemptCount})`
  );

  if (!subscriptionId) {
    // Invoice without subscription (e.g., one-time payment from another app) - skip gracefully
    logWebhookInfo(
      `Skipping invoice ${invoice.id} - no subscription ID (likely from another application)`
    );
    return { success: true, message: "Skipped - no subscription ID" };
  }

  try {
    // Get subscription to find user ID from metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      // Subscription from another application (e.g., Clerk) - skip gracefully
      logWebhookInfo(
        `Skipping failed invoice ${invoice.id} - no supabase_user_id in subscription metadata (likely from another application)`
      );
      return { success: true, message: "Skipped - no supabase_user_id" };
    }

    // Verify customer ownership (security check)
    if (!customerId) {
      throw new Error(`Invoice ${invoice.id} has no customer ID`);
    }
    const ownership = await verifyCustomerOwnership(customerId, userId);

    if (!ownership.valid) {
      logWebhookError(
        "Customer-User correlation check failed for invoice payment failure",
        {
          handler: "handleInvoicePaymentFailed",
          claimedUserId: userId,
          actualUserId: ownership.actualUserId,
          stripeCustomerId: customerId,
          subscriptionId,
          invoiceId: invoice.id,
          severity: "HIGH",
        }
      );
      throw new Error(
        `Customer-User mismatch for failed invoice ${invoice.id}`
      );
    }

    logWebhookDebug("Customer-User correlation verified for invoice failure", {
      userId,
      customerId,
      subscriptionId,
    });

    // Update subscription status to past_due
    await db
      .update(profile)
      .set({
        subscriptionStatus: "past_due",
        billingVersion: sql`billing_version + 1`,
      })
      .where(eq(profile.id, userId));

    logWebhookSuccess(
      `Updated subscription status to past_due for user ${userId}`
    );

    // Log warning if this is the final attempt
    if (attemptCount >= 3) {
      logWebhookWarning(
        `Final payment attempt failed for user ${userId} - subscription will be canceled by Stripe`,
        {
          attemptCount,
          subscriptionId,
        }
      );
    }
  } catch (error) {
    logWebhookError("Error processing invoice payment failure", error);
    throw error; // Trigger Stripe retry
  }

  return { success: true };
}
