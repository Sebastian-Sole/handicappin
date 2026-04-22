"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@/utils/supabase/client";
import { clientLogger } from "@/lib/client-logger";
import { Button } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";

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

  const checkWebhookStatus = useCallback(async () => {
    // Track status locally to avoid stale closure issues with React state
    let currentStatus:
      | "loading"
      | "processing"
      | "success"
      | "delayed"
      | "failed" = "loading";

    try {
      const supabase = createClientComponentClient();

      // Get current user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        clientLogger.debug("No user session - redirecting to login");
        const params = new URLSearchParams(window.location.search);
        const stripeSessionId = params.get("session_id");
        const returnUrl = `/billing/success${stripeSessionId ? `?session_id=${stripeSessionId}` : ""}`;
        window.location.href = `/login?returnTo=${encodeURIComponent(returnUrl)}`;
        return;
      }

      clientLogger.debug("User authenticated", { userId: currentUser.id });
      setUserId(currentUser.id);

      clientLogger.debug("Checking webhook status...");

      // Poll webhook status API (up to 20 seconds, every 2 seconds)
      const maxAttempts = 10;
      const pollInterval = 2000;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        setAttemptCount(attempt);
        clientLogger.debug("Polling webhook status", { attempt, maxAttempts });

        // Call webhook status API
        const response = await fetch("/api/billing/webhook-status");

        if (!response.ok) {
          clientLogger.error(
            "Failed to fetch webhook status",
            new Error(response.statusText),
          );
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

        clientLogger.debug("Webhook status received", {
          attempt,
          status: data.status,
        });

        // Update UI state based on API response
        if (data.status === "success") {
          clientLogger.info("Subscription activated successfully");
          currentStatus = "success";
          setStatus("success");

          // Wait 2 seconds to show success message
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Refresh session to update JWT claims before redirecting
          clientLogger.debug("Refreshing session to update JWT claims...");

          // Step 1: Client-side refresh
          const { error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            // Local dev JWT refresh issues can be safely ignored
            // JWT will be refreshed automatically on next page load
            clientLogger.warn("Session refresh failed (non-critical)", {
              error: refreshError.message,
            });
            // Continue anyway - JWT will refresh on navigation
          } else {
            clientLogger.debug("Client-side session refreshed successfully");
          }

          // Step 2: Server-side cookie sync to ensure middleware gets updated JWT
          try {
            clientLogger.debug("Syncing server-side session cookies...");
            const response = await fetch("/api/auth/sync-session", {
              method: "POST",
            });

            if (!response.ok) {
              clientLogger.error(
                "Server-side JWT sync failed",
                new Error(`Status: ${response.status}`),
              );
            } else {
              clientLogger.debug("Server-side session synced successfully");
            }
          } catch (syncError) {
            clientLogger.error("Failed to sync server-side session", syncError);
            // Continue anyway - critical for user experience
          }

          // Wait 1 more second to ensure middleware picks up new claims
          await new Promise((resolve) => setTimeout(resolve, 1000));

          clientLogger.debug("Redirecting...");
          if (!currentUser) {
            clientLogger.error(
              "No currentUser at redirect - this should not happen",
            );
            window.location.href = "/";
            return;
          }
          window.location.href = `/`;
          return;
        } else if (data.status === "failed") {
          clientLogger.error(
            "Webhook failed",
            new Error("Webhook processing failed"),
            { failureCount: data.failureCount },
          );
          currentStatus = "failed";
          setStatus("failed");
          return;
        } else if (data.status === "delayed") {
          clientLogger.warn("Webhook delayed", {
            failureCount: data.failureCount,
          });
          currentStatus = "delayed";
          setStatus("delayed");
          // Don't return - keep showing delayed UI, let user decide
          return;
        } else {
          // Still processing
          currentStatus = "processing";
          setStatus("processing");
        }

        // If not the last attempt, wait before trying again
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
      }

      // After all attempts, if still processing, show delayed state
      if (currentStatus === "processing") {
        clientLogger.warn(
          "Webhook not completed after 20 seconds - showing delayed state",
        );
        setStatus("delayed");
      }
    } catch (error) {
      clientLogger.error("Error checking webhook status", error);

      // On error, show delayed state with support contact
      setStatus("delayed");
    }
  }, []);

  useEffect(() => {
    // Get session ID from URL params (passed from checkout redirect)
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial URL param read, runs once on mount
    setSessionId(params.get("session_id"));

    checkWebhookStatus();
  }, [checkWebhookStatus]);

  // Allow user to manually re-check status
  const handleCheckAgain = () => {
    setStatus("loading");
    setAttemptCount(0);
    checkWebhookStatus();
  };

  return (
    <div className="sm:container mx-auto px-md py-3xl">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-xl">
          {/* Loading State */}
          {status === "loading" && (
            <>
              <div className="text-6xl mb-md">⏳</div>
              <H1 className="text-4xl mb-md">Just a moment...</H1>
              <p className="text-lg text-muted-foreground">
                Checking your subscription status...
              </p>
            </>
          )}

          {/* Processing State (0-5 seconds) */}
          {status === "processing" && (
            <>
              <div className="text-6xl mb-md animate-pulse">⏳</div>
              <H1 className="text-4xl mb-md">
                Activating Your Subscription
              </H1>
              <p className="text-lg text-muted-foreground mb-xl">
                We&apos;re setting up your premium access...
              </p>
              <p className="text-sm text-muted-foreground">
                This usually takes just a few seconds. (Attempt {attemptCount}
                /10)
              </p>
            </>
          )}

          {/* Success State */}
          {status === "success" && (
            <>
              <div className="text-6xl mb-md">✅</div>
              <H1 className="text-4xl mb-md text-success">
                Welcome to Premium!
              </H1>
              <p className="text-lg text-muted-foreground mb-xl">
                Your subscription is now active. You have access to all premium
                features.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to homepage...
              </p>
            </>
          )}

          {/* Delayed State (5-20 seconds, 1-2 failures) */}
          {status === "delayed" && (
            <>
              <div className="text-6xl mb-md">⚠️</div>
              <H1 className="text-4xl mb-md text-warning">
                Almost There
              </H1>
              <p className="text-lg text-muted-foreground mb-md">
                Your payment was successful! Activation is taking longer than
                usual.
              </p>
              <p className="text-base text-muted-foreground mb-xl">
                {webhookData?.action ||
                  "This usually resolves within a few minutes. Our system is working on it."}
              </p>

              <div className="space-y-md">
                <Button
                  onClick={handleCheckAgain}
                  size="lg"
                  className="w-full"
                >
                  Check Again
                </Button>

                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/">Continue to Dashboard</Link>
                </Button>
              </div>

              <div className="mt-xl pt-xl border-t">
                <p className="text-sm text-muted-foreground">
                  Still waiting after 5 minutes?{" "}
                  <a
                    href={`mailto:sebastiansole@handicappin.com?subject=Subscription Activation Delayed&body=Session ID: ${sessionId || "unknown"
                      }%0D%0AUser ID: ${userId || "unknown"}`}
                    className="text-info hover:underline"
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
              <div className="text-6xl mb-md">❌</div>
              <H1 className="text-4xl mb-md text-destructive">
                Activation Issue
              </H1>
              <p className="text-lg text-foreground mb-md">
                We encountered an issue activating your subscription.
              </p>

              <div className="tint-info p-md mb-lg">
                <p className="text-sm text-info">
                  <strong>✓ Your payment was successful</strong>
                  <br />
                  Our team has been automatically notified and will resolve this
                  within 24 hours.
                </p>
              </div>

              <p className="text-base text-muted-foreground mb-md">
                For immediate assistance, contact our support team:
              </p>

              {sessionId && (
                <div className="surface-muted border p-md mb-lg">
                  <p className="text-xs text-muted-foreground mb-xs">
                    Session ID (for support):
                  </p>
                  <p className="font-mono text-sm break-all">{sessionId}</p>
                </div>
              )}

              <div className="space-y-md">
                <Button asChild size="lg" className="w-full">
                  <a
                    href={`mailto:sebastiansole@handicappin.com?subject=Subscription Activation Issue&body=Session ID: ${sessionId || "unknown"
                      }%0D%0AUser ID: ${userId || "unknown"
                      }%0D%0A%0D%0APlease describe the issue:`}
                  >
                    Email Support
                  </a>
                </Button>

                <Button
                  onClick={handleCheckAgain}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  Try Checking Again
                </Button>

                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/">Return to Home</Link>
                </Button>
              </div>

              <div className="mt-xl pt-xl border-t">
                <p className="text-xs text-muted-foreground">
                  Support: sebastiansole@handicappin.com
                </p>
                {webhookData?.debug && (
                  <details className="mt-md text-left">
                    <summary className="text-xs text-muted-foreground/70 cursor-pointer hover:text-muted-foreground">
                      Debug Info (for support)
                    </summary>
                    <pre className="mt-sm text-xs bg-muted p-sm rounded overflow-auto">
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
            <div className="space-y-md">
              <Button asChild size="lg" className="w-full">
                <Link href="/">Go to Dashboard</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
