export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid"
  | "free";

export type PlanType = "free" | "premium" | "unlimited" | "lifetime";

export interface FeatureAccess {
  plan: PlanType;
  hasAccess: boolean; // Can use the app at all
  hasPremiumAccess: boolean; // Can access /dashboard and /calculators
  hasUnlimitedRounds: boolean; // No round limit enforcement
  remainingRounds: number;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  isLifetime: boolean;
}
