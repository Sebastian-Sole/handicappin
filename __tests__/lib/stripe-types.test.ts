import { describe, it, expect } from "vitest";
import {
  CheckoutRequestSchema,
  UpdateSubscriptionRequestSchema,
  PlanSchema,
  SubscriptionStatusSchema,
} from "@/lib/stripe-types";

describe("Stripe Type Validation", () => {
  describe("CheckoutRequestSchema", () => {
    it("should accept valid premium plan", () => {
      const result = CheckoutRequestSchema.safeParse({ plan: "premium" });
      expect(result.success).toBe(true);
    });

    it("should accept valid unlimited plan", () => {
      const result = CheckoutRequestSchema.safeParse({ plan: "unlimited" });
      expect(result.success).toBe(true);
    });

    it("should accept valid lifetime plan", () => {
      const result = CheckoutRequestSchema.safeParse({ plan: "lifetime" });
      expect(result.success).toBe(true);
    });

    it("should reject free plan (not available for checkout)", () => {
      const result = CheckoutRequestSchema.safeParse({ plan: "free" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid plan", () => {
      const result = CheckoutRequestSchema.safeParse({ plan: "invalid" });
      expect(result.success).toBe(false);
    });

    it("should reject missing plan", () => {
      const result = CheckoutRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateSubscriptionRequestSchema", () => {
    it("should accept all valid plans including free", () => {
      expect(UpdateSubscriptionRequestSchema.safeParse({ newPlan: "free" }).success).toBe(true);
      expect(UpdateSubscriptionRequestSchema.safeParse({ newPlan: "premium" }).success).toBe(true);
      expect(UpdateSubscriptionRequestSchema.safeParse({ newPlan: "unlimited" }).success).toBe(true);
      expect(UpdateSubscriptionRequestSchema.safeParse({ newPlan: "lifetime" }).success).toBe(true);
    });

    it("should reject invalid plan", () => {
      const result = UpdateSubscriptionRequestSchema.safeParse({ newPlan: "invalid" });
      expect(result.success).toBe(false);
    });
  });

  describe("PlanSchema", () => {
    it("should accept all plan types", () => {
      expect(PlanSchema.safeParse("free").success).toBe(true);
      expect(PlanSchema.safeParse("premium").success).toBe(true);
      expect(PlanSchema.safeParse("unlimited").success).toBe(true);
      expect(PlanSchema.safeParse("lifetime").success).toBe(true);
    });

    it("should reject invalid plan", () => {
      expect(PlanSchema.safeParse("invalid").success).toBe(false);
    });
  });

  describe("SubscriptionStatusSchema", () => {
    it("should accept all valid subscription statuses", () => {
      const validStatuses = [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "paused",
        "incomplete",
        "incomplete_expired",
        "unpaid",
      ];

      validStatuses.forEach((status) => {
        expect(SubscriptionStatusSchema.safeParse(status).success).toBe(true);
      });
    });

    it("should reject invalid status", () => {
      expect(SubscriptionStatusSchema.safeParse("invalid").success).toBe(false);
    });
  });
});
