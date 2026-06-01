import type { Meta, StoryObj } from "@storybook/nextjs";
import { ArrowRight, Mail } from "lucide-react";

import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
    asChild: { control: "boolean" },
    children: { control: "text" },
  },
  args: {
    children: "Button",
    variant: "default",
    size: "default",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Outline" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Secondary" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Ghost" },
};

export const Link: Story = {
  args: { variant: "link", children: "Link" },
};

export const Small: Story = {
  args: { size: "sm", children: "Small" },
};

export const Large: Story = {
  args: { size: "lg", children: "Large" },
};

export const Icon: Story = {
  args: { size: "icon", "aria-label": "Send", children: <ArrowRight className="h-4 w-4" /> },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Mail className="mr-2 h-4 w-4" />
        Login with Email
      </>
    ),
  },
};

export const AllVariants: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-4">
      {(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map(
        (variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-3">
            <Button variant={variant} size="sm">{variant} sm</Button>
            <Button variant={variant}>{variant}</Button>
            <Button variant={variant} size="lg">{variant} lg</Button>
            <Button variant={variant} size="icon" aria-label={`${variant} icon`}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )
      )}
    </div>
  ),
};
