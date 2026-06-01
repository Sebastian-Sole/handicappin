import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { withReactHookForm } from "../../.storybook/decorators";
import { TeeFormContent } from "./tee-form-content";
import { fixtureTee } from "./__fixtures__/tee";
import type { Tee } from "@/types/scorecard-input";

const meta = {
  title: "Scorecard/TeeFormContent",
  component: TeeFormContent,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withReactHookForm<Tee>(fixtureTee)],
  args: { tee: fixtureTee, onTeeChange: () => {} },
} satisfies Meta<typeof TeeFormContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [tee, setTee] = useState<Tee>(fixtureTee);
    return (
      <TeeFormContent tee={tee} onTeeChange={setTee} isPremium={false} />
    );
  },
};

export const Premium: Story = {
  render: () => {
    const [tee, setTee] = useState<Tee>(fixtureTee);
    return (
      <TeeFormContent tee={tee} onTeeChange={setTee} isPremium />
    );
  },
};

export const BlankTee: Story = {
  render: () => {
    const [tee, setTee] = useState<Tee>({
      ...fixtureTee,
      name: "",
      courseRating18: 0,
      slopeRating18: 0,
      courseRatingFront9: 0,
      slopeRatingFront9: 0,
      courseRatingBack9: 0,
      slopeRatingBack9: 0,
      outPar: 0,
      inPar: 0,
      totalPar: 0,
      outDistance: 0,
      inDistance: 0,
      totalDistance: 0,
      holes: undefined,
    });
    return (
      <TeeFormContent tee={tee} onTeeChange={setTee} isPremium={false} />
    );
  },
};
