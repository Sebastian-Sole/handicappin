/**
 * Stripe Price Mapping Unit Tests
 *
 * Tests for the mapPriceToPlan function which converts Stripe price IDs
 * to internal plan types. This is critical for webhook processing.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";


describe("mapPriceToPlan", () => {
  beforeEach(() => {
    // Reset modules to pick up new env values
    vi.resetModules();

    // Set test price IDs
    process.env.STRIPE_PREMIUM_PRICE_ID = "price_premium_test";
    process.env.STRIPE_UNLIMITED_PRICE_ID = "price_unlimited_test";
    process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID = "price_lifetime_test";
  });

  afterEach(() => {
    // Delete the specific keys we set in beforeEach
    delete process.env.STRIPE_PREMIUM_PRICE_ID;
    delete process.env.STRIPE_UNLIMITED_PRICE_ID;
    delete process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID;
  });

  test("maps premium price ID to premium plan", async () => {
    const { mapPriceToPlan } = await import("@/lib/stripe");

    const result = mapPriceToPlan("price_premium_test");

    expect(result).toBe("premium");
  });

  test("maps unlimited price ID to unlimited plan", async () => {
    const { mapPriceToPlan } = await import("@/lib/stripe");

    const result = mapPriceToPlan("price_unlimited_test");

    expect(result).toBe("unlimited");
  });

  test("maps lifetime price ID to lifetime plan", async () => {
    const { mapPriceToPlan } = await import("@/lib/stripe");

    const result = mapPriceToPlan("price_lifetime_test");

    expect(result).toBe("lifetime");
  });

  test("returns null for unknown price ID", async () => {
    const { mapPriceToPlan } = await import("@/lib/stripe");

    const result = mapPriceToPlan("price_unknown_xyz");

    expect(result).toBeNull();
  });

  test("returns null for empty string", async () => {
    const { mapPriceToPlan } = await import("@/lib/stripe");

    const result = mapPriceToPlan("");

    expect(result).toBeNull();
  });

  test("is case-sensitive (price IDs must match exactly)", async () => {
    const { mapPriceToPlan } = await import("@/lib/stripe");

    // Uppercase should not match
    const result = mapPriceToPlan("PRICE_PREMIUM_TEST");

    expect(result).toBeNull();
  });
});

describe("PLAN_TO_PRICE_MAP", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.STRIPE_PREMIUM_PRICE_ID = "price_premium_test";
    process.env.STRIPE_UNLIMITED_PRICE_ID = "price_unlimited_test";
    process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID = "price_lifetime_test";
  });

  afterEach(() => {
    // Delete the specific keys we set in beforeEach
    delete process.env.STRIPE_PREMIUM_PRICE_ID;
    delete process.env.STRIPE_UNLIMITED_PRICE_ID;
    delete process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID;
  });

  test("contains all paid plan types", async () => {
    const { PLAN_TO_PRICE_MAP } = await import("@/lib/stripe");

    expect(PLAN_TO_PRICE_MAP).toHaveProperty("premium");
    expect(PLAN_TO_PRICE_MAP).toHaveProperty("unlimited");
    expect(PLAN_TO_PRICE_MAP).toHaveProperty("lifetime");
  });

  test("does not contain free plan", async () => {
    const { PLAN_TO_PRICE_MAP } = await import("@/lib/stripe");

    expect(PLAN_TO_PRICE_MAP).not.toHaveProperty("free");
  });

  test("uses environment variables for price IDs", async () => {
    const { PLAN_TO_PRICE_MAP } = await import("@/lib/stripe");

    expect(PLAN_TO_PRICE_MAP.premium).toBe("price_premium_test");
    expect(PLAN_TO_PRICE_MAP.unlimited).toBe("price_unlimited_test");
    expect(PLAN_TO_PRICE_MAP.lifetime).toBe("price_lifetime_test");
  });
});
