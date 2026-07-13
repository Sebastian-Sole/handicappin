/**
 * Server-side PostHog singleton (posthog-node) — the capture layer for
 * revenue/lifecycle truth: webhooks, tRPC procedures, and route handlers.
 *
 * Fail-open: no `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` → a no-op client with the same
 * surface, so call sites never branch and never throw. Event names must
 * come from `ANALYTICS_EVENTS` in `@handicappin/analytics` — no string
 * literals at call sites.
 *
 * PII rule: `distinctId` is the Supabase user id; never put email or name
 * in properties.
 */
import { PostHog } from "posthog-node";
import { env } from "@/env";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

/** The subset of posthog-node the server capture sites use. */
export interface ServerAnalytics {
  capture(message: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): void;
  identify(message: {
    distinctId: string;
    properties?: Record<string, unknown>;
  }): void;
  captureException(error: unknown, distinctId?: string): void;
  flush(): Promise<void>;
}

const noopServerAnalytics: ServerAnalytics = {
  capture: () => undefined,
  identify: () => undefined,
  captureException: () => undefined,
  flush: () => Promise.resolve(),
};

let _posthog: ServerAnalytics | null = null;

export function getPostHogClient(): ServerAnalytics {
  if (!_posthog) {
    _posthog = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
      ? new PostHog(env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
          host: env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
          flushAt: 1,
          flushInterval: 0,
          enableExceptionAutocapture: true,
        })
      : noopServerAnalytics;
  }
  return _posthog;
}
