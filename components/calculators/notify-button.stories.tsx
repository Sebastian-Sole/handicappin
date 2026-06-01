import type { Meta, StoryObj } from "@storybook/nextjs";
import type { User } from "@supabase/supabase-js";
import { withTrpc } from "../../.storybook/decorators";
import NotifyButton from "./notify-button";

const fakeUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "storybook@handicappin.local",
  app_metadata: {},
  user_metadata: { full_name: "Storybook User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

const meta = {
  title: "Calculators/NotifyButton",
  component: NotifyButton,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [withTrpc],
} satisfies Meta<typeof NotifyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {
  args: { user: fakeUser },
};

export const SignedOut: Story = {
  args: { user: null },
};
