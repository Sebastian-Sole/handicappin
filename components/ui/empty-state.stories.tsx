import type { Meta, StoryObj } from "@storybook/nextjs";
import { Flag } from "lucide-react";

import { Button } from "./button";
import { EmptyState } from "./empty-state";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "No rounds logged yet",
    description: "Your rounds will show up here once you start tracking them.",
  },
};

export const WithIcon: Story = {
  args: {
    icon: <Flag className="h-6 w-6" aria-hidden />,
    title: "No rounds logged yet",
    description: "Your rounds will show up here once you start tracking them.",
  },
};

export const WithAction: Story = {
  args: {
    icon: <Flag className="h-6 w-6" aria-hidden />,
    title: "No rounds logged yet",
    description: "Start your golf journey by logging your first round.",
    action: <Button>Log your first round</Button>,
  },
};

export const Minimal: Story = {
  args: {
    title: "No results found",
  },
};

export const Compact: Story = {
  args: {
    size: "compact",
    title: "No data available",
    description: "This caption sits quietly inside a small inline slot.",
  },
};
