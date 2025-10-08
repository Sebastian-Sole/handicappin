import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose"; // Import the `jose` library
import { PasswordResetPayload } from "@/types/auth";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const publicPaths = [
    "/login",
    "/signup",
    "/calculators",
    "/about",
    "/api",
    "/verify-email",
    "/forgot-password",
    "/",
  ];

  const isPublic = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (!user && pathname === "/update-password") {
    const resetToken = request.nextUrl.searchParams.get("token");
    if (!resetToken) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    try {
      // Verify JWT token
      const secret = new TextEncoder().encode(process.env.RESET_TOKEN_SECRET);
      const { payload } = await jwtVerify<PasswordResetPayload>(
        resetToken,
        secret
      );

      if (payload.metadata.type === "password-reset") {
        // Attach decoded user info to request for further usage
        const url = request.nextUrl.clone();
        url.searchParams.set("email", payload.email);
        return NextResponse.rewrite(url); // Rewrite the request with the email in the query
      }
    } catch (err) {
      console.error("Invalid reset token:", err);
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (pathname.startsWith("/login") || pathname.startsWith("/signup"))
  ) {
    // Redirect authenticated user away from login/signup
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ============================================
  // NEW: Entitlement check
  // ============================================
  if (
    user &&
    !isPublic &&
    pathname !== "/onboarding" &&
    pathname !== "/billing"
  ) {
    // Check if user has a subscription in billing.subscriptions
    // Using raw SQL query since Supabase client doesn't support custom schemas
    console.log("🔍 Middleware: Checking subscription for user:", user.id);
    const { data: subscription, error } = await supabase.rpc(
      "get_user_subscription",
      {
        p_user_id: user.id,
      }
    );

    console.log("📊 Middleware: Subscription data:", subscription);
    if (error) {
      console.log("❌ Middleware: Error:", error);
    }

    // If no subscription exists, redirect to onboarding
    if (!subscription || subscription.length === 0) {
      console.log(
        "🚫 Middleware: No subscription found, redirecting to onboarding"
      );
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Optional: Check if subscription is active
    // For past_due or incomplete, you might want to redirect to billing page
    const sub = subscription[0]; // RPC returns array
    console.log("✅ Middleware: Found subscription:", sub);
    if (sub.status === "past_due" || sub.status === "incomplete") {
      console.log("⚠️ Middleware: Subscription issue, redirecting to billing");
      const url = request.nextUrl.clone();
      url.pathname = "/billing";
      url.searchParams.set("error", "subscription_issue");
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
