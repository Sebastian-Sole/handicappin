import type { Meta, StoryObj } from "@storybook/nextjs";

import Footer from "./footer";

const meta = {
  title: "Layout/Footer",
  component: Footer,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
