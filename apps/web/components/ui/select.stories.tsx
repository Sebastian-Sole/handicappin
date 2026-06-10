import type { Meta, StoryObj } from "@storybook/nextjs";
import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="blueberry">Blueberry</SelectItem>
          <SelectItem value="grapes">Grapes</SelectItem>
          <SelectItem value="pineapple">Pineapple</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <div className="w-64">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick a tee" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Men&apos;s tees</SelectLabel>
            <SelectItem value="black">Black</SelectItem>
            <SelectItem value="blue">Blue</SelectItem>
            <SelectItem value="white">White</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Women&apos;s tees</SelectLabel>
            <SelectItem value="red">Red</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-64">
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Disabled" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one">One</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Controlled: Story = {
  render: function ControlledRender() {
    const [value, setValue] = React.useState<string>("");
    return (
      <div className="grid w-64 gap-2">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Pick one..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Value: {value || "(none)"}
        </p>
      </div>
    );
  },
};
