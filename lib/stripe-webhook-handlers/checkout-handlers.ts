import Stripe from "stripe";
import { db } from "@/db";
import { profile, stripeCustomers, pendingLifetimePurchases } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { stripe, mapPriceToPlan } from "@/lib/stripe";
import {
  logWebhookSuccess,
  logWebhookError,
  logWebhookWarning,
  logWebhookDebug,
  logWebhookInfo,
  logPaymentEvent,
  logSubscriptionEvent,
} from "@/lib/webhook-logger";
import { verifyCustomerOwnership } from "@/lib/stripe-security";
import { verifyPaymentAmount, formatAmount } from "@/utils/billing/pricing";
import { sendWelcomeEmail } from "@/lib/email-service";
import type { WebhookContext, WebhookResult } from "./types";

/**
 * Handle checkout completion - update plan_selected
 */
export async function handleCheckoutCompleted(
  ctx: WebhookContext
): Promise<WebhookResult> {
  const session = ctx.event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.supabase_user_id;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  logWebhookDebug("Checkout session details", {
    sessionId: session.id,
    mode: session.mode,
    customerId,
    metadata: session.metadata,
    paymentStatus: session.payment_status,
  });

  if (!userId) {
    // Checkout from another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping checkout session ${session.id} - no supabase_user_id in metadata (likely from another application)`
    );
    return { success: true, message: "Skipped - no supabase_user_id" };
  }

  logWebhookSuccess(`Checkout completed for user: ${userId}`);

  // Store Stripe customer ID if we have one
  if (customerId) {
    try {
      await db
        .insert(stripeCustomers)
        .values({
          userId,
          stripeCustomerId: customerId,
        })
        .onConflictDoNothing();

      logWebhookSuccess(`Stripe customer ID stored for user: ${userId}`);
    } catch (error) {
      logWebhookError("Error storing stripe customer ID", error);
    }
  } else {
    logWebhookWarning("No customer ID in checkout session");
  }

  // Retrieve expanded session data once for EARLY100 promo code validation
  const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["total_details.breakdown"],
  });

  // For subscription mode, handle subscription immediately to avoid race condition
  if (session.mode === "subscription") {
    await handleSubscriptionCheckout(session, userId, expandedSession);
    return { success: true };
  }

  // For payment mode (lifetime), check payment status first
  if (session.mode === "payment") {
    await handlePaymentCheckout(session, userId, customerId, expandedSession);
    return { success: true };
  }

  return { success: true };
}

async function handleSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  userId: string,
  expandedSession: Stripe.Checkout.Session
) {
  logSubscriptionEvent("Subscription checkout - updating plan immediately");

  try {
    // Get price ID from line items (avoids extra subscription.retrieve call)
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;

    if (!priceId) {
      throw new Error(
        `No price ID found in line items for checkout session ${session.id}`
      );
    }

    const plan = mapPriceToPlan(priceId);
    if (!plan) {
      throw new Error(
        `Unknown price ID ${priceId} in checkout session ${session.id} - cannot determine plan`
      );
    }

    // Verify subscription amount
    const lineItemPrice = lineItems.data[0]?.price;
    if (!lineItemPrice) {
      throw new Error(
        `No price found in line items for checkout session ${session.id}`
      );
    }

    const amount = lineItemPrice.unit_amount || 0;
    const currency = lineItemPrice.currency || "usd";

    const verification = verifyPaymentAmount(plan, currency, amount, true);

    if (!verification.valid) {
      logWebhookError(
        "Amount verification failed at checkout - NOT updating plan",
        {
          handler: "handleCheckoutCompleted",
          plan,
          expected: formatAmount(verification.expected),
          actual: formatAmount(verification.actual),
          variance: verification.variance,
          currency: verification.currency,
          sessionId: session.id,
          userId,
          priceId,
          severity: "HIGH",
        }
      );
      throw new Error(
        `Amount verification failed for checkout session ${session.id} - expected ${verification.expected}, got ${verification.actual}`
      );
    }

    // Verify EARLY100 promo code only used on lifetime plans
    const discounts =
      expandedSession.total_details?.breakdown?.discounts || [];
    const hasEarly100 = discounts.some((discount) => {
      const promoCode = (discount as any)?.discount?.promotion_code?.code;
      return (
        typeof promoCode === "string" && promoCode.toUpperCase() === "EARLY100"
      );
    });

    if (hasEarly100 && plan !== "lifetime") {
      logWebhookError(
        "SECURITY: EARLY100 promo code used on non-lifetime plan - NOT granting access",
        {
          handler: "handleCheckoutCompleted",
          plan,
          userId,
          sessionId: session.id,
          severity: "CRITICAL",
          action:
            "Verify Stripe promotion code restrictions are configured correctly",
        }
      );
      throw new Error(
        `EARLY100 promo code can only be used on lifetime plans - attempted use on ${plan}`
      );
    }

    logWebhookSuccess("Amount verification passed at checkout", {
      plan,
      amount: formatAmount(verification.actual),
      currency: verification.currency,
    });

    // Get user's old plan before updating
    const userProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, userId))
      .limit(1);

    const oldPlan = userProfile[0]?.planSelected || "free";
    const userEmail =
      session.customer_details?.email || session.customer_email;
    const isFirstTimeSubscription = oldPlan === "free";

    // Update plan immediately (status fields updated by subscription.created event)
    await db
      .update(profile)
      .set({
        planSelected: plan,
        planSelectedAt: new Date(),
        billingVersion: sql`billing_version + 1`,
      })
      .where(eq(profile.id, userId));

    logWebhookSuccess(
      `Updated plan_selected to '${plan}' for user: ${userId} at checkout (status will be updated by subscription.created)`
    );

    // Send welcome email for first-time subscriptions
    if (isFirstTimeSubscription && userEmail) {
      await sendWelcomeEmailSafely(userEmail, plan, userId);
    }
  } catch (error) {
    logWebhookError("Error processing subscription at checkout", error);
    throw error;
  }
}

