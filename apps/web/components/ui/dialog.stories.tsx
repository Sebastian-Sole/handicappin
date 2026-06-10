import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the
            round and remove its data from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Closed: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hello</DialogTitle>
          <DialogDescription>Click the trigger to open me.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terms of service</DialogTitle>
          <DialogDescription>
            Please read carefully before continuing.
          </DialogDescription>
        </DialogHeader>
        <div className="text-body-sm space-y-sm">
          <p>
            By using this service you agree to abide by the rules of the United
            States Golf Association handicap system. Score posting must be
            accurate, timely, and complete.
          </p>
          <p>
            You retain ownership of all round data submitted through the
            platform.
          </p>
        </div>
        <DialogFooter>
          <Button>I agree</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
