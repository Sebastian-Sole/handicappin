"use client";
import { useState } from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema } from "@/types/auth";
import { CardDescription } from "../ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { PasswordInput } from "../ui/password-input";
import { Button } from "../ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Alert, AlertDescription } from "../ui/alert";
import { useRouter } from "next/navigation";
import { FormFeedback } from "../ui/form-feedback";
import type { FeedbackState } from "@/types/feedback";

interface UpdatePasswordProps {
  email?: string;
}

const UpdatePassword = ({ email: initialEmail }: UpdatePasswordProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: initialEmail || "",
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });

  const otpValue = useWatch({ control: form.control, name: "otp", defaultValue: "" });

  const handleSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    setLoading(true);
    setFeedback(null);

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      const response = await fetch(
        `${URL}/functions/v1/verify-password-reset-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            otp: values.otp,
            newPassword: values.password
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: data.error || response.statusText,
        });
        setLoading(false);

        // Clear OTP on error
        form.setValue("otp", "");
        return;
      }

      setFeedback({
        type: "success",
        message: "Password reset successfully! Redirecting to login...",
      });

      // Reset loading state immediately after success
      setLoading(false);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setFeedback({
        type: "error",
        message: errorMessage,
      });
      setLoading(false);
      form.setValue("otp", "");
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8 sm:min-w-[40%] min-h-full w-[90%]">
      <div className="space-y-2 text-left">
        <h1 className="text-3xl font-bold">Reset Password</h1>
        <CardDescription>
          Enter the verification code from your email and your new password
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
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit(handleSubmit)();
            }}
            className="space-y-6"
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
                        disabled={!!initialEmail}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      id="password-reset-otp-label"
                      htmlFor="password-reset-otp-input"
                      className="block text-center"
                    >
                      Verification Code
                    </FormLabel>
                    <FormControl>
                      <div
                        className="flex justify-center"
                        role="group"
                        aria-labelledby="password-reset-otp-label"
                        aria-describedby="password-reset-otp-description"
                      >
                        <InputOTP
                          id="password-reset-otp-input"
                          maxLength={6}
                          pattern={REGEXP_ONLY_DIGITS}
                          inputMode="numeric"
                          {...field}
                          disabled={loading}
                          aria-label="Enter 6-digit password reset verification code"
                          aria-required="true"
                          aria-invalid={
                            form.formState.errors.otp ? "true" : "false"
                          }
                          aria-describedby="password-reset-otp-description"
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} aria-label="Digit 1 of 6" />
                            <InputOTPSlot index={1} aria-label="Digit 2 of 6" />
                            <InputOTPSlot index={2} aria-label="Digit 3 of 6" />
                            <InputOTPSlot index={3} aria-label="Digit 4 of 6" />
                            <InputOTPSlot index={4} aria-label="Digit 5 of 6" />
                            <InputOTPSlot index={5} aria-label="Digit 6 of 6" />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </FormControl>

                    {/* Screen reader description */}
                    <p
                      id="password-reset-otp-description"
                      className="sr-only"
                    >
                      Enter the 6-digit verification code sent to your email
                      address to reset your password. Each box represents one
                      digit.
                    </p>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        id="password"
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        id="confirmPassword"
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status updates for screen readers */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {loading && "Resetting your password, please wait"}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || otpValue.length !== 6}
              aria-label={
                loading
                  ? "Resetting password, please wait"
                  : "Reset password"
              }
              aria-busy={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </Form>

        <Alert className="mt-4">
          <AlertDescription className="text-xs">
            <strong>Tip:</strong> Check your email for the 6-digit verification
            code. The code expires in 15 minutes.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default UpdatePassword;
