import type { Meta, StoryObj } from "@storybook/nextjs";

import ForgotPasswordForm from "./forgot-password-form";

const meta = {
  title: "Auth/ForgotPasswordForm",
  component: ForgotPasswordForm,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    initialEmail: { control: "text" },
  },
} satisfies Meta<typeof ForgotPasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithInitialEmail: Story = {
  args: {
    initialEmail: "golfer@example.com",
  },
};
