import type { Meta, StoryObj } from "@storybook/nextjs";

import { Textarea } from "./textarea";
import { Label } from "./label";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    rows: { control: "number" },
  },
  args: {
    placeholder: "Type your message here.",
    defaultValue:
      "Tough wind on the back nine — missed two short putts on 16 and 17.",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-full gap-2">
      <Label htmlFor="message">Your message</Label>
      <Textarea id="message" {...args} />
    </div>
  ),
};

export const Filled: Story = {
  args: {
    defaultValue:
      "This is a long-ish description that fills the textarea so we can preview how the component grows with content.",
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Disabled content" },
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    className: "border-destructive focus-visible:ring-destructive",
    defaultValue: "Something is off",
  },
};
