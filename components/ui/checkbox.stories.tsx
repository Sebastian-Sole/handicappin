import type { Meta, StoryObj } from "@storybook/nextjs";
import * as React from "react";

import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="newsletter" {...args} />
      <Label htmlFor="newsletter">Subscribe to newsletter</Label>
    </div>
  ),
};

export const Controlled: Story = {
  render: function ControlledRender() {
    const [checked, setChecked] = React.useState<boolean | "indeterminate">(false);
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id="controlled"
          checked={checked}
          onCheckedChange={(v) => setChecked(v)}
        />
        <Label htmlFor="controlled">
          {checked === true ? "Checked" : "Unchecked"}
        </Label>
      </div>
    );
  },
};
