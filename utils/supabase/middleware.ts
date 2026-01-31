import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PREMIUM_PATHS, UNLIMITED_PATHS } from "@/utils/billing/constants";
import { BillingClaims, getAppMetadataFromJWT } from "@/utils/supabase/jwt";
import { hasPremiumAccess, hasUnlimitedAccess } from "@/utils/billing/access";
import { logger } from "@/lib/logging";

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
  const enrichedUser = user
    ? {
        ...user,
        app_metadata: jwtAppMetadata || user.app_metadata,
      }
    : null;

  const { pathname } = request.nextUrl;

  // Normalize pathname by stripping trailing slashes (but preserve root "/")
  // This prevents route check bypasses via trailing slash (e.g., /rounds/id/calculation/)
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";

  const publicPaths = [
    "/login",
    "/signup",
    "/about",
    "/api",
    "/verify-email",
    "/forgot-password",
    "/update-password", // Allow unauthenticated access for password reset with OTP
    "/billing/success", // Allow access after Stripe redirect (session may be temporarily lost)
    "/verify-signup",
    "/contact",
  ];

  // Special case: "/" is public, but not paths that start with "/"
  const isPublic =
    pathname === "/" || publicPaths.some((path) => pathname.startsWith(path));

  // Password reset now uses OTP codes instead of JWT tokens
  // /update-password is in publicPaths and accessible to unauthenticated users

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
  const unlimitedPaths = UNLIMITED_PATHS;

  if (
    enrichedUser &&
    !pathname.startsWith("/api") && // Skip API routes (handled by API middleware)
    !pathname.startsWith("/billing") && // Includes /billing/success
    !pathname.startsWith("/upgrade") &&
    !pathname.startsWith("/auth/verify-session")
  ) {
    const startTime = performance.now(); // Performance monitoring

    try {
      // Read billing info from JWT claims (manually decoded from cookie)
      const billing = enrichedUser.app_metadata?.billing as
        | BillingClaims
        | undefined;

      // Check if billing claims are present
      if (!billing) {
        // No billing claims in JWT - redirect to verification to refresh token
        // This is an edge case that should rarely happen
        logger.error("Missing JWT billing claims", {
          userId: enrichedUser.id,
          pathname,
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
      logger.debug("JWT Auth successful", {
        plan: billing.plan,
        status: billing.status,
        userId: enrichedUser.id,
        billingVersion: billing.billing_version,
      });

      // Use shared access control logic
      const userHasPremiumAccess = hasPremiumAccess(billing);
      const plan = billing.plan;
      const status = billing.status;

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Log successful JWT-only authorization (no database queries!)
      logger.debug("Middleware completed", {
        durationMs: Number(duration.toFixed(2)),
        method: "JWT-only",
      });

      // Alert if middleware is slow (should be < 10ms with JWT-only)
      if (duration > 10) {
        logger.warn("Slow middleware detected", {
          durationMs: Number(duration.toFixed(2)),
          thresholdMs: 10,
          userId: enrichedUser.id,
          pathname,
        });
      }

      // Check if user needs onboarding (no plan selected)
      // Only redirect if not already on onboarding to prevent loops
      if (!plan && !pathname.startsWith("/onboarding")) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }

      // Check premium routes (use normalizedPathname to prevent trailing slash bypass)
      const isPremiumRoute = premiumPaths.some((path) =>
        normalizedPathname.startsWith(path)
      );

      // Check unlimited routes (dashboard, statistics - require unlimited/lifetime plan)
      const isUnlimitedRoute = unlimitedPaths.some((path) =>
        normalizedPathname.startsWith(path)
      );

      // Round calculation page also requires unlimited access
      const isRoundCalculationRoute =
        /^\/rounds\/[^/]+\/calculation$/.test(normalizedPathname);

      const requiresPremium = isPremiumRoute;
      const requiresUnlimited = isUnlimitedRoute || isRoundCalculationRoute;

      // Check unlimited access first (more restrictive)
      const userHasUnlimitedAccess = hasUnlimitedAccess(billing);

      if (requiresUnlimited && !userHasUnlimitedAccess) {
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }

      if (requiresPremium && !userHasPremiumAccess) {
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }
    } catch (error) {
      // ✅ NEW: On error, redirect to verification page (not onboarding)
      logger.error("Middleware error - redirecting to session verification", {
        error: error instanceof Error ? error.message : String(error),
        pathname,
      });

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
