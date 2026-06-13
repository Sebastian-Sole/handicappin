/**
 * THE billing seam. Screens import `billing` from here and nothing else.
 *
 * Provider selection (decision ledger D-seam): the factory keys off
 * EXPO_PUBLIC_REVENUECAT_IOS_API_KEY —
 *   - absent (CI, sim verification, key-less dev builds) → the
 *     RevenueCat-shaped MOCK: real subscription STATE via tRPC, purchase/
 *     restore flows surface a labelled dev notice;
 *   - present (owner builds, after RC console setup) → the real
 *     react-native-purchases SDK. The SDK module is required lazily so a
 *     key-less app never evaluates it.
 *
 * Either way the backend projection stays the entitlement source of truth
 * (D-arch) — the RC webhook feeds it; screens read it via tRPC.
 */
import { trpcQuery } from "@/lib/api/client";
import { profileSchema } from "@/lib/api/schemas/profile";
import { env } from "@/lib/env";
import { MockBillingProvider } from "@/lib/billing/mock-provider";
import {
  selectBillingProviderKind,
  type BillingProviderKind,
} from "@/lib/billing/select-provider";
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

function createBillingProvider(): {
  provider: BillingProvider;
  kind: BillingProviderKind;
} {
  const apiKey = env.revenueCatIosApiKey;
  if (apiKey && selectBillingProviderKind(apiKey) === "revenuecat") {
    // Lazy require keeps the SDK (a native module) out of the eval path for
    // key-less builds — they must boot without it (D-seam).
    const { RevenueCatBillingProvider } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/lib/billing/revenuecat-provider") as typeof import("@/lib/billing/revenuecat-provider");
    return {
      provider: new RevenueCatBillingProvider(apiKey),
      kind: "revenuecat",
    };
  }
  return {
    provider: new MockBillingProvider(fetchSubscriptionStateViaTrpc, (message) => {
      if (__DEV__) console.log(message); // allow-console dev-only mock telemetry
    }),
    kind: "mock",
  };
}

const selected = createBillingProvider();

export const billing: BillingProvider = selected.provider;
export const billingProviderKind: BillingProviderKind = selected.kind;

export type { BillingProviderKind } from "@/lib/billing/select-provider";
export type { BillingProvider } from "@/lib/billing/types";
