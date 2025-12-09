import { NextRequest, NextResponse } from "next/server";
import { reconcileStripeSubscriptions } from "@/lib/reconciliation/stripe-reconciliation";

/**
 * Daily reconciliation job
 * Run via Vercel Cron: 0 2 * * * (2 AM daily)
 *
 * Authenticated via CRON_SECRET environment variable.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error("[Reconciliation] Unauthorized cron request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔄 [Reconciliation] Starting scheduled job...");

    const result = await reconcileStripeSubscriptions();

    console.log("✅ [Reconciliation] Job complete:", result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("❌ [Reconciliation] Job failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
