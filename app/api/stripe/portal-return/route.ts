import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { portalRateLimit, getIdentifier } from "@/lib/rate-limit";

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
      console.error("❌ Portal return: No user_id provided");
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Apply rate limiting (5 requests per minute per user/IP)
    const identifier = getIdentifier(request, userId);
    const { success, limit, remaining, reset } = await portalRateLimit.limit(identifier);

    if (!success) {
      console.warn(`⚠️ Portal return rate limit exceeded for ${identifier}`);
      // Still redirect but without refresh - prevents abuse
      return NextResponse.redirect(new URL(`/profile/${userId}?tab=${tab}`, request.url));
    }

    console.log(`🔄 Processing Stripe portal return for user ${userId} (${remaining}/${limit} remaining)`);

    const cookieStore = await cookies();

    // Collect cookies that need to be set
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

    // Create Supabase client with proper cookie handling
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      console.error("❌ Portal return: Authentication failed", authError);
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Refresh session server-side to get latest JWT with updated billing
    console.log("🔄 Refreshing JWT with latest billing data...");
    const { data, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.error("❌ Portal return: Session refresh failed:", refreshError);
      // Continue anyway - user can still access their profile
    } else if (data.session) {
      const billing = data.session.user.app_metadata?.billing;
      console.log("✅ JWT refreshed successfully", {
        plan: billing?.plan,
        status: billing?.status,
        billingVersion: billing?.billing_version,
      });
    }

    // Create redirect response to profile page
    const redirectUrl = new URL(`/profile/${userId}`, request.url);
    redirectUrl.searchParams.set("tab", tab);

    const response = NextResponse.redirect(redirectUrl);

    // Apply all collected cookies to the response
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    console.log(`✅ Redirecting to profile with ${cookiesToSet.length} updated cookies`);

    return response;
  } catch (error) {
    console.error("❌ Unexpected error in portal return handler:", error);
    // Fallback redirect to home
    return NextResponse.redirect(new URL("/", request.url));
  }
}