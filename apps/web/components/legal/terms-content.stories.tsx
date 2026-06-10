import type { Meta, StoryObj } from "@storybook/nextjs";

import { TermsContent } from "./terms-content";

const meta = {
  title: "Legal/TermsContent",
  component: TermsContent,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TermsContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
