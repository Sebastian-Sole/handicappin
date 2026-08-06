/**
 * Stripe Price Mapping Unit Tests
 *
 * Tests for the mapPriceToPlan function which converts Stripe price IDs
 * to internal plan types. This is critical for webhook processing.
 *
 * De-flaking note: this is the only unit test that imports the REAL
 * `@/lib/stripe` (every sibling stripe test mocks the module wholesale).
 * `lib/stripe.ts` constructs a Stripe client at module scope and pulls in
 * `@/lib/rate-limit` -> `@/lib/sentry-utils` -> `@sentry/nextjs` + `@/env`,
 * a graph that costs >5s to load on a cold Vitest/OS cache. That whole cost
 * was billed to whichever test ran first, so the first test intermittently
 * blew the 5s per-test budget.
 *
 * Two changes remove the cliff without weakening any assertion:
 *   1. The two module-scope dependencies that price mapping never touches
 *      (the Stripe SDK itself and `getRedisClient`, used only by
 *      `getPromotionCodeDetails`) are mocked, which prunes Sentry/env/upstash
 *      from the graph. The real `@/lib/stripe` is still imported and the real
 *      `mapPriceToPlan` / `PLAN_TO_PRICE_MAP` are still under test.
 *   2. The import is hoisted into a single `beforeAll` instead of being
 *      repeated (behind `vi.resetModules()`) in all nine tests.
 */

import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";

// `lib/stripe.ts` does `new Stripe(...)` at module scope. Price mapping never
// touches that client, so a bare constructible stand-in keeps the SDK out of
// the import graph.
vi.mock("stripe", () => ({ default: class StripeStub {} }));

// `getRedisClient` is only reached from `getPromotionCodeDetails`, which this
// file never calls. Mocking it prunes @sentry/nextjs, @/env and @upstash/*.
vi.mock("@/lib/rate-limit", () => ({ getRedisClient: () => null }));

type StripeModule = typeof import("@/lib/stripe");

let mapPriceToPlan: StripeModule["mapPriceToPlan"];
let PLAN_TO_PRICE_MAP: StripeModule["PLAN_TO_PRICE_MAP"];

beforeAll(async () => {
  // Price IDs are read at module scope, so they must be set before the import.
  process.env.STRIPE_PREMIUM_PRICE_ID = "price_premium_test";
  process.env.STRIPE_UNLIMITED_PRICE_ID = "price_unlimited_test";
  process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID = "price_lifetime_test";

  // Guarantee the module is evaluated against the env set above, whatever the
  // registry state left by Vitest's setup files.
  vi.resetModules();

  ({ mapPriceToPlan, PLAN_TO_PRICE_MAP } = await import("@/lib/stripe"));
});

afterAll(() => {
  delete process.env.STRIPE_PREMIUM_PRICE_ID;
  delete process.env.STRIPE_UNLIMITED_PRICE_ID;
  delete process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID;
});

describe("mapPriceToPlan", () => {
  test("maps premium price ID to premium plan", () => {
    const result = mapPriceToPlan("price_premium_test");

    expect(result).toBe("premium");
  });

  test("maps unlimited price ID to unlimited plan", () => {
    const result = mapPriceToPlan("price_unlimited_test");

    expect(result).toBe("unlimited");
  });

  test("maps lifetime price ID to lifetime plan", () => {
    const result = mapPriceToPlan("price_lifetime_test");

    expect(result).toBe("lifetime");
  });

  test("returns null for unknown price ID", () => {
    const result = mapPriceToPlan("price_unknown_xyz");

    expect(result).toBeNull();
  });

  test("returns null for empty string", () => {
    const result = mapPriceToPlan("");

    expect(result).toBeNull();
  });

  test("is case-sensitive (price IDs must match exactly)", () => {
    // Uppercase should not match
    const result = mapPriceToPlan("PRICE_PREMIUM_TEST");

    expect(result).toBeNull();
  });
});

describe("PLAN_TO_PRICE_MAP", () => {
  test("contains all paid plan types", () => {
    expect(PLAN_TO_PRICE_MAP).toHaveProperty("premium");
    expect(PLAN_TO_PRICE_MAP).toHaveProperty("unlimited");
    expect(PLAN_TO_PRICE_MAP).toHaveProperty("lifetime");
  });

  test("does not contain free plan", () => {
    expect(PLAN_TO_PRICE_MAP).not.toHaveProperty("free");
  });

  test("uses environment variables for price IDs", () => {
    expect(PLAN_TO_PRICE_MAP.premium).toBe("price_premium_test");
    expect(PLAN_TO_PRICE_MAP.unlimited).toBe("price_unlimited_test");
    expect(PLAN_TO_PRICE_MAP.lifetime).toBe("price_lifetime_test");
  });
});
