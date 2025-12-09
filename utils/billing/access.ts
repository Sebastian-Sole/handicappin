import { BillingClaims } from "@/utils/supabase/jwt";

// Clock skew tolerance for expiry checks (prevent edge flaps)
const EXPIRY_LEEWAY_SECONDS = 120; // 2 minutes

/**
 * Determines if a user has premium access based on JWT billing claims.
 *
 * This function contains the canonical access control logic used by both:
 * - Middleware (server-side route protection)
 * - BillingSync component (client-side subscription change detection)
 *
 * IMPORTANT: This is a pure function that works only with JWT claims.
 * It does NOT query the database. For database-backed access checks,
 * use getComprehensiveUserAccess() from access-control.ts instead.
 *
 * Access Rules:
 * 1. Deny immediately for problematic statuses: past_due, incomplete, paused
 * 2. For "canceled" status: allow access until current_period_end (grace period)
 * 3. For all statuses: deny if current_period_end is expired (defense-in-depth)
 * 4. Otherwise: grant access if plan is premium/unlimited/lifetime
 *
 * @param billing - Billing claims from JWT (app_metadata.billing)
 * @returns true if user has premium access, false otherwise
 */
export function hasPremiumAccess(billing: BillingClaims | null | undefined): boolean {
  if (!billing) return false;

  const { plan, status, current_period_end, cancel_at_period_end } = billing;

  // Rule 1: Immediately deny for problematic statuses
  if (status === "past_due" || status === "incomplete" || status === "paused") {
    return false;
  }

  // Rule 2: Canceled subscriptions - allow access until period end (grace period)
  if (status === "canceled") {
    if (cancel_at_period_end && current_period_end) {
      const nowSeconds = Date.now() / 1000;
      const isExpired = nowSeconds > current_period_end + EXPIRY_LEEWAY_SECONDS;
      return !isExpired && (plan === "premium" || plan === "unlimited" || plan === "lifetime");
    }
    return false; // Canceled without grace period
  }

  // Rule 3: Check expiry for ANY status (defense-in-depth)
  // This catches edge cases like "active" subscriptions that failed to renew
  if (current_period_end && Date.now() / 1000 > current_period_end + EXPIRY_LEEWAY_SECONDS) {
    return false;
  }

  // Rule 4: Default - check if plan is premium tier
  return plan === "premium" || plan === "unlimited" || plan === "lifetime";
}
