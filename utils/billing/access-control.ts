import { createServerComponentClient } from "@/utils/supabase/server";
import { FeatureAccess, SubscriptionStatus } from "@/types/billing";

/**
 * Lightweight version of access control for Edge Runtime (middleware)
 * Only checks database, doesn't call Stripe API
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

  // No plan selected yet
  if (!profile.plan_selected) {
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

  // Free plan
  if (profile.plan_selected === "free") {
    const roundsUsed = profile.rounds_used || 0;
    return {
      plan: "free",
      hasAccess: true,
      hasPremiumAccess: false,
      hasUnlimitedRounds: false,
      remainingRounds: Math.max(0, 25 - roundsUsed),
      status: "free",
      isLifetime: false,
      currentPeriodEnd: null,
    };
  }

  // Paid plan (trust database, Stripe verification happens in page components)
  return {
    plan: profile.plan_selected as "premium" | "unlimited" | "lifetime",
    hasAccess: true,
    hasPremiumAccess: true,
    hasUnlimitedRounds:
      profile.plan_selected === "unlimited" ||
      profile.plan_selected === "lifetime",
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

  // 4. Check if user selected recurring paid plan - verify with Stripe
  if (
    profile.plan_selected === "premium" ||
    profile.plan_selected === "unlimited" ||
    profile.plan_selected === "lifetime"
  ) {
    const subscriptionAccess = await getUserAccess(userId);

    if (subscriptionAccess?.hasAccess) {
      // Stripe confirms active subscription
      return subscriptionAccess;
    }

    // Stripe says no active subscription (expired/cancelled)
    // Fall back to free tier
    console.log("Subscription expired, falling back to free tier");
    // Note: Webhook should have updated plan_selected to 'free', but handle gracefully
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
