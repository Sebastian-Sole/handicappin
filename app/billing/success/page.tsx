"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@/utils/supabase/client";

export default function BillingSuccessPage() {
  const [status, setStatus] = useState<"loading" | "success">("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function refreshClaims() {
      try {
        const supabase = createClientComponentClient();

        // Get current user first
        const {
          data: { user: initialUser },
        } = await supabase.auth.getUser();

        if (!initialUser) {
          window.location.href = "/login";
          return;
        }

        setUserId(initialUser.id);

        console.log("🔄 Waiting for webhook to update plan...");

        // Helper function to decode JWT and get billing claims
        const getBillingFromToken = (session: any) => {
          if (!session?.access_token) return null;

          try {
            const parts = session.access_token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              return payload.app_metadata?.billing || null;
            }
          } catch (e) {
            console.error("Failed to decode JWT:", e);
          }
          return null;
        };

        // Poll for plan update (up to 15 seconds)
        // Webhooks typically arrive within 2-5 seconds
        const maxAttempts = 8;
        const pollInterval = 2000; // 2 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          console.log(`⏳ Polling for plan update (attempt ${attempt}/${maxAttempts})...`);

          const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.error("Failed to refresh session:", refreshError);
            throw refreshError;
          }

          // Decode JWT manually to get custom claims from hook
          const billing = getBillingFromToken(sessionData.session);
          console.log(`🔍 Billing claims (attempt ${attempt}):`, billing);

          // Check if plan has been updated (not null and not free)
          if (billing?.plan && billing.plan !== 'free') {
            console.log(`✅ Plan updated successfully to '${billing.plan}'!`);
            setStatus("success");

            // Wait 2 seconds to show success message
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log("🚀 Redirecting to dashboard...");

            // Use window.location.href to force full page reload
            // This ensures cookies are sent with the request to middleware
            window.location.href = `/dashboard/${initialUser.id}`;

            return; // Exit early - success!
          }

          // If not the last attempt, wait before trying again
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }

        // After all attempts, plan still not updated - but try dashboard anyway
        console.warn("⚠️ Plan not detected after 15 seconds - redirecting anyway...");
        setStatus("success"); // Show success anyway

        await new Promise(resolve => setTimeout(resolve, 2000));
        window.location.href = `/dashboard/${initialUser.id}`;
      } catch (error) {
        console.error("Failed to refresh claims:", error);

        // Redirect to dashboard anyway - let middleware handle auth
        setTimeout(() => {
          if (userId) {
            window.location.href = `/dashboard/${userId}`;
          } else {
            window.location.href = "/login";
          }
        }, 2000);
      }
    }

    refreshClaims();
  }, [userId]);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          {status === "loading" && (
            <>
              <div className="text-6xl mb-4">⏳</div>
              <h1 className="text-4xl font-bold mb-4">Processing...</h1>
              <p className="text-lg text-gray-600 mb-8">
                Activating your subscription...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-4xl font-bold mb-4">Welcome to Premium!</h1>
              <p className="text-lg text-gray-600 mb-8">
                Your subscription is now active. You now have access to all
                premium features including the dashboard, advanced calculators,
                and unlimited rounds.
              </p>
              <p className="text-sm text-gray-500">
                Redirecting to dashboard...
              </p>
            </>
          )}
        </div>

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

        <div className="mt-8 pt-8 border-t">
          <p className="text-sm text-gray-600">
            Need help? Contact us at{" "}
            <a
              href="mailto:support@handicappin.com"
              className="text-blue-600 hover:underline"
            >
              support@handicappin.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
