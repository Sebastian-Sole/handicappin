/**
 * THE shared SKU↔plan mapping (decision ledger D-products). Used by the
 * RevenueCat webhook (apps/web), the native paywall (apps/native), the
 * reconcile script, and the owner runbook — change product lineup HERE only.
 *
 * Lineup is yearly-only plus a one-time lifetime unlock:
 *   - com.handicappin.premium.yearly    auto-renewable (ONE subscription group)
 *   - com.handicappin.unlimited.yearly  auto-renewable (same group)
 *   - com.handicappin.lifetime          non-consumable
 */

/** Plans as the backend projection knows them (mirrors web's PLAN_TYPES). */
export const PLAN_TYPES = ["free", "premium", "unlimited", "lifetime"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

/** Plans a user can actually pay for. */
export type PaidPlan = Exclude<PlanType, "free">;

/** Billing providers that can own a contract (profile.billing_provider). */
export const BILLING_PROVIDERS = ["stripe", "apple"] as const;
export type BillingProviderId = (typeof BILLING_PROVIDERS)[number];

/** Apple App Store product identifiers (D-products — LOCKED). */
export const APPLE_SKUS = {
  premiumYearly: "com.handicappin.premium.yearly",
  unlimitedYearly: "com.handicappin.unlimited.yearly",
  lifetime: "com.handicappin.lifetime",
} as const;

export type AppleSku = (typeof APPLE_SKUS)[keyof typeof APPLE_SKUS];

/** The single App Store subscription group both auto-renewables live in. */
export const APPLE_SUBSCRIPTION_GROUP = "handicappin_plans";

/**
 * RevenueCat entitlement identifiers, named after the plan they grant.
 * The runbook maps each product to exactly one of these in the RC console;
 * native surfaces key their entitlement checks off the same names.
 */
export const RC_ENTITLEMENT_IDS = {
  premium: "premium",
  unlimited: "unlimited",
  lifetime: "lifetime",
} as const;

export const APPLE_SKU_TO_PLAN: Record<AppleSku, PaidPlan> = {
  [APPLE_SKUS.premiumYearly]: "premium",
  [APPLE_SKUS.unlimitedYearly]: "unlimited",
  [APPLE_SKUS.lifetime]: "lifetime",
};

/** Map an App Store product id to its plan; null for unknown products. */
export function appleSkuToPlan(productId: string): PaidPlan | null {
  return (APPLE_SKU_TO_PLAN as Record<string, PaidPlan>)[productId] ?? null;
}

export function planToAppleSku(plan: PaidPlan): AppleSku {
  switch (plan) {
    case "premium":
      return APPLE_SKUS.premiumYearly;
    case "unlimited":
      return APPLE_SKUS.unlimitedYearly;
    case "lifetime":
      return APPLE_SKUS.lifetime;
  }
}

/**
 * Entitlement precedence (D-precedence): lifetime > unlimited > premium > free.
 * Matches web's plan hierarchy in apps/web/lib/stripe.ts.
 */
export const PLAN_TIER_RANK: Record<PlanType, number> = {
  free: 0,
  premium: 1,
  unlimited: 2,
  lifetime: 3,
};

export function planRank(plan: PlanType | null): number {
  return plan ? PLAN_TIER_RANK[plan] : 0;
}
