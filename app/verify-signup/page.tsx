"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Loader2 } from "lucide-react";

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
  const [attempts, setAttempts] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
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

    setStatus("loading");
    setAttempts((prev) => prev + 1);

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
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("success");
        setMessage("Email verified successfully! Redirecting...");

        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login?verified=true");
        }, 2000);
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
            data.error ||
              "Too many failed attempts. Please request a new code."
          );
          setRemainingAttempts(0);
        }
      }
    } catch (error) {
      console.error("Verification error:", error);
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
      setOtp("");
    }
  };

  const handleResend = async () => {
    if (!email) {
      setStatus("error");
      setMessage("Please enter your email address");
      return;
    }

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

        setTimeout(() => setStatus("idle"), 3000);
      } else if (response.status === 429 && data.waitSeconds) {
        // Rate limited - show countdown
        setStatus("error");
        setMessage(data.error || "Please wait before requesting another code.");
        setResendCooldown(data.waitSeconds);
      } else {
        setStatus("error");
        setMessage(
          data.error || "Failed to resend code. Please try again."
        );
      }
    } catch (error) {
      console.error("Resend error:", error);
      setStatus("error");
      setMessage("Failed to resend code. Please try again.");
    }
  };

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
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 block text-center">
                Verification Code
              </label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                  disabled={status === "loading" || status === "success"}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

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
            >
              {status === "loading" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {status === "success" && <Check className="mr-2 h-4 w-4" />}
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
