import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
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
 * Handle customer.created event - create local customer record
 */
async function handleCustomerCreated(customer: Stripe.Customer) {
  const userId = customer.metadata?.supabase_user_id;

  if (!userId) {
    console.error("No supabase_user_id in customer metadata");
    return;
  }

  console.log("✅ Creating Stripe customer record for user:", userId);

  // Insert customer record into local table
  const { error } = await supabaseAdmin.from("stripe_customers").upsert({
    user_id: userId,
    stripe_customer_id: customer.id,
  });

  if (error) {
    console.error("❌ Failed to create customer record:", error);
    throw error;
  }

  console.log("✅ Customer record created successfully");
}

/**
 * Main webhook handler - simplified to only handle essential events
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
    console.log(`📨 Processing webhook event: ${event.type}`);

    // Handle only essential events
    switch (event.type) {
      case "customer.created":
        await handleCustomerCreated(event.data.object);
        break;

      case "checkout.session.completed":
        // Just log - access control will query Stripe directly
        console.log(
          "✅ Checkout completed for customer:",
          event.data.object.customer
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // Just log - access control will query Stripe directly
        console.log(
          `📊 Subscription ${event.type} for customer:`,
          event.data.object.customer
        );
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
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
