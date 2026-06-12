import type { Meta, StoryObj } from "@storybook/nextjs";
import { Trophy } from "lucide-react";
import { StatTile } from "./stat-tile";

const meta = {
  title: "UI/StatTile",
  component: StatTile,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "inline-radio" },
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof StatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 12.4,
    label: "Handicap index",
  },
};

export const WithHint: Story = {
  args: {
    value: 82,
    label: "Best round",
    hint: "Pine Ridge GC · Aug 12",
  },
};

export const WithLeadingIcon: Story = {
  args: {
    value: "9",
    label: "Top finishes",
    leading: <Trophy className="mx-auto h-5 w-5 text-success" aria-hidden />,
  },
};

export const Sizes: Story = {
  args: { value: 42, label: "Rounds" },
  render: () => (
    <div className="flex items-end gap-xl">
      <StatTile value={12.4} label="Small" size="sm" />
      <StatTile value={12.4} label="Medium" size="md" />
      <StatTile value={12.4} label="Large" size="lg" />
    </div>
  ),
};
