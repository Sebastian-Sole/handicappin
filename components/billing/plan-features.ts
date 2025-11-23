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
    { text: "No round limits", included: true },
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
    description: "For serious golfers",
    price: "$19",
    interval: "year" as const,
  },
  unlimited: {
    title: "Unlimited",
    description: "For golf enthusiasts",
    price: "$29",
    interval: "year" as const,
  },
  lifetime: {
    title: "Lifetime",
    description: "Pay once, own forever",
    price: "$149",
    interval: "once" as const,
  },
} as const;
