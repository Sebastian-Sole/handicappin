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

// No input needed for portal (authenticated endpoint)
export type PortalRequest = Record<string, never>;

// ============================================
// API Response Schemas
// ============================================

export const CheckoutResponseSchema = z.object({
  url: z.string().url(),
});

export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

export const PortalResponseSchema = z.object({
  url: z.string().url(),
});

export type PortalResponse = z.infer<typeof PortalResponseSchema>;

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

export const GetSubscriptionResponseSchema = z.object({
  hasStripeCustomer: z.boolean(),
  stripeCustomerId: z.string().optional(),
  subscriptions: z.array(SubscriptionInfoSchema),
  error: z.string().optional(),
});

export type GetSubscriptionResponse = z.infer<typeof GetSubscriptionResponseSchema>;

export const UpdateSubscriptionResponseSchema = z.object({
  success: z.boolean(),
  changeType: z.enum(["upgrade", "downgrade", "cancel", "lifetime"]),
  checkoutUrl: z.string().url().optional(),
  message: z.string().optional(),
});

export type UpdateSubscriptionResponse = z.infer<typeof UpdateSubscriptionResponseSchema>;

// ============================================
// Error Response Schema
// ============================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  retryAfter: z.number().optional(), // For rate limit errors
  details: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================
// API Result Type (Success or Error)
// ============================================

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ErrorResponse };
