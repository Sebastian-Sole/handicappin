import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../../.storybook/decorators";
import { SettingsTab } from "./settings-tab";

const meta = {
  title: "Profile/SettingsTab",
  component: SettingsTab,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof SettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
