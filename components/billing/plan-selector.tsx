"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Clock, X } from "lucide-react";
import { createFreeTierSubscription } from "@/app/onboarding/actions";
import { api } from "@/trpc/react";
import type { PlanType } from "@/lib/stripe-types";
import { PricingCard, PricingCardSkeleton } from "./pricing-card";
import { PLAN_FEATURES, PLAN_DETAILS } from "./plan-features";

// Helper to check if user has an active paid subscription
const isPaidPlan = (plan: string | null | undefined): boolean => {
  return plan === "premium" || plan === "unlimited" || plan === "lifetime";
};

interface PlanSelectorProps {
  userId: string;
  currentPlan?: "free" | "premium" | "unlimited" | "lifetime" | null;
  mode?: "onboarding" | "upgrade";
  onPlanChange?: (plan: string) => void;
}

// Helper function to filter available plans based on current plan and mode
const getAvailablePlans = (
  currentPlan: string | null | undefined,
  mode: "onboarding" | "upgrade"
) => {
  const validPlans = ["free", "premium", "unlimited", "lifetime"];
  // Onboarding: show all plans
  if (mode === "onboarding" || !currentPlan) {
    return validPlans;
  }
  return validPlans.filter((plan) => plan != currentPlan);
};

export function PlanSelector({
  userId,
  currentPlan = null,
  mode = "onboarding",
  onPlanChange,
}: PlanSelectorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  // tRPC mutations
  const updateSubscriptionMutation =
    api.stripe.updateSubscription.useMutation();
  const createCheckoutMutation = api.stripe.createCheckout.useMutation();
  const createPortalMutation = api.stripe.createPortal.useMutation();

  // Fetch promo slots for lifetime plan
  const { data: promoSlots, isLoading: isLoadingPromoSlots } =
    api.stripe.getPromoSlots.useQuery();
  const isActiveLifetimePromo = !!promoSlots?.remaining;

  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (feedbackMessage?.type === "success") {
      const timer = setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  const availablePlans = getAvailablePlans(currentPlan, mode);
  const shouldShowPlan = (plan: string) => availablePlans.includes(plan);

  const handleFreePlan = async () => {
    try {
      setLoading("free");
      setFeedbackMessage(null); // Clear any previous feedback

      // If in upgrade mode and user has a paid plan, redirect to Stripe Portal
      // Portal handles cancellations properly with correct billing cycle behavior
      if (mode === "upgrade" && isPaidPlan(currentPlan)) {
        const result = await createPortalMutation.mutateAsync();
        window.location.href = result.url;
        return;
      }

      // Otherwise, for onboarding or already-free users, use direct action
      await createFreeTierSubscription(userId);

      // Manually refresh JWT to get new billing claims (billing_version incremented)
      // This is necessary because the redirect happens before BillingSync receives Realtime notification
      const { createClientComponentClient } = await import(
        "@/utils/supabase/client"
      );
      const supabase = createClientComponentClient();

      console.log("🔄 Refreshing session after free plan selection...");
      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error("❌ Failed to refresh session:", refreshError);
        // Continue anyway - BillingSync will catch it eventually
      } else {
        console.log("✅ Session refreshed with new billing data");
      }

      // Poll session until billing claims reflect the new plan
      const maxAttempts = 20; // 2 seconds max (20 * 100ms)
      let attempt = 0;
      while (attempt < maxAttempts) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const jwtClaims = session?.user?.app_metadata;

        // Check if JWT has updated billing claims (plan === "free")
        if (jwtClaims?.plan === "free") {
          console.log("✅ JWT claims updated, proceeding with redirect");
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        attempt++;
      }

      if (attempt === maxAttempts) {
        console.warn(
          "⚠️ JWT claims not updated after polling, BillingSync will catch up"
        );
      }

      router.push("/");
      router.refresh();
    } catch (error: any) {
      console.error("Error selecting free plan:", error);

      // Check if it's a rate limit error
      if (
        error?.data?.code === "TOO_MANY_REQUESTS" &&
        error?.data?.cause?.retryAfter
      ) {
        setFeedbackMessage({
          type: "error",
          title: "Too Many Requests",
          message: `Please wait ${error.data.cause.retryAfter} seconds before trying again. This helps us keep the service running smoothly for everyone.`,
        });
      } else {
        setFeedbackMessage({
          type: "error",
          title: "Failed to Update Plan",
          message:
            error?.message ||
            "We couldn't switch you to the free plan. Please try again or contact support if the issue persists.",
        });
      }
    } finally {
      setLoading(null);
    }
  };

  const handlePaidPlan = async (plan: "premium" | "unlimited" | "lifetime") => {
    try {
      setLoading(plan);
      setFeedbackMessage(null); // Clear any previous feedback

      // If in upgrade mode and user has a paid plan, redirect to Stripe Portal
      // Portal handles plan changes with proper proration and billing
      if (mode === "upgrade" && isPaidPlan(currentPlan)) {
        const result = await createPortalMutation.mutateAsync();
        window.location.href = result.url;
        return;
      }

      // Otherwise, create new checkout (existing logic for onboarding or free users upgrading)
      const result = await createCheckoutMutation.mutateAsync({ plan });

      window.location.href = result.url;
    } catch (error: any) {
      console.error("Error with plan change:", error);

      // Check if it's a rate limit error
      if (
        error?.data?.code === "TOO_MANY_REQUESTS" &&
        error?.data?.cause?.retryAfter
      ) {
        setFeedbackMessage({
          type: "error",
          title: "Too Many Requests",
          message: `Please wait ${error.data.cause.retryAfter} seconds before trying again. This helps us keep the service running smoothly for everyone.`,
        });
      } else {
        setFeedbackMessage({
          type: "error",
          title: "Failed to Process Plan Change",
          message:
            error?.message ||
            "We couldn't complete your plan change. Please try again or contact support if the issue persists.",
        });
      }
      setLoading(null);
    }
  };

  return (
    <>
      {/* Inline Feedback Alert */}
      {feedbackMessage && (
        <div className="mb-6 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <Alert
            variant={
              feedbackMessage.type === "error" ? "destructive" : "default"
            }
            className={
              feedbackMessage.type === "success"
                ? "border-green-500/50 bg-green-50 dark:bg-green-950/20 relative pr-12"
                : "relative pr-12"
            }
          >
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
            ) : feedbackMessage.title === "Too Many Requests" ? (
              <Clock className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>{feedbackMessage.title}</AlertTitle>
            <AlertDescription>{feedbackMessage.message}</AlertDescription>

            {/* Close button for error messages */}
            {feedbackMessage.type === "error" && (
              <button
                onClick={() => setFeedbackMessage(null)}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Dismiss error message"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </Alert>
        </div>
      )}

      {/* Context-specific messaging for upgrade mode */}
      {mode === "upgrade" && currentPlan && (
        <div className="mb-8 text-center">
          <p className="text-gray-600 text-lg">
            {availablePlans.length === 0 ? (
              <>You&apos;re on the best plan! No changes available.</>
            ) : (
              <>Select a plan to change your subscription</>
            )}
          </p>
          {availablePlans.length > 0 && isPaidPlan(currentPlan) && (
            <div className="mt-4 space-y-2 text-sm text-gray-500">
              <p>You&apos;ll be redirected to Stripe to complete your plan change</p>
              <p>✓ Upgrades take effect immediately (prorated charge)</p>
              <p>✓ Downgrades take effect at the end of your billing cycle</p>
            </div>
          )}
        </div>
      )}

      {/* Show skeletons while loading promo slots */}
      {isLoadingPromoSlots ? (
        <div className="grid gap-6 xl:grid-cols-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <PricingCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div
        className={`grid gap-6 ${
          availablePlans.length === 4
            ? "xl:grid-cols-4 md:grid-cols-2"
            : availablePlans.length === 3
            ? "lg:grid-cols-3"
            : availablePlans.length === 2
            ? "md:grid-cols-2"
            : "md:grid-cols-1"
        }`}
      >
        {/* Free Plan */}
        {shouldShowPlan("free") && (
          <PricingCard
            plan="free"
            price={PLAN_DETAILS.free.price}
            interval={PLAN_DETAILS.free.interval}
            title={PLAN_DETAILS.free.title}
            description={PLAN_DETAILS.free.description}
            features={PLAN_FEATURES.free}
            badge={
              currentPlan === "free"
                ? { text: "Current Plan", variant: "default" }
                : undefined
            }
            buttonText={
              currentPlan === "free"
                ? "Current Plan"
                : loading === "free"
                ? "Setting up..."
                : "Start Free"
            }
            onButtonClick={handleFreePlan}
            buttonDisabled={loading !== null || currentPlan === "free"}
            buttonVariant="outline"
            currentPlan={currentPlan === "free"}
          />
        )}

        {/* Premium Plan */}
        {shouldShowPlan("premium") && (
          <PricingCard
            plan="premium"
            price={PLAN_DETAILS.premium.price}
            interval={PLAN_DETAILS.premium.interval}
            title={PLAN_DETAILS.premium.title}
            description={PLAN_DETAILS.premium.description}
            features={PLAN_FEATURES.premium}
            badge={
              currentPlan === "premium"
                ? {
                    text: "Current Plan",
                    variant: "default",
                  }
                : undefined
            }
            buttonText={
              currentPlan === "premium"
                ? "Current Plan"
                : loading === "premium"
                ? "Loading..."
                : "Subscribe"
            }
            onButtonClick={() => handlePaidPlan("premium")}
            buttonDisabled={loading !== null || currentPlan === "premium"}
            currentPlan={currentPlan === "premium"}
            costComparison={PLAN_DETAILS.premium.costComparison}
          />
        )}

        {/* Unlimited Plan */}
        {shouldShowPlan("unlimited") && (
          <PricingCard
            plan="unlimited"
            price={PLAN_DETAILS.unlimited.price}
            interval={PLAN_DETAILS.unlimited.interval}
            title={PLAN_DETAILS.unlimited.title}
            description={PLAN_DETAILS.unlimited.description}
            features={PLAN_FEATURES.unlimited}
            badge={
              currentPlan === "unlimited"
                ? { text: "Current Plan", variant: "default" }
                : { text: "Best Value", variant: "value" }
            }
            buttonText={
              currentPlan === "unlimited"
                ? "Current Plan"
                : loading === "unlimited"
                ? "Loading..."
                : "Subscribe"
            }
            onButtonClick={() => handlePaidPlan("unlimited")}
            buttonDisabled={loading !== null || currentPlan === "unlimited"}
            currentPlan={currentPlan === "unlimited"}
            costComparison={PLAN_DETAILS.unlimited.costComparison}
            highlighted={false || !isActiveLifetimePromo}
          />
        )}

        {/* Lifetime Plan */}
        {shouldShowPlan("lifetime") && isActiveLifetimePromo && (
          <PricingCard
            plan="lifetime"
            price="FREE"
            originalPrice={PLAN_DETAILS.lifetime_early_100.price}
            interval={PLAN_DETAILS.lifetime_early_100.interval}
            title={PLAN_DETAILS.lifetime_early_100.title}
            description={PLAN_DETAILS.lifetime_early_100.description}
            features={PLAN_FEATURES.lifetime}
            badge={{
              text:
                currentPlan === "lifetime" ? "Current Plan" : "Launch Offer!",
              variant: "default",
            }}
            buttonText={
              currentPlan === "lifetime"
                ? "Current Plan"
                : loading === "lifetime"
                ? "Loading..."
                : "Claim Free Lifetime"
            }
            onButtonClick={() => handlePaidPlan("lifetime")}
            buttonDisabled={loading !== null || currentPlan === "lifetime"}
            currentPlan={currentPlan === "lifetime"}
            costComparison={PLAN_DETAILS.lifetime_early_100.costComparison}
            slotsRemaining={promoSlots?.remaining}
            highlighted
          />
        )}

        {shouldShowPlan("lifetime") && !isActiveLifetimePromo && (
          <PricingCard
            plan="lifetime"
            price={PLAN_DETAILS.lifetime.price}
            interval={PLAN_DETAILS.lifetime.interval}
            title={PLAN_DETAILS.lifetime.title}
            description={PLAN_DETAILS.lifetime.description}
            features={PLAN_FEATURES.lifetime}
            badge={
              currentPlan === "lifetime"
                ? { text: "Current Plan", variant: "default" }
                : undefined
            }
            buttonText={
              currentPlan === "lifetime"
                ? "Current Plan"
                : loading === "lifetime"
                ? "Loading..."
                : "Subscribe"
            }
            onButtonClick={() => handlePaidPlan("lifetime")}
            buttonDisabled={loading !== null || currentPlan === "lifetime"}
            currentPlan={currentPlan === "lifetime"}
            costComparison={PLAN_DETAILS.lifetime.costComparison}
          />
        )}
        </div>
      )}
    </>
  );
}
