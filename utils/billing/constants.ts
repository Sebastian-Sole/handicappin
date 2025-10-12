/**
 * Centralized billing constants
 */

/**
 * Free tier round limit
 */
export const FREE_TIER_ROUND_LIMIT = 25;

/**
 * Premium paths that require paid plan access
 */
export const PREMIUM_PATHS = ["/dashboard", "/calculators"];

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
