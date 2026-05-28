import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../.storybook/decorators";
import { AccountDeletionSection } from "./account-deletion-section";

const meta = {
  title: "Profile/AccountDeletionSection",
  component: AccountDeletionSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof AccountDeletionSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
