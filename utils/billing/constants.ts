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
 * Premium paths that require any paid plan access (premium, unlimited, or lifetime)
 */
export const PREMIUM_PATHS = [];

/**
 * Unlimited paths that require unlimited plan access (unlimited or lifetime only)
 * These are premium features not available to basic premium subscribers
 */
export const UNLIMITED_PATHS = ["/dashboard", "/statistics", "/calculators"];

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
