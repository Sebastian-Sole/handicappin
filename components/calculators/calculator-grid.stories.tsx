import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { CalculatorGrid } from "./calculator-grid";

const meta = {
  title: "Calculators/CalculatorGrid",
  component: CalculatorGrid,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
  argTypes: {
    category: {
      control: "select",
      options: ["core", "advanced", "educational"],
    },
  },
} satisfies Meta<typeof CalculatorGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Core: Story = { args: { category: "core" } };
export const Advanced: Story = { args: { category: "advanced" } };
export const Educational: Story = { args: { category: "educational" } };
