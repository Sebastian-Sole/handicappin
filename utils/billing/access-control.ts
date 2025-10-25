import { createServerComponentClient } from "@/utils/supabase/server";
import { FeatureAccess, SubscriptionStatus } from "@/types/billing";
import {
  createNoAccessResponse,
  createFreeTierResponse,
  hasUnlimitedRounds,
} from "./access-helpers";

/**
 * Lightweight version of access control for Edge Runtime (middleware)
 * Reads MINIMAL billing info from JWT claims for optimal performance (<1ms).
 *
 * ⚠️ PERFORMANCE NOTE: This function is now only used as a FALLBACK when JWT
 * claims are missing. In normal operation, middleware reads directly from JWT.
 *
 * JWT claims structure (MINIMAL, ~80 bytes):
 * {
 *   plan: "free" | "premium" | "unlimited" | "lifetime",
 *   status: "active" | "past_due" | "canceled" | ...,
 *   current_period_end: number | null,
 *   cancel_at_period_end: boolean,
 *   billing_version: number
 * }
 *
 * JWT claims are updated automatically via Custom Access Token Hook on:
 * - User login
 * - Token refresh (~every 1 hour)
 * - Manual refresh via /api/auth/refresh-claims
 *
 * ⚠️ STALENESS NOTE: JWT claims can be stale (1-60 minutes). This is acceptable
 * because middleware is a COARSE FILTER. Page components MUST still use
 * getComprehensiveUserAccess() which verifies with Stripe directly for critical ops.
 *
 * ⚠️ USAGE LIMITS: rounds_used is NOT in JWT (intentional). Enforce usage limits
 * in server actions by querying the database.
 */
export async function getBasicUserAccess(
  userId: string
): Promise<FeatureAccess> {
  const supabase = await createServerComponentClient();

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("plan_selected, rounds_used")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return createNoAccessResponse();
  }

  // No plan selected yet
  if (!profile.plan_selected) {
    return createNoAccessResponse();
  }

  // Free plan
  if (profile.plan_selected === "free") {
    return createFreeTierResponse(profile.rounds_used || 0);
  }

  // Paid plan (trust database, Stripe verification happens in page components)
  return {
    plan: profile.plan_selected as "premium" | "unlimited" | "lifetime",
    hasAccess: true,
    hasPremiumAccess: true,
    hasUnlimitedRounds: hasUnlimitedRounds(profile.plan_selected),
    remainingRounds: Infinity,
    status: "active",
    isLifetime: profile.plan_selected === "lifetime",
    currentPeriodEnd:
      profile.plan_selected === "lifetime"
        ? new Date("2099-12-31T23:59:59.000Z")
        : null,
  };
}

/**
 * Checks if user has active Stripe subscription (premium/unlimited)
 * Returns access info based on Stripe subscription status
 */
async function getUserAccess(userId: string): Promise<FeatureAccess | null> {
  try {
    const supabase = await createServerComponentClient();

    // Get stripe customer ID
    const { data: stripeCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (!stripeCustomer) {
      return null;
    }

    // Query Stripe for active subscriptions
    // Note: This function should not be called from middleware (edge runtime)
    // Use getBasicUserAccess() for middleware instead
    const { stripe, mapPriceToPlan } = await import("@/lib/stripe");
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    const activeSubscription = subscriptions.data[0];

    if (activeSubscription) {
      const priceId = activeSubscription.items.data[0]?.price.id;
      const plan = mapPriceToPlan(priceId || "");

      if (!plan) {
        console.error("Unknown price ID:", priceId);
        return null;
      }

      // Get subscription period from the subscription items
      const item = activeSubscription.items.data[0];
      const periodEnd = item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : new Date();

      return {
        plan,
        hasAccess: true,
        hasPremiumAccess: true,
        hasUnlimitedRounds:
          plan === "premium" || plan === "unlimited" || plan === "lifetime",
        remainingRounds:
          plan === "premium" || plan === "unlimited" || plan === "lifetime"
            ? Infinity
            : 100,
        status: "active" as SubscriptionStatus,
        currentPeriodEnd: periodEnd,
        isLifetime: plan === "lifetime",
      };
    }

    return null;
  } catch (error) {
    console.error("Error checking Stripe subscription:", error);
    return null;
  }
}

/**
 * Comprehensive access check that determines user's plan and permissions
 * This is the main function called by middleware and route guards
 */
export async function getComprehensiveUserAccess(
  userId: string
): Promise<FeatureAccess> {
  const supabase = await createServerComponentClient();

  // 1. Get user profile (exists for ALL users)
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("plan_selected, rounds_used")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return createNoAccessResponse();
  }

  // 2. Check if user selected free plan
  if (profile.plan_selected === "free") {
    return createFreeTierResponse(profile.rounds_used || 0);
  }

  // 3. LIFETIME plan (one-time payment, NOT subscription)
  if (profile.plan_selected === "lifetime") {
    // Lifetime: Trust database value set by webhook after successful payment
    // No need to query Stripe - if plan_selected='lifetime', payment succeeded
    // Webhook validates payment via signature verification (cryptographically secure)
    return {
      plan: "lifetime",
      hasAccess: true,
      hasPremiumAccess: true,
      hasUnlimitedRounds: true,
      remainingRounds: Infinity,
      status: "active",
      isLifetime: true,
      currentPeriodEnd: new Date("2099-12-31T23:59:59.000Z"), // Never expires
    };
  }

  // 4. PREMIUM/UNLIMITED plans (recurring subscriptions)
  if (
    profile.plan_selected === "premium" ||
    profile.plan_selected === "unlimited"
  ) {
    const subscriptionAccess = await getUserAccess(userId);

    if (subscriptionAccess?.hasAccess) {
      // Stripe confirms active subscription
      return subscriptionAccess;
    }

    // Subscription expired/cancelled - fall back to free tier
    console.log("Subscription expired, falling back to free tier");
    // Note: Webhook should have updated plan_selected to 'free', but handle gracefully
  }

  // 5. No plan selected yet - needs onboarding
  return createNoAccessResponse();
}

/**
 * Helper to check if user can add more rounds (for free tier limit)
 */
export async function canAddRound(userId: string): Promise<boolean> {
  const access = await getComprehensiveUserAccess(userId);

  // Paid users can always add rounds
  if (access.hasPremiumAccess) {
    return true;
  }

  // Free users must have remaining rounds
  return access.remainingRounds > 0;
}
