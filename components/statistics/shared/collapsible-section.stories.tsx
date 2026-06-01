import type { Meta, StoryObj } from "@storybook/nextjs";

import { CollapsibleSection } from "./collapsible-section";

const meta = {
  title: "Statistics/Shared/CollapsibleSection",
  component: CollapsibleSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CollapsibleSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  args: {
    title: "Course Analytics",
    subtitle: "Performance across 7 unique courses",
    defaultOpen: false,
    children: (
      <p className="text-body-sm text-muted-foreground">
        Hidden by default - click the header to expand.
      </p>
    ),
  },
};

export const OpenByDefault: Story = {
  args: {
    title: "Round Insights",
    subtitle: "Where, when, and how you play",
    defaultOpen: true,
    children: (
      <div className="space-y-sm text-body-sm">
        <p>Average score: 87.3</p>
        <p>Best differential: 8.2</p>
        <p>Total rounds: 24</p>
      </div>
    ),
  },
};

export const NoSubtitle: Story = {
  args: {
    title: "Frivolities",
    defaultOpen: false,
    children: <p className="text-body-sm">Fun stats inside.</p>,
  },
};
