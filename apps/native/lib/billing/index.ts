/**
 * THE billing seam. Screens import `billing` from here and nothing else;
 * swapping the mock for the real `react-native-purchases` SDK is a change to
 * this file only (decision ledger §1).
 *
 * The mock reads the user's REAL subscription state through tRPC: the
 * profile row carries plan/status/period (kept fresh by the web's Stripe
 * webhooks), so what the native paywall/profile shows matches the backend.
 */
import { trpcQuery } from "@/lib/api/client";
import { profileSchema } from "@/lib/api/schemas/profile";
import { MockBillingProvider } from "@/lib/billing/mock-provider";
import type {
  BillingProvider,
  SubscriptionState,
} from "@/lib/billing/types";

async function fetchSubscriptionStateViaTrpc(
  userId: string,
): Promise<SubscriptionState> {
  const profile = await trpcQuery(
    "auth.getProfileFromUserId",
    userId,
    profileSchema,
  );
  return {
    userId: profile.id,
    plan: profile.plan_selected,
    status: profile.subscription_status,
    currentPeriodEnd: profile.current_period_end,
    cancelAtPeriodEnd: profile.cancel_at_period_end,
  };
}

export const billing: BillingProvider = new MockBillingProvider(
  fetchSubscriptionStateViaTrpc,
  (message) => {
    if (__DEV__) console.log(message); // allow-console dev-only mock telemetry
  },
);

export type { BillingProvider } from "@/lib/billing/types";
