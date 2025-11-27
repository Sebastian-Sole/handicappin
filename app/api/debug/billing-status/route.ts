import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAppMetadataFromJWT } from "@/utils/supabase/jwt";

/**
 * Debug endpoint to check billing status across all layers
 *
 * This helps diagnose why users retain access after subscription expiry by showing:
 * 1. Database state (source of truth)
 * 2. JWT claims (what middleware sees)
 * 3. Session state (what client sees)
 */
export async function GET() {
  try {
    const supabase = await createServerComponentClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get session with JWT
    const { data: { session } } = await supabase.auth.getSession();

    // Extract JWT claims
    const jwtClaims = getAppMetadataFromJWT(session);
    const jwtBilling = jwtClaims?.billing;

    // Get database state (source of truth)
    const dbProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, user.id))
      .limit(1);

    const dbData = dbProfile[0];

    // Compare states
    const comparison = {
      userId: user.id,

      database: {
        plan: dbData?.planSelected || null,
        status: dbData?.subscriptionStatus || null,
        currentPeriodEnd: dbData?.currentPeriodEnd || null,
        cancelAtPeriodEnd: dbData?.cancelAtPeriodEnd || null,
        billingVersion: dbData?.billingVersion || null,
      },

      jwt: {
        plan: jwtBilling?.plan || null,
        status: jwtBilling?.status || null,
        currentPeriodEnd: jwtBilling?.current_period_end || null,
        cancelAtPeriodEnd: jwtBilling?.cancel_at_period_end || null,
        billingVersion: jwtBilling?.billing_version || null,
      },

      mismatch: {
        plan: dbData?.planSelected !== jwtBilling?.plan,
        status: dbData?.subscriptionStatus !== jwtBilling?.status,
        billingVersion: dbData?.billingVersion !== jwtBilling?.billing_version,
      },

      jwtIssuedAt: session?.expires_at ? new Date((session.expires_at - 3600) * 1000).toISOString() : null,
      jwtExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,

      diagnosis: {
        issue: null as string | null,
        solution: null as string | null,
      },
    };

    // Diagnose the issue
    if (comparison.mismatch.billingVersion) {
      comparison.diagnosis.issue = "JWT is stale - billing_version doesn't match database";
      comparison.diagnosis.solution = "Need to refresh JWT via /api/auth/sync-session or log out/in";
    } else if (comparison.database.plan === "free" && comparison.jwt.plan !== "free") {
      comparison.diagnosis.issue = "User has free plan in DB but premium in JWT";
      comparison.diagnosis.solution = "JWT needs refresh - BillingSync should handle this if Realtime is working";
    } else if (comparison.database.plan === comparison.jwt.plan) {
      comparison.diagnosis.issue = "No mismatch - JWT and database are in sync";
      comparison.diagnosis.solution = "If user still has access incorrectly, check middleware logic";
    }

    return NextResponse.json(comparison, { status: 200 });
  } catch (error) {
    console.error("❌ Debug endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
