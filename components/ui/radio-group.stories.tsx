import type { Meta, StoryObj } from "@storybook/nextjs";
import * as React from "react";

import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Label } from "./label";

const meta = {
  title: "UI/RadioGroup",
  component: RadioGroup,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="comfortable">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="default" id="r-default" />
        <Label htmlFor="r-default">Default</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="comfortable" id="r-comfortable" />
        <Label htmlFor="r-comfortable">Comfortable</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="compact" id="r-compact" />
        <Label htmlFor="r-compact">Compact</Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="a" disabled>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="a" id="d-a" />
        <Label htmlFor="d-a">Option A</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="b" id="d-b" />
        <Label htmlFor="d-b">Option B</Label>
      </div>
    </RadioGroup>
  ),
};

export const Controlled: Story = {
  render: function ControlledRender() {
    const [value, setValue] = React.useState("one");
    return (
      <div className="grid gap-3">
        <RadioGroup value={value} onValueChange={setValue}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="one" id="c-one" />
            <Label htmlFor="c-one">One</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="two" id="c-two" />
            <Label htmlFor="c-two">Two</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="three" id="c-three" />
            <Label htmlFor="c-three">Three</Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">Selected: {value}</p>
      </div>
    );
  },
};
