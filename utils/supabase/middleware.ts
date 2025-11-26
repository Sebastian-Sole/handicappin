import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose"; // Import the `jose` library
import { PasswordResetPayload } from "@/types/auth";
import { PREMIUM_PATHS } from "@/utils/billing/constants";
import { BillingClaims, getAppMetadataFromJWT } from "@/utils/supabase/jwt";

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

  // Use getUser() for secure authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get session which includes JWT with custom claims
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Decode the JWT to get custom claims from the hook
  // SECURITY: Safe for authorization - JWT signature already verified by getSession()
  // See getAppMetadataFromJWT() for full security documentation
  const jwtAppMetadata = getAppMetadataFromJWT(session);

  // Merge JWT claims into getUser() user object
  // Use the decoded JWT payload, NOT session.user.app_metadata (which doesn't include custom claims)
  const enrichedUser = user ? {
    ...user,
    app_metadata: jwtAppMetadata || user.app_metadata
  } : null;

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

  if (!enrichedUser && pathname === "/update-password") {
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

  if (!enrichedUser && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    enrichedUser &&
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
    enrichedUser &&
    !isPublic &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/billing") && // Includes /billing/success
    !pathname.startsWith("/upgrade") &&
    !pathname.startsWith("/auth/verify-session")
  ) {
    const startTime = performance.now(); // Performance monitoring

    try {
      // Read billing info from JWT claims (manually decoded from cookie)
      const billing = enrichedUser.app_metadata?.billing as BillingClaims | undefined;

      let plan: string | null = null;
      let status: string | null = null;
      let hasPremiumAccess: boolean = false;

      // Check if billing claims are present
      if (!billing) {
        // No billing claims in JWT - redirect to verification to refresh token
        // This is an edge case that should rarely happen
        console.error(`🚨 CRITICAL: Missing JWT billing claims for user ${enrichedUser.id}`, {
          pathname,
          timestamp: new Date().toISOString(),
          hasSession: !!session,
          hasAccessToken: !!session?.access_token,
        });

        // Redirect to verification page to refresh the JWT
        // This will trigger a token refresh which should add billing claims
        const url = request.nextUrl.clone();
        url.pathname = "/auth/verify-session";
        url.searchParams.set("returnTo", pathname);
        url.searchParams.set("reason", "missing_billing_claims");
        return NextResponse.redirect(url);
      }

      // ✅ SUCCESS: Using JWT claims from custom access token hook
      console.log(`✅ JWT Auth: plan=${billing.plan}, status=${billing.status}, user=${enrichedUser.id}`);

      // Use JWT claims
      plan = billing.plan;
      status = billing.status;

      // Check for edge cases using status and period_end
      if (
        status === "past_due" ||
        status === "incomplete" ||
        status === "paused"
      ) {
        console.warn(`⚠️ Subscription ${status} for user ${enrichedUser.id}`);
        hasPremiumAccess = false;
      }
      else if (status === "canceled") {
        if (billing.cancel_at_period_end && billing.current_period_end) {
          const nowSeconds = Date.now() / 1000;
          const isExpired =
            nowSeconds > billing.current_period_end + EXPIRY_LEEWAY_SECONDS;

          if (isExpired) {
            console.warn(`⚠️ Canceled subscription expired for user ${enrichedUser.id}`);
            hasPremiumAccess = false;
          } else {
            hasPremiumAccess =
              plan === "premium" ||
              plan === "unlimited" ||
              plan === "lifetime";
          }
        } else {
          console.warn(`⚠️ Subscription canceled (immediate) for user ${enrichedUser.id}`);
          hasPremiumAccess = false;
        }
      }
      else if (
        billing.current_period_end &&
        Date.now() / 1000 > billing.current_period_end + EXPIRY_LEEWAY_SECONDS
      ) {
        console.warn(`⚠️ Subscription expired for user ${enrichedUser.id}`);
        hasPremiumAccess = false;
      }
      else {
        hasPremiumAccess =
          plan === "premium" || plan === "unlimited" || plan === "lifetime";
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Log successful JWT-only authorization (no database queries!)
      console.log(`⚡ Middleware completed in ${duration.toFixed(2)}ms (JWT-only, no database)`);

      // Alert if middleware is slow (should be < 10ms with JWT-only)
      if (duration > 10) {
        console.warn(
          `🐌 Slow middleware detected: ${duration.toFixed(2)}ms (threshold: 10ms)`,
          {
            user: enrichedUser.id,
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
