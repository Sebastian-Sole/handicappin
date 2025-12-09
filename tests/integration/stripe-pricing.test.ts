/**
 * Stripe Price Configuration Integration Tests
 *
 * These tests verify that Stripe price IDs point to the correct amounts.
 * They catch:
 * - Environment misconfiguration (wrong price IDs in .env)
 * - Price changes in Stripe dashboard
 * - Price ID swaps
 *
 * IMPORTANT: These tests make real Stripe API calls
 * - Requires STRIPE_SECRET_KEY to be set
 * - Safe to run in test mode (read-only, no charges)
 * - Run in CI/CD before deployment
 */

import { stripe, PLAN_TO_PRICE_MAP } from "@/lib/stripe";
import { PLAN_PRICING } from "@/utils/billing/pricing";
import { describe, test, expect } from "vitest";

// Skip tests if Stripe not configured (e.g., in CI without secrets)
const describeIfStripeConfigured = process.env.STRIPE_SECRET_KEY
  ? describe
  : describe.skip;

describeIfStripeConfigured("Stripe Price Configuration", () => {
  test("Premium price ID matches expected amount", async () => {
    const priceId = PLAN_TO_PRICE_MAP.premium;

    if (!priceId) {
      throw new Error("STRIPE_PREMIUM_PRICE_ID not configured in environment");
    }

    const price = await stripe.prices.retrieve(priceId);

    expect(price.unit_amount).toBe(PLAN_PRICING.premium.yearly.usd);
    expect(price.currency).toBe("usd");
    expect(price.type).toBe("recurring");
    expect(price.recurring?.interval).toBe("year");
  }, 10000); // 10s timeout for API call

  test("Unlimited price ID matches expected amount", async () => {
    const priceId = PLAN_TO_PRICE_MAP.unlimited;

    if (!priceId) {
      throw new Error(
        "STRIPE_UNLIMITED_PRICE_ID not configured in environment"
      );
    }

    const price = await stripe.prices.retrieve(priceId);

    expect(price.unit_amount).toBe(PLAN_PRICING.unlimited.yearly.usd);
    expect(price.currency).toBe("usd");
    expect(price.type).toBe("recurring");
    expect(price.recurring?.interval).toBe("year");
  }, 10000);

  test("Lifetime price ID matches expected amount", async () => {
    const priceId = PLAN_TO_PRICE_MAP.lifetime;

    if (!priceId) {
      throw new Error(
        "STRIPE_UNLIMITED_LIFETIME_PRICE_ID not configured in environment"
      );
    }

    const price = await stripe.prices.retrieve(priceId);

    expect(price.unit_amount).toBe(PLAN_PRICING.lifetime.oneTime.usd);
    expect(price.currency).toBe("usd");
    expect(price.type).toBe("one_time");
  }, 10000);

  test("All price IDs are configured", () => {
    expect(PLAN_TO_PRICE_MAP.premium).toBeTruthy();
    expect(PLAN_TO_PRICE_MAP.unlimited).toBeTruthy();
    expect(PLAN_TO_PRICE_MAP.lifetime).toBeTruthy();
  });

  test("All price IDs are different", () => {
    const priceIds = [
      PLAN_TO_PRICE_MAP.premium,
      PLAN_TO_PRICE_MAP.unlimited,
      PLAN_TO_PRICE_MAP.lifetime,
    ];

    const uniquePriceIds = new Set(priceIds);
    expect(uniquePriceIds.size).toBe(3);
  });
});

describeIfStripeConfigured("Stripe Price Metadata", () => {
  test("Premium price has correct product reference", async () => {
    const priceId = PLAN_TO_PRICE_MAP.premium;
    if (!priceId) return;

    const price = await stripe.prices.retrieve(priceId);
    expect(price.product).toBeTruthy();
  }, 10000);

  test("Unlimited price has correct product reference", async () => {
    const priceId = PLAN_TO_PRICE_MAP.unlimited;
    if (!priceId) return;

    const price = await stripe.prices.retrieve(priceId);
    expect(price.product).toBeTruthy();
  }, 10000);

  test("Lifetime price has correct product reference", async () => {
    const priceId = PLAN_TO_PRICE_MAP.lifetime;
    if (!priceId) return;

    const price = await stripe.prices.retrieve(priceId);
    expect(price.product).toBeTruthy();
  }, 10000);
});
