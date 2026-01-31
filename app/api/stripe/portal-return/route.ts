import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { portalRateLimit, getIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logging";

/**
 * Server-side Stripe portal return handler
 *
 * This route handles returns from the Stripe Customer Portal and ensures
 * the JWT is refreshed server-side before redirecting to the profile page.
 *
 * This approach is more scalable and secure than client-side useEffect:
 * - Single server-side execution (no repeated client calls)
 * - Built-in rate limiting (5 requests per minute per user)
 * - No client-side API calls
 * - Atomic operation (refresh + redirect)
 * - Server-side authentication verification
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("user_id");
    const tab = searchParams.get("tab") || "billing";

    if (!userId) {
      logger.error("❌ Portal return: No user_id provided");
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Apply rate limiting (5 requests per minute per user/IP)
    const identifier = getIdentifier(request, userId);
    const { success } = await portalRateLimit.limit(identifier);

    if (!success) {
      logger.warn(`⚠️ Portal return rate limit exceeded for ${identifier}`);
      // Still redirect but without refresh - prevents abuse
      return NextResponse.redirect(
        new URL(`/profile/${userId}?tab=${tab}`, request.url),
      );
    }

    // Validate required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error("Missing Supabase configuration", {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
      });
      return NextResponse.redirect(new URL("/", request.url));
    }

    const cookieStore = await cookies();

    // Collect cookies that need to be set
    const cookiesToSet: Array<{
      name: string;
      value: string;
      options: Partial<ResponseCookie>;
    }> = [];

    // Create Supabase client with proper cookie handling
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookies) {
            // Store cookies to be set in the response
            cookiesToSet.push(...cookies);
          },
        },
      },
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      logger.error("❌ Portal return: Authentication failed", {
        error: authError?.message,
      });
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Refresh session server-side to get latest JWT with updated billing
    const { error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      logger.error("❌ Portal return: Session refresh failed", {
        error: refreshError.message,
      });
      // Continue anyway - user can still access their profile
    }

    // Create redirect response to profile page
    const redirectUrl = new URL(`/profile/${userId}`, request.url);
    redirectUrl.searchParams.set("tab", tab);

    const response = NextResponse.redirect(redirectUrl);

    // Apply all collected cookies to the response
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (error) {
    logger.error("❌ Unexpected error in portal return handler", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Fallback redirect to home
    return NextResponse.redirect(new URL("/", request.url));
  }
}
