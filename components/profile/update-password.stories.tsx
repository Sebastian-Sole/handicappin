import type { Meta, StoryObj } from "@storybook/nextjs";

import UpdatePassword from "./update-password";

const meta = {
  title: "Profile/UpdatePassword",
  component: UpdatePassword,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    email: { control: "text" },
  },
} satisfies Meta<typeof UpdatePassword>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithPrefilledEmail: Story = {
  args: {
    email: "golfer@example.com",
  },
};
