import { stripe, mapPriceToPlan } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Database } from "@/types/supabase";

// Initialize Supabase client
const supabase = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export interface FeatureAccess {
  plan: "free" | "premium" | "unlimited";
  hasAccess: boolean;
  remainingRounds: number;
  currentPeriodEnd?: Date;
  isLifetime?: boolean;
}

/**
 * Get user's access level by querying Stripe directly
 * This is the single source of truth for subscription status
 */
export async function getUserAccess(userId: string): Promise<FeatureAccess> {
  try {
    // 1. Get Stripe customer ID from local table
    const { data: customer, error } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (error || !customer) {
      // No Stripe customer = free tier
      return getFreeAccess();
    }

    // 2. Query Stripe directly for current subscription status
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No active subscription = free tier
      return getFreeAccess();
    }

    const activeSubscription = subscriptions.data[0];
    const priceId = activeSubscription.items.data[0]?.price.id;

    if (!priceId) {
      console.error("No price ID found in active subscription");
      return getFreeAccess();
    }

    // 3. Map Stripe price to our plan
    const plan = mapPriceToPlan(priceId);
    if (!plan) {
      console.error("Unknown price ID:", priceId);
      return getFreeAccess();
    }

    // 4. Determine access based on plan
    return {
      plan,
      hasAccess: true,
      remainingRounds: plan === "unlimited" ? Infinity : 100,
      currentPeriodEnd: new Date(
        (activeSubscription as any).current_period_end * 1000
      ),
      isLifetime: false, // Regular subscription
    };
  } catch (error) {
    console.error("Error fetching user access from Stripe:", error);
    // On error, default to free tier
    return getFreeAccess();
  }
}

/**
 * Get access for lifetime users (one-time payments)
 * This checks for completed payments instead of subscriptions
 */
export async function getLifetimeAccess(
  userId: string
): Promise<FeatureAccess | null> {
  try {
    const { data: customer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (!customer) return null;

    // Check for completed payments for lifetime products
    const payments = await stripe.paymentIntents.list({
      customer: customer.stripe_customer_id,
      limit: 10,
    });

    // Look for successful payments with lifetime price IDs
    const lifetimePriceIds = [env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID];

    const hasLifetimePayment = payments.data.some((payment) => {
      if (payment.status !== "succeeded") return false;

      // Check if this payment was for a lifetime product
      // This is a simplified check - in production you might want to store
      // payment metadata or check line items more thoroughly
      return lifetimePriceIds.some(
        (priceId) => payment.metadata?.price_id === priceId
      );
    });

    if (hasLifetimePayment) {
      return {
        plan: "unlimited",
        hasAccess: true,
        remainingRounds: Infinity,
        currentPeriodEnd: new Date("2099-12-31T23:59:59.000Z"), // Far future
        isLifetime: true,
      };
    }

    return null;
  } catch (error) {
    console.error("Error checking lifetime access:", error);
    return null;
  }
}

/**
 * Get comprehensive user access (subscription + lifetime)
 */
export async function getComprehensiveUserAccess(
  userId: string
): Promise<FeatureAccess> {
  // First check for regular subscription
  const subscriptionAccess = await getUserAccess(userId);

  if (subscriptionAccess.hasAccess) {
    return subscriptionAccess;
  }

  // If no subscription, check for lifetime access
  const lifetimeAccess = await getLifetimeAccess(userId);
  if (lifetimeAccess) {
    return lifetimeAccess;
  }

  // Default to free tier
  return getFreeAccess();
}

/**
 * Check if user can add more rounds
 */
export async function canAddRound(userId: string): Promise<boolean> {
  const access = await getComprehensiveUserAccess(userId);
  return access.remainingRounds > 0;
}

/**
 * Get remaining rounds for user
 */
export async function getRemainingRounds(userId: string): Promise<number> {
  const access = await getComprehensiveUserAccess(userId);
  return access.remainingRounds;
}

/**
 * Free tier access
 */
function getFreeAccess(): FeatureAccess {
  return {
    plan: "free",
    hasAccess: false,
    remainingRounds: 25,
  };
}
