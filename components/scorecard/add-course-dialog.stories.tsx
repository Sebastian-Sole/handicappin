import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { AddCourseDialog } from "./add-course-dialog";

const meta = {
  title: "Scorecard/AddCourseDialog",
  component: AddCourseDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof AddCourseDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onAdd: () => {},
    isPremium: false,
  },
};

export const Open: Story = {
  args: { onAdd: () => {} },
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <AddCourseDialog
        onAdd={() => setOpen(false)}
        open={open}
        onOpenChange={setOpen}
        isPremium={false}
      />
    );
  },
};

export const PrefilledName: Story = {
  args: { onAdd: () => {} },
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <AddCourseDialog
        onAdd={() => setOpen(false)}
        open={open}
        onOpenChange={setOpen}
        initialCourseName="Pebble Beach"
        isPremium
      />
    );
  },
};
