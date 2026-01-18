/**
 * Stripe Account Cancellation Unit Tests
 *
 * Tests for cancelling user subscriptions during account deletion.
 * Critical for ensuring no orphaned subscriptions continue charging users.
 */

import { describe, test, expect, vi, beforeEach, Mock } from "vitest";
import { cancelAllUserSubscriptions } from "@/lib/stripe-account";

// Mock Stripe client
const mockStripeSubscriptionsCancel = vi.fn();
const mockStripeSubscriptionsList = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      list: (...args: unknown[]) => mockStripeSubscriptionsList(...args),
      cancel: (...args: unknown[]) => mockStripeSubscriptionsCancel(...args),
    },
  },
}));

// Mock database
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => ({
          limit: (n: number) => mockDbLimit(n),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  stripeCustomers: {
    userId: "userId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (field: unknown, value: unknown) => ({ field, value }),
}));

describe("cancelAllUserSubscriptions", () => {
  const testUserId = "test-user-123";
  const testStripeCustomerId = "cus_test123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Success Cases", () => {
    test("successfully cancels active subscription", async () => {
      // Mock finding the customer
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      // Mock finding active subscription
      mockStripeSubscriptionsList.mockResolvedValueOnce({
        data: [
          { id: "sub_active123", status: "active" },
        ],
      });

      // Mock successful cancellation
      mockStripeSubscriptionsCancel.mockResolvedValueOnce({
        id: "sub_active123",
        status: "canceled",
      });

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(1);
      expect(result.error).toBeUndefined();
      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith(
        "sub_active123",
        { prorate: false }
      );
    });

    test("cancels multiple active subscriptions", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({
        data: [
          { id: "sub_1", status: "active" },
          { id: "sub_2", status: "active" },
          { id: "sub_3", status: "trialing" },
        ],
      });

      mockStripeSubscriptionsCancel
        .mockResolvedValueOnce({ id: "sub_1", status: "canceled" })
        .mockResolvedValueOnce({ id: "sub_2", status: "canceled" })
        .mockResolvedValueOnce({ id: "sub_3", status: "canceled" });

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(3);
      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledTimes(3);
    });

    test("cancels trialing subscription", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: "sub_trial123", status: "trialing" }],
      });

      mockStripeSubscriptionsCancel.mockResolvedValueOnce({
        id: "sub_trial123",
        status: "canceled",
      });

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(1);
    });

    test("filters out non-active subscriptions", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({
        data: [
          { id: "sub_active", status: "active" },
          { id: "sub_canceled", status: "canceled" },
          { id: "sub_past_due", status: "past_due" },
          { id: "sub_unpaid", status: "unpaid" },
        ],
      });

      mockStripeSubscriptionsCancel.mockResolvedValueOnce({
        id: "sub_active",
        status: "canceled",
      });

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(1);
      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledTimes(1);
      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith(
        "sub_active",
        { prorate: false }
      );
    });
  });

  describe("No Subscription Cases", () => {
    test("returns success when no Stripe customer exists", async () => {
      mockDbLimit.mockResolvedValueOnce([]);

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(0);
      expect(result.error).toBeUndefined();
      expect(mockStripeSubscriptionsList).not.toHaveBeenCalled();
    });

    test("returns success when customer has no active subscriptions", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({
        data: [],
      });

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(0);
      expect(mockStripeSubscriptionsCancel).not.toHaveBeenCalled();
    });

    test("returns success when only canceled subscriptions exist", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({
        data: [
          { id: "sub_1", status: "canceled" },
          { id: "sub_2", status: "canceled" },
        ],
      });

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(0);
      expect(mockStripeSubscriptionsCancel).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    test("returns error when database query fails", async () => {
      const dbError = new Error("Database connection failed");
      mockDbLimit.mockRejectedValueOnce(dbError);

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(false);
      expect(result.cancelledCount).toBe(0);
      expect(result.error).toBe("Database connection failed");
    });

    test("returns error when Stripe list fails", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      const stripeError = new Error("Stripe API unavailable");
      mockStripeSubscriptionsList.mockRejectedValueOnce(stripeError);

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(false);
      expect(result.cancelledCount).toBe(0);
      expect(result.error).toBe("Stripe API unavailable");
    });

    test("returns error when Stripe cancel fails", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: "sub_123", status: "active" }],
      });

      const cancelError = new Error("Cannot cancel subscription");
      mockStripeSubscriptionsCancel.mockRejectedValueOnce(cancelError);

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(false);
      expect(result.cancelledCount).toBe(0);
      expect(result.error).toBe("Cannot cancel subscription");
    });

    test("handles unknown error types", async () => {
      mockDbLimit.mockRejectedValueOnce("String error");

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    test("handles null/undefined customer result", async () => {
      mockDbLimit.mockResolvedValueOnce(null);

      const result = await cancelAllUserSubscriptions(testUserId);

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(0);
    });
  });

  describe("Stripe API Interaction", () => {
    test("calls Stripe subscriptions.list with correct parameters", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({ data: [] });

      await cancelAllUserSubscriptions(testUserId);

      expect(mockStripeSubscriptionsList).toHaveBeenCalledWith({
        customer: testStripeCustomerId,
        status: "all",
      });
    });

    test("calls Stripe subscriptions.cancel without proration", async () => {
      mockDbLimit.mockResolvedValueOnce([
        { stripeCustomerId: testStripeCustomerId },
      ]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: "sub_123", status: "active" }],
      });

      mockStripeSubscriptionsCancel.mockResolvedValueOnce({
        id: "sub_123",
        status: "canceled",
      });

      await cancelAllUserSubscriptions(testUserId);

      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith("sub_123", {
        prorate: false,
      });
    });
  });

  describe("Edge Cases", () => {
    test("handles empty string userId", async () => {
      mockDbLimit.mockResolvedValueOnce([]);

      const result = await cancelAllUserSubscriptions("");

      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(0);
    });

    test("handles customer with undefined stripeCustomerId", async () => {
      mockDbLimit.mockResolvedValueOnce([{ stripeCustomerId: undefined }]);

      mockStripeSubscriptionsList.mockResolvedValueOnce({ data: [] });

      const result = await cancelAllUserSubscriptions(testUserId);

      // Should still work, Stripe will handle undefined customer ID
      expect(result.success).toBe(true);
    });
  });
});

