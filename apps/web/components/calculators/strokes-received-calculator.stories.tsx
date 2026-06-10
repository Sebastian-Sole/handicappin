import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { StrokesReceivedCalculator } from "./strokes-received-calculator";

const meta = {
  title: "Calculators/StrokesReceivedCalculator",
  component: StrokesReceivedCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof StrokesReceivedCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
