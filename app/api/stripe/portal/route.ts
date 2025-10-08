import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { createPortalSession } from "@/lib/stripe";
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

    // 2. Get Stripe customer ID
    const customer = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, user.id))
      .limit(1);

    if (!customer[0]) {
      return NextResponse.json(
        { error: "No billing customer found" },
        { status: 404 }
      );
    }

    // 3. Create Portal Session
    const session = await createPortalSession({
      customerId: customer[0].stripeCustomerId,
      returnUrl: `${env.NEXT_PUBLIC_SITE_URL}/billing`,
    });

    // 4. Return portal URL
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
