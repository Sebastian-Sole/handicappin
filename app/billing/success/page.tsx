"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@/utils/supabase/client";

export default function BillingSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function refreshClaims() {
      try {
        // Get current user
        const supabase = createClientComponentClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        // Refresh JWT claims immediately to collapse staleness window
        console.log("🔄 Refreshing JWT claims after checkout...");
        const response = await fetch("/api/auth/refresh-claims", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to refresh claims");
        }

        const data = await response.json();
        console.log("✅ JWT claims refreshed:", data);

        setStatus("success");

        // Wait 2 seconds to show success message, then redirect
        setTimeout(() => {
          router.push(`/dashboard/${user.id}`);
          router.refresh(); // Force Next.js to re-run middleware
        }, 2000);
      } catch (error) {
        console.error("Failed to refresh claims:", error);
        // Continue anyway - claims will refresh naturally within ~1 hour
        setStatus("success");
        setTimeout(() => {
          if (userId) {
            router.push(`/dashboard/${userId}`);
            router.refresh();
          }
        }, 2000);
      }
    }

    refreshClaims();
  }, [router, userId]);

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

          {status === "error" && (
            <>
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-4xl font-bold mb-4">Almost There!</h1>
              <p className="text-lg text-gray-600 mb-8">
                Your subscription is being processed. You&apos;ll have access within
                a few minutes.
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
