import type { Meta, StoryObj } from "@storybook/nextjs";
import { Progress } from "./progress";

const meta = {
  title: "UI/Progress",
  component: Progress,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 60, className: "w-[320px]" },
};

export const Empty: Story = {
  args: { value: 0, className: "w-[320px]" },
};

export const Half: Story = {
  args: { value: 50, className: "w-[320px]" },
};

export const Full: Story = {
  args: { value: 100, className: "w-[320px]" },
};
