import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure, publicProcedure } from "../trpc";
import {
  createCheckoutSession,
  createLifetimeCheckoutSession,
  createPortalSession,
  updateSubscription as updateStripeSubscription,
  PLAN_TO_PRICE_MAP,
  stripe,
  mapPriceToPlan,
  getPromotionCodeDetails,
} from "@/lib/stripe";
import { verifyPaymentAmount, formatAmount } from "@/utils/billing/pricing";
import {
  checkoutRateLimit,
  portalRateLimit,
} from "@/lib/rate-limit";
import {
  sendSubscriptionUpgradedEmail,
  sendSubscriptionDowngradedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/email-service";
import { PlanSchema } from "@/lib/stripe-types";
import Stripe from "stripe";

// Helper to check rate limits and throw tRPC error if exceeded
async function checkRateLimit(
  identifier: string,
  rateLimit: typeof checkoutRateLimit
) {
  const { success, limit, remaining, reset } = await rateLimit.limit(
    identifier
  );

  if (!success) {
    const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);

    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again in a moment.",
      cause: {
        retryAfter: retryAfterSeconds,
        limit,
        remaining,
        reset: new Date(reset).toISOString(),
      },
    });
  }

  return { limit, remaining, reset };
}

// Helper to get the base URL for server-side operations
// Uses stable Vercel branch URL or SITE_URL for local dev
function getServerBaseUrl(): string {
  // Production: Use production URL
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Preview/Development: Use stable branch URL (not commit-specific URL)
  // VERCEL_BRANCH_URL is stable for the branch (e.g., project-feat-payments.vercel.app)
  // VERCEL_URL changes every commit (e.g., project-git-abc123.vercel.app)
  if (process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}`;
  }

  // Fallback to commit URL if branch URL not available
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development: Use SITE_URL from .env.development
  if (process.env.SITE_URL) {
    return process.env.SITE_URL;
  }

  // Final fallback to localhost
  return "http://localhost:3000";
}

export const stripeRouter = createTRPCRouter({
  // POST /api/stripe/checkout
  createCheckout: authedProcedure
    .input(
      z.object({
        plan: z.enum(["premium", "unlimited", "lifetime"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      if (!user.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email required for checkout",
        });
      }

      // Rate limiting check
      const identifier = `user:${user.id}`;
      await checkRateLimit(identifier, checkoutRateLimit);

      const priceId = PLAN_TO_PRICE_MAP[input.plan];

      if (!priceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Price ID not configured for this plan",
        });
      }

      // Verify price ID points to correct amount (Defense in Depth)
      try {
        const price = await stripe.prices.retrieve(priceId);

        const verification = verifyPaymentAmount(
          input.plan,
          price.currency,
          price.unit_amount || 0,
          price.type === "recurring"
        );

        if (!verification.valid) {
          console.error("❌ CRITICAL: Price verification failed at checkout", {
            plan: input.plan,
            priceId,
            expected: formatAmount(verification.expected),
            actual: formatAmount(verification.actual),
            variance: verification.variance,
            severity: "HIGH",
            action: "Check environment variables and Stripe dashboard",
          });

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Pricing configuration error. Please contact support.",
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("❌ Failed to verify price during checkout", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify pricing",
        });
      }

      // Get base URL and construct redirect URLs
      const baseUrl = getServerBaseUrl();
      const successUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/onboarding`;

      // Create the checkout session
      const session =
        input.plan === "lifetime"
          ? await createLifetimeCheckoutSession({
              userId: user.id,
              email: user.email,
              priceId,
              successUrl,
              cancelUrl,
            })
          : await createCheckoutSession({
              userId: user.id,
              email: user.email,
              priceId,
              successUrl,
              cancelUrl,
            });

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session URL",
        });
      }

      return {
        url: session.url,
      };
    }),

  // POST /api/stripe/portal
  createPortal: authedProcedure.mutation(async ({ ctx }) => {
    const { user, supabase } = ctx;

    // Rate limiting check
    const identifier = user.id;
    await checkRateLimit(identifier, portalRateLimit);

    // Get the Stripe customer ID from the database
    const { data: stripeCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!stripeCustomer?.stripe_customer_id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Stripe customer found",
      });
    }

    // Create a portal session
    const baseUrl = getServerBaseUrl();
    const session = await createPortalSession({
      customerId: stripeCustomer.stripe_customer_id,
      returnUrl: `${baseUrl}/profile/${user.id}?tab=billing`,
    });

    if (!session.url) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create portal session URL",
      });
    }

    return {
      url: session.url,
    };
  }),

  // GET /api/stripe/subscription
  getSubscription: authedProcedure.query(async ({ ctx }) => {
    const { user, supabase } = ctx;

    // Get the Stripe customer ID from the database
    const { data: stripeCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!stripeCustomer?.stripe_customer_id) {
      return {
        hasStripeCustomer: false,
        subscriptions: [],
      };
    }

    // Get subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.stripe_customer_id,
      limit: 10,
    });

    const subscriptionData = subscriptions.data.map((sub) => {
      const items = sub.items.data;
      const item = items[0];

      return {
        id: sub.id,
        status: sub.status,
        currentPeriodStart: item?.current_period_start
          ? new Date(item.current_period_start * 1000)
          : null,
        currentPeriodEnd: item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null,
        priceId: item?.price.id,
        plan: mapPriceToPlan(item?.price.id || ""),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        metadata: sub.metadata,
      };
    });

    return {
      hasStripeCustomer: true,
      stripeCustomerId: stripeCustomer.stripe_customer_id,
      subscriptions: subscriptionData,
    };
  }),

  // PUT /api/stripe/subscription
  updateSubscription: authedProcedure
    .input(
      z.object({
        newPlan: PlanSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, supabase } = ctx;

      // Get current plan before update
      const { data: currentProfile } = await supabase
        .from("profile")
        .select("plan_selected")
        .eq("id", user.id)
        .single();

      const currentPlan = currentProfile?.plan_selected || "free";

      // Update subscription via Stripe
      const result = await updateStripeSubscription({
        userId: user.id,
        newPlan: input.newPlan,
      });

      // Send email notification (non-blocking)
      const baseUrl = getServerBaseUrl();
      const billingUrl = `${baseUrl}/billing`;

      try {
        if (result.changeType === "upgrade" && user.email) {
          const proratedCharge =
            result.subscription?.latest_invoice &&
            typeof result.subscription.latest_invoice !== "string"
              ? (result.subscription.latest_invoice as Stripe.Invoice).amount_due || 0
              : 0;

          const currency =
            result.subscription?.items.data[0]?.price.currency || "usd";

          await sendSubscriptionUpgradedEmail({
            to: user.email,
            oldPlan: currentPlan,
            newPlan: input.newPlan,
            proratedCharge,
            currency,
            billingUrl,
          });
        } else if (result.changeType === "downgrade" && user.email) {
          const periodEnd = result.subscription?.items?.data[0]?.current_period_end;
          const effectiveDate = periodEnd
            ? new Date(periodEnd * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await sendSubscriptionDowngradedEmail({
            to: user.email,
            oldPlan: currentPlan,
            newPlan: input.newPlan,
            effectiveDate,
            billingUrl,
          });
        } else if (result.changeType === "cancel" && user.email) {
          const periodEnd = result.subscription?.items?.data[0]?.current_period_end;
          const endDate = periodEnd
            ? new Date(periodEnd * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await sendSubscriptionCancelledEmail({
            to: user.email,
            plan: currentPlan,
            endDate,
            billingUrl,
          });
        }
      } catch (emailError) {
        console.error("Failed to send subscription change email:", emailError);
      }

      // If changing to lifetime, return checkout URL
      if ("requiresCheckout" in result && result.requiresCheckout) {
        const priceId = PLAN_TO_PRICE_MAP.lifetime;

        if (!priceId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Price ID not configured for lifetime plan",
          });
        }

        if (!user.email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Email required for checkout",
          });
        }

        const session = await createLifetimeCheckoutSession({
          userId: user.id,
          email: user.email!,
          priceId,
          successUrl: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${baseUrl}/upgrade`,
        });

        if (!session.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create lifetime checkout session",
          });
        }

        return {
          success: true,
          changeType: "lifetime" as const,
          checkoutUrl: session.url,
        };
      }

      // Return success response for other changes
      const message =
        result.changeType === "cancel"
          ? "alreadyCancelled" in result
            ? "Your subscription has been cancelled. You're now on the free plan."
            : "Subscription will cancel at the end of your billing period"
          : result.changeType === "upgrade"
          ? "Plan upgraded! You'll be charged the prorated difference."
          : "Plan change scheduled for end of billing period";

      return {
        success: true,
        changeType: result.changeType,
        message,
      };
    }),

  // GET /api/stripe/promo-slots - Public endpoint to show remaining launch offer slots
  getPromoSlots: publicProcedure.query(async () => {
    const promoDetails = await getPromotionCodeDetails("EARLY100");

    if (!promoDetails) {
      return {
        available: false,
        remaining: 0,
        total: 0,
      };
    }

    return {
      available: promoDetails.remaining > 0,
      remaining: promoDetails.remaining,
      total: promoDetails.total,
    };
  }),

});
