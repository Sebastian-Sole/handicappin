import type { Meta, StoryObj } from "@storybook/nextjs";
import { UsageLimitAlert, UsageLimitReachedView } from "./usage-limit-alert";

const meta = {
  title: "Scorecard/UsageLimitAlert",
  component: UsageLimitAlert,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    current: { control: { type: "number" } },
    total: { control: { type: "number" } },
    variant: {
      control: "select",
      options: ["default", "warning", "critical"],
    },
    resourceName: { control: "text" },
  },
  args: {
    current: 3,
    total: 10,
    resourceName: "rounds",
    variant: "default",
  },
} satisfies Meta<typeof UsageLimitAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Warning: Story = {
  args: { current: 7, total: 10, variant: "warning" },
};

export const Critical: Story = {
  args: { current: 9, total: 10, variant: "critical" },
};

export const ReachedView: StoryObj = {
  render: () => <UsageLimitReachedView />,
};
