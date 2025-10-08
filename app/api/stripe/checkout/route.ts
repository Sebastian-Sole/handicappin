import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { checkoutRequestSchema } from "@/types/billing";
import { createCheckoutSession, getOrCreateCustomer } from "@/lib/stripe";
import { env } from "@/env";
import { db } from "@/db";
import { billingCustomers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // 1. Get authenticated user
    const supabase = await createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = checkoutRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error },
        { status: 400 }
      );
    }

    const { priceId, mode } = validationResult.data;

    // 3. Get or create billing customer
    const existingCustomer = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, user.id))
      .limit(1);

    let stripeCustomerId: string;

    if (existingCustomer[0]) {
      stripeCustomerId = existingCustomer[0].stripeCustomerId;
    } else {
      // Create new Stripe customer
      stripeCustomerId = await getOrCreateCustomer(user.id, user.email!, null);

      // Store in database
      await db.insert(billingCustomers).values({
        userId: user.id,
        stripeCustomerId,
      });
    }

    // 4. Create Checkout Session
    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      mode,
      userId: user.id,
      successUrl: `${env.NEXT_PUBLIC_SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${env.NEXT_PUBLIC_SITE_URL}/onboarding`,
    });

    console.log("✅ Checkout session created:", session.id);
    console.log("🔗 Checkout URL:", session.url);

    // 5. Return checkout URL
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