async function handlePaymentCheckout(
  session: Stripe.Checkout.Session,
  userId: string,
  customerId: string | undefined,
  expandedSession: Stripe.Checkout.Session
) {
  logPaymentEvent("Payment mode detected - checking payment status");

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;

    logWebhookDebug("Line items", {
      count: lineItems.data.length,
      priceId,
    });

    if (!priceId) {
      throw new Error(
        `No price ID found in line items for checkout session ${session.id}`
      );
    }

    const plan = mapPriceToPlan(priceId);
    logWebhookDebug("Mapped price to plan", { priceId, plan });

    if (!plan) {
      throw new Error(
        `Unknown price ID ${priceId} in checkout session ${session.id} - cannot determine plan`
      );
    }

    // Verify customer ownership if customer ID exists
    if (customerId) {
      const ownership = await verifyCustomerOwnership(customerId, userId);

      if (!ownership.valid) {
        logWebhookError(
          "Customer-User correlation check failed for lifetime purchase",
          {
            handler: "handleCheckoutCompleted",
            mode: "payment",
            claimedUserId: userId,
            actualUserId: ownership.actualUserId,
            stripeCustomerId: customerId,
            sessionId: session.id,
            severity: "HIGH",
          }
        );
        return; // DO NOT GRANT LIFETIME ACCESS
      }

      logWebhookDebug(
        "Customer-User correlation verified for lifetime purchase",
        {
          userId,
          customerId,
        }
      );
    }

    // Verify line item price
    const lineItemPrice = lineItems.data[0]?.price;
    if (!lineItemPrice) {
      throw new Error(
        `No price found in line items for checkout session ${session.id}`
      );
    }

    const verification = verifyPaymentAmount(
      plan,
      lineItemPrice.currency || "usd",
      lineItemPrice.unit_amount || 0,
      false // lifetime is one-time payment
    );

    if (!verification.valid) {
      logWebhookError(
        "CRITICAL: Amount verification failed - NOT granting access",
        {
          handler: "handleCheckoutCompleted",
          mode: "payment",
          plan,
          expected: formatAmount(verification.expected),
          actual: formatAmount(verification.actual),
          variance: verification.variance,
          currency: verification.currency,
          sessionId: session.id,
          userId,
          priceId,
          severity: "HIGH",
          action: "Check environment variables and Stripe price configuration",
        }
      );

      throw new Error(
        `Amount verification failed for checkout session ${
          session.id
        }: expected ${formatAmount(
          verification.expected
        )}, got ${formatAmount(verification.actual)}`
      );
    }

    // Verify EARLY100 promo code only used on lifetime plans
    const paymentDiscounts =
      expandedSession.total_details?.breakdown?.discounts || [];
    const hasEarly100Payment = paymentDiscounts.some((discount) => {
      const promoCode = (discount as any)?.discount?.promotion_code?.code;
      return (
        typeof promoCode === "string" && promoCode.toUpperCase() === "EARLY100"
      );
    });

    if (hasEarly100Payment && plan !== "lifetime") {
      logWebhookError(
        "SECURITY: EARLY100 promo code used on non-lifetime plan - NOT granting access",
        {
          handler: "handleCheckoutCompleted",
          mode: "payment",
          plan,
          userId,
          sessionId: session.id,
          severity: "CRITICAL",
          action:
            "Verify Stripe promotion code restrictions are configured correctly",
        }
      );
      throw new Error(
        `EARLY100 promo code can only be used on lifetime plans - attempted use on ${plan}`
      );
    }

    logWebhookSuccess("Amount verification passed", {
      plan,
      amount: formatAmount(verification.actual),
      currency: verification.currency,
    });

    const paymentStatus = session.payment_status;
    logWebhookDebug("Payment status", {
      paymentStatus,
      sessionId: session.id,
    });

    if (paymentStatus === "paid") {
      await grantLifetimeAccess(session, userId, plan);
    } else if (paymentStatus === "unpaid") {
      await storePendingPurchase(session, userId, priceId, plan);
    } else if (paymentStatus === "no_payment_required") {
      await grantLifetimeAccess(session, userId, plan);
    } else {
      logWebhookWarning(
        `Unknown payment status: ${paymentStatus} for session ${session.id}`
      );
    }
  } catch (error) {
    logWebhookError("Error processing payment mode checkout", error);
    throw error;
  }
}

