import { createServerComponentClient } from "@/utils/supabase/server";
import { FeatureAccess, SubscriptionStatus } from "@/types/billing";
import {
  createNoAccessResponse,
  createFreeTierResponse,
  hasUnlimitedRounds,
} from "./access-helpers";

/**
 * ⚠️ DEPRECATED: This function is NO LONGER used in middleware!
 *
 * Lightweight version of access control for Edge Runtime (middleware).
 * Reads MINIMAL billing info from database WITHOUT Stripe verification.
 *
 * ⚠️ SECURITY WARNING: This function does NOT verify with Stripe and should
 * NOT be used for authorization decisions!
 *
 * ⚠️ MIDDLEWARE NOTE: Middleware no longer calls this function. Missing JWT
 * claims now trigger a redirect to /auth/verify-session for controlled recovery.
 *
 * ✅ USE INSTEAD:
 * - Middleware: Read billing data from JWT claims (user.app_metadata.billing)
 * - Server Actions: Use getComprehensiveUserAccess() which verifies with Stripe
 *
 * This function is kept for backward compatibility in case other code uses it,
 * but should be removed entirely once all usages are migrated.
 *
 * @deprecated Use JWT claims in middleware or getComprehensiveUserAccess() in server actions
 */
export async function getBasicUserAccess(
  userId: string
): Promise<FeatureAccess> {
  console.warn(
    "⚠️ DEPRECATED: getBasicUserAccess() called - this should NOT be used for authorization!",
    {
      userId,
      caller: new Error().stack?.split("\n")[2]?.trim(), // Log caller for debugging
    }
  );
  const supabase = await createServerComponentClient();

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("plan_selected")
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

  // Free plan - COUNT rounds from database
  if (profile.plan_selected === "free") {
    const { count, error: countError } = await supabase
      .from("round")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId);

    if (countError) {
      console.error("Error counting rounds:", countError);
      return createFreeTierResponse(0);
    }

    return createFreeTierResponse(count || 0);
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
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
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
    .select("plan_selected, subscription_status, current_period_end, cancel_at_period_end")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return createNoAccessResponse();
  }

  // 2. Check if user selected free plan - COUNT rounds from database
  if (profile.plan_selected === "free") {
    const { count, error: countError } = await supabase
      .from("round")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId);

    if (countError) {
      console.error("Error counting rounds:", countError);
      return createFreeTierResponse(0);
    }

    return createFreeTierResponse(count || 0);
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
    // Trust database values set by webhook - webhooks are the source of truth
    // Webhook validates via Stripe signature and updates these fields
    if (profile.subscription_status === "active" || profile.subscription_status === "trialing") {
      return {
        plan: profile.plan_selected,
        hasAccess: true,
        hasPremiumAccess: true,
        hasUnlimitedRounds: true,
        remainingRounds: Infinity,
        status: profile.subscription_status,
        isLifetime: false,
        currentPeriodEnd: profile.current_period_end ? new Date(profile.current_period_end * 1000) : null,
        cancelAtPeriodEnd: profile.cancel_at_period_end || false,
      };
    }

    // Subscription expired/cancelled - fall back to free tier
    console.log("Subscription not active in database, falling back to free tier", {
      plan: profile.plan_selected,
      status: profile.subscription_status,
    });
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
