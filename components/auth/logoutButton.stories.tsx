import type { Meta, StoryObj } from "@storybook/nextjs";

import LogoutButton from "./logoutButton";

const meta = {
  title: "Auth/LogoutButton",
  component: LogoutButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof LogoutButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
