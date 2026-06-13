/**
 * Billing provider contract — shaped 1:1 after the `react-native-purchases`
 * (RevenueCat) surface the app will eventually adopt, so swapping the mock
 * for the real SDK is a one-module change in `lib/billing/index.ts`.
 *
 * Decision ledger: subscription STATE is real (read via tRPC from the user's
 * profile); purchase/restore FLOWS are mocked until the RevenueCat milestone.
 */
import type { PlanType, SubscriptionStatus } from "@/lib/api/schemas/profile";

export interface BillingProduct {
  identifier: string;
  title: string;
  description: string;
  priceString: string;
  currencyCode: string;
}

export type BillingPackageType = "MONTHLY" | "ANNUAL" | "LIFETIME" | "CUSTOM";

export interface BillingPackage {
  identifier: string;
  packageType: BillingPackageType;
  offeringIdentifier: string;
  product: BillingProduct;
}

export interface BillingOffering {
  identifier: string;
  serverDescription: string;
  availablePackages: BillingPackage[];
}

export interface BillingOfferings {
  current: BillingOffering | null;
  all: Record<string, BillingOffering>;
}

export interface BillingEntitlement {
  identifier: string;
  isActive: boolean;
  productIdentifier: string;
  /** ISO date string, null for lifetime. */
  expirationDate: string | null;
  willRenew: boolean;
}

export interface BillingCustomerInfo {
  originalAppUserId: string;
  activeSubscriptions: string[];
  entitlements: { active: Record<string, BillingEntitlement> };
  managementURL: string | null;
}

/**
 * The user's real subscription state as the backend knows it — derived from
 * the tRPC-fetched profile (plan + status + period). The provider maps this
 * onto the RevenueCat-shaped CustomerInfo.
 */
export interface SubscriptionState {
  userId: string;
  plan: PlanType | null;
  status: SubscriptionStatus | null;
  /** Unix seconds; null when not applicable (no plan / lifetime). */
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingProvider {
  configure(options: { appUserID: string }): Promise<void>;
  getOfferings(): Promise<BillingOfferings>;
  getCustomerInfo(): Promise<BillingCustomerInfo>;
  purchasePackage(
    pkg: BillingPackage,
  ): Promise<{ customerInfo: BillingCustomerInfo }>;
  restorePurchases(): Promise<BillingCustomerInfo>;
}
