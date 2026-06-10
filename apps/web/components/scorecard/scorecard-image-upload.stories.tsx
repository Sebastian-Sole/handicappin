import type { Meta, StoryObj } from "@storybook/nextjs";
import { ScorecardImageUpload } from "./scorecard-image-upload";
import { fixtureTee } from "./__fixtures__/tee";

const meta = {
  title: "Scorecard/ScorecardImageUpload",
  component: ScorecardImageUpload,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ScorecardImageUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

// Idle state only — the multi-stage upload/extraction flow depends on browser
// FileReader + fetch and isn't worth stubbing for a visual snapshot.
export const Idle: Story = {
  args: {
    currentTee: fixtureTee,
    onExtracted: () => {},
    onAdditionalTeesExtracted: () => {},
    isPremium: true,
  },
};

export const FreeTier: Story = {
  args: {
    currentTee: fixtureTee,
    onExtracted: () => {},
    onAdditionalTeesExtracted: () => {},
    isPremium: false,
  },
};
