"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientLogger } from "@/lib/client-logger";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CardDescription } from "@/components/ui/card";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { FeedbackState } from "@/types/feedback";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

interface ForgotPasswordFormProps {
  initialEmail?: string;
}

export default function ForgotPasswordForm({
  initialEmail,
}: ForgotPasswordFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitButtonText, setSubmitButtonText] = useState(
    "Send verification code"
  );
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const handleSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setLoading(true);
    setFeedback(null);
    setSubmitButtonText("Checking email exists...");

    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      clientLogger.error("Missing Supabase configuration", undefined, {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
      });
      setFeedback({
        type: "error",
        message: "Unable to process your request. Please contact support.",
      });
      setLoading(false);
      setSubmitButtonText("Send verification code");
      return;
    }

    // Security: Don't check if email exists to prevent account enumeration
    // Always proceed to reset-password endpoint which handles non-existent emails safely
    try {
      setSubmitButtonText("Sending verification code...");
      const URL = `${supabaseUrl}/functions/v1/reset-password`;

      const response = await fetch(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: values.email,
        }),
      });

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage =
          "An error occurred with the reset password email. Contact support";
        try {
          // Read body once as text, then try to parse as JSON
          const bodyText = await response.text();
          try {
            const errorData = JSON.parse(bodyText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // JSON parsing failed, use the text directly if available
            if (bodyText) {
              errorMessage = bodyText;
            }
          }
        } catch {
          // Use default error message
        }

        setFeedback({
          type: "error",
          message: errorMessage,
        });
        setLoading(false);
        setSubmitButtonText("Send verification code");
        return;
      }

      // Security: Always show success message even if user doesn't exist
      // This prevents account enumeration attacks
      setFeedback({
        type: "success",
        message: "If an account exists with that email, you'll receive a verification code. Redirecting...",
      });

      // Redirect to update-password page with email pre-filled
      setTimeout(() => {
        router.push(
          `/update-password?email=${encodeURIComponent(values.email)}`
        );
      }, 1500);
    } catch {
      setFeedback({
        type: "error",
        message: "An error occurred with the reset password email. Contact support",
      });
      setLoading(false);
      setSubmitButtonText("Send verification code");
    }
  };

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: initialEmail || "",
    },
  });

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-left">
        <h1 className="text-3xl font-bold">Reset Password</h1>
        <CardDescription>
          Enter your email to receive a verification code to reset your
          password.
        </CardDescription>
      </div>
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
        />
      )}
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
                      <Input id="email" type="email" required {...field} />
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
