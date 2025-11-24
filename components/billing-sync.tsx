"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Background component that listens for billing changes via Supabase Realtime
 * and triggers JWT refresh when billing_version increments.
 *
 * Mounted in root layout, detects auth state client-side.
 * No UI - purely functional.
 */
export function BillingSync() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
    });
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    // Skip in local development if using local Supabase without Realtime
    const isLocalDev = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1');

    if (isLocalDev) {
      console.log(`🔄 BillingSync: Skipped in local dev (Realtime not available)`);
      return;
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
              // Force JWT refresh to get new billing claims
              const { data, error } = await supabase.auth.refreshSession();

              if (error) {
                console.error("❌ JWT refresh failed:", error);
                return;
              }

              if (data.session) {
                console.log("✅ JWT refreshed with new billing data");

                // Refresh server components to reflect new JWT claims
                router.refresh();
              }
            } catch (err) {
              console.error("❌ Error during JWT refresh:", err);
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
  }, [userId, supabase, router]);

  // No UI - this component is invisible
  return null;
}
