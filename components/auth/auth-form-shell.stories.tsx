import type { Meta, StoryObj } from "@storybook/nextjs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";

import { AuthFormShell } from "./auth-form-shell";

const meta = {
  title: "Auth/AuthFormShell",
  component: AuthFormShell,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    className: { control: "text" },
  },
} satisfies Meta<typeof AuthFormShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <div className="space-y-sm text-center">
          <H1>Welcome Back</H1>
          <p className="text-muted-foreground">
            Sign in to continue
          </p>
        </div>
        <div className="space-y-sm">
          <Label htmlFor="story-email">Email</Label>
          <Input id="story-email" type="email" placeholder="you@example.com" />
        </div>
        <Button className="w-full">Continue</Button>
      </>
    ),
  },
};

export const WithPadding: Story = {
  args: {
    className: "py-xl",
    children: (
      <div className="text-center">
        <H1>Reset Password</H1>
        <p className="text-muted-foreground mt-sm">
          Enter your email to receive a verification code.
        </p>
      </div>
    ),
  },
};
