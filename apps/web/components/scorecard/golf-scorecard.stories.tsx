import type { Meta, StoryObj } from "@storybook/nextjs";
import { allProviders } from "../../.storybook/decorators";
import GolfScorecard from "./golf-scorecard";
import type { Tables } from "@/types/supabase";
import type { FeatureAccess } from "@/types/billing";

const profile: Tables<"profile"> = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "storybook@handicappin.local",
  name: "Storybook User",
  handicapIndex: 12.4,
  initialHandicapIndex: 16,
  verified: true,
  billing_version: 1,
  cancel_at_period_end: false,
  createdAt: new Date("2024-01-01").toISOString(),
  current_period_end: null,
  plan_selected: null,
  plan_selected_at: null,
  subscription_status: null,
};

const premiumAccess: FeatureAccess = {
  plan: "premium",
  hasAccess: true,
  hasPremiumAccess: true,
  hasUnlimitedRounds: true,
  remainingRounds: 999,
  status: "active",
  currentPeriodEnd: null,
  isLifetime: true,
  cancelAtPeriodEnd: false,
};

const meta = {
  title: "Scorecard/GolfScorecard",
  component: GolfScorecard,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: allProviders(),
} satisfies Meta<typeof GolfScorecard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Minimal "Initial" snapshot only. The full form orchestrates tRPC queries,
// a tee-management hook, and multiple dialogs — those flows aren't viable in
// an isolated story without a backend. This captures the empty-state shell.
export const InitialState: Story = {
  args: {
    profile,
    access: premiumAccess,
  },
};
