/**
 * Shared auth/recovery route prefixes.
 *
 * These are the paths that render the dedicated `(auth)` route-group chrome
 * (logo header, no Navbar/Footer). The `ChromeGate` + `MainShell` components
 * in `components/layout/chrome-gate.tsx` use this list to decide whether to
 * suppress the global chrome on the current pathname.
 *
 * NOTE: This is intentionally narrower than `utils/supabase/middleware.ts`'s
 * `publicPaths` list — that one also includes marketing/legal pages
 * (`/about`, `/privacy-policy`, `/terms-of-service`, …) which have full
 * Navbar/Footer chrome. Do not import this constant into the middleware as a
 * drop-in replacement; the two lists serve different concerns.
 */
export const AUTH_ROUTE_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/update-password",
  "/verify-signup",
  "/verify-email",
  "/auth/verify-session",
] as const;

export function isAuthRoutePath(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
