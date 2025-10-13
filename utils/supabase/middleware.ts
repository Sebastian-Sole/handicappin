import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose"; // Import the `jose` library
import { PasswordResetPayload } from "@/types/auth";
import { getBasicUserAccess } from "@/utils/billing/access-control";
import { PREMIUM_PATHS } from "@/utils/billing/constants";

// Define billing claims type (minimal)
type BillingClaims = {
  plan: string;
  status: string;
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
    "/",
  ];

  const isPublic = publicPaths.some((path) => pathname.startsWith(path));

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
    !pathname.startsWith("/upgrade")
  ) {
    const startTime = performance.now(); // Performance monitoring
    console.log("🔍 Middleware: Checking access for user:", user.id);

    try {
      // NEW: Read MINIMAL billing info from JWT claims (NO DATABASE QUERY!)
      const billing = user.app_metadata?.billing as BillingClaims | undefined;

      let plan: string | null = null;
      let status: string = 'active';
      let hasPremiumAccess: boolean = false;

      // Graceful fallback to database if claims missing (during migration)
      if (!billing) {
        console.warn(
          `⚠️ Missing JWT claims for user ${user.id}, falling back to database`
        );

        // Fallback: Query database (temporary during migration)
        const access = await getBasicUserAccess(user.id);
        plan = access.plan;
        hasPremiumAccess = access.hasPremiumAccess;
      } else {
        // JWT claims present - use them!
        plan = billing.plan;
        status = billing.status;

        // Check for edge cases using status and period_end
        // This avoids database queries for common scenarios

        // 1. Check subscription status (but respect cancel_at_period_end)
        // If canceled but cancel_at_period_end=true, keep access until expiry
        if (status === 'past_due' || status === 'incomplete' || status === 'paused') {
          console.warn(`⚠️ Subscription ${status} for user ${user.id}`);
          hasPremiumAccess = false; // Revoke premium access
        }
        // 2. Handle "canceled" status: check cancel_at_period_end flag
        else if (status === 'canceled') {
          if (billing.cancel_at_period_end && billing.current_period_end) {
            // User canceled but has access until period end
            // Check if period has expired (with leeway for clock skew)
            const nowSeconds = Date.now() / 1000;
            const isExpired = nowSeconds > (billing.current_period_end + EXPIRY_LEEWAY_SECONDS);

            if (isExpired) {
              console.warn(`⚠️ Canceled subscription expired for user ${user.id}`);
              hasPremiumAccess = false;
            } else {
              console.log(`✅ Canceled subscription still valid until ${new Date(billing.current_period_end * 1000).toISOString()} for user ${user.id}`);
              hasPremiumAccess = plan === "premium" || plan === "unlimited" || plan === "lifetime";
            }
          } else {
            // Canceled without period end, or cancel_at_period_end=false (immediate cancellation)
            console.warn(`⚠️ Subscription canceled (immediate) for user ${user.id}`);
            hasPremiumAccess = false;
          }
        }
        // 3. Check if subscription expired (with leeway for clock skew)
        else if (billing.current_period_end && Date.now() / 1000 > (billing.current_period_end + EXPIRY_LEEWAY_SECONDS)) {
          console.warn(`⚠️ Subscription expired for user ${user.id}`);
          hasPremiumAccess = false; // Revoke premium access
        }
        // 4. Normal case: check plan type
        else {
          hasPremiumAccess =
            plan === "premium" || plan === "unlimited" || plan === "lifetime";
        }

        console.log(
          `✅ Using JWT claims for user ${user.id} (v${billing.billing_version})`
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`⏱️ Middleware access check took: ${duration.toFixed(2)}ms`, {
        userId: user.id,
        source: billing ? "jwt" : "database",
        plan,
        status,
        hasPremiumAccess,
      });

      // Alert if middleware is slow
      const threshold = billing ? 10 : 100;
      if (duration > threshold) {
        console.warn(
          `🐌 Slow middleware detected: ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
          {
            userId: user.id,
            source: billing ? "jwt" : "database",
            pathname,
          }
        );
      }

      // Check if user needs onboarding (no plan selected)
      if (!plan) {
        console.log(
          "🚫 Middleware: No plan selected, redirecting to onboarding"
        );
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }

      // Check premium routes
      const isPremiumRoute = premiumPaths.some((path) =>
        pathname.startsWith(path)
      );

      if (isPremiumRoute && !hasPremiumAccess) {
        console.log(
          "🚫 Middleware: Premium route blocked, redirecting to upgrade"
        );
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }

      console.log("✅ Middleware: Access granted for plan:", plan);
    } catch (error) {
      console.error("❌ Middleware: Error checking access:", error);
      // On error, redirect to onboarding to be safe
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
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
