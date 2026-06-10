import { z } from "zod";

// ============================================
// Plan Types
// ============================================

export const PLAN_TYPES = ["free", "premium", "unlimited", "lifetime"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PlanSchema = z.enum(PLAN_TYPES);

// ============================================
// Subscription Status Types
// ============================================

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "paused",
  "incomplete",
  "incomplete_expired",
  "unpaid",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);

// ============================================
// API Request Schemas
// ============================================

export const CheckoutRequestSchema = z.object({
  plan: z.enum(["premium", "unlimited", "lifetime"]),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export const UpdateSubscriptionRequestSchema = z.object({
  newPlan: PlanSchema,
});

export type UpdateSubscriptionRequest = z.infer<typeof UpdateSubscriptionRequestSchema>;

// ============================================
// Subscription Info Schema
// ============================================

export const SubscriptionInfoSchema = z.object({
  id: z.string(),
  status: SubscriptionStatusSchema,
  currentPeriodStart: z.date().nullable(),
  currentPeriodEnd: z.date().nullable(),
  priceId: z.string().optional(),
  plan: PlanSchema.nullable(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.date().nullable(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;
