import { FeatureAccess } from "@/types/billing";
import { FREE_TIER_ROUND_LIMIT } from "./constants";

/**
 * Create default "no access" response (user needs onboarding)
 */
export function createNoAccessResponse(): FeatureAccess {
  return {
    plan: null, // NULL because no plan selected yet
    hasAccess: false,
    hasPremiumAccess: false,
    hasUnlimitedRounds: false,
    remainingRounds: 0, // No rounds available without plan selection
    status: null, // NULL because no plan selected yet
    isLifetime: false,
    currentPeriodEnd: null,
  };
}

/**
 * Create free tier access response
 */
export function createFreeTierResponse(roundsUsed: number): FeatureAccess {
  return {
    plan: "free",
    hasAccess: true,
    hasPremiumAccess: false,
    hasUnlimitedRounds: false,
    remainingRounds: Math.max(0, FREE_TIER_ROUND_LIMIT - roundsUsed),
    status: "free",
    isLifetime: false,
    currentPeriodEnd: null,
  };
}

/**
 * Check if plan type has unlimited rounds
 */
export function hasUnlimitedRounds(plan: string): boolean {
  return plan === "unlimited" || plan === "lifetime";
}

/**
 * Check if plan is a paid plan
 */
export function isPaidPlan(plan: string): boolean {
  return plan === "premium" || plan === "unlimited" || plan === "lifetime";
}
