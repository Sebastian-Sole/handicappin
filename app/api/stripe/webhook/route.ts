import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profile, stripeCustomers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe, mapPriceToPlan } from "@/lib/stripe";

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

    console.log(`📥 Received webhook event: ${event.type}`);

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
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 400 }
    );
  }
}

/**
 * Handle customer creation
 */
async function handleCustomerCreated(customer: any) {
  const userId = customer.metadata?.supabase_user_id;

  if (!userId) {
    console.error("No supabase_user_id in customer metadata");
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

    console.log("✅ Stripe customer created for user:", userId);
  } catch (error) {
    console.error("Error creating stripe customer record:", error);
  }
}

/**
 * Handle checkout completion - update plan_selected
 */
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;
  const customerId = session.customer;

  console.log("🔍 Checkout session details:", {
    sessionId: session.id,
    mode: session.mode,
    customerId,
    metadata: session.metadata,
    paymentStatus: session.payment_status,
  });

  if (!userId) {
    console.error("❌ No supabase_user_id in checkout session metadata");
    console.error("Session metadata:", session.metadata);
    return;
  }

  console.log("✅ Checkout completed for user:", userId);

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

      console.log("✅ Stripe customer ID stored for user:", userId);
    } catch (error) {
      console.error("❌ Error storing stripe customer ID:", error);
    }
  } else {
    console.warn("⚠️ No customer ID in checkout session");
  }

  // For subscription mode, wait for subscription.created event to update plan
  if (session.mode === "subscription") {
    console.log(
      "📝 Subscription checkout - will update plan on subscription.created"
    );
    return;
  }

  // For payment mode (lifetime), update plan immediately
  if (session.mode === "payment") {
    console.log("💳 Payment mode detected - processing lifetime plan");

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const priceId = lineItems.data[0]?.price?.id;

      console.log("🔍 Line items:", {
        count: lineItems.data.length,
        priceId,
      });

      if (priceId) {
        const plan = mapPriceToPlan(priceId);
        console.log(`🔍 Mapped price ${priceId} to plan: ${plan}`);

        if (plan) {
          await db
            .update(profile)
            .set({
              planSelected: plan,
              planSelectedAt: new Date(),
            })
            .where(eq(profile.id, userId));

          console.log(`✅ Updated plan_selected to '${plan}' for user:`, userId);
        } else {
          console.error(`❌ Unknown price ID: ${priceId}`);
        }
      } else {
        console.error("❌ No price ID found in line items");
      }
    } catch (error) {
      console.error("❌ Error processing payment mode checkout:", error);
    }
  }
}

/**
 * Handle subscription changes - update plan_selected
 */
async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    console.error("No supabase_user_id in subscription metadata");
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error("No price ID in subscription");
    return;
  }

  const plan = mapPriceToPlan(priceId);
  if (!plan) {
    console.error("Unknown price ID:", priceId);
    return;
  }

  // Only update if subscription is active
  if (subscription.status === "active" || subscription.status === "trialing") {
    await db
      .update(profile)
      .set({
        planSelected: plan,
        planSelectedAt: new Date(),
      })
      .where(eq(profile.id, userId));

    console.log(`✅ Updated plan_selected to '${plan}' for user:`, userId);
  }
}

/**
 * Handle subscription deletion - revert to free tier
 */
async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    console.error("No supabase_user_id in subscription metadata");
    return;
  }

  // Revert to free tier
  await db
    .update(profile)
    .set({
      planSelected: "free",
      planSelectedAt: new Date(),
    })
    .where(eq(profile.id, userId));

  console.log("✅ Reverted to free tier for user:", userId);
}
