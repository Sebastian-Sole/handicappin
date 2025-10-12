import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { createCheckoutSession, PLAN_TO_PRICE_MAP } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = (await request.json()) as { plan: string };

    if (plan !== "premium" && plan !== "unlimited") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = PLAN_TO_PRICE_MAP[plan as "premium" | "unlimited"];

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID not configured for this plan" },
        { status: 500 }
      );
    }

    console.log("Price ID:", priceId);
    console.log("User ID:", user.id);
    console.log("User Email:", user.email);
    console.log("Plan:", plan);
    console.log(
      "Success URL:",
      `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`
    );
    console.log(
      "Cancel URL:",
      `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`
    );

    // Create the checkout session
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email!,
      priceId,
      successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
    });

    console.log("Checkout session created:", session);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
