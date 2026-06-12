import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { TimeRangeFilter } from "./time-range-filter";
import type { TimeRange } from "@/types/statistics";

const meta = {
  title: "Statistics/TimeRangeFilter",
  component: TimeRangeFilter,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof TimeRangeFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllTime: Story = {
  args: {
    value: "all",
    onChange: () => {},
  },
};

export const SixMonths: Story = {
  args: {
    value: "6months",
    onChange: () => {},
  },
};

export const OneYear: Story = {
  args: {
    value: "1year",
    onChange: () => {},
  },
};

export const Controlled: Story = {
  args: { value: "all", onChange: () => {} },
  render: () => {
    const [value, setValue] = useState<TimeRange>("6months");
    return <TimeRangeFilter value={value} onChange={setValue} />;
  },
};
