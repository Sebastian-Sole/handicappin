import Stripe from "stripe";
import { getOrCreateStripeCustomer } from "./stripe-customer";
import type { PlanType } from "./stripe-types";

// Initialize Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

// Launch promotion code for lifetime plan
const LAUNCH_PROMO_CODE = "EARLY100";

// Price IDs for different plans (set these in your .env file)
export const PLAN_TO_PRICE_MAP = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID ?? "",
  unlimited: process.env.STRIPE_UNLIMITED_PRICE_ID ?? "",
  lifetime: process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID ?? "",
} as const;

// Reverse mapping: price ID to plan type
export function mapPriceToPlan(
  priceId: string
): Exclude<PlanType, "free"> | null {
  if (priceId === PLAN_TO_PRICE_MAP.premium) return "premium";
  if (priceId === PLAN_TO_PRICE_MAP.unlimited) return "unlimited";
  if (priceId === PLAN_TO_PRICE_MAP.lifetime) return "lifetime";
  return null;
}

/**
 * Get promotion code details and remaining redemptions
 */
export async function getPromotionCodeDetails(code: string): Promise<{
  id: string | null;
  remaining: number;
  total: number;
} | null> {
  try {
    const promoCodes = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });

    const promoCode = promoCodes.data[0];

    if (!promoCode) {
      return null;
    }

    const maxRedemptions = promoCode.max_redemptions || 0;
    const timesRedeemed = promoCode.times_redeemed || 0;
    const remaining = Math.max(0, maxRedemptions - timesRedeemed);

    return {
      id: promoCode.id,
      remaining,
      total: maxRedemptions,
    };
  } catch (error) {
    console.error(`Failed to fetch promotion code details for "${code}":`, error);
    return null;
  }
}

/**
 * Create a Stripe checkout session for a subscription (recurring)
 */
export async function createCheckoutSession({
  userId,
  email,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer({ email, userId });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    ...(customerId ? { customer: customerId } : { customer_email: email }),
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Don't allow promo codes on subscriptions (only on lifetime via auto-apply)
    allow_promotion_codes: false,
    metadata: {
      supabase_user_id: userId,
    },
    subscription_data: {
      metadata: {
        supabase_user_id: userId,
      },
    },
  });

  return session;
}

/**
 * Create a Stripe checkout session for a one-time payment (lifetime)
 */
export async function createLifetimeCheckoutSession({
  userId,
  email,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer({ email, userId });

  // Get the launch promotion code and auto-apply if available
  const promoDetails = await getPromotionCodeDetails(LAUNCH_PROMO_CODE);
  const hasAvailableSlots = promoDetails && promoDetails.remaining > 0;

  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    ...(customerId ? { customer: customerId } : { customer_email: email }),
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      supabase_user_id: userId,
      plan_type: "lifetime",
    },
  };

  // Auto-apply promo code if slots are available, otherwise allow manual entry
  if (hasAvailableSlots && promoDetails.id) {
    sessionConfig.discounts = [{ promotion_code: promoDetails.id }];
  } else {
    sessionConfig.allow_promotion_codes = true;
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  return session;
}

/**
 * Create a customer portal session for subscription management
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

type UpdateSubscriptionResult =
  | { subscription: Stripe.Subscription; changeType: "cancel" }
  | { subscription: null; changeType: "cancel"; alreadyCancelled: true }
  | { subscription: null; changeType: "lifetime"; requiresCheckout: true }
  | { subscription: Stripe.Subscription; changeType: "upgrade" | "downgrade" };

/**
 * Update an existing subscription to a new price
 * Handles both upgrades (immediate with proration) and downgrades (end of cycle)
 */
export async function updateSubscription({
  userId,
  newPlan,
}: {
  userId: string;
  newPlan: PlanType;
}): Promise<UpdateSubscriptionResult> {
  const { db } = await import("@/db");
  const { stripeCustomers } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  // Get user's Stripe customer ID
  const customer = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1);

  if (!customer || customer.length === 0) {
    throw new Error("No Stripe customer found for user");
  }

  const customerId = customer[0].stripeCustomerId;

  // Get active subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  const subscription = subscriptions.data[0];

  // Special case: User wants to downgrade to free but no active subscription exists
  // This can happen if subscription was already cancelled/expired in Stripe but DB not synced
  if (!subscription && newPlan === "free") {
    const { profile } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");

    await db
      .update(profile)
      .set({
        planSelected: "free",
        planSelectedAt: new Date(),
        subscriptionStatus: "canceled",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingVersion: sql`billing_version + 1`,
      })
      .where(eq(profile.id, userId));

    // Return success - subscription is already cancelled
    return {
      subscription: null,
      changeType: "cancel" as const,
      alreadyCancelled: true,
    };
  }

  if (!subscription) {
    throw new Error("No active subscription found");
  }

  const currentPlan = mapPriceToPlan(
    subscription.items.data[0]?.price.id || ""
  );

  // Determine if upgrade or downgrade
  const planHierarchy = { free: 0, premium: 1, unlimited: 2, lifetime: 3 };
  const isUpgrade =
    planHierarchy[newPlan] > planHierarchy[currentPlan || "free"];

  // Handle downgrade to free = cancel subscription
  if (newPlan === "free") {
    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });
    return { subscription: updated, changeType: "cancel" as const };
  }

  // Handle upgrade to lifetime = cancel subscription + create checkout
  if (newPlan === "lifetime") {
    // Cancel current subscription at period end
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    // Return signal to create lifetime checkout
    return {
      subscription: null,
      changeType: "lifetime" as const,
      requiresCheckout: true,
    };
  }

  // Handle subscription tier change (premium <-> unlimited)
  // NOTE: Plan changes between paid tiers should be done via Stripe Customer Portal
  // This code path is kept for backwards compatibility but is not actively used
  const newPriceId = PLAN_TO_PRICE_MAP[newPlan];

  if (!newPriceId) {
    throw new Error(`No price ID found for plan: ${newPlan}`);
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: isUpgrade ? "always_invoice" : "create_prorations",
    billing_cycle_anchor: isUpgrade ? "now" : "unchanged",
  });

  return {
    subscription: updated,
    changeType: isUpgrade ? ("upgrade" as const) : ("downgrade" as const),
  };
}
