import { getUserSubscription } from "./entitlements";
import type { Plan } from "@/types/billing";

/**
 * Feature flags based on plan
 */
export const PLAN_FEATURES = {
  free: {
    roundLogging: true,
    basicHandicap: true,
    scoreHistory: true,
    roundInsights: false,
    analytics: false,
    advancedCalculators: false,
    prioritySupport: false,
  },
  premium: {
    roundLogging: true,
    basicHandicap: true,
    scoreHistory: true,
    roundInsights: false,
    analytics: false,
    advancedCalculators: false,
    prioritySupport: false,
  },
  unlimited: {
    roundLogging: true,
    basicHandicap: true,
    scoreHistory: true,
    roundInsights: true,
    analytics: true,
    advancedCalculators: true,
    prioritySupport: true,
  },
} as const;

/**
 * Check if user has access to a specific feature
 */
export async function hasFeatureAccess(
  userId: string,
  feature: keyof typeof PLAN_FEATURES.unlimited
): Promise<boolean> {
  const access = await getUserSubscription(userId);

  if (!access) {
    return false;
  }

  return PLAN_FEATURES[access.plan][feature];
}
