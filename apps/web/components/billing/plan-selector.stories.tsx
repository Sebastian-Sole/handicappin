import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../.storybook/decorators";
import { PlanSelector } from "./plan-selector";

const meta = {
  title: "Billing/PlanSelector",
  component: PlanSelector,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
  argTypes: {
    currentPlan: {
      control: "select",
      options: [null, "free", "premium", "unlimited", "lifetime"],
    },
    mode: {
      control: "radio",
      options: ["onboarding", "upgrade"],
    },
  },
} satisfies Meta<typeof PlanSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

const userId = "00000000-0000-0000-0000-000000000001";

export const Onboarding: Story = {
  args: {
    userId,
    mode: "onboarding",
    currentPlan: null,
  },
};

export const UpgradeFromFree: Story = {
  args: {
    userId,
    mode: "upgrade",
    currentPlan: "free",
  },
};

export const UpgradeFromPremium: Story = {
  args: {
    userId,
    mode: "upgrade",
    currentPlan: "premium",
  },
};
