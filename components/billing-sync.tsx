"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { getBillingFromJWT } from "@/utils/supabase/jwt";
import { useToast } from "@/components/ui/use-toast";
import { PREMIUM_PATHS } from "@/utils/billing/constants";
import { hasPremiumAccess } from "@/utils/billing/access";

/**
 * Background component that listens for billing changes via Supabase Realtime
 * and triggers JWT refresh when billing_version increments.
 *
 * Mounted in root layout for all authenticated users.
 * Handles its own auth detection - no props required.
 * No UI - purely functional.
 */
export function BillingSync() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  // Detect authenticated user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };

    getUser();
  }, [supabase]);

  useEffect(() => {
    // Only proceed if we have a userId
    if (!userId) {
      return;
    }

    // Skip in local development if using local Supabase without Realtime
    // Can be overridden with NEXT_PUBLIC_ENABLE_BILLING_SYNC=true for testing
    const isLocalDev = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1');
    const forceEnable = process.env.NEXT_PUBLIC_ENABLE_BILLING_SYNC === 'true';

    if (isLocalDev && !forceEnable) {
      console.log(`🔄 BillingSync: Skipped in local dev (Realtime not available)`);
      console.log(`💡 To enable for testing, set NEXT_PUBLIC_ENABLE_BILLING_SYNC=true`);
      return;
    }

    if (forceEnable && isLocalDev) {
      console.log(`🔄 BillingSync: Force-enabled in local dev for testing`);
    }

    console.log(`🔄 BillingSync mounted for user ${userId}`);

    // Subscribe to profile changes for this user
    const channel = supabase
      .channel(`billing-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profile",
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          // Only refresh if billing_version changed (ignore other profile updates)
          const newBillingVersion = payload.new?.billing_version;
          const oldBillingVersion = payload.old?.billing_version;

          if (
            newBillingVersion !== undefined &&
            oldBillingVersion !== undefined &&
            newBillingVersion !== oldBillingVersion
          ) {
            console.log(
              "🔄 Billing update detected, refreshing JWT...",
              {
                old: oldBillingVersion,
                new: newBillingVersion,
                plan: payload.new?.plan_selected,
                status: payload.new?.subscription_status,
              }
            );

            try {
              console.log("🔄 Detected billing update - refreshing session...");

              // Step 1: Refresh client-side session first
              const { data: clientData, error: clientError } = await supabase.auth.refreshSession();

              if (clientError || !clientData?.session) {
                console.error("❌ Client-side JWT refresh failed:",
                  clientError || "No session returned");
                return;
              }

              console.log("✅ Client-side JWT refreshed");

              // Step 2: Force server-side cookie update via API route
              try {
                const response = await fetch("/api/auth/sync-session", {
                  method: "POST",
                });

                if (!response.ok) {
                  console.error("❌ Server-side session sync failed:", response.status);
                  // Continue anyway - client-side refresh may be enough
                } else {
                  const result = await response.json();
                  console.log("✅ Server-side session synced, new billing:", result.billing);
                }
              } catch (fetchError) {
                console.error("❌ Failed to call sync-session API:", fetchError);
                // Continue anyway - client-side refresh may be enough
              }

              // Step 3: Check if user lost premium access while on a premium page
              const newBilling = getBillingFromJWT(clientData.session);
              const isOnPremiumPage = PREMIUM_PATHS.some((path) => pathname.startsWith(path));

              if (newBilling) {
                // Use shared access control logic (same as middleware)
                const userHasPremiumAccess = hasPremiumAccess(newBilling);

                console.log("🔐 Access check:", {
                  hasPremiumAccess: userHasPremiumAccess,
                  isOnPremiumPage,
                  plan: newBilling.plan,
                  status: newBilling.status
                });

                // Step 4: Redirect if access was revoked while on premium page
                if (isOnPremiumPage && !userHasPremiumAccess) {
                  console.warn("⚠️ Access revoked while on premium page - redirecting to /upgrade");

                  toast({
                    title: "Subscription Expired",
                    description: "Your premium access has ended. Please upgrade to continue.",
                    variant: "destructive",
                  });

                  // Redirect to upgrade page
                  router.push("/upgrade");
                  return; // Don't call router.refresh() - we're navigating
                }
              }

              // Step 5: Refresh server components to reflect new JWT
              router.refresh();

              console.log("✅ Billing sync complete");
            } catch (err) {
              console.error("❌ Error during billing sync:", err);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`✅ Subscribed to billing updates for user ${userId}`);
        } else if (status === "CHANNEL_ERROR") {
          console.error(`❌ Failed to subscribe to billing updates for user ${userId}`);
        }
      });

    // Cleanup on unmount
    return () => {
      console.log(`🔄 BillingSync unmounting for user ${userId}`);
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, router, pathname, toast]);

  // No UI - this component is invisible
  return null;
}
