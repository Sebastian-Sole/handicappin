import type { Meta, StoryObj } from "@storybook/nextjs";
import type { FeatureAccess } from "@/types/billing";

import { withTrpc } from "../../../.storybook/decorators";
import { BillingTab } from "./billing-tab";

const freeAccess: FeatureAccess = {
  plan: "free",
  hasAccess: true,
  hasPremiumAccess: false,
  hasUnlimitedRounds: false,
  remainingRounds: 14,
  status: "free",
  currentPeriodEnd: null,
  isLifetime: false,
  cancelAtPeriodEnd: false,
};

const premiumAccess: FeatureAccess = {
  plan: "premium",
  hasAccess: true,
  hasPremiumAccess: true,
  hasUnlimitedRounds: true,
  remainingRounds: 25,
  status: "active",
  currentPeriodEnd: new Date("2025-12-31T00:00:00.000Z"),
  isLifetime: false,
  cancelAtPeriodEnd: false,
};

const cancellingAccess: FeatureAccess = {
  ...premiumAccess,
  cancelAtPeriodEnd: true,
};

const lifetimeAccess: FeatureAccess = {
  plan: "lifetime",
  hasAccess: true,
  hasPremiumAccess: true,
  hasUnlimitedRounds: true,
  remainingRounds: 25,
  status: "active",
  currentPeriodEnd: null,
  isLifetime: true,
  cancelAtPeriodEnd: false,
};

const meta = {
  title: "Profile/BillingTab",
  component: BillingTab,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof BillingTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Free: Story = {
  args: { access: freeAccess },
};

export const Premium: Story = {
  args: { access: premiumAccess },
};

export const PremiumCancelling: Story = {
  args: { access: cancellingAccess },
};

export const Lifetime: Story = {
  args: { access: lifetimeAccess },
};
