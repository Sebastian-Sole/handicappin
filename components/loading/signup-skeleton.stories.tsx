import type { Meta, StoryObj } from "@storybook/nextjs";

import SignupSkeleton from "./signup-skeleton";

const meta = {
  title: "Loading/SignupSkeleton",
  component: SignupSkeleton,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof SignupSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
