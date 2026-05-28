import type { Meta, StoryObj } from "@storybook/nextjs";
import { CalculationStep } from "./calculation-step";

const meta = {
  title: "Round/CalculationStep",
  component: CalculationStep,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    stepNumber: { control: "number" },
    title: { control: "text" },
    description: { control: "text" },
  },
  args: {
    stepNumber: 1,
    title: "Course Handicap",
    description: "How many handicap strokes you received for this round",
  },
} satisfies Meta<typeof CalculationStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-md surface-muted">Example body content for the step.</div>
    ),
  },
};

export const WithLearnMore: Story = {
  args: {
    children: (
      <div className="p-md surface-muted">Example body content for the step.</div>
    ),
    learnMoreContent: (
      <p className="text-body-sm text-muted-foreground">
        Detailed explanation that appears when the user expands &ldquo;Learn
        more&rdquo;.
      </p>
    ),
  },
};

export const NoDescription: Story = {
  args: {
    stepNumber: 4,
    title: "Handicap Impact",
    description: undefined,
    children: (
      <div className="p-md surface-muted">Body without a description above.</div>
    ),
  },
};
