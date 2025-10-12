import { createServerComponentClient } from "@/utils/supabase/server";
import { FeatureAccess, SubscriptionStatus } from "@/types/billing";

/**
 * Returns free tier access (no Stripe subscription needed)
 */
function getFreeAccess(roundsUsed: number = 0): FeatureAccess {
  return {
    plan: "free",
    hasAccess: true, // ✅ Free users can access app
    hasPremiumAccess: false, // ❌ But not premium routes
    hasUnlimitedRounds: false,
    remainingRounds: Math.max(0, 25 - roundsUsed),
    status: "free",
    isLifetime: false,
    currentPeriodEnd: null,
  };
}

/**
 * Checks if user has active Stripe subscription (premium/unlimited)
 * Returns access info based on Stripe subscription status
 */
async function getUserAccess(userId: string): Promise<FeatureAccess | null> {
  // TODO: Implement Stripe subscription check when Stripe is fully integrated
  // For now, this returns null to indicate no active paid subscription

  /*
  Example implementation when Stripe is integrated:

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
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomer.stripe_customer_id,
    status: "active",
    limit: 1,
  });

  const activeSubscription = subscriptions.data[0];

  if (activeSubscription) {
    const priceId = activeSubscription.items.data[0]?.price.id;
    const plan = mapPriceToPlan(priceId);

    return {
      plan,
      hasAccess: true,
      hasPremiumAccess: true,
      hasUnlimitedRounds: plan === "unlimited",
      remainingRounds: plan === "unlimited" ? Infinity : 100,
      status: "active" as SubscriptionStatus,
      currentPeriodEnd: new Date(activeSubscription.current_period_end * 1000),
      isLifetime: false,
    };
  }
  */

  return null;
}

/**
 * Checks if user has lifetime access
 */
async function getLifetimeAccess(
  userId: string
): Promise<FeatureAccess | null> {
  // TODO: Implement lifetime access check when needed
  // This would check for one-time payment or special lifetime flag

  /*
  Example implementation:

  const supabase = await createServerComponentClient();

  const { data: profile } = await supabase
    .from("profile")
    .select("plan_selected")
    .eq("id", userId)
    .single();

  if (profile?.plan_selected === "lifetime") {
    return {
      plan: "unlimited",
      hasAccess: true,
      hasPremiumAccess: true,
      hasUnlimitedRounds: true,
      remainingRounds: Infinity,
      status: "active" as SubscriptionStatus,
      currentPeriodEnd: new Date("2099-12-31T23:59:59.000Z"),
      isLifetime: true,
    };
  }
  */

  return null;
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
    // No profile = needs onboarding
    return {
      plan: "free",
      hasAccess: false,
      hasPremiumAccess: false,
      hasUnlimitedRounds: false,
      remainingRounds: 25,
      status: "free",
      isLifetime: false,
      currentPeriodEnd: null,
    };
  }

  // 2. Check if user selected free plan
  if (profile.plan_selected === "free") {
    const roundsUsed = profile.rounds_used || 0;
    return {
      plan: "free",
      hasAccess: true, // ✅ Free users can use app
      hasPremiumAccess: false, // ❌ But not premium routes
      hasUnlimitedRounds: false,
      remainingRounds: Math.max(0, 25 - roundsUsed),
      status: "free",
      isLifetime: false,
      currentPeriodEnd: null,
    };
  }

  // 3. Check if user selected paid plan - verify with Stripe
  if (
    profile.plan_selected === "premium" ||
    profile.plan_selected === "unlimited"
  ) {
    const subscriptionAccess = await getUserAccess(userId);

    if (subscriptionAccess?.hasAccess) {
      // Stripe confirms active subscription
      return {
        ...subscriptionAccess,
        hasAccess: true,
        hasPremiumAccess: true, // ✅ Paid users get premium access
        hasUnlimitedRounds: true,
      };
    }

    // Stripe says no active subscription (expired/cancelled)
    // Fall back to free tier
    console.log("Subscription expired, falling back to free tier");
    // Note: Webhook should have updated plan_selected to 'free', but handle gracefully
  }

  // 4. Check for lifetime access
  const lifetimeAccess = await getLifetimeAccess(userId);
  if (lifetimeAccess) {
    return {
      ...lifetimeAccess,
      hasAccess: true,
      hasPremiumAccess: true,
      hasUnlimitedRounds: true,
    };
  }

  // 5. No plan selected yet - needs onboarding
  return {
    plan: "free",
    hasAccess: false, // ❌ Redirect to onboarding
    hasPremiumAccess: false,
    hasUnlimitedRounds: false,
    remainingRounds: 25,
    status: "free",
    isLifetime: false,
    currentPeriodEnd: null,
  };
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
