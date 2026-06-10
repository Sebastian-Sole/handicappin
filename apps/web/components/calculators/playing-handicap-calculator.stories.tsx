import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { PlayingHandicapCalculator } from "./playing-handicap-calculator";

const meta = {
  title: "Calculators/PlayingHandicapCalculator",
  component: PlayingHandicapCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof PlayingHandicapCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
