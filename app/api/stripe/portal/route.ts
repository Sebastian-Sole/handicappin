import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { createPortalSession, stripe } from "@/lib/stripe";
import { portalRateLimit, getIdentifier } from '@/lib/rate-limit';

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
    const { success, limit, remaining, reset } = await portalRateLimit.limit(identifier);

    // Build rate limit headers
    const rateLimitHeaders = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    };

    // If rate limit exceeded, return 429
    if (!success) {
      const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);

      console.warn(`[Rate Limit] Portal rate limit exceeded for ${identifier}`);

      return NextResponse.json(
        {
          error: 'Too many portal requests. Please try again in a moment.',
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

    // Get the Stripe customer ID from the database
    const { data: stripeCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!stripeCustomer?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 404 }
      );
    }

    // Create a portal session
    const session = await createPortalSession({
      customerId: stripeCustomer.stripe_customer_id,
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/billing`,
    });

    // ✅ NEW: Include rate limit headers in success response
    return NextResponse.json({ url: session.url }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
