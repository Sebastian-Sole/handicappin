import type { Meta, StoryObj } from "@storybook/nextjs";

import { PLAN_DETAILS, PLAN_FEATURES } from "./plan-features";
import { PricingCard, PricingCardSkeleton } from "./pricing-card";

const meta = {
  title: "Billing/PricingCard",
  component: PricingCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PricingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Free: Story = {
  args: {
    plan: "free",
    price: PLAN_DETAILS.free.price,
    interval: PLAN_DETAILS.free.interval,
    title: PLAN_DETAILS.free.title,
    description: PLAN_DETAILS.free.description,
    features: PLAN_FEATURES.free,
    buttonText: "Start Free",
    buttonVariant: "outline",
  },
};

export const Premium: Story = {
  args: {
    plan: "premium",
    price: PLAN_DETAILS.premium.price,
    interval: PLAN_DETAILS.premium.interval,
    title: PLAN_DETAILS.premium.title,
    description: PLAN_DETAILS.premium.description,
    features: PLAN_FEATURES.premium,
    buttonText: "Subscribe",
    costComparison: PLAN_DETAILS.premium.costComparison,
  },
};

export const UnlimitedBestValue: Story = {
  args: {
    plan: "unlimited",
    price: PLAN_DETAILS.unlimited.price,
    interval: PLAN_DETAILS.unlimited.interval,
    title: PLAN_DETAILS.unlimited.title,
    description: PLAN_DETAILS.unlimited.description,
    features: PLAN_FEATURES.unlimited,
    badge: { text: "Best Value", variant: "value" },
    buttonText: "Subscribe",
    costComparison: PLAN_DETAILS.unlimited.costComparison,
    highlighted: true,
  },
};

export const LifetimeLaunchOffer: Story = {
  args: {
    plan: "lifetime",
    price: "FREE",
    originalPrice: PLAN_DETAILS.lifetime_early_100.price,
    interval: PLAN_DETAILS.lifetime_early_100.interval,
    title: PLAN_DETAILS.lifetime_early_100.title,
    description: PLAN_DETAILS.lifetime_early_100.description,
    features: PLAN_FEATURES.lifetime,
    badge: { text: "Launch Offer!", variant: "default" },
    buttonText: "Claim Free Lifetime",
    slotsRemaining: 12,
    highlighted: true,
  },
};

export const CurrentPlan: Story = {
  args: {
    plan: "premium",
    price: PLAN_DETAILS.premium.price,
    interval: PLAN_DETAILS.premium.interval,
    title: PLAN_DETAILS.premium.title,
    description: PLAN_DETAILS.premium.description,
    features: PLAN_FEATURES.premium,
    badge: { text: "Current Plan", variant: "default" },
    buttonText: "Current Plan",
    buttonDisabled: true,
    currentPlan: true,
  },
};

export const Skeleton: Story = {
  args: {
    plan: "free",
    price: "$0",
    title: "",
    description: "",
    features: [],
    buttonText: "",
  },
  render: () => <PricingCardSkeleton />,
};
