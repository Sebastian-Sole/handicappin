import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side session refresh endpoint
 *
 * Called by BillingSync (client-side) after detecting billing changes.
 * Refreshes the session server-side to update HTTP-only cookies.
 *
 * This ensures middleware sees the latest JWT claims on next request.
 *
 * IMPORTANT: This route uses createServerClient (not createServerComponentClient)
 * because we need to set cookies in the response, which requires proper cookie handling.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration:", {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
      });
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();

    // Collect cookies that need to be set
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

    // Create Supabase client with proper cookie handling for route handlers
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
      }
    );

    // Refresh session server-side (this will trigger setAll with new cookies)
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error("❌ Server-side session refresh failed:", error);
      return NextResponse.json(
        { error: "Session refresh failed", details: error.message },
        { status: 500 }
      );
    }

    if (!data.session) {
      console.error("❌ No session returned from refresh");
      return NextResponse.json(
        { error: "No session found" },
        { status: 401 }
      );
    }

    // Extract billing claims from new JWT
    const billing = data.session.user.app_metadata?.billing;

    console.log("✅ Server-side session refreshed successfully", {
      userId: data.session.user.id,
      plan: billing?.plan,
      status: billing?.status,
      billingVersion: billing?.billing_version,
      cookiesUpdated: cookiesToSet.length,
    });

    // Create response with billing info
    const response = NextResponse.json({
      success: true,
      billing: billing || null,
    });

    // Apply all collected cookies to the response
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    console.log(`✅ Set ${cookiesToSet.length} cookies in response`);

    return response;
  } catch (error) {
    console.error("❌ Unexpected error in session sync:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
