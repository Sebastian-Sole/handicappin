import { z } from "zod";

// Plan types
export const planSchema = z.enum(["free", "premium", "unlimited"]);
export type Plan = z.infer<typeof planSchema>;

// Subscription status types (matches Stripe)
export const subscriptionStatusSchema = z.enum([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "trialing",
  "unpaid",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

// Subscription type
export const subscriptionSchema = z.object({
  userId: z.string().uuid(),
  stripeSubscriptionId: z.string().nullable(),
  plan: planSchema,
  status: subscriptionStatusSchema,
  currentPeriodEnd: z.date().nullable(),
  isLifetime: z.boolean(),
  updatedAt: z.date(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

// Customer type
export const customerSchema = z.object({
  userId: z.string().uuid(),
  stripeCustomerId: z.string(),
  createdAt: z.date(),
});
export type Customer = z.infer<typeof customerSchema>;

// Checkout request
export const checkoutRequestSchema = z.object({
  priceId: z.string().startsWith("price_"),
  mode: z.enum(["subscription", "payment"]),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

// Feature access helper types
export interface FeatureAccess {
  hasPremiumAccess: boolean;
  hasUnlimitedRounds: boolean;
  plan: Plan;
  status: SubscriptionStatus | "free";
  isLifetime: boolean;
  currentPeriodEnd: Date | null;
}
