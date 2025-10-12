"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createFreeTierSubscription } from "@/app/onboarding/actions";

interface PlanSelectorProps {
  userId: string;
}

export function PlanSelector({ userId }: PlanSelectorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleFreePlan = async () => {
    try {
      setLoading("free");
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
      // Redirect to checkout API route
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
      console.error("Error creating checkout session:", error);
      alert("Failed to start checkout. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="grid md:grid-cols-4 gap-6">
      {/* Free Plan */}
      <div className="border rounded-lg p-8 shadow-md hover:shadow-lg transition">
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
          disabled={loading !== null}
          className="w-full"
          variant="outline"
        >
          {loading === "free" ? "Setting up..." : "Start Free"}
        </Button>
      </div>

      {/* Premium Plan */}
      <div className="border-2 border-blue-500 rounded-lg p-8 shadow-lg hover:shadow-xl transition relative">
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
            Most Popular
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
          disabled={loading !== null}
          className="w-full"
        >
          {loading === "premium" ? "Loading..." : "Subscribe"}
        </Button>
      </div>

      {/* Unlimited Plan */}
      <div className="border rounded-lg p-8 shadow-md hover:shadow-lg transition">
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
          disabled={loading !== null}
          className="w-full"
        >
          {loading === "unlimited" ? "Loading..." : "Subscribe"}
        </Button>
      </div>

      {/* Lifetime Plan */}
      <div className="border-2 border-green-500 rounded-lg p-8 shadow-lg hover:shadow-xl transition relative">
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
            Best Value
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
          disabled={loading !== null}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {loading === "lifetime" ? "Loading..." : "Buy Lifetime"}
        </Button>
      </div>
    </div>
  );
}
