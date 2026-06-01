import type { Meta, StoryObj } from "@storybook/nextjs";

import AddRoundSkeleton from "./add-round-skeleton";

const meta = {
  title: "Loading/AddRoundSkeleton",
  component: AddRoundSkeleton,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof AddRoundSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
