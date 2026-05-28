import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { CountryCombobox } from "./country-combobox";

const meta = {
  title: "Scorecard/CountryCombobox",
  component: CountryCombobox,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CountryCombobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => {
    const [value, setValue] = useState<string>("");
    return (
      <div className="w-80">
        <CountryCombobox value={value} onValueChange={setValue} />
      </div>
    );
  },
};

export const Selected: Story = {
  render: () => {
    const [value, setValue] = useState<string>("United States");
    return (
      <div className="w-80">
        <CountryCombobox value={value} onValueChange={setValue} />
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <CountryCombobox value="Norway" onValueChange={() => {}} disabled />
    </div>
  ),
};
