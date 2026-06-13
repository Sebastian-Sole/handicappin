/**
 * Update password — native twin of apps/web/app/(auth)/update-password/
 * page.tsx + components/profile/update-password.tsx: email (locked when
 * passed via params) + 6-digit OTP + new password pair, submitted to the
 * verify-password-reset-otp edge function, then back to /login.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Text, View } from "react-native";
import { z } from "zod";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { DataSettledMarker } from "@/components/data-settled";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { InputOTP } from "@/components/ui/input-otp";
import { env } from "@/lib/env";

const resetPasswordSchema = z
  .object({
    email: z.string().email("Please enter a valid email"),
    otp: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

interface FeedbackState {
  type: "success" | "error" | "info";
  message: string;
}

export default function UpdatePasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = typeof params.email === "string" ? params.email : "";
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: initialEmail,
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });

  const otpValue = useWatch({
    control: form.control,
    name: "otp",
    defaultValue: "",
  });

  const handleSubmit = async (
    values: z.infer<typeof resetPasswordSchema>,
  ) => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `${env.supabaseUrl}/functions/v1/verify-password-reset-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            otp: values.otp,
            newPassword: values.password,
          }),
        },
      );

      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          typeof (data as Record<string, unknown>)["error"] === "string"
            ? (data as Record<string, string>)["error"]
            : response.statusText;
        setFeedback({ type: "error", message });
        setLoading(false);
        form.setValue("otp", "");
        return;
      }

      setFeedback({
        type: "success",
        message: "Password reset successfully! Redirecting to login...",
      });
      setLoading(false);

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setFeedback({ type: "error", message: errorMessage });
      setLoading(false);
      form.setValue("otp", "");
    }
  };

  return (
    <AuthFormShell
      testID="update-password-screen"
      title="Reset Password"
      description="Enter the verification code from your email and your new password"
    >
      <DataSettledMarker settled />
      {feedback ? (
        <FormFeedback type={feedback.type} message={feedback.message} />
      ) : null}
      <View className="gap-md">
        <Form {...form}>
          <View className="gap-lg">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <Input
                    testID="update-password-email"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    editable={!initialEmail}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-center">
                    Verification Code
                  </FormLabel>
                  <View className="items-center">
                    <InputOTP
                      testID="update-password-otp"
                      accessibilityLabel="Enter 6-digit password reset verification code"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={loading}
                    />
                  </View>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <Input
                    testID="update-password-new"
                    secureTextEntry
                    autoComplete="new-password"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <Input
                    testID="update-password-confirm"
                    secureTextEntry
                    autoComplete="new-password"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              testID="update-password-submit"
              className="w-full"
              disabled={loading || otpValue.length !== 6}
              accessibilityLabel={
                loading ? "Resetting password, please wait" : "Reset password"
              }
              onPress={() => {
                void form.handleSubmit(handleSubmit)();
              }}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </View>
        </Form>

        <Alert className="mt-md">
          <AlertDescription className="text-meta">
            <Text className="text-meta font-semibold text-foreground">
              Tip:
            </Text>{" "}
            Check your email for the 6-digit verification code. The code
            expires in 15 minutes.
          </AlertDescription>
        </Alert>
      </View>
    </AuthFormShell>
  );
}
