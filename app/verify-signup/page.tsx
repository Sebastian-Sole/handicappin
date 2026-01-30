"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Loader2 } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

// Delay constants for UX timing
const REDIRECT_DELAY_MS = 2000;
const STATUS_RESET_DELAY_MS = 3000;

function VerifySignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email");

  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState(emailFromUrl || "");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );
  const [resendCooldown, setResendCooldown] = useState(0);

  // Refs for cleanup to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      // Abort any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clear any pending timeouts
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (statusResetTimeoutRef.current) {
        clearTimeout(statusResetTimeoutRef.current);
      }
    };
  }, []);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !otp) {
      setStatus("error");
      setMessage("Please enter both email and verification code");
      return;
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setStatus("error");
      setMessage("Verification code must be 6 digits");
      return;
    }

    // Abort any previous request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStatus("loading");

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error("Configuration error");
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/verify-signup-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
          signal: abortControllerRef.current.signal,
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("success");
        setMessage(
          data.message || "Email verified successfully! Redirecting to login..."
        );
        // Store timeout ref for cleanup on unmount
        redirectTimeoutRef.current = setTimeout(
          () => router.push("/login?verified=true"),
          REDIRECT_DELAY_MS
        );
      } else {
        setStatus("error");
        setMessage(
          data.error ||
            "Verification failed. Please check your code and try again."
        );

        // Update remaining attempts from backend
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }

        // Clear OTP input on error
        setOtp("");

        // If max attempts reached, focus on resend button
        if (data.maxAttemptsReached) {
          setMessage(
            data.error || "Too many failed attempts. Please request a new code."
          );
          setRemainingAttempts(0);
        }
      }
    } catch (error) {
      // Don't update state if request was aborted (component unmounting or new request)
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      Sentry.captureException(error, {
        tags: { feature: "otp_verification" },
      });
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
      setOtp("");
    }
  }, [email, otp, router]);

  const handleResend = useCallback(async () => {
    if (!email) {
      setStatus("error");
      setMessage("Please enter your email address");
      return;
    }

    // Abort any previous request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStatus("loading");

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error("Configuration error");
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/resend-verification-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          signal: abortControllerRef.current.signal,
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("success");
        setMessage(
          data.message || "A new verification code has been sent to your email."
        );
        setRemainingAttempts(null); // Reset attempts with new code
        setOtp("");

        // Store timeout ref for cleanup on unmount
        statusResetTimeoutRef.current = setTimeout(
          () => setStatus("idle"),
          STATUS_RESET_DELAY_MS
        );
      } else if (response.status === 429 && data.waitSeconds) {
        // Rate limited - show countdown
        setStatus("error");
        setMessage(data.error || "Please wait before requesting another code.");
        setResendCooldown(data.waitSeconds);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to resend code. Please try again.");
      }
    } catch (error) {
      // Don't update state if request was aborted (component unmounting or new request)
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      Sentry.captureException(error, {
        tags: { feature: "otp_resend" },
      });
      setStatus("error");
      setMessage("Failed to resend code. Please try again.");
    }
  }, [email]);

  return (
    <div className="flex-1 flex justify-center items-center flex-col py-2 md:py-4 lg:py-8">
      <Card className="w-[90%] max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            Enter the 6-digit code we sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={status === "loading" || status === "success"}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                id="otp-label"
                htmlFor="otp-input"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 block text-center"
              >
                Verification Code
              </label>
              <div
                className="flex justify-center"
                role="group"
                aria-labelledby="otp-label"
                aria-describedby="otp-description otp-hint"
              >
                <InputOTP
                  id="otp-input"
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  value={otp}
                  onChange={(value) => setOtp(value)}
                  disabled={status === "loading" || status === "success"}
                  aria-label="Enter 6-digit verification code"
                  aria-required="true"
                  aria-invalid={status === "error" ? "true" : "false"}
                  aria-describedby="otp-description"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} aria-label="Digit 1 of 6" />
                    <InputOTPSlot index={1} aria-label="Digit 2 of 6" />
                    <InputOTPSlot index={2} aria-label="Digit 3 of 6" />
                  </InputOTPGroup>
                  <InputOTPSeparator aria-hidden="true" />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} aria-label="Digit 4 of 6" />
                    <InputOTPSlot index={4} aria-label="Digit 5 of 6" />
                    <InputOTPSlot index={5} aria-label="Digit 6 of 6" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* Screen reader description */}
              <p id="otp-description" className="sr-only">
                Enter the 6-digit verification code sent to your email address.
                Each box represents one digit.
              </p>

              {/* Hint text (visible to all) */}
              <p id="otp-hint" className="text-xs text-gray-500 text-center mt-1">
                Check your spam folder if you don&apos;t see the email
              </p>
            </div>

            {/* Status updates for screen readers */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {status === "loading" && "Verifying your code, please wait"}
              {status === "success" &&
                "Verification successful! Redirecting you now"}
              {status === "error" && message}
            </div>

            {/* Visual error/success message */}
            {message && (
              <Alert variant={status === "error" ? "destructive" : "default"}>
                <AlertDescription>
                  {message}
                  {remainingAttempts !== null &&
                    remainingAttempts > 0 &&
                    status === "error" && (
                      <div className="mt-2 text-sm">
                        {remainingAttempts}{" "}
                        {remainingAttempts === 1 ? "attempt" : "attempts"}{" "}
                        remaining
                      </div>
                    )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                status === "loading" || status === "success" || otp.length !== 6
              }
              aria-label={
                status === "loading"
                  ? "Verifying email, please wait"
                  : status === "success"
                    ? "Email verified successfully"
                    : "Verify email"
              }
              aria-busy={status === "loading"}
            >
              {status === "loading" && (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Verifying your email, please wait</span>
                </>
              )}
              {status === "success" && (
                <>
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Email verified successfully</span>
                </>
              )}
              Verify Email
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={handleResend}
                disabled={
                  status === "loading" ||
                  status === "success" ||
                  resendCooldown > 0
                }
                aria-label={
                  resendCooldown > 0
                    ? `Wait ${resendCooldown} seconds before requesting another code`
                    : "Resend verification code"
                }
              >
                {resendCooldown > 0
                  ? `Wait ${resendCooldown}s to resend`
                  : "Didn't receive a code? Resend"}
              </Button>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                <strong>Tip:</strong> Check your spam folder if you don&apos;t
                see the email. The code expires in 15 minutes.
              </AlertDescription>
            </Alert>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifySignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <VerifySignupContent />
    </Suspense>
  );
}
