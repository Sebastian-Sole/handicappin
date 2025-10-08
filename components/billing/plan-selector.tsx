"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
// Price map is now passed as a prop from server component
import { createFreeTierSubscription } from "@/app/onboarding/actions";

// PLANS array will be created inside the component to use priceMap prop

interface PlanSelectorProps {
  userId: string;
  priceMap: {
    premium: string;
    unlimited: string;
    "unlimited-lifetime": string;
  };
}

export function PlanSelector({ userId, priceMap }: PlanSelectorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const PLANS = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      features: [
        "25 rounds total",
        "Basic handicap calculation",
        "Score history",
        "Round logging",
      ],
      action: "free",
    },
    {
      name: "Premium",
      price: "$19",
      period: "per year",
      features: [
        "Unlimited rounds",
        "Basic handicap calculation",
        "Score history",
        "Round logging",
      ],
      priceId: priceMap.premium,
      mode: "subscription" as const,
      popular: false,
    },
    {
      name: "Unlimited",
      price: "$29",
      period: "per year",
      features: [
        "Unlimited rounds",
        "Advanced handicap insights",
        "Performance analytics",
        "Trend charts",
        "Advanced calculators",
        "Priority support",
      ],
      priceId: priceMap.unlimited,
      mode: "subscription" as const,
      popular: true,
    },
    {
      name: "Unlimited Lifetime",
      price: "$149",
      period: "one-time",
      features: [
        "Everything in Unlimited",
        "Pay once, use forever",
        "No recurring charges",
        "Early access to new features",
      ],
      priceId: priceMap["unlimited-lifetime"],
      mode: "payment" as const,
      popular: false,
    },
  ];

  async function handleFreeTier() {
    setLoading("free");
    try {
      await createFreeTierSubscription(userId);
      router.push("/dashboard");
    } catch (error) {
      console.error("Free tier creation error:", error);
      alert("Failed to create free tier subscription");
    } finally {
      setLoading(null);
    }
  }

  async function handlePaidPlan(
    priceId: string,
    mode: "subscription" | "payment"
  ) {
    setLoading(priceId);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, mode }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout");
      setLoading(null);
    }
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {PLANS.map((plan) => (
        <Card
          key={plan.name}
          className={`p-6 relative ${
            plan.popular ? "border-blue-500 border-2" : ""
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </span>
            </div>
          )}

          <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
          <div className="mb-4">
            <span className="text-3xl font-bold">{plan.price}</span>
            <span className="text-gray-600"> {plan.period}</span>
          </div>

          <ul className="space-y-2 mb-6">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            onClick={() => {
              if (plan.action === "free") {
                handleFreeTier();
              } else if (plan.priceId && plan.mode) {
                handlePaidPlan(plan.priceId, plan.mode);
              }
            }}
            disabled={loading !== null}
            className="w-full"
            variant={plan.popular ? "default" : "outline"}
          >
            {loading === (plan.action === "free" ? "free" : plan.priceId)
              ? "Loading..."
              : plan.action === "free"
              ? "Start Free"
              : "Subscribe"}
          </Button>

          {plan.priceId && (
            <p className="text-xs text-center text-gray-500 mt-2">
              Have a promo code? Apply at checkout
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
