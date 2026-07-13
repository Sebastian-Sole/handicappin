/**
 * Canonical product-analytics event taxonomy (v1).
 *
 * This is the ONE vocabulary shared by the web client, the native app, and
 * the server-side capture layer (posthog-node). Add new events HERE first —
 * reviewers should reject `capture("some_string")` literals at call sites.
 *
 * Naming rule: snake_case, past-tense verb, object first
 * ("round_submitted", not "submit_round").
 *
 * Ownership rule: no event fires from both sides. Events marked "server"
 * below are captured by server code (webhooks / tRPC procedures / route
 * handlers) and must NOT be duplicated client-side; the rest are UI-truth
 * events captured by the apps.
 */

export type AnalyticsPlan = "free" | "premium" | "unlimited" | "lifetime";

export type PaywallSurface =
  | "onboarding"
  | "upgrade_page"
  | "round_limit"
  | "stats_gate"
  | "native_paywall";

export type RoundEntryMethod = "manual" | "live";

/**
 * Event name → payload type. The payload shapes for server events mirror
 * exactly what the existing posthog-node call sites send.
 */
export interface AnalyticsEventMap {
  // --- auth (server: apps/web/app/auth/callback/route.ts) ---
  signed_up: { provider: string };
  logged_in: { provider: string; plan?: string };

  // --- plan & billing funnel ---
  /**
   * Plan pick on the onboarding paywall. Free picks are captured server-side
   * (apps/web/app/onboarding/actions.ts); paid picks fire from the clients.
   */
  plan_selected: { plan: AnalyticsPlan };
  paywall_viewed: { surface: PaywallSurface };
  upgrade_clicked: { plan?: AnalyticsPlan; surface: PaywallSurface };
  /** server: apps/web/server/api/routers/stripe.ts (createCheckout) */
  checkout_initiated: { plan: AnalyticsPlan; checkout_session_id: string };
  /** server: apps/web/lib/stripe-webhook-handlers/checkout-handlers.ts */
  subscription_started: {
    plan: string;
    billing_provider: "stripe";
    is_first_subscription: boolean;
    checkout_session_id: string;
  };
  /** server: apps/web/server/api/routers/stripe.ts (updateSubscription) */
  subscription_updated: { new_plan: string; change_type: string };
  /** server: apps/web/lib/stripe-webhook-handlers/subscription-handlers.ts */
  subscription_cancelled: {
    plan: string;
    billing_provider: "stripe";
    cancel_at_period_end: boolean;
  };
  /** server: apps/web/app/api/webhooks/revenuecat/route.ts */
  apple_subscription_started: {
    plan: string;
    billing_provider: "apple";
    event_type: string;
  };
  /** server: apps/web/app/api/webhooks/revenuecat/route.ts */
  apple_subscription_cancelled: { plan: string; billing_provider: "apple" };

  // --- rounds ---
  round_add_started: { method: RoundEntryMethod };
  /** server: apps/web/server/api/routers/round.ts (submitScorecard) */
  round_submitted: {
    round_id: number;
    holes_played: number;
    approval_status: string;
    course_is_new: boolean;
    score_differential: number | null;
    total_strokes: number;
  };
  /** The 25-round free-tier FORBIDDEN error surfaced to the user. */
  round_limit_hit: Record<string, never>;
  live_round_started: { holes: 9 | 18 };
  live_round_submitted: { holes: 9 | 18 };

  // --- engagement ---
  stats_viewed: { tab?: string };
  /** id from apps/web/lib/calculator-registry.ts */
  calculator_used: { calculator: string };

  // --- misc (server) ---
  /** server: apps/web/server/api/routers/contact.ts */
  contact_form_submitted: { subject: string };
  /** server: apps/web/server/api/routers/account.ts */
  account_deleted: { subscriptions_cancelled: number };
  /** server: apps/web/app/api/ai/extract-scorecard/route.ts */
  ai_scorecard_extracted: { mime_type: string };
  /** server: apps/web/app/api/legal/record-consent/route.ts */
  legal_consent_recorded: { acceptance_method: string; legal_version: string };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsEventProperties<E extends AnalyticsEventName> =
  AnalyticsEventMap[E];

/**
 * Event-name constants for call sites that talk to an SDK directly (the
 * posthog-node server layer). App code going through `AnalyticsClient`
 * can use string literals — they are type-checked against the map.
 */
export const ANALYTICS_EVENTS = {
  SIGNED_UP: "signed_up",
  LOGGED_IN: "logged_in",
  PLAN_SELECTED: "plan_selected",
  PAYWALL_VIEWED: "paywall_viewed",
  UPGRADE_CLICKED: "upgrade_clicked",
  CHECKOUT_INITIATED: "checkout_initiated",
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_UPDATED: "subscription_updated",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  APPLE_SUBSCRIPTION_STARTED: "apple_subscription_started",
  APPLE_SUBSCRIPTION_CANCELLED: "apple_subscription_cancelled",
  ROUND_ADD_STARTED: "round_add_started",
  ROUND_SUBMITTED: "round_submitted",
  ROUND_LIMIT_HIT: "round_limit_hit",
  LIVE_ROUND_STARTED: "live_round_started",
  LIVE_ROUND_SUBMITTED: "live_round_submitted",
  STATS_VIEWED: "stats_viewed",
  CALCULATOR_USED: "calculator_used",
  CONTACT_FORM_SUBMITTED: "contact_form_submitted",
  ACCOUNT_DELETED: "account_deleted",
  AI_SCORECARD_EXTRACTED: "ai_scorecard_extracted",
  LEGAL_CONSENT_RECORDED: "legal_consent_recorded",
} as const satisfies Record<string, AnalyticsEventName>;
