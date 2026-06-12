/**
 * Purchase/restore orchestration over the billing seam — shared by the
 * onboarding paywall and the profile billing tab. Screens stay declarative;
 * this module owns the configure → offerings → purchase dance and the
 * mock-mode labelling (decision ledger: mocked flows must say so out loud).
 */
import { planToAppleSku, type PaidPlan } from "@handicappin/billing-core";

import { billing, billingProviderKind } from "@/lib/billing";
import type { BillingCustomerInfo, BillingPackage } from "@/lib/billing/types";

export const MOCK_PURCHASE_NOTICE =
  "Purchases aren't available in this development build — select your plan on handicappin.com and it will appear here.";

export const MOCK_RESTORE_PREFIX = "Dev build: purchases are mocked.";

export type PurchaseFlowResult =
  | { kind: "mock-notice"; message: string }
  | { kind: "purchased"; customerInfo: BillingCustomerInfo }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

/** Narrow unknown SDK errors; RC user-cancellations carry userCancelled. */
function isUserCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "userCancelled" in error &&
    Boolean((error as { userCancelled: unknown }).userCancelled)
  );
}

export async function loadPackages(
  userId: string,
): Promise<BillingPackage[]> {
  await billing.configure({ appUserID: userId });
  const offerings = await billing.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export function packageForPlan(
  packages: BillingPackage[],
  plan: PaidPlan,
): BillingPackage | null {
  const sku = planToAppleSku(plan);
  return packages.find((pkg) => pkg.product.identifier === sku) ?? null;
}

/**
 * Purchase the package for a paid plan. In mock mode this performs NO
 * purchase — it returns the labelled dev notice for the UI to surface.
 */
export async function purchasePlan(
  userId: string,
  plan: PaidPlan,
): Promise<PurchaseFlowResult> {
  if (billingProviderKind === "mock") {
    return { kind: "mock-notice", message: MOCK_PURCHASE_NOTICE };
  }
  try {
    const packages = await loadPackages(userId);
    const pkg = packageForPlan(packages, plan);
    if (!pkg) {
      return {
        kind: "error",
        message:
          "This plan isn't available right now. Please try again later.",
      };
    }
    const { customerInfo } = await billing.purchasePackage(pkg);
    return { kind: "purchased", customerInfo };
  } catch (error) {
    if (isUserCancelled(error)) return { kind: "cancelled" };
    return {
      kind: "error",
      message:
        error instanceof Error ? error.message : "Purchase failed. Try again.",
    };
  }
}

export type RestoreFlowResult =
  | { kind: "restored"; activeEntitlements: string[]; mocked: boolean }
  | { kind: "error"; message: string };

/** Restore purchases — always available (§1: Restore always visible). */
export async function restorePurchases(
  userId: string,
): Promise<RestoreFlowResult> {
  try {
    await billing.configure({ appUserID: userId });
    const info = await billing.restorePurchases();
    return {
      kind: "restored",
      activeEntitlements: Object.keys(info.entitlements.active),
      mocked: billingProviderKind === "mock",
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error ? error.message : "Restore failed. Try again.",
    };
  }
}

/**
 * Apple's manage-subscriptions surface: prefer the account-scoped
 * managementURL from CustomerInfo; fall back to the canonical
 * subscriptions URL (works on device and sim).
 */
export const APPLE_MANAGE_SUBSCRIPTIONS_URL =
  "https://apps.apple.com/account/subscriptions";

export async function getManagementUrl(userId: string): Promise<string> {
  try {
    await billing.configure({ appUserID: userId });
    const info = await billing.getCustomerInfo();
    return info.managementURL ?? APPLE_MANAGE_SUBSCRIPTIONS_URL;
  } catch {
    return APPLE_MANAGE_SUBSCRIPTIONS_URL;
  }
}
