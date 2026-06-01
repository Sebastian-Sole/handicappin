import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../.storybook/decorators";
import { Signup } from "./signup";

const meta = {
  title: "Auth/Signup",
  component: Signup,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
  argTypes: {
    description: { control: "text" },
    notify: { control: "boolean" },
  },
} satisfies Meta<typeof Signup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomDescription: Story = {
  args: {
    description: "Start tracking your handicap today",
  },
};
