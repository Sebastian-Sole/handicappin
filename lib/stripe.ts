import Stripe from "stripe";
import { getOrCreateStripeCustomer } from "./stripe-customer";

// Initialize Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-09-30.clover",
  typescript: true,
});

// Price IDs for different plans (set these in your .env file)
export const PLAN_TO_PRICE_MAP = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID ?? "",
  unlimited: process.env.STRIPE_UNLIMITED_PRICE_ID ?? "",
  lifetime: process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID ?? "",
} as const;

// Reverse mapping: price ID to plan type
export function mapPriceToPlan(
  priceId: string
): "premium" | "unlimited" | "lifetime" | null {
  if (priceId === PLAN_TO_PRICE_MAP.premium) return "premium";
  if (priceId === PLAN_TO_PRICE_MAP.unlimited) return "unlimited";
  if (priceId === PLAN_TO_PRICE_MAP.lifetime) return "lifetime";
  return null;
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

  const session = await stripe.checkout.sessions.create({
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
