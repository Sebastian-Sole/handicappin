/**
 * Server-side capture helpers for the api-platform G2 events (plan 010 T12,
 * decision D9: G2 ships as server events only — no interest form, no
 * `api_access_interest` table, no client events).
 *
 * Spec: docs/research/api-platform/DEMAND_INSTRUMENTATION.md §3.3/§3.4.
 * Both events are server-owned (posthog-node via `getPostHogClient()`), and
 * both honour the hard PII rule: `distinctId` is the Supabase user id and
 * the property sets below are closed — never email, name, or free text.
 *
 * Fail-open: analytics must never break the request. `getPostHogClient()`
 * already no-ops without a token; these helpers additionally swallow any
 * capture/flush error.
 */
import { ANALYTICS_EVENTS } from "@handicappin/analytics";
import { getPostHogClient } from "@/lib/posthog";

/**
 * §3.3 `api_round_submitted` — the API-transport fact for a successful
 * `/v1` round write. This is NOT a second `round_submitted` (the shared
 * scorecard service owns that one, exactly once per round); it must fire
 * ONLY for `/v1`-originated writes, so its single intended call site is the
 * wave-2 route handler `apps/web/app/api/v1/rounds/route.ts` (T13), after
 * the shared service returns the created round:
 *
 *   await captureApiRoundSubmitted({ userId, consumer: clientId, quarantined, holesPlayed });
 *
 * Web/native submissions never reach this module — a unit test guards that
 * nothing under `apps/web/server/` references the event.
 */
export async function captureApiRoundSubmitted(args: {
  /** Supabase user id of the round owner — becomes `distinctId`. */
  userId: string;
  /** OAuth client_id of the calling consumer — attribution, not identity. */
  consumer: string;
  quarantined: boolean;
  holesPlayed: number;
}): Promise<void> {
  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: args.userId,
      event: ANALYTICS_EVENTS.API_ROUND_SUBMITTED,
      properties: {
        consumer: args.consumer,
        quarantined: args.quarantined,
        holes_played: args.holesPlayed,
      },
    });
    await posthog.flush();
  } catch {
    // Fail-open: analytics must never break the request.
  }
}

/**
 * §3.4 `api_connect_completed` — one Connect-flow completion ("how many
 * users connected fitbull"). Captured server-side from the tRPC procedure
 * `oauth.connectCompleted` after the grant is verified against GoTrue.
 */
export async function captureApiConnectCompleted(args: {
  /** Supabase user id of the granting user — becomes `distinctId`. */
  userId: string;
  /** OAuth client id of the connected consumer — attribution, not identity. */
  consumer: string;
}): Promise<void> {
  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: args.userId,
      event: ANALYTICS_EVENTS.API_CONNECT_COMPLETED,
      properties: {
        consumer: args.consumer,
      },
    });
    await posthog.flush();
  } catch {
    // Fail-open: analytics must never break the request.
  }
}