describe("Stripe Cancellation Security Properties", () => {
  test("cancellation is immediate, not at period end", async () => {
    // The implementation uses cancel(), not update() with cancel_at_period_end
    // This ensures subscriptions are cancelled immediately during account deletion
    mockDbLimit.mockResolvedValueOnce([
      { stripeCustomerId: "cus_test" },
    ]);

    mockStripeSubscriptionsList.mockResolvedValueOnce({
      data: [{ id: "sub_123", status: "active" }],
    });

    mockStripeSubscriptionsCancel.mockResolvedValueOnce({
      id: "sub_123",
      status: "canceled",
    });

    await cancelAllUserSubscriptions("user-123");

    // Verify cancel was called (not update with cancel_at_period_end)
    expect(mockStripeSubscriptionsCancel).toHaveBeenCalled();
  });

  test("no proration on cancellation", async () => {
    // Account deletion should not prorate - user requested deletion
    mockDbLimit.mockResolvedValueOnce([
      { stripeCustomerId: "cus_test" },
    ]);

    mockStripeSubscriptionsList.mockResolvedValueOnce({
      data: [{ id: "sub_123", status: "active" }],
    });

    mockStripeSubscriptionsCancel.mockResolvedValueOnce({
      id: "sub_123",
      status: "canceled",
    });

    await cancelAllUserSubscriptions("user-123");

    expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith(
      "sub_123",
      { prorate: false }
    );
  });
});
