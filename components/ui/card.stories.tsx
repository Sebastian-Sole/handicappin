import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Round summary</CardTitle>
        <CardDescription>Saturday, Aug 12 — Pine Ridge GC</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body-sm">Scored 82 with 11 GIRs and 28 putts.</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Update handicap</CardTitle>
        <CardDescription>
          We&apos;ll recalculate after your next round.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body-sm">
          Current handicap index: <strong>12.4</strong>
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-sm">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
};

export const ContentOnly: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardContent className="pt-lg">
        <p className="text-body-sm">
          Minimal card with just content — no header or footer.
        </p>
      </CardContent>
    </Card>
  ),
};
