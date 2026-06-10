/**
 * Trust-boundary schema for `auth.getProfileFromUserId` (and any procedure
 * returning a `profile` row). Shape source: the PostgREST row in
 * apps/web/types/supabase.ts (`profile.Row`) — snake_case billing columns,
 * camelCase legacy columns, timestamps as ISO strings.
 */
import { z } from "zod";

export const planTypeSchema = z.enum([
  "free",
  "premium",
  "unlimited",
  "lifetime",
]);
export type PlanType = z.infer<typeof planTypeSchema>;

export const subscriptionStatusSchema = z.enum([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "trialing",
  "unpaid",
  "free",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const profileSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  handicapIndex: z.number(),
  initialHandicapIndex: z.number(),
  verified: z.boolean(),
  createdAt: z.string(),
  plan_selected: planTypeSchema.nullable(),
  plan_selected_at: z.string().nullable(),
  subscription_status: subscriptionStatusSchema.nullable(),
  current_period_end: z.number().nullable(),
  cancel_at_period_end: z.boolean(),
  billing_version: z.number(),
});

export type Profile = z.infer<typeof profileSchema>;
