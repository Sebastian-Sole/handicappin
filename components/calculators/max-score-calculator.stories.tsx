import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { MaxScoreCalculator } from "./max-score-calculator";

const meta = {
  title: "Calculators/MaxScoreCalculator",
  component: MaxScoreCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof MaxScoreCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
