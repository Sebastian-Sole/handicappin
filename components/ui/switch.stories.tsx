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
