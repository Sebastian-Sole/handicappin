import type { Meta, StoryObj } from "@storybook/nextjs";
import * as React from "react";
import { useForm } from "react-hook-form";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import { Input } from "./input";
import { Button } from "./button";

type DemoValues = {
  username: string;
  email: string;
};

function DemoForm({
  defaultValues,
  forceError,
}: {
  defaultValues?: Partial<DemoValues>;
  forceError?: boolean;
}) {
  const form = useForm<DemoValues>({
    defaultValues: {
      username: "",
      email: "",
      ...defaultValues,
    },
  });

  React.useEffect(() => {
    if (forceError) {
      form.setError("username", {
        type: "manual",
        message: "Username is already taken.",
      });
    }
  }, [form, forceError]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => {})}
        className="w-80 space-y-4"
      >
        <FormField
          control={form.control}
          name="username"
          rules={{ required: "Username is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="shadcn" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}

const meta = {
  title: "UI/Form",
  component: DemoForm,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof DemoForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValues: { username: "shadcn", email: "shadcn@example.com" },
  },
};

export const WithError: Story = {
  args: {
    defaultValues: { username: "taken", email: "" },
    forceError: true,
  },
};
