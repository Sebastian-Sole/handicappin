import type { Meta, StoryObj } from "@storybook/nextjs";

import AboutSkeleton from "./about-skeleton";

const meta = {
  title: "Loading/AboutSkeleton",
  component: AboutSkeleton,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof AboutSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
