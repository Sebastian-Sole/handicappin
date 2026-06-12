import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../.storybook/decorators";
import { BillingPortalButton } from "./portal-button";

const meta = {
  title: "Billing/BillingPortalButton",
  component: BillingPortalButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof BillingPortalButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
