import Stripe from "stripe";
import { env } from "@/env";

// Initialize Stripe client with secret key
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
  typescript: true,
});

// Price ID to Plan mapping
export const PRICE_TO_PLAN_MAP: Record<string, "premium" | "unlimited"> = {
  [env.STRIPE_PREMIUM_PRICE_ID]: "premium",
  [env.STRIPE_UNLIMITED_PRICE_ID]: "unlimited",
  [env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID]: "unlimited",
};

// Plan to Price ID mapping (for UI)
export const PLAN_TO_PRICE_MAP = {
  premium: env.STRIPE_PREMIUM_PRICE_ID,
  unlimited: env.STRIPE_UNLIMITED_PRICE_ID,
  "unlimited-lifetime": env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID,
} as const;

/**
 * Map Stripe price ID to internal plan type
 */
export function mapPriceToPlan(
  priceId: string
): "premium" | "unlimited" | null {
  return PRICE_TO_PLAN_MAP[priceId] ?? null;
}

/**
 * Get or create Stripe customer for a Supabase user
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  stripeCustomerId?: string | null
): Promise<string> {
  // If we already have a customer ID, return it
  console.log("stripeCustomerId", stripeCustomerId);
  if (stripeCustomerId) {
    return stripeCustomerId;
  }

  // Create new Stripe customer with user metadata
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  console.log("customer", customer);

  return customer.id;
}

/**
 * Create Stripe Checkout Session for subscription or one-time payment
 */
export async function createCheckoutSession({
  customerId,
  priceId,
  mode,
  userId,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  priceId: string;
  mode: "subscription" | "payment";
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    metadata: {
      supabase_user_id: userId,
    },
    // Add metadata to subscription when created
    subscription_data:
      mode === "subscription"
        ? {
            metadata: {
              supabase_user_id: userId,
            },
          }
        : undefined,
    allow_promotion_codes: true, // Enable promo codes
    billing_address_collection: "auto",
  });

  return session;
}

/**
 * Create Stripe Customer Portal session for subscription management
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
