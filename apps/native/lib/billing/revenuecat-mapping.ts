/**
 * Pure structural mapping: react-native-purchases SDK shapes → the app's
 * BillingProvider contract types. NO SDK imports — the inputs are minimal
 * structural mirrors of the SDK types, so this module is unit-testable in
 * plain node (the SDK itself needs a native runtime).
 */
import type {
  BillingCustomerInfo,
  BillingEntitlement,
  BillingOffering,
  BillingOfferings,
  BillingPackage,
  BillingPackageType,
} from "@/lib/billing/types";

/** Structural mirror of the SDK's PurchasesStoreProduct (fields we use). */
export interface RcStoreProductShape {
  identifier: string;
  title: string;
  description: string;
  priceString: string;
  currencyCode: string;
}

/** Structural mirror of the SDK's PurchasesPackage (fields we use). */
export interface RcPackageShape {
  identifier: string;
  packageType: string;
  offeringIdentifier: string;
  product: RcStoreProductShape;
}

/** Structural mirror of the SDK's PurchasesOffering. */
export interface RcOfferingShape {
  identifier: string;
  serverDescription: string;
  availablePackages: RcPackageShape[];
}

/** Structural mirror of the SDK's PurchasesOfferings. */
export interface RcOfferingsShape {
  current: RcOfferingShape | null;
  all: Record<string, RcOfferingShape>;
}

/** Structural mirror of the SDK's PurchasesEntitlementInfo. */
export interface RcEntitlementShape {
  identifier: string;
  isActive: boolean;
  productIdentifier: string;
  expirationDate: string | null;
  willRenew: boolean;
}

/** Structural mirror of the SDK's CustomerInfo. */
export interface RcCustomerInfoShape {
  originalAppUserId: string;
  activeSubscriptions: string[];
  entitlements: { active: Record<string, RcEntitlementShape> };
  managementURL: string | null;
}

const KNOWN_PACKAGE_TYPES: ReadonlySet<BillingPackageType> = new Set([
  "MONTHLY",
  "ANNUAL",
  "LIFETIME",
  "CUSTOM",
]);

function toBillingPackageType(sdkType: string): BillingPackageType {
  return KNOWN_PACKAGE_TYPES.has(sdkType as BillingPackageType)
    ? (sdkType as BillingPackageType)
    : "CUSTOM";
}

export function mapRcPackage(pkg: RcPackageShape): BillingPackage {
  return {
    identifier: pkg.identifier,
    packageType: toBillingPackageType(pkg.packageType),
    offeringIdentifier: pkg.offeringIdentifier,
    product: {
      identifier: pkg.product.identifier,
      title: pkg.product.title,
      description: pkg.product.description,
      priceString: pkg.product.priceString,
      currencyCode: pkg.product.currencyCode,
    },
  };
}

function mapRcOffering(offering: RcOfferingShape): BillingOffering {
  return {
    identifier: offering.identifier,
    serverDescription: offering.serverDescription,
    availablePackages: offering.availablePackages.map(mapRcPackage),
  };
}

export function mapRcOfferings(offerings: RcOfferingsShape): BillingOfferings {
  const all: Record<string, BillingOffering> = {};
  for (const [key, offering] of Object.entries(offerings.all)) {
    all[key] = mapRcOffering(offering);
  }
  return {
    current: offerings.current ? mapRcOffering(offerings.current) : null,
    all,
  };
}

export function mapRcCustomerInfo(
  info: RcCustomerInfoShape,
): BillingCustomerInfo {
  const active: Record<string, BillingEntitlement> = {};
  for (const [key, ent] of Object.entries(info.entitlements.active)) {
    active[key] = {
      identifier: ent.identifier,
      isActive: ent.isActive,
      productIdentifier: ent.productIdentifier,
      expirationDate: ent.expirationDate,
      willRenew: ent.willRenew,
    };
  }
  return {
    originalAppUserId: info.originalAppUserId,
    activeSubscriptions: [...info.activeSubscriptions],
    entitlements: { active },
    managementURL: info.managementURL,
  };
}
