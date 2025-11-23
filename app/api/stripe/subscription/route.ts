import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import {
  stripe,
  mapPriceToPlan,
  updateSubscription,
  PLAN_TO_PRICE_MAP,
  createLifetimeCheckoutSession,
} from "@/lib/stripe";
import {
  sendSubscriptionUpgradedEmail,
  sendSubscriptionDowngradedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/email-service";

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

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newPlan } = (await request.json()) as {
      newPlan: "free" | "premium" | "unlimited" | "lifetime";
    };

    if (!["free", "premium", "unlimited", "lifetime"].includes(newPlan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get current plan before update
    const { data: currentProfile } = await supabase
      .from("profile")
      .select("plan_selected")
      .eq("id", user.id)
      .single();

    const currentPlan = currentProfile?.plan_selected || "free";

    // Update subscription via Stripe
    const result = await updateSubscription({
      userId: user.id,
      newPlan,
    });

    // Send email notification (non-blocking)
    const billingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/billing`;

    try {
      if (result.changeType === "upgrade" && user.email) {
        // Calculate prorated charge from subscription
        const proratedCharge =
          result.subscription?.latest_invoice &&
          typeof result.subscription.latest_invoice !== "string"
            ? (result.subscription.latest_invoice as any).amount_due || 0
            : 0;

        const currency =
          result.subscription?.items.data[0]?.price.currency || "usd";

        await sendSubscriptionUpgradedEmail({
          to: user.email,
          oldPlan: currentPlan,
          newPlan,
          proratedCharge,
          currency,
          billingUrl,
        });
      } else if (result.changeType === "downgrade" && user.email) {
        // Calculate effective date (end of current period)
        const periodEnd = result.subscription?.items?.data[0]?.current_period_end;
        const effectiveDate = periodEnd
          ? new Date(periodEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await sendSubscriptionDowngradedEmail({
          to: user.email,
          oldPlan: currentPlan,
          newPlan,
          effectiveDate,
          billingUrl,
        });
      } else if (result.changeType === "cancel" && user.email) {
        // Calculate end date (end of current period)
        const periodEnd = result.subscription?.items?.data[0]?.current_period_end;
        const endDate = periodEnd
          ? new Date(periodEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await sendSubscriptionCancelledEmail({
          to: user.email,
          plan: currentPlan,
          endDate,
          billingUrl,
        });
      }
    } catch (emailError) {
      // Log but don't fail the API request - email is secondary
      console.error("Failed to send subscription change email:", emailError);
    }

    // If changing to lifetime, return checkout URL
    if (result.requiresCheckout) {
      const priceId = PLAN_TO_PRICE_MAP.lifetime;

      const session = await createLifetimeCheckoutSession({
        userId: user.id,
        email: user.email!,
        priceId,
        successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/upgrade`,
      });

      return NextResponse.json({
        success: true,
        changeType: "lifetime",
        checkoutUrl: session.url,
      });
    }

    return NextResponse.json({
      success: true,
      changeType: result.changeType,
      message:
        result.changeType === "cancel"
          ? (result as any).alreadyCancelled
            ? "Your subscription has been cancelled. You're now on the free plan."
            : "Subscription will cancel at the end of your billing period"
          : result.changeType === "upgrade"
          ? "Plan upgraded! You'll be charged the prorated difference."
          : "Plan change scheduled for end of billing period",
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      {
        error: "Failed to update subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
