import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { HandicapCapsCalculator } from "./handicap-caps-calculator";

const meta = {
  title: "Calculators/HandicapCapsCalculator",
  component: HandicapCapsCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof HandicapCapsCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
