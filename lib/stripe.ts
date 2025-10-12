import Stripe from "stripe";

// Initialize Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-09-30.clover",
  typescript: true,
});

// Price IDs for different plans (set these in your .env file)
export const PLAN_TO_PRICE_MAP = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID ?? "",
  unlimited: process.env.STRIPE_UNLIMITED_PRICE_ID ?? "",
  lifetime: process.env.STRIPE_LIFETIME_PRICE_ID ?? "",
} as const;

// Reverse mapping: price ID to plan type
export function mapPriceToPlan(
  priceId: string
): "premium" | "unlimited" | null {
  if (priceId === PLAN_TO_PRICE_MAP.premium) return "premium";
  if (priceId === PLAN_TO_PRICE_MAP.unlimited) return "unlimited";
  return null;
}

/**
 * Create a Stripe checkout session for a subscription
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
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
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
