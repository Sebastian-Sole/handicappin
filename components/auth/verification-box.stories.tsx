import type { Meta, StoryObj } from "@storybook/nextjs";

import { VerificationBox } from "./verification-box";

const meta = {
  title: "Auth/VerificationBox",
  component: VerificationBox,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof VerificationBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
