import type { Meta, StoryObj } from "@storybook/nextjs";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "./button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

const meta = {
  title: "UI/Collapsible",
  component: Collapsible,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-[360px] space-y-sm">
      <div className="flex items-center justify-between space-x-md rounded-md border p-md">
        <h4 className="text-body-sm font-semibold">
          Advanced statistics (3)
        </h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <ChevronsUpDown className="h-4 w-4" />
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-sm">
        <div className="rounded-md border px-md py-sm text-body-sm">
          Fairways hit: 8 / 14
        </div>
        <div className="rounded-md border px-md py-sm text-body-sm">
          Greens in regulation: 11 / 18
        </div>
        <div className="rounded-md border px-md py-sm text-body-sm">
          Total putts: 28
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const Closed: Story = {
  render: () => (
    <Collapsible className="w-[360px] space-y-sm">
      <div className="flex items-center justify-between space-x-md rounded-md border p-md">
        <h4 className="text-body-sm font-semibold">Advanced statistics</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="rounded-md border px-md py-sm text-body-sm">
          Hidden content
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
};
