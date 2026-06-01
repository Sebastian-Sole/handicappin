import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../.storybook/decorators";
import { ManageSubscriptionButton } from "./manage-subscription-button";

const meta = {
  title: "Billing/ManageSubscriptionButton",
  component: ManageSubscriptionButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof ManageSubscriptionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
