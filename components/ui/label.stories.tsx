import type { Meta, StoryObj } from "@storybook/nextjs";

import { Label } from "./label";
import { Input } from "./input";
import { Checkbox } from "./checkbox";

const meta = {
  title: "UI/Label",
  component: Label,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    children: { control: "text" },
  },
  args: {
    children: "Email",
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithInput: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="email-field" {...args}>{args.children}</Label>
      <Input id="email-field" type="email" placeholder="name@example.com" />
    </div>
  ),
};

export const WithCheckbox: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="accept-terms" />
      <Label htmlFor="accept-terms">Accept terms and conditions</Label>
    </div>
  ),
};
