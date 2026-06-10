import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { FormFeedback } from "./form-feedback";

const meta = {
  title: "UI/FormFeedback",
  component: FormFeedback,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["success", "error", "info"],
    },
    title: { control: "text" },
    message: { control: "text" },
  },
  args: {
    type: "info",
    message: "Heads up — this is some informational content.",
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormFeedback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const Success: Story = {
  args: {
    type: "success",
    title: "Saved",
    message: "Your changes have been saved successfully.",
  },
};

export const Error: Story = {
  args: {
    type: "error",
    title: "Something went wrong",
    message: "We couldn't save your changes. Please try again.",
  },
};

export const Dismissible: Story = {
  args: {
    type: "success",
    title: "Subscribed",
    message: "You will receive an email when we launch.",
    onClose: fn(),
  },
};
