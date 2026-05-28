import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { HandicapIndexCalculator } from "./handicap-index-calculator";

const meta = {
  title: "Calculators/HandicapIndexCalculator",
  component: HandicapIndexCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof HandicapIndexCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
