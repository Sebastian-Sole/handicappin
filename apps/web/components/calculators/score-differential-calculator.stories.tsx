import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { ScoreDifferentialCalculator } from "./score-differential-calculator";

const meta = {
  title: "Calculators/ScoreDifferentialCalculator",
  component: ScoreDifferentialCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof ScoreDifferentialCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
