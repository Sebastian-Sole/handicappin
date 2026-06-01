import type { Meta, StoryObj } from "@storybook/nextjs";

import { GoogleSignInButton } from "./google-sign-in-button";

const meta = {
  title: "Auth/GoogleSignInButton",
  component: GoogleSignInButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    mode: {
      control: "select",
      options: ["login", "signup"],
    },
    className: { control: "text" },
  },
} satisfies Meta<typeof GoogleSignInButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { mode: "login", className: "w-72" },
};
