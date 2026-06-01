import type { Meta, StoryObj } from "@storybook/nextjs";

import { PrivacyContent } from "./privacy-content";

const meta = {
  title: "Legal/PrivacyContent",
  component: PrivacyContent,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PrivacyContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
