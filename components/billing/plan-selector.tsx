"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createFreeTierSubscription } from "@/app/onboarding/actions";

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

  const availablePlans = getAvailablePlans(currentPlan, mode);
  const shouldShowPlan = (plan: string) => availablePlans.includes(plan);

  const handleFreePlan = async () => {
    try {
      setLoading("free");

      // If in upgrade mode and user has a paid plan, use subscription update API
      if (mode === "upgrade" && currentPlan && currentPlan !== "free") {
        const response = await fetch("/api/stripe/subscription", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPlan: "free" }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to update subscription");
        }

        // Show success message
        alert(result.message);
        router.push("/billing");
        router.refresh();
        return;
      }

      // Otherwise, for onboarding or already-free users, use direct action
      await createFreeTierSubscription(userId);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error selecting free plan:", error);
      alert("Failed to select free plan. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handlePaidPlan = async (
    plan: "premium" | "unlimited" | "lifetime"
  ) => {
    try {
      setLoading(plan);

      // If in upgrade mode and user has a paid plan, use subscription update API
      if (mode === "upgrade" && currentPlan && currentPlan !== "free") {
        const response = await fetch("/api/stripe/subscription", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPlan: plan }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to update subscription");
        }

        // If lifetime, redirect to checkout
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }

        // Show success message
        alert(result.message);
        router.push("/billing");
        router.refresh();
        return;
      }

      // Otherwise, create new checkout (existing logic for onboarding or free users upgrading)
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId }),
      });

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error with plan change:", error);
      alert("Failed to process plan change. Please try again.");
      setLoading(null);
    }
  };

  return (
    <>
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
            ? "md:grid-cols-4"
            : availablePlans.length === 3
            ? "md:grid-cols-3"
            : availablePlans.length === 2
            ? "md:grid-cols-2"
            : "md:grid-cols-1"
        }`}
      >
        {/* Free Plan */}
        {shouldShowPlan("free") && (
          <div className="border rounded-lg p-8 shadow-md hover:shadow-lg transition relative">
            {/* Current plan badge */}
            {currentPlan === "free" && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gray-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Current Plan
                </span>
              </div>
            )}
            <h2 className="text-2xl font-bold mb-2">Free</h2>
            <div className="text-3xl font-bold mb-4">$0</div>
            <p className="text-gray-600 mb-6">Perfect for casual golfers</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Up to 25 rounds</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Handicap tracking</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Round history</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✗</span>
                <span className="text-gray-400">Dashboard analytics</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✗</span>
                <span className="text-gray-400">Advanced calculators</span>
              </li>
            </ul>
            <Button
              onClick={handleFreePlan}
              disabled={loading !== null || currentPlan === "free"}
              className="w-full"
              variant="outline"
            >
              {currentPlan === "free"
                ? "Current Plan"
                : loading === "free"
                ? "Setting up..."
                : "Start Free"}
            </Button>
          </div>
        )}

        {/* Premium Plan */}
        {shouldShowPlan("premium") && (
          <div className="border-2 border-blue-500 rounded-lg p-8 shadow-lg hover:shadow-xl transition relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                {currentPlan === "premium" ? "Current Plan" : "Most Popular"}
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Premium</h2>
            <div className="text-3xl font-bold mb-4">
              $9.99<span className="text-lg text-gray-600">/mo</span>
            </div>
            <p className="text-gray-600 mb-6">For serious golfers</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Unlimited rounds</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Handicap tracking</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Round history</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Dashboard analytics</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Advanced calculators</span>
              </li>
            </ul>
            <Button
              onClick={() => handlePaidPlan("premium")}
              disabled={loading !== null || currentPlan === "premium"}
              className="w-full"
            >
              {currentPlan === "premium"
                ? "Current Plan"
                : loading === "premium"
                ? "Loading..."
                : "Subscribe"}
            </Button>
          </div>
        )}

        {/* Unlimited Plan */}
        {shouldShowPlan("unlimited") && (
          <div className="border rounded-lg p-8 shadow-md hover:shadow-lg transition relative">
            {/* Current plan badge */}
            {currentPlan === "unlimited" && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gray-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Current Plan
                </span>
              </div>
            )}
            <h2 className="text-2xl font-bold mb-2">Unlimited</h2>
            <div className="text-3xl font-bold mb-4">
              $14.99<span className="text-lg text-gray-600">/mo</span>
            </div>
            <p className="text-gray-600 mb-6">For golf enthusiasts</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Everything in Premium</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Priority support</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Early access to features</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Custom course management</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Advanced reporting</span>
              </li>
            </ul>
            <Button
              onClick={() => handlePaidPlan("unlimited")}
              disabled={loading !== null || currentPlan === "unlimited"}
              className="w-full"
            >
              {currentPlan === "unlimited"
                ? "Current Plan"
                : loading === "unlimited"
                ? "Loading..."
                : "Subscribe"}
            </Button>
          </div>
        )}

        {/* Lifetime Plan */}
        {shouldShowPlan("lifetime") && (
          <div className="border-2 border-green-500 rounded-lg p-8 shadow-lg hover:shadow-xl transition relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                {currentPlan === "lifetime" ? "Current Plan" : "Best Value"}
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Lifetime</h2>
            <div className="text-3xl font-bold mb-4">
              $199<span className="text-lg text-gray-600"> once</span>
            </div>
            <p className="text-gray-600 mb-6">Pay once, own forever</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Everything in Unlimited</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>One-time payment</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Lifetime updates</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>All future features</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Premium support forever</span>
              </li>
            </ul>
            <Button
              onClick={() => handlePaidPlan("lifetime")}
              disabled={loading !== null || currentPlan === "lifetime"}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {currentPlan === "lifetime"
                ? "Current Plan"
                : loading === "lifetime"
                ? "Loading..."
                : "Buy Lifetime"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
