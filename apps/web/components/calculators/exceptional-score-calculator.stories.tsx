import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { ExceptionalScoreCalculator } from "./exceptional-score-calculator";

const meta = {
  title: "Calculators/ExceptionalScoreCalculator",
  component: ExceptionalScoreCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof ExceptionalScoreCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
