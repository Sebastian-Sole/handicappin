import { createServerComponentClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/refresh-claims
 *
 * Forces a JWT token refresh to immediately update billing claims.
 * This is useful after checkout completion or subscription changes
 * to avoid waiting for the automatic token refresh (~1 hour).
 *
 * How it works:
 * 1. Updates user metadata (triggers token refresh)
 * 2. Custom Access Token Hook reads latest data from profile table
 * 3. New JWT issued with updated billing claims
 * 4. Client receives fresh token with current billing info
 *
 * Returns:
 * - 200: Success with updated billing claims
 * - 401: Unauthorized (no user session)
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("JWT refresh failed: No authenticated user", userError);
      return NextResponse.json(
        { error: "Unauthorized", message: "No authenticated user" },
        { status: 401 }
      );
    }

    console.log(`🔄 JWT Refresh requested for user: ${user.id}`);

    // Force token refresh by updating user metadata
    // This triggers Supabase to issue a new JWT with updated claims
    // The custom access token hook will automatically inject latest billing data
    const { data, error } = await supabase.auth.updateUser({
      data: {
        last_claims_refresh: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("JWT refresh failed:", error);
      return NextResponse.json(
        { error: "Refresh failed", message: error.message },
        { status: 500 }
      );
    }

    const billing = data.user?.app_metadata?.billing;

    console.log("✅ JWT refresh successful:", {
      user: user.id,
      billing,
    });

    return NextResponse.json(
      {
        success: true,
        billing,
        message: "JWT claims refreshed successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("JWT refresh error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
