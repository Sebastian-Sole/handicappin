import type { Meta, StoryObj } from "@storybook/nextjs";
import { useEffect } from "react";
import { withCalculatorContext } from "../../.storybook/decorators";
import { LinkedValuesBar } from "./linked-values-bar";
import { useCalculatorContext } from "@/contexts/calculatorContext";

const meta = {
  title: "Calculators/LinkedValuesBar",
  component: LinkedValuesBar,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withCalculatorContext],
} satisfies Meta<typeof LinkedValuesBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Renders nothing when no values are set — confirms empty-state behavior.
export const Empty: Story = { args: {} };

function PopulatedSeed() {
  const { setValues } = useCalculatorContext();
  useEffect(() => {
    setValues({
      handicapIndex: 12.4,
      courseHandicap: 14,
      scoreDifferential: 13.2,
      courseRating: 72.3,
      slopeRating: 130,
    });
  }, [setValues]);
  return <LinkedValuesBar />;
}

export const Populated: Story = {
  render: () => <PopulatedSeed />,
};

function PartialSeed() {
  const { setValues } = useCalculatorContext();
  useEffect(() => {
    setValues({
      handicapIndex: 8.7,
      slopeRating: 125,
    });
  }, [setValues]);
  return <LinkedValuesBar />;
}

export const PartiallyPopulated: Story = {
  render: () => <PartialSeed />,
};
