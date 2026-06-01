import type { Meta, StoryObj } from "@storybook/nextjs";
import { QuickActions } from "./quick-actions";

const meta = {
  title: "Homepage/QuickActions",
  component: QuickActions,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof QuickActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { userId: "00000000-0000-0000-0000-000000000001" },
};

export const NarrowContainer: Story = {
  args: { userId: "00000000-0000-0000-0000-000000000001" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};
