/**
 * Centralized plan features configuration
 * Ensures consistency across all pricing displays
 */

export interface Feature {
  text: string;
  included: boolean;
}

export const PLAN_FEATURES: Record<string, Feature[]> = {
  free: [
    { text: "Round logging", included: true },
    { text: "Basic handicap calculation", included: true },
    { text: "Score history", included: true },
    { text: "Up to 25 rounds", included: true },
    { text: "Round calculation insights", included: false },
    { text: "Advanced calculators", included: false },
    { text: "Personal statistics", included: false },
  ],
  premium: [
    { text: "Everything from Free tier", included: true },
    { text: "Unlimited round logging", included: true },
    { text: "Round calculation insights", included: false },
    { text: "Advanced calculators", included: false },
    { text: "Personal statistics", included: false },
  ],
  unlimited: [
    { text: "Unlimited round logging", included: true },
    { text: "Round calculation insights", included: true },
    { text: "Advanced calculators", included: true },
    { text: "Personal statistics", included: true },
    { text: "Early access to new features", included: true },
  ],
  lifetime: [
    { text: "Same features as Unlimited tier", included: true },
    { text: "One-time payment", included: true },
    { text: "Lifetime access", included: true },
    { text: "All future features", included: true },
  ],
};

export const PLAN_DETAILS = {
  free: {
    title: "Free",
    description: "Perfect for casual golfers",
    price: "$0",
    interval: "forever" as const,
  },
  premium: {
    title: "Premium",
    description: "For golf enthusiasts",
    price: "$19",
    interval: "year" as const,
    costComparison: "Less than half a golf ball/month",
  },
  unlimited: {
    title: "Unlimited",
    description: "For extended use",
    price: "$29",
    interval: "year" as const,
    costComparison: "Less than 1 golf ball/month",
  },
  lifetime: {
    title: "Lifetime",
    description: "Unlimited access, forever",
    price: "$149",
    interval: "once" as const,
    costComparison: "~30 premium golf balls",
  },
  lifetime_early_100: {
    title: "Lifetime",
    description: "First 100 users free, forever",
    price: "$149",
    interval: "once" as const,
    costComparison: "~30 premium golf balls",
  },
} as const;
