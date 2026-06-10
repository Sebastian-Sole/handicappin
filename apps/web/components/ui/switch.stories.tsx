import type { Meta, StoryObj } from "@storybook/nextjs";
import * as React from "react";

import { Switch } from "./switch";
import { Label } from "./label";

const meta = {
  title: "UI/Switch",
  component: Switch,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="default-switch" defaultChecked {...args} />
      <Label htmlFor="default-switch">Post score automatically</Label>
    </div>
  ),
};

export const Checked: Story = {
  args: { defaultChecked: true },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="checked-switch" {...args} />
      <Label htmlFor="checked-switch">Notifications on</Label>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="disabled-switch" {...args} />
      <Label htmlFor="disabled-switch" className="text-muted-foreground">
        Private rounds (locked)
      </Label>
    </div>
  ),
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="disabled-checked-switch" {...args} />
      <Label htmlFor="disabled-checked-switch" className="text-muted-foreground">
        Pro membership (locked on)
      </Label>
    </div>
  ),
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="airplane-mode" {...args} />
      <Label htmlFor="airplane-mode">Airplane mode</Label>
    </div>
  ),
};

export const Controlled: Story = {
  render: function ControlledRender() {
    const [on, setOn] = React.useState(false);
    return (
      <div className="flex items-center gap-2">
        <Switch id="controlled-switch" checked={on} onCheckedChange={setOn} />
        <Label htmlFor="controlled-switch">{on ? "On" : "Off"}</Label>
      </div>
    );
  },
};
