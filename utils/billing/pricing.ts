/**
 * Payment Amount Verification
 *
 * Verifies that payment amounts match expected prices to prevent:
 * - Environment misconfiguration (test prices in production)
 * - Price ID swaps in .env files
 * - Unauthorized price changes in Stripe dashboard
 *
 * Strategy: Verify line item prices, not session totals
 * - Supports 100% discount coupons (amount_total=0 is OK)
 * - Verifies the base price before discounts
 */

/**
 * Expected pricing in cents (USD only)
 *
 * IMPORTANT: These must match your Stripe price configuration
 * Run `pnpm test:integration` to verify Stripe prices match
 */
export const PLAN_PRICING = {
  premium: {
    yearly: {
      usd: 1900, // $19.00/year
    },
  },
  unlimited: {
    yearly: {
      usd: 2900, // $29.00/year
    },
  },
  lifetime: {
    oneTime: {
      usd: 14900, // $149.00 one-time
    },
  },
} as const;

/**
 * Variance tolerance for currency rounding (±1 cent)
 * Some payment processors may introduce minor rounding differences
 */
const AMOUNT_VARIANCE_TOLERANCE = 1;

export interface AmountVerificationResult {
  valid: boolean;
  expected: number;
  actual: number;
  variance: number;
  currency: string;
}

/**
 * Verify payment amount matches expected price for plan
 *
 * @param plan - The plan type (premium, unlimited, lifetime)
 * @param currency - The currency code (currently only 'usd' supported)
 * @param actualAmount - The actual amount charged in cents
 * @param isRecurring - Whether this is a subscription (true) or one-time payment (false)
 * @returns Verification result with validity status and details
 *
 * @example
 * // Verify premium subscription price
 * const result = verifyPaymentAmount('premium', 'usd', 1900, true);
 * if (!result.valid) {
 *   console.error('Amount mismatch!', result);
 * }
 *
 * @example
 * // Verify lifetime one-time payment
 * const result = verifyPaymentAmount('lifetime', 'usd', 14900, false);
 */
export function verifyPaymentAmount(
  plan: "premium" | "unlimited" | "lifetime",
  currency: string,
  actualAmount: number,
  isRecurring: boolean
): AmountVerificationResult {
  const currencyLower = currency.toLowerCase();

  // Only USD supported currently
  if (currencyLower !== 'usd') {
    console.warn(`Currency ${currency} not configured - defaulting to USD pricing`);
  }

  let expectedAmount: number;

  if (plan === "lifetime") {
    expectedAmount = PLAN_PRICING.lifetime.oneTime.usd;
  } else {
    expectedAmount = PLAN_PRICING[plan].yearly.usd;
  }

  const variance = Math.abs(actualAmount - expectedAmount);
  const valid = variance <= AMOUNT_VARIANCE_TOLERANCE;

  return {
    valid,
    expected: expectedAmount,
    actual: actualAmount,
    variance,
    currency: currencyLower,
  };
}

/**
 * Format amount for logging (cents to dollars)
 */
export function formatAmount(amountInCents: number, currency: string = 'usd'): string {
  const amount = amountInCents / 100;
  const currencySymbol = currency.toLowerCase() === 'usd' ? '$' : currency.toUpperCase();
  return `${currencySymbol}${amount.toFixed(2)}`;
}
