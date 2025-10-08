import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe, mapPriceToPlan } from "@/lib/stripe";
import { env } from "@/env";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Initialize Supabase client with service role key (bypasses RLS)
const supabaseAdmin = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Log webhook event to billing.events table
 */
async function logEvent(
  type: string,
  payload: unknown,
  userId?: string | null
) {
  // Log event to public schema billing_events table
  await supabaseAdmin.from("billing_events").insert({
    user_id: userId ?? null,
    type,
    payload: JSON.stringify(payload),
  });
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    session.metadata?.supabase_user_id || session.client_reference_id;

  if (!userId) {
    console.error("No user ID in checkout session metadata");
    return;
  }

  console.log("✅ Processing checkout for user:", userId);
  await logEvent("checkout.session.completed", session, userId);

  if (session.mode === "subscription") {
    // Subscription mode: fetch subscription details
    const subscriptionId = session.subscription as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    console.log(
      "📊 Full subscription object:",
      JSON.stringify(subscription, null, 2)
    );

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

    // Upsert subscription using RPC
    // Get current_period_end from subscription items (not root subscription object)
    const subscriptionItem = subscription.items.data[0];
    const currentPeriodEnd = subscriptionItem.current_period_end;
    const currentPeriodEndISO = currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null;

    console.log("💾 Upserting subscription:", {
      userId,
      subscriptionId,
      plan,
      status: subscription.status,
      currentPeriodEnd,
      currentPeriodEndISO,
    });

    // Call RPC function in public schema (Supabase client limitation)
    const { error: rpcError } = await supabaseAdmin.rpc("upsert_subscription", {
      p_user_id: userId,
      p_stripe_subscription_id: subscriptionId,
      p_plan: plan,
      p_status: subscription.status,
      p_current_period_end: currentPeriodEndISO,
      p_is_lifetime: false,
    });

    if (rpcError) {
      console.error("❌ RPC Error:", rpcError);
      throw rpcError;
    }

    console.log("✅ Subscription created successfully in database!");
  } else if (session.mode === "payment") {
    // One-time payment (lifetime)
    console.log("💰 Processing one-time payment for lifetime access");

    // Call RPC function in public schema (Supabase client limitation)
    const { error: rpcError } = await supabaseAdmin.rpc("upsert_subscription", {
      p_user_id: userId,
      p_stripe_subscription_id: null,
      p_plan: "unlimited",
      p_status: "active",
      p_current_period_end: null,
      p_is_lifetime: true,
    });

    if (rpcError) {
      console.error("❌ Failed to create lifetime subscription:", rpcError);
      throw rpcError;
    }

    console.log("✅ Lifetime subscription created successfully");
  }
}

/**
 * Handle customer.subscription.* events
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    console.error("No user ID in subscription metadata");
    return;
  }

  await logEvent("customer.subscription.updated", subscription, userId);

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

  // Get current_period_end from subscription items
  const subscriptionItem = subscription.items.data[0];
  const currentPeriodEnd = subscriptionItem?.current_period_end as
    | number
    | undefined;
  const currentPeriodEndISO = currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : null;

  // Call RPC function in public schema (Supabase client limitation)
  const { error: rpcError } = await supabaseAdmin.rpc("upsert_subscription", {
    p_user_id: userId,
    p_stripe_subscription_id: subscription.id,
    p_plan: plan,
    p_status: subscription.status,
    p_current_period_end: currentPeriodEndISO,
    p_is_lifetime: false,
  });

  if (rpcError) {
    console.error("❌ RPC Error updating subscription:", rpcError);
    throw rpcError;
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    console.error("No user ID in subscription metadata");
    return;
  }

  await logEvent("customer.subscription.deleted", subscription, userId);

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

  // Get current_period_end from subscription items
  const subscriptionItem = subscription.items.data[0];
  const currentPeriodEnd = subscriptionItem.current_period_end;
  const currentPeriodEndISO = currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : null;

  // Call RPC function in public schema (Supabase client limitation)
  const { error: rpcError } = await supabaseAdmin.rpc("upsert_subscription", {
    p_user_id: userId,
    p_stripe_subscription_id: subscription.id,
    p_plan: plan,
    p_status: "canceled",
    p_current_period_end: currentPeriodEndISO,
    p_is_lifetime: false,
  });

  if (rpcError) {
    console.error("❌ RPC Error deleting subscription:", rpcError);
    throw rpcError;
  }
}

/**
 * Main webhook handler
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    // Log all events for debugging
    await logEvent(event.type, event.data.object);

    // Handle events
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
        // These are already logged above, no additional processing needed
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
