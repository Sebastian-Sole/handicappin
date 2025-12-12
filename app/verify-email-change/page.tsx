"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Check, X, Loader2 } from "lucide-react";

function VerifyEmailChangeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    async function verifyEmail() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const response = await fetch(
          `${supabaseUrl}/functions/v1/verify-email-change`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
          setMessage(
            data.message || "Email address updated successfully!"
          );
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed");
        }
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        setMessage("An unexpected error occurred. Please try again.");
      }
    }

    verifyEmail();
  }, [token, router]);

  // Redirect after success with cleanup
  useEffect(() => {
    if (status !== "success") return;

    const timeoutId = setTimeout(() => {
      router.push("/profile?tab=personal");
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
        {status === "loading" && (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Verifying Your Email
            </h1>
            <p className="text-gray-600 text-center">
              Please wait while we verify your new email address...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Email Verified!
            </h1>
            <p className="text-gray-600 text-center mb-6">{message}</p>
            <p className="text-sm text-gray-500 text-center mb-4">
              Redirecting you to your profile...
            </p>
            <div className="text-center">
              <Link href="/profile?tab=personal">
                <Button>Go to Profile Now</Button>
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <X className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Verification Failed
            </h1>
            <p className="text-gray-600 text-center mb-6">{message}</p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Common reasons:</strong>
              </p>
              <ul className="text-sm text-gray-600 list-disc pl-4 space-y-1">
                <li>The verification link has expired (48 hours)</li>
                <li>The link has already been used</li>
                <li>The email change was cancelled</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link href="/profile?tab=personal" className="block">
                <Button className="w-full">Request New Email Change</Button>
              </Link>
              <Link href="/profile" className="block">
                <Button variant="outline" className="w-full">
                  Return to Profile
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailChangePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
          <div className="flex justify-center mb-4">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Loading...
          </h1>
        </div>
      </div>
    }>
      <VerifyEmailChangeContent />
    </Suspense>
  );
}
