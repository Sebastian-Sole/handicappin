import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { WhatIfCalculator } from "./what-if-calculator";

const meta = {
  title: "Calculators/WhatIfCalculator",
  component: WhatIfCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof WhatIfCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
