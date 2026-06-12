/**
 * Unit tests — lib/billing/revenuecat-mapping (pure SDK-shape → contract
 * mapping; the SDK itself needs a native runtime so the provider is
 * exercised structurally, per the handoff).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapRcCustomerInfo,
  mapRcOfferings,
  mapRcPackage,
  type RcCustomerInfoShape,
  type RcOfferingsShape,
} from "../../lib/billing/revenuecat-mapping";

const offerings: RcOfferingsShape = {
  current: {
    identifier: "default",
    serverDescription: "Standard set",
    availablePackages: [
      {
        identifier: "premium_yearly",
        packageType: "ANNUAL",
        offeringIdentifier: "default",
        product: {
          identifier: "com.handicappin.premium.yearly",
          title: "Premium",
          description: "For golf enthusiasts",
          priceString: "$19.00",
          currencyCode: "USD",
        },
      },
      {
        identifier: "$rc_lifetime",
        packageType: "LIFETIME",
        offeringIdentifier: "default",
        product: {
          identifier: "com.handicappin.lifetime",
          title: "Lifetime",
          description: "Forever",
          priceString: "$149.00",
          currencyCode: "USD",
        },
      },
    ],
  },
  all: {},
};
offerings.all["default"] = offerings.current!;

describe("mapRcOfferings", () => {
  it("maps current + all with packages and products intact", () => {
    const mapped = mapRcOfferings(offerings);
    assert.equal(mapped.current?.identifier, "default");
    assert.equal(mapped.current?.availablePackages.length, 2);
    assert.equal(
      mapped.current?.availablePackages[0]?.product.identifier,
      "com.handicappin.premium.yearly",
    );
    assert.equal(mapped.all["default"]?.availablePackages.length, 2);
  });

  it("maps null current offering", () => {
    const mapped = mapRcOfferings({ current: null, all: {} });
    assert.equal(mapped.current, null);
    assert.deepEqual(mapped.all, {});
  });

  it("normalizes unknown package types to CUSTOM", () => {
    const pkg = mapRcPackage({
      identifier: "weird",
      packageType: "SIX_MONTH",
      offeringIdentifier: "default",
      product: {
        identifier: "p",
        title: "t",
        description: "d",
        priceString: "$1",
        currencyCode: "USD",
      },
    });
    assert.equal(pkg.packageType, "CUSTOM");
  });
});

describe("mapRcCustomerInfo", () => {
  it("maps entitlements, subscriptions and managementURL", () => {
    const info: RcCustomerInfoShape = {
      originalAppUserId: "user-123",
      activeSubscriptions: ["com.handicappin.premium.yearly"],
      entitlements: {
        active: {
          premium: {
            identifier: "premium",
            isActive: true,
            productIdentifier: "com.handicappin.premium.yearly",
            expirationDate: "2027-06-12T00:00:00Z",
            willRenew: true,
          },
        },
      },
      managementURL: "https://apps.apple.com/account/subscriptions",
    };
    const mapped = mapRcCustomerInfo(info);
    assert.equal(mapped.originalAppUserId, "user-123");
    assert.deepEqual(mapped.activeSubscriptions, [
      "com.handicappin.premium.yearly",
    ]);
    assert.equal(mapped.entitlements.active["premium"]?.isActive, true);
    assert.equal(
      mapped.managementURL,
      "https://apps.apple.com/account/subscriptions",
    );
  });

  it("maps empty entitlements and null managementURL", () => {
    const mapped = mapRcCustomerInfo({
      originalAppUserId: "user-123",
      activeSubscriptions: [],
      entitlements: { active: {} },
      managementURL: null,
    });
    assert.deepEqual(mapped.activeSubscriptions, []);
    assert.deepEqual(mapped.entitlements.active, {});
    assert.equal(mapped.managementURL, null);
  });
});
