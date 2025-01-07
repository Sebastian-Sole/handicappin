"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardDescription } from "@/components/ui/card";
import { createClientComponentClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const supabase = createClientComponentClient();

  const handleSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setLoading(true);

    const { error } = await supabase
      .from("Profile")
      .select("email")
      .eq("email", values.email)
      .single();

    if (error) {
      toast({
        title: "No user found",
        description:
          "We could not find a user with that email, try a different email or contact us for help.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const PROJECT_ID = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const URL = `${PROJECT_ID}/functions/v1/reset-password`;

    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/update-password`;

    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email: values.email,
        resetLinkBase: resetLink,
      }),
    });

    toast({
      title: "✅ Password reset requested",
      description: "An email has been sent to you to reset your password",
    });

    if (!response.ok) {
      const { error } = await response.json();
      toast({
        title: "Error",
        description: error || "Failed to send password reset link.",
        variant: "destructive",
      });
      setLoading(false);
      throw new Error(error || "Failed to call edge function.");
    }

    setLoading(false);
  };

  const forgotPasswordSchema = z.object({
    email: z.string(),
  });

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: email,
    },
  });

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-left">
        <h1 className="text-3xl font-bold">Reset Password</h1>
        <CardDescription>
          Enter your email to receive a password reset link.
        </CardDescription>
      </div>
      <div className="space-y-4">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-8"
          >
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        required
                        {...field}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          form.setValue("email", e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending link..." : "Request link"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
