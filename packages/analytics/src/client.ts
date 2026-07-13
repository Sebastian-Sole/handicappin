/**
 * SDK-free analytics client seam. Each app builds a concrete implementation
 * over its own PostHog SDK (posthog-js on web, posthog-react-native on
 * native) and falls back to the no-op client when no API key is configured —
 * analytics is fail-open by design: never a runtime error, never dev noise.
 */
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";

export interface AnalyticsClient {
  /** Send one canonical event. Payload is type-checked against the taxonomy. */
  capture<E extends AnalyticsEventName>(
    event: E,
    properties: AnalyticsEventMap[E],
  ): void;
  /**
   * Bind subsequent events to a user. Supabase user id ONLY — never email,
   * name, or any other PII.
   */
  identify(userId: string): void;
  /** Unbind the user (logout). */
  reset(): void;
}

/** The fail-open fallback: every method is a silent no-op. */
export function createNoopClient(): AnalyticsClient {
  return {
    capture: () => undefined,
    identify: () => undefined,
    reset: () => undefined,
  };
}
