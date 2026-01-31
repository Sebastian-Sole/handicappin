"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/utils/supabase/client";
import { clientLogger } from "@/lib/client-logger";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds between retries

type VerificationState = "verifying" | "retrying" | "failed" | "error";

interface VerifySessionContentProps {
  userId: string;
  returnTo: string;
  initialError?: string;
}

export function VerifySessionContent({
  userId,
  returnTo,
  initialError,
}: VerifySessionContentProps) {
  const router = useRouter();
  const [state, setState] = useState<VerificationState>("verifying");
  const [attemptCount, setAttemptCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError || null,
  );

  useEffect(() => {
    async function verifySession() {
      const supabase = createClientComponentClient();

      try {
        // Force session refresh to re-run JWT hook
        const { data, error } = await supabase.auth.refreshSession();

        // 🔍 DIAGNOSTIC: Check if profile exists in database
        try {
          const { data: profileCheck, error: profileError } = await supabase
            .from("profile")
            .select(
              "id, plan_selected, subscription_status, current_period_end, billing_version",
            )
            .eq("id", userId)
            .single();

          if (profileError) {
            clientLogger.error("Profile query error", profileError);
          } else {
            if (!profileCheck.plan_selected) {
              clientLogger.warn("Profile exists but plan_selected is NULL - user needs onboarding");
            }
          }
        } catch (diagError) {
          clientLogger.error("Failed to check profile", diagError);
        }

        if (error) {
          clientLogger.error("Session refresh failed", error);
          throw error;
        }

        if (!data.session) {
          clientLogger.error("No session returned from refresh");
          throw new Error("No session returned");
        }

        // Check if billing claims are now present
        const billing = data.session.user.app_metadata?.billing;

        if (!billing) {
          clientLogger.warn("Billing claims still missing after refresh", { attempt: attemptCount + 1 });

          // Retry if we haven't exceeded max attempts
          if (attemptCount < MAX_RETRY_ATTEMPTS - 1) {
            setState("retrying");
            setAttemptCount(attemptCount + 1);
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            return; // useEffect will re-run due to attemptCount change
          } else {
            // Last attempt failed - try diagnostic database query
            clientLogger.error("JWT hook appears to be failing. Checking database directly for diagnosis...");

            try {
              const { data: profile, error: profileError } = await supabase
                .from("profile")
                .select(
                  "id, plan_selected, subscription_status, current_period_end, cancel_at_period_end, billing_version",
                )
                .eq("id", userId)
                .single();

              if (profileError) {
                clientLogger.error("Profile query failed - profile table might not have a row for this user", profileError);
              } else if (!profile) {
                clientLogger.error("No profile found for user - Missing profile row prevents JWT hook from populating claims", undefined, { userId });
              } else {
                clientLogger.debug("Profile exists in database", {
                  id: profile.id,
                  plan_selected: profile.plan_selected,
                  subscription_status: profile.subscription_status,
                  billing_version: profile.billing_version,
                });
                clientLogger.error("Profile exists but JWT hook isn't populating claims - check Supabase Auth Hooks configuration");
              }
            } catch (diagError) {
              clientLogger.error("Diagnostic query failed", diagError);
            }
            // Max retries exceeded
            // Metric: Failed verification
            clientLogger.error("Session verification failed", undefined, {
              userId,
              attemptCount: MAX_RETRY_ATTEMPTS,
              reason: "max_retries_exceeded",
            });

            setState("failed");
            setErrorMessage(
              "Unable to verify your session after multiple attempts. Please try logging in again.",
            );
            return;
          }
        }

        // Success! Claims are present
        clientLogger.info("Session verified successfully", {
          plan: billing.plan,
          status: billing.status,
          version: billing.billing_version,
        });

        // Metric: Successful verification
        clientLogger.info("Session verification success", {
          userId,
          attemptCount: attemptCount + 1,
        });

        // Check if user needs onboarding (no plan selected)
        if (!billing.plan || billing.plan === null) {
          clientLogger.debug("No plan selected, redirecting to onboarding");
          router.push("/onboarding");
        } else {
          clientLogger.debug("Redirecting", { returnTo });
          router.push(returnTo);
        }
        router.refresh(); // Force middleware to re-run
      } catch (error) {
        clientLogger.error("Verification error", error);

        // Retry if we haven't exceeded max attempts
        if (attemptCount < MAX_RETRY_ATTEMPTS - 1) {
          setState("retrying");
          setAttemptCount(attemptCount + 1);
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          // Max retries exceeded
          // Metric: Error during verification
          clientLogger.error("Session verification error", error, {
            userId,
            attemptCount: attemptCount + 1,
          });

          setState("error");
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
        }
      }
    }

    verifySession();
  }, [attemptCount, returnTo, router, userId]);

  // Handle logout on failure
  const handleLogout = async () => {
    const supabase = createClientComponentClient();
    await supabase.auth.signOut();
    router.push("/login?error=session_verification_failed");
  };

  return (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center">
        {/* Verifying State */}
        {state === "verifying" && (
          <>
            <div className="text-6xl mb-4 animate-spin">⏳</div>
            <h1 className="text-2xl font-bold mb-2">Verifying Your Session</h1>
            <p className="text-gray-600 mb-6">
              Please wait while we verify your account...
            </p>
            <div className="flex justify-center">
              <div className="animate-pulse flex space-x-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              </div>
            </div>
          </>
        )}

        {/* Retrying State */}
        {state === "retrying" && (
          <>
            <div className="text-6xl mb-4 animate-pulse">🔄</div>
            <h1 className="text-2xl font-bold mb-2">Retrying...</h1>
            <p className="text-gray-600 mb-2">
              Attempt {attemptCount + 1} of {MAX_RETRY_ATTEMPTS}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Having trouble verifying your session. Trying again...
            </p>
            <div className="flex justify-center">
              <div className="animate-pulse flex space-x-2">
                <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
              </div>
            </div>
          </>
        )}

        {/* Failed State (Max Retries) */}
        {state === "failed" && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <div className="space-y-3">
              <button
                onClick={handleLogout}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Sign In Again
              </button>
              <a
                href="mailto:sebastiansole@handicappin.com"
                className="block w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
              >
                Contact Support
              </a>
            </div>
          </>
        )}

        {/* Error State (Unexpected) */}
        {state === "error" && (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2">Something Went Wrong</h1>
            <p className="text-gray-600 mb-2">
              We encountered an error while verifying your session.
            </p>
            <p className="text-sm text-red-600 mb-6">{errorMessage}</p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setAttemptCount(0);
                  setState("verifying");
                }}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Try Again
              </button>
              <button
                onClick={handleLogout}
                className="w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
              >
                Sign In Again
              </button>
            </div>
          </>
        )}
      </div>

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 p-4 bg-gray-100 rounded text-xs text-left">
          <p className="font-mono mb-1">
            <strong>Debug Info:</strong>
          </p>
          <p className="font-mono">State: {state}</p>
          <p className="font-mono">
            Attempts: {attemptCount}/{MAX_RETRY_ATTEMPTS}
          </p>
          <p className="font-mono">Return To: {returnTo}</p>
          <p className="font-mono">User ID: {userId}</p>
          {initialError && (
            <p className="font-mono text-red-600">
              Initial Error: {initialError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
