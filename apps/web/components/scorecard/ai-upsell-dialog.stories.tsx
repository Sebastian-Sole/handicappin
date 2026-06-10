import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { AiUpsellDialog } from "./ai-upsell-dialog";

const meta = {
  title: "Scorecard/AiUpsellDialog",
  component: AiUpsellDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof AiUpsellDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { open: true, onOpenChange: () => {} },
  render: () => {
    const [open, setOpen] = useState(true);
    return <AiUpsellDialog open={open} onOpenChange={setOpen} />;
  },
};

export const Controlled: Story = {
  args: { open: false, onOpenChange: () => {} },
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex flex-col gap-md">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border px-md py-sm text-body-sm"
        >
          Open AI upsell
        </button>
        <AiUpsellDialog open={open} onOpenChange={setOpen} />
      </div>
    );
  },
};
