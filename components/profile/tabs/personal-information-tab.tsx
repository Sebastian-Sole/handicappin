"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tables } from "@/types/supabase";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { createClientComponentClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { api } from "@/trpc/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchParams, useRouter } from "next/navigation";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { verifyEmailChangeOtp } from "@/app/actions/email-change";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { FeedbackState } from "@/types/feedback";

interface PersonalInformationTabProps {
  authUser: User;
  profile: Tables<"profile">;
}

const updateProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  // Email is managed separately through email change workflow
});

// Helper hook for handling success query params
function useSuccessParam(
  paramName: string,
  setShowSuccess: (show: boolean) => void,
  authUserId: string,
  onSuccess?: () => void
) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get(paramName) === "true") {
      setShowSuccess(true);
      onSuccess?.();

      // Remove the query param from URL
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete(paramName);
      const newUrl = `/profile/${authUserId}?${newParams.toString()}`;
      router.replace(newUrl, { scroll: false });

      // Hide after 5 seconds
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [paramName, searchParams, authUserId, router, setShowSuccess, onSuccess]);
}

export function PersonalInformationTab({
  profile,
  authUser,
}: PersonalInformationTabProps) {
  const { id, name: profileName } = profile;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isRequestingChange, setIsRequestingChange] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [showVerifySuccess, setShowVerifySuccess] = useState(false);
  const [lastResendTime, setLastResendTime] = useState<number | null>(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const supabase = createClientComponentClient();
  const utils = api.useUtils();

  const { mutate } = api.auth.updateProfile.useMutation({
    onSuccess: () => {
      setSaveState("saved");
      setFeedback(null);

      // Reset button state after 2 seconds
      setTimeout(() => {
        setSaveState("idle");
      }, 2000);
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error.message,
      });
      setSaveState("idle");
    },
  });

  // Fetch pending email change
  const { data: pendingChange } = api.auth.getPendingEmailChange.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );

  // Derive pendingEmail from query data instead of duplicating in state
  const pendingEmail = pendingChange?.new_email ?? null;

  const form = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      id: id,
      name: profileName || "",
    },
  });

  // Reference to current email (not part of profile update)
  const currentEmail = authUser.email || "";
  const [newEmail, setNewEmail] = useState(authUser.email || "");

  // Handle success query params
  useSuccessParam("cancelled", setShowCancelSuccess, authUser.id);
  useSuccessParam("verified", setShowVerifySuccess, authUser.id, () => {
    utils.auth.getPendingEmailChange.invalidate();
  });

  const handleSubmit = async (values: z.infer<typeof updateProfileSchema>) => {
    setSaveState("saving");

    // Update name only - email is managed separately
    mutate({
      id,
      name: values.name,
    });
  };

  const handleEmailChange = async () => {
    // Check if email changed
    const emailChanged = newEmail !== currentEmail;

    if (!emailChanged) {
      setFeedback({
        type: "info",
        message: "Please enter a different email address",
      });
      return;
    }

    // Request email change
    setIsRequestingChange(true);
    setFeedback(null);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const session = await supabase.auth.getSession();

      if (!session.data.session) {
        setFeedback({
          type: "error",
          message: "Session expired. Please log in again.",
        });
        setIsRequestingChange(false);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/request-email-change`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({ newEmail }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        // Invalidate query to refetch actual backend state
        await utils.auth.getPendingEmailChange.invalidate();
        // Show OTP input and reset verified state
        setShowOtpInput(true);
        setOtpError("");
        setOtp("");
        setIsVerified(false); // Reset verified state for new verification
        setLastResendTime(Date.now());
        setFeedback(null);
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to request email change",
        });
      }
    } catch (error) {
      console.error("Email change request error:", error);
      setFeedback({
        type: "error",
        message: "An unexpected error occurred",
      });
    } finally {
      setIsRequestingChange(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError("Please enter a 6-digit code");
      return;
    }

    setIsVerifying(true);
    setOtpError("");

    try {
      // Call server action - much simpler!
      const result = await verifyEmailChangeOtp(currentEmail, otp);

      if (result.success) {
        // Mark as verified FIRST to hide all pending UI immediately
        setIsVerified(true);
        setShowOtpInput(false);
        setOtp("");
        setOtpError("");

        // Refresh user session to get updated email
        const { data: sessionData } = await supabase.auth.refreshSession();

        // Force refetch the pending email change query to ensure it shows null
        await utils.auth.getPendingEmailChange.refetch();

        // Update email field to show the NEW email from refreshed session
        const updatedEmail = sessionData.session?.user.email || currentEmail;
        setNewEmail(updatedEmail);

        // Show success message
        setShowVerifySuccess(true);

        // Reset success message after 5 seconds
        setTimeout(() => {
          setShowVerifySuccess(false);
        }, 5000);

        // Reset isVerified after success message disappears
        // This ensures pendingEmail has been cleared from the query
        setTimeout(() => {
          setIsVerified(false);
        }, 6000);
      } else {
        setOtpError(
          result.error || "Invalid verification code. Please try again."
        );
        setOtp(""); // Clear OTP on error
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      setOtpError("An unexpected error occurred. Please try again.");
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    if (!pendingEmail) return;

    // Rate limit: only allow resend every 2 minutes
    const now = Date.now();
    if (lastResendTime && now - lastResendTime < 120000) {
      const remainingSeconds = Math.ceil(
        (120000 - (now - lastResendTime)) / 1000
      );
      setOtpError(`Please wait ${remainingSeconds} seconds before resending`);
      return;
    }

    setIsResending(true);
    setOtpError("");
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const session = await supabase.auth.getSession();

      if (!session.data.session) {
        setFeedback({
          type: "error",
          message: "Session expired. Please log in again.",
        });
        setIsResending(false);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/request-email-change`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({ newEmail: pendingEmail }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setLastResendTime(Date.now());
        // Ensure OTP input is shown and reset verified state
        setShowOtpInput(true);
        setOtp("");
        setOtpError("");
        setIsVerified(false);
      } else {
        setOtpError(data.error || "Failed to resend email");
      }
    } catch (error) {
      console.error("Email resend error:", error);
      setOtpError("An unexpected error occurred");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Personal Information</h2>
        <p className="text-muted-foreground">
          Manage your account details and preferences
        </p>
      </div>

      {/* Inline feedback display */}
      {feedback && (
        <FormFeedback
          type={feedback.type}
          message={feedback.message}
        />
      )}

      {/* Success alert for cancelled email change */}
      {showCancelSuccess && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Email change cancelled successfully. Your email address remains
            unchanged.
          </AlertDescription>
        </Alert>
      )}

      {/* Success alert for verified email change */}
      {showVerifySuccess && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Email address updated successfully!
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input id="name" type="text" required {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email section - managed separately */}
          <div className="space-y-3">
            <FormLabel>Email</FormLabel>
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email"
                disabled={showOtpInput}
              />
              <Button
                type="button"
                onClick={handleEmailChange}
                disabled={
                  isRequestingChange ||
                  newEmail === currentEmail ||
                  showOtpInput
                }
                aria-label={
                  isRequestingChange
                    ? "Sending verification code, please wait"
                    : "Send email change verification code"
                }
                aria-busy={isRequestingChange}
              >
                {isRequestingChange ? "Sending..." : "Change Email"}
              </Button>
            </div>

            {/* OTP Input Section */}
            {showOtpInput && !isVerified && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-4">
                    <div>
                      <strong>Verification code sent to:</strong> {pendingEmail}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Check your email for the 6-digit verification code. The
                      code is valid for 15 minutes.
                    </div>

                    <div className="space-y-2">
                      <FormLabel
                        id="inline-email-otp-label"
                        htmlFor="inline-email-otp-input"
                        className="text-sm"
                      >
                        Enter Verification Code
                      </FormLabel>
                      <div
                        className="flex justify-start"
                        role="group"
                        aria-labelledby="inline-email-otp-label"
                        aria-describedby="inline-email-otp-description"
                      >
                        <InputOTP
                          id="inline-email-otp-input"
                          maxLength={6}
                          pattern={REGEXP_ONLY_DIGITS}
                          inputMode="numeric"
                          value={otp}
                          onChange={(value) => {
                            setOtp(value);
                            setOtpError("");
                          }}
                          disabled={isVerifying}
                          aria-label="Enter 6-digit email verification code"
                          aria-required="true"
                          aria-invalid={otpError ? "true" : "false"}
                          aria-describedby="inline-email-otp-description"
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

                      {/* Screen reader description */}
                      <p id="inline-email-otp-description" className="sr-only">
                        Enter the 6-digit verification code sent to your new
                        email address. Each box represents one digit.
                      </p>

                      {/* Status updates for screen readers */}
                      <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className="sr-only"
                      >
                        {isVerifying && "Verifying your code, please wait"}
                        {isResending && "Resending verification code"}
                        {otpError && `Error: ${otpError}`}
                      </div>

                      {/* Visual error message */}
                      {otpError && (
                        <p className="text-sm text-red-600" role="alert">
                          {otpError}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={isVerifying || otp.length !== 6}
                          size="sm"
                          aria-label={
                            isVerifying
                              ? "Verifying code, please wait"
                              : "Verify code"
                          }
                          aria-busy={isVerifying}
                        >
                          {isVerifying ? "Verifying..." : "Verify Code"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResendEmail}
                          disabled={isResending}
                          aria-label={
                            isResending
                              ? "Resending code, please wait"
                              : "Resend verification code"
                          }
                          aria-busy={isResending}
                        >
                          {isResending ? "Resending..." : "Resend Code"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowOtpInput(false);
                            setOtp("");
                            setOtpError("");
                            setIsVerified(false);
                            setNewEmail(currentEmail);
                          }}
                          disabled={isVerifying}
                          aria-label="Cancel email change"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Pending email info when OTP input is not shown */}
            {pendingEmail && !showOtpInput && !isVerified && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div>
                      <strong>Pending verification:</strong> {pendingEmail}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Check your email to verify this change. The code is valid
                      for 15 minutes.
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0 h-auto text-sm"
                      onClick={() => {
                        setShowOtpInput(true);
                        setOtp("");
                        setOtpError("");
                        setIsVerified(false);
                      }}
                    >
                      Enter verification code
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {!pendingEmail && !showOtpInput && !isVerified && (
              <p className="text-sm text-muted-foreground">
                A verification code will be sent to your new address. The code
                will be valid for 15 minutes.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-4">
            <Link href="/forgot-password">
              <Button variant="link" className="px-0">
                Change password?
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={saveState === "saving" || saveState === "saved"}
              className={`transition-all duration-300 ${
                saveState === "saved"
                  ? "bg-green-600 hover:bg-green-600"
                  : saveState === "saving"
                  ? "bg-muted text-muted-foreground hover:bg-muted"
                  : ""
              }`}
            >
              {saveState === "saving" && (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Saving...
                </span>
              )}
              {saveState === "saved" && (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Saved!
                </span>
              )}
              {saveState === "idle" && "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
