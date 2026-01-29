"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@/utils/supabase/client";

type WebhookStatus = {
  status: "processing" | "success" | "delayed" | "failed";
  message: string;
  action: string | null;
  plan: string;
  failureCount: number;
  debug?: {
    recentEventCount: number;
    lastEventType: string;
    lastEventStatus: string;
  };
};

export default function BillingSuccessPage() {
  const [status, setStatus] = useState<
    "loading" | "processing" | "success" | "delayed" | "failed"
  >("loading");
  const [webhookData, setWebhookData] = useState<WebhookStatus | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    // Get session ID from URL params (passed from checkout redirect)
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get("session_id"));

    checkWebhookStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkWebhookStatus() {
    try {
      const supabase = createClientComponentClient();

      // Get current user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        console.log("⚠️ No user session - redirecting to login");
        const params = new URLSearchParams(window.location.search);
        const stripeSessionId = params.get("session_id");
        const returnUrl = `/billing/success${stripeSessionId ? `?session_id=${stripeSessionId}` : ""}`;
        window.location.href = `/login?returnTo=${encodeURIComponent(returnUrl)}`;
        return;
      }

      console.log("✅ User authenticated:", currentUser.id);
      setUserId(currentUser.id);

      console.log("🔄 Checking webhook status...");

      // Poll webhook status API (up to 20 seconds, every 2 seconds)
      const maxAttempts = 10;
      const pollInterval = 2000;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        setAttemptCount(attempt);
        console.log(
          `⏳ Polling webhook status (attempt ${attempt}/${maxAttempts})...`,
        );

        // Call webhook status API
        const response = await fetch("/api/billing/webhook-status");

        if (!response.ok) {
          console.error("Failed to fetch webhook status:", response.statusText);
          // Continue polling on API errors
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            continue;
          } else {
            // After max attempts, show delayed state
            setStatus("delayed");
            break;
          }
        }

        const data: WebhookStatus = await response.json();
        setWebhookData(data);

        console.log(`🔍 Webhook status (attempt ${attempt}):`, data);

        // Update UI state based on API response
        if (data.status === "success") {
          console.log(`✅ Subscription activated successfully!`);
          setStatus("success");

          // Wait 2 seconds to show success message
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Refresh session to update JWT claims before redirecting
          console.log("🔄 Refreshing session to update JWT claims...");

          // Step 1: Client-side refresh
          const { error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            // Local dev JWT refresh issues can be safely ignored
            // JWT will be refreshed automatically on next page load
            if (process.env.NODE_ENV === "development") {
              console.warn(
                "⚠️ Local dev: Session refresh failed (non-critical):",
                refreshError.message,
              );
            } else {
              console.error("Failed to refresh session:", refreshError);
            }
            // Continue anyway - JWT will refresh on navigation
          } else {
            console.log("✅ Client-side session refreshed successfully!");
          }

          // Step 2: Server-side cookie sync to ensure middleware gets updated JWT
          try {
            console.log("🔄 Syncing server-side session cookies...");
            const response = await fetch("/api/auth/sync-session", {
              method: "POST",
            });

            if (!response.ok) {
              console.error("❌ Server-side JWT sync failed:", response.status);
            } else {
              console.log("✅ Server-side session synced successfully!");
            }
          } catch (syncError) {
            console.error("❌ Failed to sync server-side session:", syncError);
            // Continue anyway - critical for user experience
          }

          // Wait 1 more second to ensure middleware picks up new claims
          await new Promise((resolve) => setTimeout(resolve, 1000));

          console.log("🚀 Redirecting to dashboard...");
          if (!currentUser) {
            console.error(
              "❌ No currentUser at redirect - this should not happen!",
            );
            window.location.href = "/";
            return;
          }
          window.location.href = `/`;
          return;
        } else if (data.status === "failed") {
          console.error(`❌ Webhook failed ${data.failureCount} times`);
          setStatus("failed");
          return;
        } else if (data.status === "delayed") {
          console.warn(`⚠️ Webhook delayed (${data.failureCount} failures)`);
          setStatus("delayed");
          // Don't return - keep showing delayed UI, let user decide
          return;
        } else {
          // Still processing
          setStatus("processing");
        }

        // If not the last attempt, wait before trying again
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
      }

      // After all attempts, if still processing, show delayed state
      if (status === "processing") {
        console.warn(
          "⚠️ Webhook not completed after 20 seconds - showing delayed state",
        );
        setStatus("delayed");
      }
    } catch (error) {
      console.error("Error checking webhook status:", error);

      // On error, show delayed state with support contact
      setStatus("delayed");
    }
  }

  // Allow user to manually re-check status
  const handleCheckAgain = () => {
    setStatus("loading");
    setAttemptCount(0);
    checkWebhookStatus();
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          {/* Loading State */}
          {status === "loading" && (
            <>
              <div className="text-6xl mb-4">⏳</div>
              <h1 className="text-4xl font-bold mb-4">Just a moment...</h1>
              <p className="text-lg text-gray-600">
                Checking your subscription status...
              </p>
            </>
          )}

          {/* Processing State (0-5 seconds) */}
          {status === "processing" && (
            <>
              <div className="text-6xl mb-4 animate-pulse">⏳</div>
              <h1 className="text-4xl font-bold mb-4">
                Activating Your Subscription
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                We&apos;re setting up your premium access...
              </p>
              <p className="text-sm text-gray-500">
                This usually takes just a few seconds. (Attempt {attemptCount}
                /10)
              </p>
            </>
          )}

          {/* Success State */}
          {status === "success" && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-4xl font-bold mb-4 text-green-600">
                Welcome to Premium!
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Your subscription is now active. You have access to all premium
                features.
              </p>
              <p className="text-sm text-gray-500">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {/* Delayed State (5-20 seconds, 1-2 failures) */}
          {status === "delayed" && (
            <>
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-4xl font-bold mb-4 text-amber-600">
                Almost There
              </h1>
              <p className="text-lg text-gray-600 mb-4">
                Your payment was successful! Activation is taking longer than
                usual.
              </p>
              <p className="text-base text-gray-600 mb-8">
                {webhookData?.action ||
                  "This usually resolves within a few minutes. Our system is working on it."}
              </p>

              <div className="space-y-4">
                <button
                  onClick={handleCheckAgain}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                >
                  Check Again
                </button>

                <Link
                  href={userId ? `/dashboard/${userId}` : "/"}
                  className="block w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
                >
                  Continue to Dashboard
                </Link>
              </div>

              <div className="mt-8 pt-8 border-t">
                <p className="text-sm text-gray-600">
                  Still waiting after 5 minutes?{" "}
                  <a
                    href={`mailto:sebastiansole@handicappin.com?subject=Subscription Activation Delayed&body=Session ID: ${
                      sessionId || "unknown"
                    }%0D%0AUser ID: ${userId || "unknown"}`}
                    className="text-blue-600 hover:underline"
                  >
                    Contact Support
                  </a>
                </p>
              </div>
            </>
          )}

          {/* Failed State (3+ failures) */}
          {status === "failed" && (
            <>
              <div className="text-6xl mb-4">❌</div>
              <h1 className="text-4xl font-bold mb-4 text-red-600">
                Activation Issue
              </h1>
              <p className="text-lg text-gray-700 mb-4">
                We encountered an issue activating your subscription.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>✓ Your payment was successful</strong>
                  <br />
                  Our team has been automatically notified and will resolve this
                  within 24 hours.
                </p>
              </div>

              <p className="text-base text-gray-600 mb-4">
                For immediate assistance, contact our support team:
              </p>

              {sessionId && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <p className="text-xs text-gray-500 mb-1">
                    Session ID (for support):
                  </p>
                  <p className="font-mono text-sm break-all">{sessionId}</p>
                </div>
              )}

              <div className="space-y-4">
                <a
                  href={`mailto:sebastiansole@handicappin.com?subject=Subscription Activation Issue&body=Session ID: ${
                    sessionId || "unknown"
                  }%0D%0AUser ID: ${
                    userId || "unknown"
                  }%0D%0A%0D%0APlease describe the issue:`}
                  className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition text-center"
                >
                  📧 Email Support
                </a>

                <button
                  onClick={handleCheckAgain}
                  className="w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
                >
                  Try Checking Again
                </button>

                <Link
                  href="/"
                  className="block w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition text-center"
                >
                  Return to Home
                </Link>
              </div>

              <div className="mt-8 pt-8 border-t">
                <p className="text-xs text-gray-500">
                  Support: sebastiansole@handicappin.com
                </p>
                {webhookData?.debug && (
                  <details className="mt-4 text-left">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                      Debug Info (for support)
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(webhookData.debug, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </>
          )}
        </div>

        {/* Always show navigation buttons (except on success state) */}
        {status !== "success" &&
          status !== "delayed" &&
          status !== "failed" && (
            <div className="space-y-4">
              <Link
                href={userId ? `/dashboard/${userId}` : "/"}
                className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/"
                className="block w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
              >
                Back to Home
              </Link>
            </div>
          )}
      </div>
    </div>
  );
}
