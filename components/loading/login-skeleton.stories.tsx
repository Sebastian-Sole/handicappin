import type { Meta, StoryObj } from "@storybook/nextjs";

import LoginSkeleton from "./login-skeleton";

const meta = {
  title: "Loading/LoginSkeleton",
  component: LoginSkeleton,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof LoginSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
