/**
 * Native analytics client — posthog-react-native behind the shared
 * `AnalyticsClient` seam from `@handicappin/analytics`. Mirrors the web
 * wrapper (apps/web/lib/analytics.ts).
 *
 * Fail-open: no `posthogApiKey` in the runtime env (the development EAS
 * profile deliberately leaves it unset) → silent no-op client, so CI,
 * simulators, and dev clients never emit events or errors. Config mirrors
 * web's cookieless-leaning stance: memory persistence, no autocapture, no
 * lifecycle events — explicit taxonomy events only.
 *
 * PII rule: `identify` takes the Supabase user id ONLY. Never put email,
 * name, or any other PII in identify or capture properties.
 */
import PostHog from "posthog-react-native";

import {
  createNoopClient,
  type AnalyticsClient,
} from "@handicappin/analytics";

import { env } from "@/lib/env";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

/** Exported for tests; app code should use the `analytics` singleton. */
export function createNativeAnalyticsClient(
  key: string | null,
): AnalyticsClient {
  if (!key) {
    return createNoopClient();
  }

  const posthog = new PostHog(key, {
    host: DEFAULT_POSTHOG_HOST,
    // Memory-only: no device storage, distinct id resets each launch until
    // identify() binds the Supabase user id (identified-only philosophy).
    persistence: "memory",
    captureAppLifecycleEvents: false,
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

/** App-wide singleton. */
export const analytics: AnalyticsClient = createNativeAnalyticsClient(
  env.posthogApiKey,
);
