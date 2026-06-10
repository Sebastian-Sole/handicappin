import type { Meta, StoryObj } from "@storybook/nextjs";
import { StatDelta } from "./stat-delta";

const meta = {
  title: "UI/StatDelta",
  component: StatDelta,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    value: { control: { type: "number" } },
    invert: { control: { type: "boolean" } },
    iconOnly: { control: { type: "boolean" } },
    numberOnly: { control: { type: "boolean" } },
  },
} satisfies Meta<typeof StatDelta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PositiveBetter: Story = {
  args: { value: 2.3 },
};

export const NegativeWorse: Story = {
  args: { value: -1.8 },
};

export const Flat: Story = {
  args: { value: 0 },
};

export const InvertedHandicap: Story = {
  args: { value: -1.2, invert: true },
};

export const IconOnly: Story = {
  args: { value: 3.1, iconOnly: true },
};

export const NumberOnly: Story = {
  args: { value: -0.7, numberOnly: true },
};
