import type { Meta, StoryObj } from "@storybook/nextjs";
import { CalculatorSkeleton } from "./calculator-skeleton";

const meta = {
  title: "Calculators/CalculatorSkeleton",
  component: CalculatorSkeleton,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CalculatorSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
