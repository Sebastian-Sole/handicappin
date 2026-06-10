/**
 * Forgot password — native twin of apps/web/app/(auth)/forgot-password/
 * page.tsx + components/auth/forgot-password-form.tsx. Same flow: the
 * reset-password edge function sends an OTP (enumeration-safe success copy
 * either way), then on to /update-password with the email prefilled. Web
 * prefills the email server-side for signed-in users; native reads it from
 * the session.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth/session-provider";
import { env } from "@/lib/env";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

interface FeedbackState {
  type: "success" | "error" | "info";
  message: string;
}

export default function ForgotPasswordScreen() {
  const { session } = useSession();
  const [loading, setLoading] = useState(false);
  const [submitButtonText, setSubmitButtonText] = useState(
    "Send verification code",
  );
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: session?.user.email ?? "" },
  });

  const handleSubmit = async (
    values: z.infer<typeof forgotPasswordSchema>,
  ) => {
    setLoading(true);
    setFeedback(null);
    setSubmitButtonText("Sending verification code...");

    // Security: never check whether the email exists (account enumeration);
    // the reset-password edge function handles unknown emails safely.
    try {
      const response = await fetch(
        `${env.supabaseUrl}/functions/v1/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.supabaseAnonKey}`,
          },
          body: JSON.stringify({ email: values.email }),
        },
      );

      if (!response.ok) {
        let errorMessage =
          "An error occurred with the reset password email. Contact support";
        try {
          const bodyText = await response.text();
          try {
            const errorData: unknown = JSON.parse(bodyText);
            if (
              typeof errorData === "object" &&
              errorData !== null &&
              typeof (errorData as Record<string, unknown>)["error"] ===
                "string"
            ) {
              errorMessage = (errorData as Record<string, string>)["error"];
            }
          } catch {
            if (bodyText) errorMessage = bodyText;
          }
        } catch {
          // keep default message
        }

        setFeedback({ type: "error", message: errorMessage });
        setLoading(false);
        setSubmitButtonText("Send verification code");
        return;
      }

      setFeedback({
        type: "success",
        message:
          "If an account exists with that email, you'll receive a verification code. Redirecting...",
      });

      setTimeout(() => {
        router.push(
          `/update-password?email=${encodeURIComponent(values.email)}`,
        );
      }, 1500);
    } catch {
      setFeedback({
        type: "error",
        message:
          "An error occurred with the reset password email. Contact support",
      });
      setLoading(false);
      setSubmitButtonText("Send verification code");
    }
  };

  return (
    <AuthFormShell
      testID="forgot-password-screen"
      title="Reset Password"
      description="Enter your email to receive a verification code to reset your password."
    >
      <DataSettledMarker settled />
      {feedback ? (
        <FormFeedback type={feedback.type} message={feedback.message} />
      ) : null}
      <View className="gap-md">
        <Form {...form}>
          <View className="gap-xl">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <Input
                    testID="forgot-password-email"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              testID="forgot-password-submit"
              className="w-full"
              disabled={loading}
              onPress={() => {
                void form.handleSubmit(handleSubmit)();
              }}
            >
              {submitButtonText}
            </Button>
          </View>
        </Form>
      </View>
    </AuthFormShell>
  );
}
