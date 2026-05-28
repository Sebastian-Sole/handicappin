import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../.storybook/decorators";
import { ContactForm } from "./contact-form";

const meta = {
  title: "Contact/ContactForm",
  component: ContactForm,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof ContactForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
