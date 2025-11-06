import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose"; // Import the `jose` library
import { PasswordResetPayload } from "@/types/auth";
import {
  FREE_TIER_ROUND_LIMIT,
  PREMIUM_PATHS,
} from "@/utils/billing/constants";

// Define billing claims type (minimal)
type BillingClaims = {
  plan: string | null; // NULL when user hasn't selected a plan
  status: string | null; // NULL when user hasn't selected a plan
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  billing_version: number;
};

// Clock skew tolerance for expiry checks (prevent edge flaps)
const EXPIRY_LEEWAY_SECONDS = 120; // 2 minutes

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
    "/about",
    "/api",
    "/verify-email",
    "/forgot-password",
  ];

  // Special case: "/" is public, but not paths that start with "/"
  const isPublic =
    pathname === "/" || publicPaths.some((path) => pathname.startsWith(path));

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

  // Check access control for authenticated users on protected routes
  const premiumPaths = PREMIUM_PATHS;

  if (
    user &&
    !isPublic &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/billing") &&
    !pathname.startsWith("/upgrade") &&
    !pathname.startsWith("/auth/verify-session")
  ) {
    const startTime = performance.now(); // Performance monitoring

    try {
      // Read billing info from JWT claims (NO DATABASE FALLBACK!)
      const billing = user.app_metadata?.billing as BillingClaims | undefined;

      let plan: string | null = null;
      let status: string | null = "active";
      let hasPremiumAccess: boolean = false;

      // ✅ NEW: If claims missing, handle based on environment
      if (!billing) {
        // 🔍 DIAGNOSTIC: Log what we actually received
        console.error(
          `❌ Missing JWT claims for user ${user.id}`,
          {
            pathname,
            timestamp: new Date().toISOString(),
            hasAppMetadata: !!user.app_metadata,
            appMetadataKeys: user.app_metadata ? Object.keys(user.app_metadata) : [],
            appMetadataType: typeof user.app_metadata,
            environment: process.env.NODE_ENV,
          }
        );

        // 🔧 LOCAL DEV ONLY: Fallback to database (JWT hook doesn't work reliably locally)
        if (process.env.NODE_ENV === "development") {
          console.warn("⚠️ LOCAL DEV: JWT hook not working, falling back to database query");

          try {
            // Query profile table directly
            const { data: profileData, error: profileError } = await supabase
              .from("profile")
              .select("plan_selected, subscription_status, current_period_end, cancel_at_period_end")
              .eq("id", user.id)
              .single();

            if (profileError || !profileData) {
              console.error("❌ LOCAL DEV: Profile query failed:", profileError);
              // No profile = needs onboarding
              const url = request.nextUrl.clone();
              url.pathname = "/onboarding";
              return NextResponse.redirect(url);
            }

            // Manually construct billing data from database
            plan = profileData.plan_selected;
            status = profileData.subscription_status || "active";

            // If no plan, redirect to onboarding
            if (!plan) {
              const url = request.nextUrl.clone();
              url.pathname = "/onboarding";
              return NextResponse.redirect(url);
            }

            // Set hasPremiumAccess based on plan
            hasPremiumAccess = plan === "premium" || plan === "unlimited" || plan === "lifetime";

            console.log(`✅ LOCAL DEV: Using database fallback - plan: ${plan}, status: ${status}`);
          } catch (dbError) {
            console.error("❌ LOCAL DEV: Database fallback failed:", dbError);
            const url = request.nextUrl.clone();
            url.pathname = "/onboarding";
            return NextResponse.redirect(url);
          }
        } else {
          // 🔒 PRODUCTION: Fail closed - redirect to verification page
          console.error("🔒 PRODUCTION: Redirecting to session verification");

          const url = request.nextUrl.clone();
          url.pathname = "/auth/verify-session";
          url.searchParams.set("returnTo", pathname);
          return NextResponse.redirect(url);
        }
      } else {
        // JWT claims present - use them!
        plan = billing.plan;
        status = billing.status;
      }

      // Check for edge cases using status and period_end (only if we have JWT claims)
      if (billing) {
        if (
          status === "past_due" ||
          status === "incomplete" ||
          status === "paused"
        ) {
          console.warn(`⚠️ Subscription ${status} for user ${user.id}`);
          hasPremiumAccess = false;
        }
        else if (status === "canceled") {
          if (billing.cancel_at_period_end && billing.current_period_end) {
            const nowSeconds = Date.now() / 1000;
            const isExpired =
              nowSeconds > billing.current_period_end + EXPIRY_LEEWAY_SECONDS;

            if (isExpired) {
              console.warn(`⚠️ Canceled subscription expired for user ${user.id}`);
              hasPremiumAccess = false;
            } else {
              hasPremiumAccess =
                plan === "premium" ||
                plan === "unlimited" ||
                plan === "lifetime";
            }
          } else {
            console.warn(`⚠️ Subscription canceled (immediate) for user ${user.id}`);
            hasPremiumAccess = false;
          }
        }
        else if (
          billing.current_period_end &&
          Date.now() / 1000 > billing.current_period_end + EXPIRY_LEEWAY_SECONDS
        ) {
          console.warn(`⚠️ Subscription expired for user ${user.id}`);
          hasPremiumAccess = false;
        }
        else {
          hasPremiumAccess =
            plan === "premium" || plan === "unlimited" || plan === "lifetime";
        }
      }
      // Local dev fallback already set hasPremiumAccess

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Alert if middleware is slow (should be < 10ms with JWT-only)
      if (duration > 10) {
        console.warn(
          `🐌 Slow middleware detected: ${duration.toFixed(2)}ms (threshold: 10ms)`,
          {
            userId: user.id,
            pathname,
          }
        );
      }

      // Check if user needs onboarding (no plan selected)
      if (!plan) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }

      // Check premium routes
      const isPremiumRoute = premiumPaths.some((path) =>
        pathname.startsWith(path)
      );

      if (isPremiumRoute && !hasPremiumAccess) {
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }

      // Check if user is trying to add a round when at limit (free tier only)
      if (pathname.startsWith("/rounds/add") && plan === "free") {
        // Count rounds from database (fast query due to index)
        const { count: roundCount, error: countError } = await supabase
          .from("round")
          .select("*", { count: "exact", head: true })
          .eq("userId", user.id);

        if (countError) {
          console.error("❌ Middleware: Error counting rounds:", countError);
        } else {
          if (roundCount !== null && roundCount >= FREE_TIER_ROUND_LIMIT) {
            const url = request.nextUrl.clone();
            url.pathname = "/upgrade";
            url.searchParams.set("reason", "round_limit");
            return NextResponse.redirect(url);
          }
        }
      }
    } catch (error) {
      // ✅ NEW: On error, redirect to verification page (not onboarding)
      console.error("❌ Middleware error - redirecting to session verification:", error);

      const url = request.nextUrl.clone();
      url.pathname = "/auth/verify-session";
      url.searchParams.set("returnTo", pathname);
      url.searchParams.set("error", "middleware_exception");

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
