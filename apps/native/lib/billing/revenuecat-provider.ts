/**
 * REAL RevenueCat billing provider (decision ledger D-rc-scope): Apple-side
 * plumbing only — purchasing, receipt validation, restore. RC is NEVER the
 * entitlement source of truth; the backend projection (fed by the RC
 * webhook) stays authoritative and screens keep reading it via tRPC.
 *
 * This module is loaded by lib/billing/index.ts ONLY when
 * EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is set (D-seam) — keeping the SDK's
 * native module out of the eval path for key-less builds (CI, sim
 * verification), which run the mock and never touch this file at runtime.
 */
import Purchases, { LOG_LEVEL } from "react-native-purchases";

import type {
  BillingCustomerInfo,
  BillingOfferings,
  BillingPackage,
  BillingProvider,
} from "@/lib/billing/types";
import {
  mapRcCustomerInfo,
  mapRcOfferings,
} from "@/lib/billing/revenuecat-mapping";

export class RevenueCatBillingProvider implements BillingProvider {
  private readonly apiKey: string;
  private configured = false;
  /** Native package objects from the last getOfferings(), by identifier —
   * purchasePackage must hand the SDK its own object back. */
  private nativePackages = new Map<string, unknown>();

  constructor(apiKey: string) {
    if (!apiKey) {
      // D-seam: the SDK must never be configured without a key. The factory
      // guarantees this; the throw guards direct construction.
      throw new Error(
        "RevenueCatBillingProvider requires EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
      );
    }
    this.apiKey = apiKey;
  }

  async configure(options: { appUserID: string }): Promise<void> {
    if (!this.configured) {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      // app_user_id IS the Supabase user id (D-rc-scope): configure
      // anonymously, then logIn binds the store receipt to our user id.
      Purchases.configure({ apiKey: this.apiKey });
      this.configured = true;
    }
    await Purchases.logIn(options.appUserID);
  }

  async getOfferings(): Promise<BillingOfferings> {
    this.requireConfigured("getOfferings");
    const offerings = await Purchases.getOfferings();
    this.nativePackages.clear();
    for (const offering of Object.values(offerings.all)) {
      for (const pkg of offering.availablePackages) {
        this.nativePackages.set(pkg.identifier, pkg);
      }
    }
    return mapRcOfferings(offerings);
  }

  async getCustomerInfo(): Promise<BillingCustomerInfo> {
    this.requireConfigured("getCustomerInfo");
    return mapRcCustomerInfo(await Purchases.getCustomerInfo());
  }

  async purchasePackage(
    pkg: BillingPackage,
  ): Promise<{ customerInfo: BillingCustomerInfo }> {
    this.requireConfigured("purchasePackage");
    const nativePkg = this.nativePackages.get(pkg.identifier);
    if (!nativePkg) {
      throw new Error(
        `Unknown package ${pkg.identifier} — call getOfferings() before purchasePackage()`,
      );
    }
    const result = await Purchases.purchasePackage(
      nativePkg as Parameters<typeof Purchases.purchasePackage>[0],
    );
    return { customerInfo: mapRcCustomerInfo(result.customerInfo) };
  }

  async restorePurchases(): Promise<BillingCustomerInfo> {
    this.requireConfigured("restorePurchases");
    return mapRcCustomerInfo(await Purchases.restorePurchases());
  }

  private requireConfigured(method: string): void {
    if (!this.configured) {
      throw new Error(
        `RevenueCatBillingProvider.${method} called before configure() — call configure({appUserID}) after login`,
      );
    }
  }
}
