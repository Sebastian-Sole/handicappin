import type { Meta, StoryObj } from "@storybook/nextjs";
import * as React from "react";
import { Mail } from "lucide-react";

import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "tel", "url"],
    },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: {
    type: "text",
    placeholder: "Enter text...",
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-full gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" {...args} type="email" placeholder="name@example.com" />
    </div>
  ),
};

export const Password: Story = {
  args: { type: "password", placeholder: "Enter password" },
};

export const Number: Story = {
  args: { type: "number", placeholder: "0" },
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: "Disabled input", value: "Cannot edit" },
};

export const WithIcon: Story = {
  render: (args) => (
    <div className="relative">
      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input {...args} className="pl-9" placeholder="name@example.com" />
    </div>
  ),
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    className: "border-destructive focus-visible:ring-destructive",
    defaultValue: "not-an-email",
  },
};

export const Controlled: Story = {
  render: function ControlledRender(args) {
    const [value, setValue] = React.useState("");
    return (
      <Input
        {...args}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  },
};
