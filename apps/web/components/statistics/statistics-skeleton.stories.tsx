import type { Meta, StoryObj } from "@storybook/nextjs";

import StatisticsSkeleton from "./statistics-skeleton";

const meta = {
  title: "Statistics/StatisticsSkeleton",
  component: StatisticsSkeleton,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof StatisticsSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
