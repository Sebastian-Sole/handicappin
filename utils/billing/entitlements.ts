import { createServerComponentClient } from "@/utils/supabase/server";
import type { FeatureAccess, Plan, SubscriptionStatus } from "@/types/billing";

/**
 * Get user's subscription and feature access
 * Used in server components and API routes
 */
export async function getUserSubscription(
  userId: string
): Promise<FeatureAccess | null> {
  const supabase = await createServerComponentClient();

  // Using type assertion since billing schema types haven't been regenerated yet
  const { data: subscription, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !subscription) {
    return null;
  }

  const plan = subscription.plan as Plan;
  const status = subscription.status as SubscriptionStatus;
  const isLifetime = subscription.is_lifetime;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : null;

  // Premium access logic
  const hasPremiumAccess =
    (["premium", "unlimited"].includes(plan) &&
      ["active", "trialing"].includes(status)) ||
    isLifetime;

  // Unlimited rounds logic
  const hasUnlimitedRounds = plan !== "free" || isLifetime;

  return {
    hasPremiumAccess,
    hasUnlimitedRounds,
    plan,
    status,
    isLifetime,
    currentPeriodEnd,
  };
}

/**
 * Check if user can add a new round
 */
export async function canAddRound(userId: string): Promise<boolean> {
  const access = await getUserSubscription(userId);

  if (!access) {
    return false; // No subscription = no access
  }

  // Unlimited rounds for non-free tiers
  if (access.hasUnlimitedRounds) {
    return true;
  }

  // Free tier: check round count
  const supabase = await createServerComponentClient();
  const { count, error } = await supabase
    .from("round")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId);

  if (error || count === null) {
    return false;
  }

  return count < 25;
}

/**
 * Get remaining rounds for free tier users
 */
export async function getRemainingRounds(
  userId: string
): Promise<number | null> {
  const access = await getUserSubscription(userId);

  if (!access || access.plan !== "free") {
    return null; // Not free tier
  }

  const supabase = await createServerComponentClient();
  const { count, error } = await supabase
    .from("round")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId);

  if (error || count === null) {
    return null;
  }

  return Math.max(0, 25 - count);
}
