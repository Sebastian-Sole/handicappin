import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import {
  createCheckoutSession,
  createLifetimeCheckoutSession,
  PLAN_TO_PRICE_MAP,
  stripe,
} from "@/lib/stripe";
import { verifyPaymentAmount, formatAmount } from '@/utils/billing/pricing';
import { checkoutRateLimit, getIdentifier } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ NEW: Rate limiting check
    const identifier = getIdentifier(request, user.id);
    const { success, limit, remaining, reset } = await checkoutRateLimit.limit(identifier);

    // Build rate limit headers
    const rateLimitHeaders = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    };

    // If rate limit exceeded, return 429
    if (!success) {
      const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);

      console.warn(`[Rate Limit] Checkout rate limit exceeded for ${identifier}`);

      return NextResponse.json(
        {
          error: 'Too many checkout requests. Please try again in a moment.',
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            'Retry-After': retryAfterSeconds.toString(),
          },
        }
      );
    }

    const { plan } = (await request.json()) as { plan: string };

    if (plan !== "premium" && plan !== "unlimited" && plan !== "lifetime") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId =
      PLAN_TO_PRICE_MAP[plan as "premium" | "unlimited" | "lifetime"];

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID not configured for this plan" },
        { status: 500 }
      );
    }

    // ✅ NEW: Verify price ID points to correct amount (Defense in Depth)
    try {
      const price = await stripe.prices.retrieve(priceId);

      const verification = verifyPaymentAmount(
        plan as "premium" | "unlimited" | "lifetime",
        price.currency,
        price.unit_amount || 0,
        price.type === 'recurring'
      );

      if (!verification.valid) {
        console.error('❌ CRITICAL: Price verification failed at checkout', {
          plan,
          priceId,
          expected: formatAmount(verification.expected),
          actual: formatAmount(verification.actual),
          variance: verification.variance,
          severity: 'HIGH',
          action: 'Check environment variables and Stripe dashboard',
        });

        return NextResponse.json(
          { error: 'Pricing configuration error. Please contact support.' },
          { status: 500 }
        );
      }

      console.log('✅ Price verification passed at checkout', {
        plan,
        amount: formatAmount(verification.actual),
        currency: price.currency,
      });
    } catch (error) {
      console.error('❌ Failed to verify price during checkout', error);
      return NextResponse.json(
        { error: 'Failed to verify pricing' },
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

    // Create the checkout session (lifetime uses payment mode, others use subscription mode)
    const session =
      plan === "lifetime"
        ? await createLifetimeCheckoutSession({
            userId: user.id,
            email: user.email!,
            priceId,
            successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
          })
        : await createCheckoutSession({
            userId: user.id,
            email: user.email!,
            priceId,
            successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
          });

    console.log("Checkout session created:", session);

    // ✅ NEW: Include rate limit headers in success response
    return NextResponse.json({ url: session.url }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
