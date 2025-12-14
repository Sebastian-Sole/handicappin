import { NextRequest, NextResponse } from "next/server";
import { reconcileStripeSubscriptions } from "@/lib/reconciliation/stripe-reconciliation";
import { logger } from "@/lib/logging";

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
      logger.error("[Reconciliation] Unauthorized cron request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("🔄 [Reconciliation] Starting scheduled job");

    const result = await reconcileStripeSubscriptions();

    logger.info("✅ [Reconciliation] Job complete", result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("❌ [Reconciliation] Job failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
