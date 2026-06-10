import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { NineHoleCalculator } from "./nine-hole-calculator";

const meta = {
  title: "Calculators/NineHoleCalculator",
  component: NineHoleCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof NineHoleCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
