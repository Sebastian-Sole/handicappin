import type { Meta, StoryObj } from "@storybook/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage
        src="https://github.com/shadcn.png"
        alt="@shadcn avatar"
      />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>SS</AvatarFallback>
    </Avatar>
  ),
};

export const BrokenImageShowsFallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/does-not-exist.png" alt="broken" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-md">
      <Avatar className="h-8 w-8">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar className="h-14 w-14">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
};
