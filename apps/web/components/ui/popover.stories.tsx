import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta = {
  title: "UI/Popover",
  component: Popover,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-sm">
          <h4 className="font-medium">Dimensions</h4>
          <p className="text-body-sm text-muted-foreground">
            Set the width and height for the chart.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignStart: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Aligned start</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <p className="text-body-sm">Popover aligned to the start.</p>
      </PopoverContent>
    </Popover>
  ),
};

export const Closed: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button>Click to open</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-body-sm">Hello from the popover</p>
      </PopoverContent>
    </Popover>
  ),
};
