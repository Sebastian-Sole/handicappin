"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Clock, X } from "lucide-react";
import { createFreeTierSubscription } from "@/app/onboarding/actions";
import { createCheckout, updateSubscription } from "@/lib/stripe-api-client";
import type { PlanType } from "@/lib/stripe-types";
import { PricingCard } from "./pricing-card";
import { PLAN_FEATURES, PLAN_DETAILS } from "./plan-features";

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
  // Onboarding: show all plans
  if (mode === "onboarding" || !currentPlan) {
    return ["free", "premium", "unlimited", "lifetime"];
  }

  // Upgrade mode: filter based on current plan
  switch (currentPlan) {
    case "free":
      return ["premium", "unlimited", "lifetime"]; // Only upgrades
    case "premium":
      return ["unlimited", "lifetime", "free"]; // Upgrades + downgrade
    case "unlimited":
      return ["lifetime", "premium", "free"]; // Upgrade + downgrades
    case "lifetime":
      return []; // No changes available - lifetime is permanent
    default:
      return ["free", "premium", "unlimited", "lifetime"];
  }
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

      // If in upgrade mode and user has a paid plan, use subscription update API
      if (mode === "upgrade" && currentPlan && currentPlan !== "free") {
        // ✅ NEW: Use type-safe client
        const result = await updateSubscription({ newPlan: "free" });

        if (!result.success) {
          throw new Error(result.error.error);
        }

        // Show success message
        setFeedbackMessage({
          type: "success",
          title: "Plan Updated",
          message:
            result.data.message || "Your plan has been updated successfully.",
        });

        // Delay navigation to allow user to see success message
        setTimeout(() => {
          router.push("/billing");
          router.refresh();
        }, 2000); // 2 second delay (message stays for 5 total)

        return;
      }

      // Otherwise, for onboarding or already-free users, use direct action
      await createFreeTierSubscription(userId);

      // Manually refresh JWT to get new billing claims (billing_version incremented)
      // This is necessary because the redirect happens before BillingSync receives Realtime notification
      const { createClientComponentClient } = await import("@/utils/supabase/client");
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
        const { data: { session } } = await supabase.auth.getSession();
        const jwtClaims = session?.user?.app_metadata;

        // Check if JWT has updated billing claims (plan === "free")
        if (jwtClaims?.plan === "free") {
          console.log("✅ JWT claims updated, proceeding with redirect");
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempt++;
      }

      if (attempt === maxAttempts) {
        console.warn("⚠️ JWT claims not updated after polling, BillingSync will catch up");
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error selecting free plan:", error);
      setFeedbackMessage({
        type: "error",
        title: "Failed to Update Plan",
        message:
          "We couldn't switch you to the free plan. Please try again or contact support if the issue persists.",
      });
    } finally {
      setLoading(null);
    }
  };

  const handlePaidPlan = async (plan: "premium" | "unlimited" | "lifetime") => {
    try {
      setLoading(plan);
      setFeedbackMessage(null); // Clear any previous feedback

      // If in upgrade mode and user has a paid plan, use subscription update API
      if (mode === "upgrade" && currentPlan && currentPlan !== "free") {
        // ✅ NEW: Use type-safe client
        const result = await updateSubscription({ newPlan: plan });

        if (!result.success) {
          // ✅ NEW: Type-safe error handling with retryAfter
          if (result.error.retryAfter) {
            setFeedbackMessage({
              type: "error",
              title: "Too Many Requests",
              message: `Please wait ${result.error.retryAfter} seconds before trying again to avoid rate limiting.`,
            });
          } else {
            throw new Error(result.error.error);
          }
          setLoading(null);
          return;
        }

        // If lifetime, redirect to checkout
        if (result.data.checkoutUrl) {
          window.location.href = result.data.checkoutUrl;
          return;
        }

        // Show success message
        setFeedbackMessage({
          type: "success",
          title: "Plan Updated",
          message:
            result.data.message || "Your plan has been updated successfully.",
        });

        // Delay navigation to allow user to see success message
        setTimeout(() => {
          router.push("/billing");
          router.refresh();
        }, 2000);

        return;
      }

      // Otherwise, create new checkout (existing logic for onboarding or free users upgrading)
      // ✅ NEW: Use type-safe client
      const result = await createCheckout({ plan });

      if (!result.success) {
        // ✅ NEW: Type-safe error handling with retryAfter
        if (result.error.retryAfter) {
          setFeedbackMessage({
            type: "error",
            title: "Too Many Requests",
            message: `Please wait ${result.error.retryAfter} seconds before trying again to avoid rate limiting.`,
          });
        } else {
          throw new Error(result.error.error);
        }
        setLoading(null);
        return;
      }

      // ✅ NEW: TypeScript knows result.data.url exists
      window.location.href = result.data.url;
    } catch (error) {
      console.error("Error with plan change:", error);
      setFeedbackMessage({
        type: "error",
        title: "Failed to Process Plan Change",
        message:
          "We couldn't complete your plan change. Please try again or contact support if the issue persists.",
      });
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
              <>Change your plan below</>
            )}
          </p>
          {availablePlans.length > 0 && (
            <div className="mt-4 space-y-2 text-sm text-gray-500">
              <p>✓ Upgrades take effect immediately (prorated charge)</p>
              <p>✓ Downgrades take effect at the end of your billing cycle</p>
            </div>
          )}
        </div>
      )}

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
            badge={{
              text: currentPlan === "premium" ? "Current Plan" : "Most Popular",
              variant: "primary",
            }}
            buttonText={
              currentPlan === "premium"
                ? "Current Plan"
                : loading === "premium"
                ? "Loading..."
                : "Subscribe"
            }
            onButtonClick={() => handlePaidPlan("premium")}
            buttonDisabled={loading !== null || currentPlan === "premium"}
            highlighted
            currentPlan={currentPlan === "premium"}
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
                : undefined
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
          />
        )}

        {/* Lifetime Plan */}
        {shouldShowPlan("lifetime") && (
          <PricingCard
            plan="lifetime"
            price={PLAN_DETAILS.lifetime.price}
            interval={PLAN_DETAILS.lifetime.interval}
            title={PLAN_DETAILS.lifetime.title}
            description={PLAN_DETAILS.lifetime.description}
            features={PLAN_FEATURES.lifetime}
            badge={{
              text: currentPlan === "lifetime" ? "Current Plan" : "Best Value",
              variant: "success",
            }}
            buttonText={
              currentPlan === "lifetime"
                ? "Current Plan"
                : loading === "lifetime"
                ? "Loading..."
                : "Buy Lifetime"
            }
            onButtonClick={() => handlePaidPlan("lifetime")}
            buttonDisabled={loading !== null || currentPlan === "lifetime"}
            highlighted
            currentPlan={currentPlan === "lifetime"}
          />
        )}
      </div>
    </>
  );
}
