import type { Meta, StoryObj } from "@storybook/nextjs";
import { Skeleton } from "./skeleton";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { className: "h-4 w-[240px]" },
};

export const Avatar: Story = {
  render: () => (
    <div className="flex items-center gap-md">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-sm">
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[160px]" />
      </div>
    </div>
  ),
};

export const CardLoading: Story = {
  render: () => (
    <div className="space-y-sm">
      <Skeleton className="h-32 w-[320px] rounded-md" />
      <Skeleton className="h-4 w-[240px]" />
      <Skeleton className="h-4 w-[180px]" />
    </div>
  ),
};
