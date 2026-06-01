import type { Meta, StoryObj } from "@storybook/nextjs";
import { Terminal, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta = {
  title: "UI/Alert",
  component: Alert,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "inline-radio" },
      options: ["default", "destructive"],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: "default" },
  render: (args) => (
    <Alert {...args} className="w-[400px]">
      <Terminal className="h-4 w-4" />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        You can add components to your app using the CLI.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args} className="w-[400px]">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        Your session has expired. Please log in again.
      </AlertDescription>
    </Alert>
  ),
};

export const WithoutIcon: Story = {
  args: { variant: "default" },
  render: (args) => (
    <Alert {...args} className="w-[400px]">
      <AlertTitle>Quick reminder</AlertTitle>
      <AlertDescription>
        Don&apos;t forget to log your last round before midnight.
      </AlertDescription>
    </Alert>
  ),
};
