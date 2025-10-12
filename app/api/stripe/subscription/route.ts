import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { stripe, mapPriceToPlan } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the Stripe customer ID from the database
    const { data: stripeCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!stripeCustomer?.stripe_customer_id) {
      return NextResponse.json({
        hasStripeCustomer: false,
        subscriptions: [],
        error: "No Stripe customer found",
      });
    }

    // Get subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.stripe_customer_id,
      limit: 10,
      // no special expand needed for the period fields on items
    });

    const subscriptionData = subscriptions.data.map((sub) => {
      const items = sub.items.data;
      // Pick your "primary" item. If you have multiple, choose by priceId instead of [0].
      const item = items[0];

      return {
        id: sub.id,
        status: sub.status,
        currentPeriodStart: item?.current_period_start
          ? new Date(item.current_period_start * 1000)
          : null,
        currentPeriodEnd: item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null,
        priceId: item?.price.id,
        plan: mapPriceToPlan(item?.price.id || ""),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        metadata: sub.metadata,
      };
    });

    return NextResponse.json({
      hasStripeCustomer: true,
      stripeCustomerId: stripeCustomer.stripe_customer_id,
      subscriptions: subscriptionData,
    });
  } catch (error) {
    console.error("Error fetching Stripe subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription data" },
      { status: 500 }
    );
  }
}
