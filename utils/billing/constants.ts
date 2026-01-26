/**
 * Centralized billing constants
 */

/**
 * Free tier round limit
 */
export const FREE_TIER_ROUND_LIMIT = 25;

/**
 * Free tier round limit critical
 */
export const FREE_TIER_ROUND_LIMIT_CRITICAL = 5;
/**
 * Free tier round limit warning
 */
export const FREE_TIER_ROUND_LIMIT_WARNING = 10;

/**
 * Premium paths that require paid plan access
 */
export const PREMIUM_PATHS = ["/dashboard", "/calculators", "/statistics"];

/**
 * Plan type definitions
 */
export type PlanType = "free" | "premium" | "unlimited" | "lifetime";

/**
 * Valid plan types for database constraint
 */
export const VALID_PLAN_TYPES: PlanType[] = [
  "free",
  "premium",
  "unlimited",
  "lifetime",
];
