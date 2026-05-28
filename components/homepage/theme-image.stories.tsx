import type { Meta, StoryObj } from "@storybook/nextjs";
import ThemeImage from "./theme-image";

const meta = {
  title: "Homepage/ThemeImage",
  component: ThemeImage,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 600 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ThemeImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
