import type { Meta, StoryObj } from "@storybook/nextjs";
import { TeeDialog } from "./tee-dialog";
import { fixtureTee } from "./__fixtures__/tee";

const meta = {
  title: "Scorecard/TeeDialog",
  component: TeeDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    mode: { control: "select", options: ["add", "edit"] },
  },
} satisfies Meta<typeof TeeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddMode: Story = {
  args: {
    mode: "add",
    onSave: () => {},
    isPremium: false,
  },
};

export const EditMode: Story = {
  args: {
    mode: "edit",
    existingTee: fixtureTee,
    onSave: () => {},
    isPremium: false,
  },
};

export const EditModePremium: Story = {
  args: {
    mode: "edit",
    existingTee: fixtureTee,
    onSave: () => {},
    isPremium: true,
  },
};

export const Disabled: Story = {
  args: {
    mode: "add",
    onSave: () => {},
    disabled: true,
  },
};
