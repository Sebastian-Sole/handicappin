import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  profile,
  stripeCustomers,
  webhookEvents,
  pendingLifetimePurchases,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { stripe, mapPriceToPlan } from "@/lib/stripe";
import {
  logWebhookReceived,
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
import { webhookRateLimit, getIdentifier } from "@/lib/rate-limit";
import { shouldAlertAdmin, sendAdminWebhookAlert } from "@/lib/admin-alerts";
import { sendWelcomeEmail } from "@/lib/email-service";
import { logger } from "@/lib/logging";

export async function POST(request: NextRequest) {
  let event: Stripe.Event | null = null; // Declare in outer scope for failure recording

  try {
    // ✅ NEW: Rate limiting check (IP-based, no user context)
    const identifier = getIdentifier(request); // No userId = uses IP
    const { success, limit, remaining, reset } = await webhookRateLimit.limit(
      identifier
    );

    logger.debug(`[Webhook] Rate limit check for ${identifier}`, {
      success,
      limit,
      remaining,
      reset,
    });

    if (!success) {
      const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);

      logger.warn(`[Rate Limit] Webhook rate limit exceeded for ${identifier}`);

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "No signature provided" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    logWebhookReceived(event.type);

    // Check for duplicate event (only block successful duplicates)
    const existingEvent = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);

    if (existingEvent.length > 0 && existingEvent[0].status === "success") {
      logWebhookInfo(
        `Duplicate event ${event.id} (${event.type}) - already processed successfully at ${existingEvent[0].processedAt}`
      );
      return NextResponse.json(
        {
          received: true,
          duplicate: true,
          originalProcessedAt: existingEvent[0].processedAt,
        },
        { status: 200 }
      );
    } else if (
      existingEvent.length > 0 &&
      existingEvent[0].status === "failed"
    ) {
      logWebhookInfo(
        `Retry detected for failed event ${event.id} (retry #${
          (existingEvent[0].retryCount || 0) + 1
        })`
      );
    }

    // Handle different event types
    switch (event.type) {
      case "customer.created":
        await handleCustomerCreated(event.data.object);
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object);
        break;

      default:
        logWebhookInfo(`Unhandled event type: ${event.type}`);
    }

    // Record successful processing
    const userId = extractUserId(event);

    try {
      await db.insert(webhookEvents).values({
        eventId: event.id,
        eventType: event.type,
        status: "success",
        userId: userId,
      });

      logWebhookSuccess(
        `Recorded successful processing of ${event.type} (${event.id})`
      );
    } catch (recordError) {
      // Log but don't fail webhook - event was processed successfully
      logWebhookError(
        "Failed to record webhook event (event was processed successfully)",
        recordError
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // Signature verification failures are client errors (400)
    if (error instanceof Error && error.message.includes("signature")) {
      logWebhookError("Invalid webhook signature", error);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Record processing failure (only if event was validated)
    if (event?.id) {
      try {
        const userId = extractUserId(event);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Get or increment retry count
        const existingEvent = await db
          .select()
          .from(webhookEvents)
          .where(eq(webhookEvents.eventId, event.id))
          .limit(1);

        const retryCount =
          existingEvent.length > 0 ? (existingEvent[0].retryCount || 0) + 1 : 1;

        await db
          .insert(webhookEvents)
          .values({
            eventId: event.id,
            eventType: event.type,
            status: "failed",
            errorMessage: errorMessage,
            retryCount: retryCount,
            userId: userId,
          })
          .onConflictDoUpdate({
            target: webhookEvents.eventId,
            set: {
              retryCount: sql`${webhookEvents.retryCount} + 1`,
              errorMessage: errorMessage,
              processedAt: sql`CURRENT_TIMESTAMP`,
            },
          });

        logWebhookError(
          `Recorded failure for ${event.type} (${event.id}), retry count: ${retryCount}`
        );

        // ✅ NEW: Alert admin if retry count >= 3
        if (shouldAlertAdmin(retryCount)) {
          const eventObject = event.data.object as any;
          await sendAdminWebhookAlert({
            userId: userId || "unknown",
            eventId: event.id,
            eventType: event.type,
            sessionId: eventObject.id, // Checkout session ID if applicable
            customerId: eventObject.customer,
            subscriptionId: eventObject.subscription,
            errorMessage,
            retryCount,
            timestamp: new Date(),
          });
        }
      } catch (recordError) {
        logWebhookError("Failed to record webhook failure", recordError);
      }
    }

    // All other errors are server errors (500)
    logWebhookError("Webhook handler failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle customer creation
 */
async function handleCustomerCreated(customer: Stripe.Customer) {
  const userId = customer.metadata?.supabase_user_id;

  if (!userId) {
    // Customer created by another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping customer ${customer.id} - no supabase_user_id in metadata (likely from another application)`
    );
    return;
  }

  try {
    // ✅ NEW: Check if user already has a customer (defensive)
    const existingCustomer = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1);

    if (existingCustomer.length > 0) {
      // Check if it's the same customer (race condition) or different (security issue)
      if (existingCustomer[0].stripeCustomerId === customer.id) {
        // Same customer - just a race between checkout API and webhook
        logWebhookInfo(
          `Customer ${customer.id} already stored for user ${userId} (race condition - checkout API vs webhook)`
        );
        return;
      } else {
        // Different customer - this is a real security concern
        logWebhookWarning(
          "🚨 SECURITY: Attempt to create duplicate customer for user",
          {
            userId,
            existingCustomerId: existingCustomer[0].stripeCustomerId,
            newCustomerId: customer.id,
            severity: "HIGH",
          }
        );
        throw new Error(
          `Security: User already has customer ${existingCustomer[0].stripeCustomerId}, cannot create duplicate customer ${customer.id}`
        );
      }
    }

    // Proceed with customer creation
    await db
      .insert(stripeCustomers)
      .values({
        userId,
        stripeCustomerId: customer.id,
      })
      .onConflictDoNothing(); // Still keep this as safety net

    logWebhookSuccess(`Stripe customer created for user: ${userId}`);
  } catch (error) {
    logWebhookError("Error creating stripe customer record", error);
  }
}

/**
 * Handle checkout completion - update plan_selected
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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
    return;
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
    logSubscriptionEvent("Subscription checkout - updating plan immediately");

    try {
      // Get price ID from line items (avoids extra subscription.retrieve call)
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );
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
          "🚨 Amount verification failed at checkout - NOT updating plan",
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

      // ✅ NEW: Verify EARLY100 promo code only used on lifetime plans
      const discounts =
        expandedSession.total_details?.breakdown?.discounts || [];
      const hasEarly100 = discounts.some((discount) => {
        const promoCode = (discount as any)?.discount?.promotion_code?.code;
        return (
          typeof promoCode === "string" &&
          promoCode.toUpperCase() === "EARLY100"
        );
      });

      if (hasEarly100 && plan !== "lifetime") {
        logWebhookError(
          "🚨 SECURITY: EARLY100 promo code used on non-lifetime plan - NOT granting access",
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

      logWebhookSuccess("✅ Amount verification passed at checkout", {
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
      // Get email from session.customer_details (email is in auth.users, not profile)
      const userEmail = session.customer_details?.email || session.customer_email;
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

      // ✅ Send welcome email for first-time subscriptions
      if (isFirstTimeSubscription && userEmail) {
        try {
          const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

          const emailResult = await sendWelcomeEmail({
            to: userEmail,
            plan,
            dashboardUrl,
          });

          if (!emailResult.success) {
            logWebhookWarning(
              `Welcome email failed for user ${userId}, but subscription processing continues`,
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
    } catch (error) {
      logWebhookError("Error processing subscription at checkout", error);
      throw error;
    }

    return;
  }

  // For payment mode (lifetime), check payment status first
  if (session.mode === "payment") {
    logPaymentEvent("Payment mode detected - checking payment status");

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );
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

      // ✅ NEW: Verify customer ownership if customer ID exists
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
          return; // ❌ DO NOT GRANT LIFETIME ACCESS
        }

        logWebhookDebug(
          "Customer-User correlation verified for lifetime purchase",
          {
            userId,
            customerId,
          }
        );
      }

      // Continue with existing payment status logic (no changes below)...
      // ✅ NEW: Check payment status before granting access
      const paymentStatus = session.payment_status;
      logWebhookDebug("Payment status", {
        paymentStatus,
        sessionId: session.id,
      });

      // ✅ NEW: Verify line item price (NOT session total, to support 100% coupons)
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
          "🚨 CRITICAL: Amount verification failed - NOT granting access",
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
            action:
              "Check environment variables and Stripe price configuration",
          }
        );

        // ❌ DO NOT GRANT ACCESS - Throw error for retry
        throw new Error(
          `Amount verification failed for checkout session ${
            session.id
          }: expected ${formatAmount(
            verification.expected
          )}, got ${formatAmount(verification.actual)}`
        );
      }

      // ✅ NEW: Verify EARLY100 promo code only used on lifetime plans
      const paymentDiscounts =
        expandedSession.total_details?.breakdown?.discounts || [];
      const hasEarly100Payment = paymentDiscounts.some((discount) => {
        const promoCode = (discount as any)?.discount?.promotion_code?.code;
        return (
          typeof promoCode === "string" &&
          promoCode.toUpperCase() === "EARLY100"
        );
      });

      if (hasEarly100Payment && plan !== "lifetime") {
        logWebhookError(
          "🚨 SECURITY: EARLY100 promo code used on non-lifetime plan - NOT granting access",
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

      logWebhookSuccess("✅ Amount verification passed", {
        plan,
        amount: formatAmount(verification.actual),
        currency: verification.currency,
      });

      if (paymentStatus === "paid") {
        // Payment confirmed - grant access immediately
        logPaymentEvent(
          `Payment confirmed - granting ${plan} access to user ${userId}`
        );

        // Get user's old plan before updating
        const userProfile = await db
          .select()
          .from(profile)
          .where(eq(profile.id, userId))
          .limit(1);

        const oldPlan = userProfile[0]?.planSelected || "free";
        // Get email from Stripe session (email is in auth.users, not profile)
      const userEmail = session.customer_details?.email || session.customer_email;
        const isFirstTimePurchase = oldPlan === "free";

        try {
          await db
            .update(profile)
            .set({
              planSelected: plan,
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

        // ✅ Send welcome email for first-time purchases
        if (isFirstTimePurchase && userEmail) {
          try {
            const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

            const emailResult = await sendWelcomeEmail({
              to: userEmail,
              plan,
              dashboardUrl,
            });

            if (!emailResult.success) {
              logWebhookWarning(
                `Welcome email failed for user ${userId}, but plan grant continues`,
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
      } else if (paymentStatus === "unpaid") {
        // Payment pending - store for later processing
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
                paymentIntentId: session.payment_intent as string, // Update if webhook retries
              },
            });

          logWebhookInfo(`Stored pending lifetime purchase for user ${userId}`);
        } catch (dbError) {
          logWebhookError("Error storing pending purchase", dbError);
          throw dbError;
        }
      } else if (paymentStatus === "no_payment_required") {
        // Free checkout (100% coupon) - grant access
        logPaymentEvent(
          `No payment required - granting ${plan} access to user ${userId}`
        );

        // Get user's old plan before updating
        const userProfile = await db
          .select()
          .from(profile)
          .where(eq(profile.id, userId))
          .limit(1);

        const oldPlan = userProfile[0]?.planSelected || "free";
        // Get email from Stripe session (email is in auth.users, not profile)
      const userEmail = session.customer_details?.email || session.customer_email;
        const isFirstTimePurchase = oldPlan === "free";

        try {
          await db
            .update(profile)
            .set({
              planSelected: plan,
              planSelectedAt: new Date(),
              subscriptionStatus: "active",
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              billingVersion: sql`billing_version + 1`,
            })
            .where(eq(profile.id, userId));

          logWebhookSuccess(
            `Granted ${plan} access to user ${userId} (no payment required)`
          );
        } catch (dbError) {
          logWebhookError("Error updating plan", dbError);
          throw dbError;
        }

        // ✅ Send welcome email for first-time purchases
        if (isFirstTimePurchase && userEmail) {
          try {
            const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

            const emailResult = await sendWelcomeEmail({
              to: userEmail,
              plan,
              dashboardUrl,
            });

            if (!emailResult.success) {
              logWebhookWarning(
                `Welcome email failed for user ${userId}, but plan grant continues`,
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
      } else {
        // Unknown payment status
        logWebhookWarning(
          `Unknown payment status: ${paymentStatus} for session ${session.id}`
        );
      }
    } catch (error) {
      logWebhookError("Error processing payment mode checkout", error);
      throw error;
    }
  }
}

/**
 * Handle payment intent succeeded - grant access for pending lifetime purchases
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
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
      return;
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
        const checkoutSession = await stripe.checkout.sessions.retrieve(purchase.checkoutSessionId);
        userEmail = checkoutSession.customer_details?.email || checkoutSession.customer_email || undefined;
      } catch (sessionError) {
        logWebhookWarning(`Could not retrieve checkout session for email fallback`, {
          checkoutSessionId: purchase.checkoutSessionId,
          error: sessionError instanceof Error ? sessionError.message : "Unknown error",
        });
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

    // ✅ Send welcome email for first-time purchases
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
}

/**
 * Handle payment intent failed - mark pending lifetime purchase as failed
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
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
      return;
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

    // NOTE: Payment failure emails removed - Stripe Checkout shows errors in real-time
    // Users are unlikely to leave the page before seeing the error
    // For async failures (rare), the /billing/success page polls for status
    // If needed in future, Stripe can be configured to send built-in payment failure emails

    // TODO: Consider cleanup job for old failed purchases (separate ticket)
  } catch (error) {
    logWebhookError("Error processing payment intent failed", error);
    throw error;
  }
}

/**
 * Handle failed invoice payment (subscription payment declined)
 * Updates subscription status to reflect payment failure
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
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
    return;
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
      return;
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

    // TODO: Send email notification (separate ticket)
    // await sendPaymentFailureEmail({
    //   userId,
    //   attemptCount,
    //   nextAttemptDate: nextPaymentAttempt ? new Date(nextPaymentAttempt * 1000) : null,
    // });
  } catch (error) {
    logWebhookError("Error processing invoice payment failure", error);
    throw error; // Trigger Stripe retry
  }
}

/**
 * Handle charge refunds (full or partial)
 * Revokes access for full refunds of lifetime purchases
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
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
    return;
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
      return;
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

      // TODO: Send email notification (separate ticket)
      // await sendRefundNotificationEmail({ userId, amount: amountRefunded });
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
}

/**
 * Handle charge disputes (chargebacks)
 * Logs security alert for manual review - does NOT automatically revoke access
 */
async function handleDisputeCreated(dispute: Stripe.Dispute) {
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
    return;
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
      return;
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
      return;
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
    logger.error("🚨 SECURITY ALERT: Charge dispute filed", {
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

    // TODO: Send alert to admin (separate ticket)
    // await sendDisputeAlert({
    //   userId,
    //   disputeId,
    //   amount,
    //   reason,
    // });

    // TODO: Flag user account for review (separate ticket)
    // await flagUserAccountForReview(userId, 'dispute_filed');

    // IMPORTANT: Do NOT automatically revoke access
    // Wait for dispute resolution (charge.dispute.closed)
    logWebhookInfo(
      "No automatic action taken - waiting for dispute resolution"
    );
  } catch (error) {
    logWebhookError("Error processing dispute notification", error);
    throw error; // Trigger Stripe retry
  }
}

/**
 * Handle subscription changes - update plan_selected
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!userId) {
    // Subscription from another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping subscription ${subscription.id} - no supabase_user_id in metadata (likely from another application)`
    );
    return;
  }

  if (!customerId) {
    throw new Error(`Missing customer ID in subscription ${subscription.id}`);
  }

  // ✅ NEW: Verify customer belongs to this user
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
      }
    );
    throw new Error(
      `Customer-User mismatch for subscription ${subscription.id}`
    );
  }

  logWebhookDebug("Customer-User correlation verified", {
    userId,
    customerId,
  });

  // Continue with existing logic (no changes below)...
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error(
      `No price ID in subscription ${subscription.id} for user ${userId}`
    );
  }

  const plan = mapPriceToPlan(priceId);
  if (!plan) {
    throw new Error(
      `Unknown price ID ${priceId} in subscription ${subscription.id} for user ${userId}`
    );
  }

  // ✅ NEW: Verify subscription amount
  const price = subscription.items.data[0]?.price;
  if (!price) {
    throw new Error(
      `No price object in subscription ${subscription.id} for user ${userId}`
    );
  }

  const amount = price.unit_amount || 0;
  const currency = price.currency || "usd";

  const verification = verifyPaymentAmount(
    plan,
    currency,
    amount,
    true // subscription is recurring
  );

  if (!verification.valid) {
    logWebhookError(
      "🚨 CRITICAL: Subscription amount verification failed - NOT updating plan",
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
      }
    );
    throw new Error(
      `Amount verification failed for subscription ${subscription.id}`
    );
  }

  logWebhookSuccess("✅ Subscription amount verification passed", {
    plan,
    amount: formatAmount(verification.actual),
    currency: verification.currency,
  });

  // Log subscription details BEFORE condition check
  logger.debug("🔍 [Webhook] Subscription change details", {
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
      // Stripe can represent this in two ways:
      // 1. cancel_at_period_end: true
      // 2. cancel_at: <timestamp> (scheduled cancellation)
      const isCancelling = subscription.cancel_at_period_end || !!subscription.cancel_at;

      const updateData = {
        planSelected: plan,
        planSelectedAt: new Date(),
        subscriptionStatus: subscription.status, // NEW: active, trialing, etc.
        currentPeriodEnd: subscription.items.data[0]?.current_period_end, // NEW: unix timestamp
        cancelAtPeriodEnd: isCancelling, // FIX: Check both cancel_at_period_end AND cancel_at
        billingVersion: sql`billing_version + 1`, // NEW: Increment version
      };

      logger.debug("🔍 [Webhook] About to update profile with", {
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

      logger.debug("🔍 [Webhook] Database update result", { result });

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

      logger.debug("🔍 [Webhook] Verified database state after update", {
        userId,
        dbState: verifyProfile[0],
      });

      logWebhookSuccess(
        `Updated plan_selected to '${plan}' for user: ${userId} (status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}, cancel_at: ${subscription.cancel_at}, isCancelling: ${isCancelling})`
      );
    } catch (error) {
      logWebhookError("Error updating plan", error);
      // Throw error to trigger webhook retry by Stripe
      throw error;
    }
  } else {
    logger.warn("⚠️ [Webhook] Skipping database update - subscription status not active/trialing", {
      subscriptionId: subscription.id,
      userId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }
}

/**
 * Handle subscription deletion - revert to free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!userId) {
    // Subscription from another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping deleted subscription ${subscription.id} - no supabase_user_id in metadata (likely from another application)`
    );
    return;
  }

  if (!customerId) {
    throw new Error(
      `Missing customer ID in deleted subscription ${subscription.id}`
    );
  }

  // ✅ NEW: Verify customer belongs to this user
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
      }
    );
    throw new Error(
      `Customer-User mismatch in subscription deletion ${subscription.id}`
    );
  }

  // Continue with existing logic (no changes below)...
  // Revert to free tier
  try {
    await db
      .update(profile)
      .set({
        planSelected: "free",
        planSelectedAt: new Date(),
        subscriptionStatus: "canceled", // NEW
        currentPeriodEnd: null, // NEW
        cancelAtPeriodEnd: false, // NEW: No longer relevant after deletion
        billingVersion: sql`billing_version + 1`, // NEW: Increment version
      })
      .where(eq(profile.id, userId));

    logWebhookSuccess(`Reverted to free tier for user: ${userId}`);
    logger.info(`📊 [Webhook] Billing version incremented for user ${userId} - BillingSync should detect within seconds`);
  } catch (error) {
    logWebhookError("Error reverting user to free tier", error);
    // Throw error to trigger webhook retry by Stripe
    throw error;
  }
}

/**
 * Extract user ID from event metadata
 * Handles different event structures (customer, session, subscription)
 */
function extractUserId(event: Stripe.Event): string | null {
  // Try metadata from event object
  const object = event.data.object as any; // Stripe events have various object types
  return object.metadata?.supabase_user_id || null;
}
