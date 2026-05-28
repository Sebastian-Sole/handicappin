import type { Meta, StoryObj } from "@storybook/nextjs";

import { LegalDialog } from "./legal-dialog";

const meta = {
  title: "Legal/LegalDialog",
  component: LegalDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "radio",
      options: ["terms", "privacy"],
    },
  },
} satisfies Meta<typeof LegalDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Terms: Story = {
  args: {
    type: "terms",
    children: "Terms of Service",
  },
};

export const Privacy: Story = {
  args: {
    type: "privacy",
    children: "Privacy Policy",
  },
};
