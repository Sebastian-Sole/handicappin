/**
 * Binds analytics events to the logged-in user — native twin of
 * apps/web/components/analytics-identify.tsx. Consumes the app's single
 * session source (SessionProvider) instead of adding another auth listener:
 * identify on session presence, reset when the session goes away (logout).
 * Supabase user id ONLY — no email, no name, no PII. No UI.
 */
import { useEffect, useRef } from "react";

import { analytics } from "@/lib/analytics";
import { useSession } from "@/lib/auth/session-provider";

export function AnalyticsIdentify() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (userId) {
      analytics.identify(userId);
    } else if (previousUserId.current) {
      analytics.reset();
    }
    previousUserId.current = userId;
  }, [userId]);

  return null;
}
