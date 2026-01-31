import Stripe from "stripe";
import { db } from "@/db";
import { profile, pendingLifetimePurchases } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import {
  logWebhookSuccess,
  logWebhookError,
  logWebhookWarning,
  logWebhookInfo,
  logPaymentEvent,
} from "@/lib/webhook-logger";
import { sendWelcomeEmail } from "@/lib/email-service";
import type { WebhookContext, WebhookResult } from "./types";

/**
 * Handle payment intent succeeded - grant access for pending lifetime purchases
 */
export async function handlePaymentIntentSucceeded(
  ctx: WebhookContext
): Promise<WebhookResult> {
  const paymentIntent = ctx.event.data.object as Stripe.PaymentIntent;
  const paymentIntentId = paymentIntent.id;

  logPaymentEvent(`Payment intent succeeded: ${paymentIntentId}`);

  try {
    // Find pending lifetime purchase
    const pendingResults = await db
      .select()
      .from(pendingLifetimePurchases)
      .where(eq(pendingLifetimePurchases.paymentIntentId, paymentIntentId))
      .limit(1);

    if (pendingResults.length === 0) {
      // Not a lifetime purchase or already processed
      logWebhookInfo(
        `No pending lifetime purchase found for payment intent ${paymentIntentId}`
      );
      return { success: true, message: "No pending purchase found" };
    }

    const purchase = pendingResults[0];

    // Grant lifetime access
    logPaymentEvent(
      `Granting ${purchase.plan} access to user ${purchase.userId} after payment confirmation`
    );

    // Get user's old plan before updating
    const userProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, purchase.userId))
      .limit(1);

    const oldPlan = userProfile[0]?.planSelected || "free";
    // Get email from payment intent receipt_email or fetch from checkout session
    let userEmail = paymentIntent.receipt_email || undefined;

    // Fallback: If no receipt_email, try to get email from the original checkout session
    if (!userEmail && purchase.checkoutSessionId) {
      try {
        const checkoutSession = await stripe.checkout.sessions.retrieve(
          purchase.checkoutSessionId
        );
        userEmail =
          checkoutSession.customer_details?.email ||
          checkoutSession.customer_email ||
          undefined;
      } catch (sessionError) {
        logWebhookWarning(
          `Could not retrieve checkout session for email fallback`,
          {
            checkoutSessionId: purchase.checkoutSessionId,
            error:
              sessionError instanceof Error
                ? sessionError.message
                : "Unknown error",
          }
        );
      }
    }

    const isFirstTimePurchase = oldPlan === "free";

    try {
      await db
        .update(profile)
        .set({
          planSelected: purchase.plan,
          planSelectedAt: new Date(),
          subscriptionStatus: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          billingVersion: sql`billing_version + 1`,
        })
        .where(eq(profile.id, purchase.userId));

      logWebhookSuccess(
        `Granted ${purchase.plan} access to user ${purchase.userId}`
      );
    } catch (dbError) {
      logWebhookError("Error updating plan", dbError);
      throw dbError;
    }

    // Send welcome email for first-time purchases
    if (isFirstTimePurchase && userEmail) {
      try {
        const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

        const emailResult = await sendWelcomeEmail({
          to: userEmail,
          plan: purchase.plan,
          dashboardUrl,
        });

        if (!emailResult.success) {
          logWebhookWarning(
            `Welcome email failed for user ${purchase.userId}, but plan grant continues`,
            {
              error: emailResult.error,
            }
          );
        }
      } catch (emailError) {
        // Log but don't throw - email failure shouldn't break webhook
        logWebhookError(
          `Error sending welcome email for user ${purchase.userId} (webhook processing continues)`,
          emailError
        );
      }
    }

    // Mark purchase as paid
    try {
      await db
        .update(pendingLifetimePurchases)
        .set({
          status: "paid",
          updatedAt: new Date(),
        })
        .where(eq(pendingLifetimePurchases.id, purchase.id));

      logWebhookSuccess(`Marked pending purchase ${purchase.id} as paid`);
    } catch (dbError) {
      logWebhookError(`Error updating pending purchase status`, dbError);
      // Don't throw - access was granted successfully
    }
  } catch (error) {
    logWebhookError("Error processing payment intent succeeded", error);
    throw error;
  }

  return { success: true };
}

/**
 * Handle payment intent failed - mark pending lifetime purchase as failed
 */
export async function handlePaymentIntentFailed(
  ctx: WebhookContext
): Promise<WebhookResult> {
  const paymentIntent = ctx.event.data.object as Stripe.PaymentIntent;
  const paymentIntentId = paymentIntent.id;

  logPaymentEvent(`Payment intent failed: ${paymentIntentId}`);

  try {
    // Find pending lifetime purchase
    const pendingResults = await db
      .select()
      .from(pendingLifetimePurchases)
      .where(eq(pendingLifetimePurchases.paymentIntentId, paymentIntentId))
      .limit(1);

    if (pendingResults.length === 0) {
      // Not a lifetime purchase or already processed
      logWebhookInfo(
        `No pending lifetime purchase found for failed payment intent ${paymentIntentId}`
      );
      return { success: true, message: "No pending purchase found" };
    }

    const purchase = pendingResults[0];

    // Mark purchase as failed
    try {
      await db
        .update(pendingLifetimePurchases)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(pendingLifetimePurchases.id, purchase.id));

      logWebhookWarning(
        `Payment failed for user ${purchase.userId} - marked pending purchase ${purchase.id} as failed`
      );
    } catch (dbError) {
      logWebhookError(`Error marking pending purchase as failed`, dbError);
      throw dbError;
    }
  } catch (error) {
    logWebhookError("Error processing payment intent failed", error);
    throw error;
  }

  return { success: true };
}
