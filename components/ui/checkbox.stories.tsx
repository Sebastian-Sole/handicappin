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

export const Default: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="default-checkbox" defaultChecked {...args} />
      <Label htmlFor="default-checkbox">Walk only (no cart)</Label>
    </div>
  ),
};

export const Checked: Story = {
  args: { defaultChecked: true },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="checked-checkbox" {...args} />
      <Label htmlFor="checked-checkbox">Count toward handicap</Label>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="disabled-checkbox" {...args} />
      <Label htmlFor="disabled-checkbox" className="text-muted-foreground">
        Practice round
      </Label>
    </div>
  ),
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="disabled-checked-checkbox" {...args} />
      <Label htmlFor="disabled-checked-checkbox" className="text-muted-foreground">
        Tournament round (locked)
      </Label>
    </div>
  ),
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
