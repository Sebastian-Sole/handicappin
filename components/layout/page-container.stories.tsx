import type { Meta, StoryObj } from "@storybook/nextjs";

import { H1 } from "@/components/ui/typography";
import { PageContainer } from "./page-container";

const meta = {
  title: "Layout/PageContainer",
  component: PageContainer,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof PageContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="space-y-md">
        <H1>Page title</H1>
        <p className="text-body text-muted-foreground">
          PageContainer wraps authenticated app pages in Tailwind&apos;s
          <code className="mx-xs">container</code> (matches the homepage),
          with consistent horizontal padding and page-level vertical rhythm.
        </p>
        <div className="rounded-lg border bg-card p-lg">
          Sample card content sits inside the shared container.
        </div>
      </div>
    ),
  },
};

export const WithGrid: Story = {
  args: {
    children: (
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-lg">
            Tile {i + 1}
          </div>
        ))}
      </div>
    ),
  },
};
