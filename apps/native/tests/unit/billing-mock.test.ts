/** Unit tests — lib/billing mock provider (the RevenueCat-shaped seam). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  customerInfoFromSubscriptionState,
  MockBillingProvider,
} from "../../lib/billing/mock-provider";
import type { SubscriptionState } from "../../lib/billing/types";

const state = (overrides: Partial<SubscriptionState>): SubscriptionState => ({
  userId: "user-1",
  plan: "unlimited" as const,
  status: "active" as const,
  currentPeriodEnd: 1750000000,
  cancelAtPeriodEnd: false,
  ...overrides,
});

describe("customerInfoFromSubscriptionState", () => {
  it("maps an active subscription to an entitlement + active subscription", () => {
    const info = customerInfoFromSubscriptionState(state({}));
    assert.equal(info.originalAppUserId, "user-1");
    assert.deepEqual(Object.keys(info.entitlements.active), ["unlimited"]);
    assert.equal(
      info.entitlements.active.unlimited.productIdentifier,
      "unlimited_plan",
    );
    assert.equal(info.entitlements.active.unlimited.willRenew, true);
    assert.deepEqual(info.activeSubscriptions, ["unlimited_plan"]);
  });

  it("lifetime is entitled forever with no subscription", () => {
    const info = customerInfoFromSubscriptionState(
      state({ plan: "lifetime", status: null, currentPeriodEnd: null }),
    );
    assert.equal(info.entitlements.active.lifetime.expirationDate, null);
    assert.equal(info.entitlements.active.lifetime.willRenew, false);
    assert.deepEqual(info.activeSubscriptions, []);
  });

  it("canceled paid plans carry no active entitlement", () => {
    const info = customerInfoFromSubscriptionState(
      state({ status: "canceled" }),
    );
    assert.deepEqual(info.entitlements.active, {});
    assert.deepEqual(info.activeSubscriptions, []);
  });

  it("free plan is entitled but not a store subscription", () => {
    const info = customerInfoFromSubscriptionState(
      state({ plan: "free", status: "free", currentPeriodEnd: null }),
    );
    assert.ok(info.entitlements.active.free);
    assert.deepEqual(info.activeSubscriptions, []);
  });
});

describe("MockBillingProvider", () => {
  it("requires configure() before reading customer info", async () => {
    const provider = new MockBillingProvider(async () => state({}));
    await assert.rejects(() => provider.getCustomerInfo(), /configure/);
  });

  it("reads REAL state through the injected fetcher", async () => {
    let askedFor = null;
    const provider = new MockBillingProvider(async (userId) => {
      askedFor = userId;
      return state({ userId });
    });
    await provider.configure({ appUserID: "user-9" });
    const info = await provider.getCustomerInfo();
    assert.equal(askedFor, "user-9");
    assert.equal(info.originalAppUserId, "user-9");
  });

  it("purchasePackage is a logged no-op returning unchanged real state", async () => {
    const logs: string[] = [];
    const provider = new MockBillingProvider(
      async () => state({}),
      (message) => logs.push(message),
    );
    await provider.configure({ appUserID: "user-1" });
    const offerings = await provider.getOfferings();
    const pkg = offerings.current!.availablePackages[0]!;
    const { customerInfo } = await provider.purchasePackage(pkg);
    assert.deepEqual(Object.keys(customerInfo.entitlements.active), [
      "unlimited",
    ]);
    assert.ok(logs.some((entry) => entry.includes("mocked no-op")));
  });

  it("restorePurchases re-reads backend state", async () => {
    let calls = 0;
    const provider = new MockBillingProvider(async () => {
      calls += 1;
      return state({});
    });
    await provider.configure({ appUserID: "user-1" });
    await provider.restorePurchases();
    assert.equal(calls, 1);
  });
});
