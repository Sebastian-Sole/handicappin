import type { Meta, StoryObj } from "@storybook/nextjs";
import { HandicapDisplay } from "./handicap-display";

const meta = {
  title: "Homepage/HandicapDisplay",
  component: HandicapDisplay,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof HandicapDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { handicapIndex: 12.4, previousHandicapIndex: 14.8 },
};

export const Improving: Story = {
  args: { handicapIndex: 8.2, previousHandicapIndex: 12.4 },
};

export const Regressing: Story = {
  args: { handicapIndex: 18.6, previousHandicapIndex: 16.4 },
};

export const HighHandicap: Story = {
  args: { handicapIndex: 28.6 },
};

export const Scratch: Story = {
  args: { handicapIndex: 0.4, previousHandicapIndex: 1.6 },
};
