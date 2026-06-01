import type { Meta, StoryObj } from "@storybook/nextjs";
import ScoreLegend from "./score-legend";

const meta = {
  title: "Charts/ScoreLegend",
  component: ScoreLegend,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    showLegend: { control: "boolean" },
  },
} satisfies Meta<typeof ScoreLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { showLegend: true },
};

export const Hidden: Story = {
  args: { showLegend: false },
};
