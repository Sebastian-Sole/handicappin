// This file is deprecated - use utils/billing/access-control.ts instead
// Kept for backward compatibility during migration

import { getComprehensiveUserAccess } from "./access-control";

export interface FeatureAccess {
  plan: "free" | "premium" | "unlimited";
  hasAccess: boolean;
  remainingRounds: number;
  currentPeriodEnd?: Date;
}

/**
 * @deprecated Use getComprehensiveUserAccess from access-control.ts instead
 * Get user's subscription status - now queries Stripe directly
 */
export async function getUserSubscription(
  userId: string
): Promise<FeatureAccess> {
  return getComprehensiveUserAccess(userId);
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
