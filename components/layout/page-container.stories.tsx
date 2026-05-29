import type { Meta, StoryObj } from "@storybook/nextjs";

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
        <h1 className="text-heading-1">Page title</h1>
        <p className="text-body text-muted-foreground">
          PageContainer constrains authenticated app pages to a single
          <code className="mx-xs">max-w-6xl</code> width with consistent
          horizontal padding and page-level vertical rhythm.
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
