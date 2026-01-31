"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { getBillingFromJWT } from "@/utils/supabase/jwt";
import { PREMIUM_PATHS, UNLIMITED_PATHS } from "@/utils/billing/constants";
import { hasPremiumAccess, hasUnlimitedAccess } from "@/utils/billing/access";
import { clientLogger } from "@/lib/client-logger";

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
      clientLogger.debug("BillingSync: Skipped in local dev (Realtime not available)");
      return;
    }

    if (forceEnable && isLocalDev) {
      clientLogger.debug("BillingSync: Force-enabled in local dev for testing");
    }

    clientLogger.debug("BillingSync mounted", { userId });

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
            clientLogger.debug("Billing update detected, refreshing JWT...", {
              old: oldBillingVersion,
              new: newBillingVersion,
              plan: payload.new?.plan_selected,
              status: payload.new?.subscription_status,
            });

            try {
              clientLogger.debug("Detected billing update - refreshing session...");

              // Step 1: Refresh client-side session first
              const { data: clientData, error: clientError } = await supabase.auth.refreshSession();

              if (clientError || !clientData?.session) {
                clientLogger.error("Client-side JWT refresh failed", clientError || new Error("No session returned"));
                return;
              }

              clientLogger.debug("Client-side JWT refreshed");

              // Step 2: Force server-side cookie update via API route
              try {
                const response = await fetch("/api/auth/sync-session", {
                  method: "POST",
                });

                if (!response.ok) {
                  clientLogger.error("Server-side session sync failed", new Error(`Status: ${response.status}`));
                  // Continue anyway - client-side refresh may be enough
                } else {
                  const result = await response.json();
                  clientLogger.debug("Server-side session synced", { billing: result.billing });
                }
              } catch (fetchError) {
                clientLogger.error("Failed to call sync-session API", fetchError);
                // Continue anyway - client-side refresh may be enough
              }

              // Step 3: Check if user lost access while on a protected page
              const newBilling = getBillingFromJWT(clientData.session);
              const isOnPremiumPage = PREMIUM_PATHS.some((path) => pathname.startsWith(path));
              const isOnUnlimitedPage = UNLIMITED_PATHS.some((path) => pathname.startsWith(path));

              if (newBilling) {
                // Use shared access control logic (same as middleware)
                const userHasPremiumAccess = hasPremiumAccess(newBilling);
                const userHasUnlimitedAccess = hasUnlimitedAccess(newBilling);

                clientLogger.debug("Access check", {
                  hasPremiumAccess: userHasPremiumAccess,
                  hasUnlimitedAccess: userHasUnlimitedAccess,
                  isOnPremiumPage,
                  isOnUnlimitedPage,
                  plan: newBilling.plan,
                  status: newBilling.status
                });

                // Step 4: Redirect if access was revoked while on protected page
                // Check unlimited pages first (more restrictive)
                if (isOnUnlimitedPage && !userHasUnlimitedAccess) {
                  clientLogger.warn("Unlimited access revoked while on unlimited page - redirecting to /upgrade");
                  router.push("/upgrade?expired=true");
                  return; // Don't call router.refresh() - we're navigating
                }

                if (isOnPremiumPage && !userHasPremiumAccess) {
                  clientLogger.warn("Premium access revoked while on premium page - redirecting to /upgrade");
                  router.push("/upgrade?expired=true");
                  return; // Don't call router.refresh() - we're navigating
                }
              }

              // Step 5: Refresh server components to reflect new JWT
              router.refresh();

              clientLogger.info("Billing sync complete");
            } catch (err) {
              clientLogger.error("Error during billing sync", err);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clientLogger.debug("Subscribed to billing updates", { userId });
        } else if (status === "CHANNEL_ERROR") {
          clientLogger.error("Failed to subscribe to billing updates", undefined, { userId });
        }
      });

    // Cleanup on unmount
    return () => {
      clientLogger.debug("BillingSync unmounting", { userId });
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, router, pathname]);

  // No UI - this component is invisible
  return null;
}
