import type { Meta, StoryObj } from "@storybook/nextjs";
import * as React from "react";

import DatePicker from "./datepicker";

const meta = {
  title: "UI/DatePicker",
  component: DatePicker,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    onChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: function EmptyRender() {
    const [date, setDate] = React.useState<Date | undefined>(undefined);
    return <DatePicker value={date} onChange={setDate} />;
  },
};

export const WithValue: Story = {
  render: function WithValueRender() {
    const [date, setDate] = React.useState<Date>(
      new Date(2024, 5, 15, 14, 30)
    );
    return <DatePicker value={date} onChange={setDate} />;
  },
};