async function grantLifetimeAccess(
  session: Stripe.Checkout.Session,
  userId: string,
  plan: string
) {
  logPaymentEvent(`Payment confirmed - granting ${plan} access to user ${userId}`);

  // Get user's old plan before updating
  const userProfile = await db
    .select()
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);

  const oldPlan = userProfile[0]?.planSelected || "free";
  const userEmail =
    session.customer_details?.email || session.customer_email;
  const isFirstTimePurchase = oldPlan === "free";

  try {
    await db
      .update(profile)
      .set({
        planSelected: plan as any,
        planSelectedAt: new Date(),
        subscriptionStatus: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingVersion: sql`billing_version + 1`,
      })
      .where(eq(profile.id, userId));

    logWebhookSuccess(`Granted ${plan} access to user ${userId}`);
  } catch (dbError) {
    logWebhookError("Error updating plan", dbError);
    throw dbError;
  }

  // Send welcome email for first-time purchases
  if (isFirstTimePurchase && userEmail) {
    await sendWelcomeEmailSafely(userEmail, plan, userId);
  }
}

async function storePendingPurchase(
  session: Stripe.Checkout.Session,
  userId: string,
  priceId: string,
  plan: string
) {
  logPaymentEvent(
    `Payment pending for user ${userId} - waiting for payment_intent.succeeded`
  );

  try {
    await db
      .insert(pendingLifetimePurchases)
      .values({
        userId,
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent as string,
        priceId,
        plan: plan as "lifetime",
        status: "pending",
      })
      .onConflictDoUpdate({
        target: pendingLifetimePurchases.checkoutSessionId,
        set: {
          updatedAt: new Date(),
          paymentIntentId: session.payment_intent as string,
        },
      });

    logWebhookInfo(`Stored pending lifetime purchase for user ${userId}`);
  } catch (dbError) {
    logWebhookError("Error storing pending purchase", dbError);
    throw dbError;
  }
}

async function sendWelcomeEmailSafely(
  userEmail: string,
  plan: string,
  userId: string
) {
  try {
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

    const emailResult = await sendWelcomeEmail({
      to: userEmail,
      plan: plan as any,
      dashboardUrl,
    });

    if (!emailResult.success) {
      logWebhookWarning(
        `Welcome email failed for user ${userId}, but processing continues`,
        {
          error: emailResult.error,
        }
      );
    }
  } catch (emailError) {
    // Log but don't throw - email failure shouldn't break webhook
    logWebhookError(
      `Error sending welcome email for user ${userId} (webhook processing continues)`,
      emailError
    );
  }
}
