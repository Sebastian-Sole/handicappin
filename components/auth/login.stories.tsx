import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../.storybook/decorators";
import { Login } from "./login";

const meta = {
  title: "Auth/Login",
  component: Login,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof Login>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
