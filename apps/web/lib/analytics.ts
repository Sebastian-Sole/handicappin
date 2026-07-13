/**
 * Web analytics client — posthog-js behind the shared `AnalyticsClient`
 * seam from `@handicappin/analytics`.
 *
 * Fail-open by design: no `NEXT_PUBLIC_POSTHOG_KEY` (or a non-browser
 * runtime) → silent no-op client. Cookieless-leaning config: memory
 * persistence, identified-only person profiles, no autocapture, no session
 * recording, no automatic pageviews — explicit taxonomy events only.
 *
 * PII rule: `identify` takes the Supabase user id ONLY. Never put email,
 * name, or any other PII in identify or capture properties.
 */
import posthog from "posthog-js";
import {
  createNoopClient,
  type AnalyticsClient,
} from "@handicappin/analytics";
import { env } from "@/env";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

/**
 * Build the web analytics client. Exported for unit tests; app code should
 * use the `analytics` singleton below.
 */
export function createWebAnalyticsClient(
  key: string | undefined,
  host?: string,
): AnalyticsClient {
  if (!key || typeof window === "undefined") {
    return createNoopClient();
  }

  posthog.init(key, {
    api_host: host ?? DEFAULT_POSTHOG_HOST,
    persistence: "memory",
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
  });

  return {
    capture: (event, properties) => {
      posthog.capture(event, properties);
    },
    identify: (userId) => {
      posthog.identify(userId);
    },
    reset: () => {
      posthog.reset();
    },
  };
}

/** App-wide singleton. Safe to import from any client component. */
export const analytics: AnalyticsClient = createWebAnalyticsClient(
  env.NEXT_PUBLIC_POSTHOG_KEY,
  env.NEXT_PUBLIC_POSTHOG_HOST,
);
