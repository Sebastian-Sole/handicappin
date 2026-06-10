import type { Meta, StoryObj } from "@storybook/nextjs";

import { withTrpc } from "../../.storybook/decorators";
import { DataExportSection } from "./data-export-section";

const meta = {
  title: "Profile/DataExportSection",
  component: DataExportSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof DataExportSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
