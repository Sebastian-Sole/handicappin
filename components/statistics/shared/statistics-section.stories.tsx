import type { Meta, StoryObj } from "@storybook/nextjs";

import { StatisticsSection } from "./statistics-section";

const meta = {
  title: "Statistics/Shared/StatisticsSection",
  component: StatisticsSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof StatisticsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: "📊",
    title: "Performance Overview",
    description: "How you've been playing this season",
    children: (
      <div className="rounded-lg border p-md text-body-sm text-muted-foreground">
        Section content goes here
      </div>
    ),
  },
};

export const WithLearnMore: Story = {
  args: {
    icon: "🎯",
    title: "Play Patterns",
    description: "Discover when you play your best golf",
    learnMoreContent: (
      <p>
        Patterns are calculated from your tee times. Understanding when you perform
        best can help you schedule rounds for optimal results.
      </p>
    ),
    children: (
      <div className="rounded-lg border p-md text-body-sm text-muted-foreground">
        Charts go here
      </div>
    ),
  },
};

export const NoDescription: Story = {
  args: {
    icon: "🏆",
    title: "Highlights",
    children: (
      <div className="rounded-lg border p-md text-body-sm text-muted-foreground">
        Bare section
      </div>
    ),
  },
};
