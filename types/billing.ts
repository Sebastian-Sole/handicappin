export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid"
  | "free"
  | null; // NULL when no plan selected

export type PlanType = "free" | "premium" | "unlimited" | "lifetime" | null; // NULL when no plan selected

export interface FeatureAccess {
  plan: PlanType;
  hasAccess: boolean; // Can use the app at all
  hasPremiumAccess: boolean; // Can access /dashboard and /calculators
  hasUnlimitedRounds: boolean; // No round limit enforcement
  remainingRounds: number;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  isLifetime: boolean;
  cancelAtPeriodEnd?: boolean; // Whether subscription is set to cancel at period end
}
