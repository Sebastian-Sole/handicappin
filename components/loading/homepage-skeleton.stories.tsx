import type { Meta, StoryObj } from "@storybook/nextjs";

import HomepageSkeleton from "./homepage-skeleton";

const meta = {
  title: "Loading/HomepageSkeleton",
  component: HomepageSkeleton,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof HomepageSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
