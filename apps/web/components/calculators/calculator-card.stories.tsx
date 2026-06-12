import type { Meta, StoryObj } from "@storybook/nextjs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { P } from "@/components/ui/typography";
import { withCalculatorContext } from "../../.storybook/decorators";
import { CalculatorCard } from "./calculator-card";
import type { CalculatorMeta } from "@/types/calculators";

const sampleMeta: CalculatorMeta = {
  id: "sample-calculator",
  name: "Sample Calculator",
  description: "A sample calculator card used for visual demos.",
  category: "core",
  inputs: ["handicapIndex", "slopeRating"],
  outputs: ["courseHandicap"],
  usgaLink: "https://www.usga.org/handicapping.html",
};

const meta = {
  title: "Calculators/CalculatorCard",
  component: CalculatorCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof CalculatorCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleInputs = (
  <div className="space-y-sm">
    <Label htmlFor="sample-input">Handicap Index</Label>
    <Input id="sample-input" type="number" placeholder="e.g., 12.4" />
  </div>
);

export const Default: Story = {
  args: {
    meta: sampleMeta,
    children: sampleInputs,
  },
};

export const WithResult: Story = {
  args: {
    meta: sampleMeta,
    children: sampleInputs,
    result: (
      <div className="flex items-center justify-between">
        <P className="font-medium">Course Handicap:</P>
        <span className="text-figure-lg text-primary">14</span>
      </div>
    ),
  },
};

export const WithResultAndExplanation: Story = {
  args: {
    meta: sampleMeta,
    children: sampleInputs,
    result: (
      <div className="flex items-center justify-between">
        <P className="font-medium">Course Handicap:</P>
        <span className="text-figure-lg text-primary">14</span>
      </div>
    ),
    explanation: (
      <P className="text-muted-foreground">
        Course Handicap = Handicap Index x (Slope / 113) + (Course Rating - Par)
      </P>
    ),
  },
};
