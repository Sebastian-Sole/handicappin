import type { Meta, StoryObj } from "@storybook/nextjs";
import { Save } from "lucide-react";

import { SaveStateButton } from "./save-state-button";

const meta = {
  title: "UI/SaveStateButton",
  component: SaveStateButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    state: {
      control: "select",
      options: ["idle", "saving", "saved", "error"],
    },
    idleLabel: { control: "text" },
    savingLabel: { control: "text" },
    savedLabel: { control: "text" },
    errorLabel: { control: "text" },
  },
  args: {
    state: "idle",
    idleLabel: "Save changes",
  },
} satisfies Meta<typeof SaveStateButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Saving: Story = {
  args: { state: "saving" },
};

export const Saved: Story = {
  args: { state: "saved" },
};

export const Error: Story = {
  args: { state: "error" },
};

export const WithIcon: Story = {
  args: { idleIcon: Save },
};
