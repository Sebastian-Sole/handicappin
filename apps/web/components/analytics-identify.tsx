"use client";

import { useEffect } from "react";
import { createClientComponentClient } from "@/utils/supabase/client";
import { analytics } from "@/lib/analytics";

/**
 * Binds analytics events to the logged-in user. Mounted in the root layout
 * next to BillingSync and mirrors its one-shot `getUser()` pattern (the
 * app's established client-side auth detection — deliberately NOT a second
 * `onAuthStateChange` listener; reviewer-approved shape for plan 009).
 *
 * With `persistence: "memory"` the PostHog distinct id resets on every full
 * page load, so a mount-time identify is exactly the required cadence.
 * Identify uses the Supabase user id ONLY — no email, no name, no PII.
 * Logout-side `reset()` lives at the signOut call site (logoutButton).
 *
 * No UI — purely functional.
 */
export function AnalyticsIdentify() {
  useEffect(() => {
    const supabase = createClientComponentClient();

    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!cancelled && user) {
          analytics.identify(user.id);
        }
      })
      .catch(() => {
        // Fail-open: analytics must never surface an auth error.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
