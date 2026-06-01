import type { Meta, StoryObj } from "@storybook/nextjs";
import { withCalculatorContext } from "../../.storybook/decorators";
import { CourseHandicapCalculator } from "./course-handicap-calculator";

const meta = {
  title: "Calculators/CourseHandicapCalculator",
  component: CourseHandicapCalculator,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof CourseHandicapCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
