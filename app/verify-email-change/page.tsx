"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Check, Loader2 } from "lucide-react";

function VerifyEmailChangeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email");

  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState(emailFromUrl || "");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [attempts, setAttempts] = useState(0);

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
        `${supabaseUrl}/functions/v1/verify-email-change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("success");
        setMessage("Email changed successfully! Redirecting...");

        // Redirect to profile after 2 seconds
        setTimeout(() => {
          router.push(`/profile/${data.user_id}?tab=personal&verified=true`);
        }, 2000);
      } else {
        setStatus("error");
        setMessage(
          data.error ||
            "Verification failed. Please check your code and try again."
        );

        // Clear OTP input on error
        setOtp("");

        if (attempts >= 4) {
          setMessage(
            data.error || "Too many failed attempts. Please request a new code."
          );
        }
      }
    } catch (error) {
      console.error("Verification error:", error);
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
      setOtp("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
        {status === "success" ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Email Changed!
            </h1>
            <p className="text-gray-600 text-center mb-6">{message}</p>
            <p className="text-sm text-gray-500 text-center">
              Redirecting you to your profile...
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Verify Email Change
              </h1>
              <p className="text-gray-600">
                Enter the 6-digit code we sent to your new email address
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Current Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@current-email.com"
                  disabled={status === "loading"}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Verification Code
                </label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    disabled={status === "loading"}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              {message && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    status === "error"
                      ? "bg-red-50 text-red-800"
                      : "bg-blue-50 text-blue-800"
                  }`}
                >
                  {message}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={status === "loading" || otp.length !== 6}
              >
                {status === "loading" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Verify Email Change
              </Button>
            </form>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>Tip:</strong> Check your new email address for the
                verification code. The code expires in 15 minutes.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailChangePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <VerifyEmailChangeContent />
    </Suspense>
  );
}
