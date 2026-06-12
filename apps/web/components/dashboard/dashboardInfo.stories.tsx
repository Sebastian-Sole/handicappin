import type { Meta, StoryObj } from "@storybook/nextjs";
import DashboardInfo from "./dashboardInfo";

const meta = {
  title: "Dashboard/DashboardInfo",
  component: DashboardInfo,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    handicapIndex: 12.4,
    header: "Your handicap is trending in the right direction!",
  },
};

export const HighHandicap: Story = {
  args: {
    handicapIndex: 28.6,
    header: "Welcome to the world of golf — every round counts.",
  },
};

export const Scratch: Story = {
  args: {
    handicapIndex: 0.4,
    header: "Scratch territory — phenomenal play.",
  },
};
