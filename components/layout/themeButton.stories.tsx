import type { Meta, StoryObj } from "@storybook/nextjs";

import { withNextThemes } from "../../.storybook/decorators";
import ThemeButton from "./themeButton";

const meta = {
  title: "Layout/ThemeButton",
  component: ThemeButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [withNextThemes],
  argTypes: {
    size: {
      control: "radio",
      options: ["icon", "sm", "lg"],
    },
    className: { control: "text" },
  },
} satisfies Meta<typeof ThemeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { size: "icon" },
};

export const Small: Story = {
  args: { size: "sm" },
};

export const Large: Story = {
  args: { size: "lg" },
};
