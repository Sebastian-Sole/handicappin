/**
 * RevenueCat-shaped MOCK billing provider (decision ledger §1).
 *
 * Real state, mocked flows: `getCustomerInfo` reflects the user's actual
 * subscription read via tRPC (injected fetcher — keeps this module unit
 * testable with no network); `purchasePackage`/`restorePurchases` are
 * clearly-labelled dev no-ops that simply re-read the real state. Offerings
 * mirror the web upgrade page's plan lineup so the paywall renders something
 * truthful about what exists, with placeholder prices labelled as such.
 */
import type {
  BillingCustomerInfo,
  BillingEntitlement,
  BillingOfferings,
  BillingPackage,
  BillingProvider,
  SubscriptionState,
} from "@/lib/billing/types";

export type SubscriptionStateFetcher = (
  userId: string,
) => Promise<SubscriptionState>;

const MOCK_OFFERINGS: BillingOfferings = (() => {
  const packages: BillingPackage[] = [
    {
      identifier: "$rc_monthly",
      packageType: "MONTHLY",
      offeringIdentifier: "default",
      product: {
        identifier: "premium_monthly",
        title: "Premium",
        description: "Dashboard and calculators access",
        priceString: "$3.99/mo (mock)",
        currencyCode: "USD",
      },
    },
    {
      identifier: "$rc_annual",
      packageType: "ANNUAL",
      offeringIdentifier: "default",
      product: {
        identifier: "unlimited_annual",
        title: "Unlimited",
        description: "Unlimited rounds, dashboard, and calculators",
        priceString: "$29.99/yr (mock)",
        currencyCode: "USD",
      },
    },
    {
      identifier: "$rc_lifetime",
      packageType: "LIFETIME",
      offeringIdentifier: "default",
      product: {
        identifier: "lifetime",
        title: "Lifetime",
        description: "Everything, forever",
        priceString: "$79.99 (mock)",
        currencyCode: "USD",
      },
    },
  ];
  return {
    current: {
      identifier: "default",
      serverDescription: "Mock offering mirroring the web plan lineup",
      availablePackages: packages,
    },
    all: {
      default: {
        identifier: "default",
        serverDescription: "Mock offering mirroring the web plan lineup",
        availablePackages: packages,
      },
    },
  };
})();

/** Statuses that count as an active entitlement, matching web's access logic. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "free"]);

export function customerInfoFromSubscriptionState(
  state: SubscriptionState,
): BillingCustomerInfo {
  const planIsEntitled =
    state.plan !== null &&
    (state.plan === "lifetime" ||
      (state.status !== null && ACTIVE_STATUSES.has(state.status)));

  const entitlements: Record<string, BillingEntitlement> = {};
  const activeSubscriptions: string[] = [];

  if (planIsEntitled && state.plan) {
    const productIdentifier =
      state.plan === "lifetime" ? "lifetime" : `${state.plan}_plan`;
    entitlements[state.plan] = {
      identifier: state.plan,
      isActive: true,
      productIdentifier,
      expirationDate:
        state.plan === "lifetime" || state.currentPeriodEnd === null
          ? null
          : new Date(state.currentPeriodEnd * 1000).toISOString(),
      willRenew: !state.cancelAtPeriodEnd && state.plan !== "lifetime",
    };
    if (state.plan !== "lifetime" && state.plan !== "free") {
      activeSubscriptions.push(productIdentifier);
    }
  }

  return {
    originalAppUserId: state.userId,
    activeSubscriptions,
    entitlements: { active: entitlements },
    managementURL: null,
  };
}

export class MockBillingProvider implements BillingProvider {
  private appUserID: string | null = null;
  private readonly fetchSubscriptionState: SubscriptionStateFetcher;
  private readonly log: (message: string) => void;

  constructor(
    fetchSubscriptionState: SubscriptionStateFetcher,
    log: (message: string) => void = () => undefined,
  ) {
    this.fetchSubscriptionState = fetchSubscriptionState;
    this.log = log;
  }

  configure(options: { appUserID: string }): Promise<void> {
    this.appUserID = options.appUserID;
    this.log(`[billing-mock] configure(${options.appUserID})`);
    return Promise.resolve();
  }

  getOfferings(): Promise<BillingOfferings> {
    return Promise.resolve(MOCK_OFFERINGS);
  }

  async getCustomerInfo(): Promise<BillingCustomerInfo> {
    const state = await this.fetchSubscriptionState(this.requireUser());
    return customerInfoFromSubscriptionState(state);
  }

  /**
   * MOCKED purchase: no money moves, no backend write. Logs the intent and
   * returns the user's real (unchanged) state — the UI labels this as a dev
   * action. Real RevenueCat lands as a swap of `lib/billing/index.ts`.
   */
  async purchasePackage(
    pkg: BillingPackage,
  ): Promise<{ customerInfo: BillingCustomerInfo }> {
    this.log(
      `[billing-mock] purchasePackage(${pkg.identifier}) — mocked no-op, state unchanged`,
    );
    return { customerInfo: await this.getCustomerInfo() };
  }

  /** MOCKED restore: re-reads the real backend state. */
  async restorePurchases(): Promise<BillingCustomerInfo> {
    this.log("[billing-mock] restorePurchases — re-reading real state");
    return this.getCustomerInfo();
  }

  private requireUser(): string {
    if (!this.appUserID) {
      throw new Error(
        "MockBillingProvider used before configure() — call configure({appUserID}) after login",
      );
    }
    return this.appUserID;
  }
}
