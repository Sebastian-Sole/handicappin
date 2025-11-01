import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profile, stripeCustomers, webhookEvents, pendingLifetimePurchases } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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

export async function POST(request: NextRequest) {
  let event: any = null; // Declare in outer scope for failure recording

  try {
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

    // Check for duplicate event
    const existingEvent = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);

    if (existingEvent.length > 0) {
      logWebhookInfo(
        `Duplicate event ${event.id} (${event.type}) - already processed at ${existingEvent[0].processedAt}`
      );
      return NextResponse.json(
        {
          received: true,
          duplicate: true,
          originalProcessedAt: existingEvent[0].processedAt,
        },
        { status: 200 }
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

        await db
          .insert(webhookEvents)
          .values({
            eventId: event.id,
            eventType: event.type,
            status: "failed",
            errorMessage: errorMessage,
            retryCount: 1,
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

        logWebhookError(`Recorded failure for ${event.type} (${event.id})`);
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
async function handleCustomerCreated(customer: any) {
  const userId = customer.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("No supabase_user_id in customer metadata");
    return;
  }

  try {
    await db
      .insert(stripeCustomers)
      .values({
        userId,
        stripeCustomerId: customer.id,
      })
      .onConflictDoNothing();

    logWebhookSuccess(`Stripe customer created for user: ${userId}`);
  } catch (error) {
    logWebhookError("Error creating stripe customer record", error);
  }
}

/**
 * Handle checkout completion - update plan_selected
 */
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;
  const customerId = session.customer;

  logWebhookDebug("Checkout session details", {
    sessionId: session.id,
    mode: session.mode,
    customerId,
    metadata: session.metadata,
    paymentStatus: session.payment_status,
  });

  if (!userId) {
    logWebhookError("No supabase_user_id in checkout session metadata", {
      metadata: session.metadata,
    });
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

  // For subscription mode, wait for subscription.created event to update plan
  if (session.mode === "subscription") {
    logSubscriptionEvent(
      "Subscription checkout - will update plan on subscription.created"
    );
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
        logWebhookError("No price ID found in line items");
        return;
      }

      const plan = mapPriceToPlan(priceId);
      logWebhookDebug("Mapped price to plan", { priceId, plan });

      if (!plan) {
        logWebhookError(`Unknown price ID: ${priceId}`);
        return;
      }

      // ✅ NEW: Check payment status before granting access
      const paymentStatus = session.payment_status;
      logWebhookDebug("Payment status", { paymentStatus, sessionId: session.id });

      if (paymentStatus === "paid") {
        // Payment confirmed - grant access immediately
        logPaymentEvent(`Payment confirmed - granting ${plan} access to user ${userId}`);

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
          logWebhookError(`Error updating plan for user ${userId}`, dbError);
          throw dbError;
        }

      } else if (paymentStatus === "unpaid") {
        // Payment pending - store for later processing
        logPaymentEvent(`Payment pending for user ${userId} - waiting for payment_intent.succeeded`);

        try {
          await db.insert(pendingLifetimePurchases).values({
            userId,
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent as string,
            priceId,
            plan: plan as "lifetime",
            status: "pending",
          }).onConflictDoUpdate({
            target: pendingLifetimePurchases.checkoutSessionId,
            set: {
              updatedAt: new Date(),
              paymentIntentId: session.payment_intent as string, // Update if webhook retries
            },
          });

          logWebhookInfo(`Stored pending lifetime purchase for user ${userId}`);
        } catch (dbError) {
          logWebhookError(`Error storing pending purchase for user ${userId}`, dbError);
          throw dbError;
        }

      } else if (paymentStatus === "no_payment_required") {
        // Free checkout (100% coupon) - grant access
        logPaymentEvent(`No payment required - granting ${plan} access to user ${userId}`);

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

          logWebhookSuccess(`Granted ${plan} access to user ${userId} (no payment required)`);
        } catch (dbError) {
          logWebhookError(`Error updating plan for user ${userId}`, dbError);
          throw dbError;
        }

      } else {
        // Unknown payment status
        logWebhookWarning(`Unknown payment status: ${paymentStatus} for session ${session.id}`);
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
async function handlePaymentIntentSucceeded(paymentIntent: any) {
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
      logWebhookInfo(`No pending lifetime purchase found for payment intent ${paymentIntentId}`);
      return;
    }

    const purchase = pendingResults[0];

    // Grant lifetime access
    logPaymentEvent(`Granting ${purchase.plan} access to user ${purchase.userId} after payment confirmation`);

    try {
      await db.update(profile).set({
        planSelected: purchase.plan,
        planSelectedAt: new Date(),
        subscriptionStatus: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingVersion: sql`billing_version + 1`,
      }).where(eq(profile.id, purchase.userId));

      logWebhookSuccess(`Granted ${purchase.plan} access to user ${purchase.userId}`);
    } catch (dbError) {
      logWebhookError(`Error updating plan for user ${purchase.userId}`, dbError);
      throw dbError;
    }

    // Mark purchase as paid
    try {
      await db.update(pendingLifetimePurchases).set({
        status: "paid",
        updatedAt: new Date(),
      }).where(eq(pendingLifetimePurchases.id, purchase.id));

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
async function handlePaymentIntentFailed(paymentIntent: any) {
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
      logWebhookInfo(`No pending lifetime purchase found for failed payment intent ${paymentIntentId}`);
      return;
    }

    const purchase = pendingResults[0];

    // Mark purchase as failed
    try {
      await db.update(pendingLifetimePurchases).set({
        status: "failed",
        updatedAt: new Date(),
      }).where(eq(pendingLifetimePurchases.id, purchase.id));

      logWebhookWarning(`Payment failed for user ${purchase.userId} - marked pending purchase ${purchase.id} as failed`);
    } catch (dbError) {
      logWebhookError(`Error marking pending purchase as failed`, dbError);
      throw dbError;
    }

    // TODO: Send email notification to user (separate ticket)
    // TODO: Consider cleanup job for old failed purchases (separate ticket)

  } catch (error) {
    logWebhookError("Error processing payment intent failed", error);
    throw error;
  }
}

/**
 * Handle subscription changes - update plan_selected
 */
async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("No supabase_user_id in subscription metadata");
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    logWebhookError("No price ID in subscription");
    return;
  }

  const plan = mapPriceToPlan(priceId);
  if (!plan) {
    logWebhookError(`Unknown price ID: ${priceId}`);
    return;
  }

  // Only update if subscription is active
  if (subscription.status === "active" || subscription.status === "trialing") {
    try {
      await db
        .update(profile)
        .set({
          planSelected: plan,
          planSelectedAt: new Date(),
          subscriptionStatus: subscription.status, // NEW: active, trialing, etc.
          currentPeriodEnd: subscription.current_period_end, // NEW: unix timestamp
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false, // NEW: Critical for graceful cancellation
          billingVersion: sql`billing_version + 1`, // NEW: Increment version
        })
        .where(eq(profile.id, userId));

      logWebhookSuccess(
        `Updated plan_selected to '${plan}' for user: ${userId}`
      );
    } catch (error) {
      logWebhookError(`Error updating plan for user ${userId}`, error);
      // Throw error to trigger webhook retry by Stripe
      throw error;
    }
  }
}

/**
 * Handle subscription deletion - revert to free tier
 */
async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("No supabase_user_id in subscription metadata");
    return;
  }

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
  } catch (error) {
    logWebhookError(`Error reverting user ${userId} to free tier`, error);
    // Throw error to trigger webhook retry by Stripe
    throw error;
  }
}

/**
 * Extract user ID from event metadata
 * Handles different event structures (customer, session, subscription)
 */
function extractUserId(event: any): string | null {
  // Try subscription metadata
  if (event.data.object.metadata?.supabase_user_id) {
    return event.data.object.metadata.supabase_user_id;
  }

  // Try session/checkout metadata
  if (event.data.object.metadata?.supabase_user_id) {
    return event.data.object.metadata.supabase_user_id;
  }

  return null;
}
