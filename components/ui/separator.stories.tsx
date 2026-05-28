import type { Meta, StoryObj } from "@storybook/nextjs";
import { Separator } from "./separator";

const meta = {
  title: "UI/Separator",
  component: Separator,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-[320px]">
      <div className="space-y-xs">
        <h4 className="text-body-sm font-medium">Account settings</h4>
        <p className="text-body-sm text-muted-foreground">
          Manage your account preferences.
        </p>
      </div>
      <Separator className="my-md" />
      <div className="flex h-5 items-center space-x-md text-body-sm">
        <div>Profile</div>
        <Separator orientation="vertical" />
        <div>Billing</div>
        <Separator orientation="vertical" />
        <div>Notifications</div>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 items-center gap-md text-body-sm">
      <span>Section A</span>
      <Separator orientation="vertical" />
      <span>Section B</span>
      <Separator orientation="vertical" />
      <span>Section C</span>
    </div>
  ),
};
