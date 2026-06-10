import type { Meta, StoryObj } from "@storybook/nextjs";

import ProfileSkeleton from "./profile-skeleton";

const meta = {
  title: "Loading/ProfileSkeleton",
  component: ProfileSkeleton,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof ProfileSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
