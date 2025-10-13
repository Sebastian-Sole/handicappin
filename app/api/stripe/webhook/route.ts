import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profile, stripeCustomers } from "@/db/schema";
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
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    logWebhookReceived(event.type);

    // Handle different event types
    switch (event.type) {
      case "customer.created":
        await handleCustomerCreated(event.data.object);
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
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

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // Signature verification failures are client errors (400)
    if (error instanceof Error && error.message.includes("signature")) {
      logWebhookError("Invalid webhook signature", error);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
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

  // For payment mode (lifetime), update plan immediately
  if (session.mode === "payment") {
    logPaymentEvent("Payment mode detected - processing lifetime plan");

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const priceId = lineItems.data[0]?.price?.id;

      logWebhookDebug("Line items", {
        count: lineItems.data.length,
        priceId,
      });

      if (priceId) {
        const plan = mapPriceToPlan(priceId);
        logWebhookDebug("Mapped price to plan", { priceId, plan });

        if (plan) {
          try {
            await db
              .update(profile)
              .set({
                planSelected: plan,
                planSelectedAt: new Date(),
                subscriptionStatus: 'active', // NEW
                currentPeriodEnd: null, // NEW: Lifetime plans have no period end
                cancelAtPeriodEnd: false, // NEW: Not canceled
                billingVersion: sql`billing_version + 1`, // NEW: Increment version
              })
              .where(eq(profile.id, userId));

            logWebhookSuccess(`Updated plan_selected to '${plan}' for user: ${userId}`);
          } catch (dbError) {
            logWebhookError(`Error updating plan for user ${userId}`, dbError);
            // Throw error to trigger webhook retry by Stripe
            throw dbError;
          }
        } else {
          logWebhookError(`Unknown price ID: ${priceId}`);
        }
      } else {
        logWebhookError("No price ID found in line items");
      }
    } catch (error) {
      logWebhookError("Error processing payment mode checkout", error);
    }
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

      logWebhookSuccess(`Updated plan_selected to '${plan}' for user: ${userId}`);
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
        subscriptionStatus: 'canceled', // NEW
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
