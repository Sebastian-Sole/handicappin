import type { Meta, StoryObj } from "@storybook/nextjs";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/types/supabase";
import type { FeatureAccess } from "@/types/billing";

import { allProviders } from "../../.storybook/decorators";
import { TabbedProfilePage } from "./tabbed-profile-page";

// Fixture-only factory: Supabase's `User` type has 20+ required fields;
// a single trailing cast on the sensible-default shape is acceptable here.
function makeFakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "storybook@handicappin.local",
    app_metadata: {},
    user_metadata: { full_name: "Storybook User" },
    created_at: "2024-01-01T00:00:00.000Z",
    email_confirmed_at: "2024-01-01T00:00:00.000Z",
    phone: "",
    updated_at: "2024-01-01T00:00:00.000Z",
    identities: [],
    ...overrides,
  } as User;
}

const authUser = makeFakeUser();

const profile: Tables<"profile"> = {
  id: authUser.id,
  email: authUser.email ?? "storybook@handicappin.local",
  name: "Storybook User",
  handicapIndex: 12.4,
  initialHandicapIndex: 18,
  verified: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  plan_selected: "premium",
  plan_selected_at: "2024-02-01T00:00:00.000Z",
  subscription_status: "active",
  current_period_end: 1735689600,
  cancel_at_period_end: false,
  billing_version: 1,
  billing_provider: "stripe",
};

const access: FeatureAccess = {
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

const meta = {
  title: "Profile/TabbedProfilePage",
  component: TabbedProfilePage,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  decorators: allProviders(),
} satisfies Meta<typeof TabbedProfilePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    authUser,
    profile,
    access,
  },
};

export const FreePlan: Story = {
  args: {
    authUser,
    profile: { ...profile, plan_selected: "free", subscription_status: "free" },
    access: {
      ...access,
      plan: "free",
      hasPremiumAccess: false,
      hasUnlimitedRounds: false,
      remainingRounds: 12,
      status: "free",
    },
  },
};
