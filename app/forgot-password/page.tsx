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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitButtonText, setSubmitButtonText] = useState("Request link");

  const handleSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setLoading(true);
    setSubmitButtonText("Checking email exists...");

    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration:", {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
      });
      toast({
        title: "Configuration error",
        description: "Unable to process your request. Please contact support.",
        variant: "destructive",
      });
      setLoading(false);
      setSubmitButtonText("Request link");
      return;
    }

    try {
      const checkEmailResponse = await fetch(
        `${supabaseUrl}/functions/v1/check-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ email: values.email }),
        }
      );

      const { exists } = await checkEmailResponse.json();

      if (!exists) {
        toast({
          title: "No user found",
          description: "We could not find a user with that email.",
          variant: "destructive",
        });
        setLoading(false);
        setSubmitButtonText("Requeset link");
        return;
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          "An error occurred when checking the email exists. Contact support.",
        variant: "destructive",
      });
      setLoading(false);
      setSubmitButtonText("Requeset link");
    }

    try {
      setSubmitButtonText("Sending email...");
      const URL = `${supabaseUrl}/functions/v1/reset-password`;

      const resetLink = `${window.location.origin}/update-password`;

      await fetch(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: values.email,
          resetLinkBase: resetLink,
        }),
      });

      toast({
        title: "✅ Password reset requested",
        description: "An email has been sent to reset your password.",
      });

      setLoading(false);
      setSubmitButtonText("Request link");
    } catch (error) {
      toast({
        title: "Error",
        description:
          "An error occurred with the reset password email. Contact support",
        variant: "destructive",
      });
      setLoading(false);
    }
    setLoading(false);
    setSubmitButtonText("Request link");
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
              {submitButtonText}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
