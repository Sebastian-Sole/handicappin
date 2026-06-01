import type { Meta, StoryObj } from "@storybook/nextjs";

import { WhatsThis } from "./whats-this";

const meta = {
  title: "UI/WhatsThis",
  component: WhatsThis,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    caption: { control: "text" },
    captionResponsive: { control: "boolean" },
    children: { control: "text" },
  },
  args: {
    children: "Course Handicap factors slope and course rating into your index.",
  },
} satisfies Meta<typeof WhatsThis>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomCaption: Story = {
  args: {
    caption: "Learn more",
    children: "A short, helpful explanation of the metric beside it.",
  },
};

export const AlwaysVisibleCaption: Story = {
  args: { captionResponsive: false },
};
