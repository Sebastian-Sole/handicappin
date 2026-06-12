/**
 * The §1 paywall policy matrix (decision ledger D-policy / D-paywall,
 * LOCKED) as a pure function over the user's REAL billing projection:
 *
 * | Projection state          | Native paywall                              |
 * |---------------------------|---------------------------------------------|
 * | plan null/free            | full paywall (purchasable)                  |
 * | active + provider apple   | native plan change + Apple manage link      |
 * | active + provider stripe  | no purchase buttons; neutral copy (NO link) |
 * | lifetime (any provider)   | no purchase buttons                         |
 * | always                    | Restore Purchases                           |
 *
 * Non-active paid states (past_due, canceled-in-grace) keep their
 * provider's management affordance and never show purchase buttons — the
 * contract still exists; buying again would double-bill (logged D26).
 */
import type {
  BillingProviderId,
  PlanType,
  SubscriptionStatus,
} from "@/lib/api/schemas/profile";

export interface BillingProjectionState {
  plan: PlanType | null;
  status: SubscriptionStatus | null;
  provider: BillingProviderId | null;
  cancelAtPeriodEnd: boolean;
}

export interface PaywallPolicy {
  /** Full paywall: the real lineup with purchase CTAs through the seam. */
  showPurchaseButtons: boolean;
  /** Apple-billed: native upgrade/downgrade within the subscription group. */
  showNativePlanChange: boolean;
  /** Apple-billed: manage-subscriptions affordance (managementURL). */
  showAppleManage: boolean;
  /** Stripe-billed: neutral "managed on handicappin.com" copy, NO link. */
  showStripeNeutralCopy: boolean;
  /** Always true (§1: Restore always visible). */
  showRestore: true;
  /** Paywall compliance block (auto-renew disclosure + legal links). */
  showDisclosure: boolean;
}

function isPaidPlan(plan: PlanType | null): boolean {
  return plan === "premium" || plan === "unlimited" || plan === "lifetime";
}

export function paywallPolicyFor(
  state: BillingProjectionState,
): PaywallPolicy {
  // Lifetime (any provider): no purchase buttons, nothing to manage.
  if (state.plan === "lifetime") {
    return {
      showPurchaseButtons: false,
      showNativePlanChange: false,
      showAppleManage: false,
      showStripeNeutralCopy: false,
      showRestore: true,
      showDisclosure: false,
    };
  }

  // No contract (null or free tier): full paywall, purchasable.
  if (!isPaidPlan(state.plan)) {
    return {
      showPurchaseButtons: true,
      showNativePlanChange: false,
      showAppleManage: false,
      showStripeNeutralCopy: false,
      showRestore: true,
      showDisclosure: true,
    };
  }

  // Paid subscription (active OR in a non-active contract state like
  // past_due / canceled-in-grace): the owning provider manages it.
  if (state.provider === "apple") {
    const active = state.status === "active" || state.status === "trialing";
    return {
      showPurchaseButtons: false,
      // Plan change happens where the subscription lives (Policy A) — only
      // offered while the contract is actually active.
      showNativePlanChange: active,
      showAppleManage: true,
      showStripeNeutralCopy: false,
      showRestore: true,
      showDisclosure: active,
    };
  }

  // Stripe-billed (or legacy rows with provider null + a paid plan, which
  // predate billing_provider and are all stripe-billed): neutral copy.
  return {
    showPurchaseButtons: false,
    showNativePlanChange: false,
    showAppleManage: false,
    showStripeNeutralCopy: true,
    showRestore: true,
    showDisclosure: false,
  };
}

/** §1 D-policy copy — neutral, and deliberately NOT a link. */
export const STRIPE_NEUTRAL_COPY =
  "Your subscription is managed on handicappin.com.";

/** Paywall compliance copy (App Store 3.1.2 auto-renew disclosure). */
export const AUTO_RENEW_DISCLOSURE =
  "Yearly subscriptions renew automatically until cancelled. Payment is " +
  "charged to your Apple ID account; manage or cancel anytime in App Store " +
  "subscription settings. The lifetime plan is a one-time purchase and does " +
  "not renew.";
