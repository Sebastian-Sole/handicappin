/**
 * Unit tests — lib/billing/paywall-policy (the LOCKED §1 matrix) and the
 * D-seam provider selection rule.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  paywallPolicyFor,
  type BillingProjectionState,
} from "../../lib/billing/paywall-policy";
import { selectBillingProviderKind } from "../../lib/billing/select-provider";

const state = (
  overrides: Partial<BillingProjectionState>,
): BillingProjectionState => ({
  plan: null,
  status: null,
  provider: null,
  cancelAtPeriodEnd: false,
  ...overrides,
});

describe("paywallPolicyFor — §1 matrix", () => {
  it("plan null → full paywall (purchasable), restore, disclosure", () => {
    const policy = paywallPolicyFor(state({}));
    assert.equal(policy.showPurchaseButtons, true);
    assert.equal(policy.showNativePlanChange, false);
    assert.equal(policy.showAppleManage, false);
    assert.equal(policy.showStripeNeutralCopy, false);
    assert.equal(policy.showRestore, true);
    assert.equal(policy.showDisclosure, true);
  });

  it("plan free → full paywall (purchasable)", () => {
    const policy = paywallPolicyFor(
      state({ plan: "free", status: "active" }),
    );
    assert.equal(policy.showPurchaseButtons, true);
    assert.equal(policy.showRestore, true);
  });

  it("active + provider apple → native plan change + Apple manage link", () => {
    const policy = paywallPolicyFor(
      state({ plan: "premium", status: "active", provider: "apple" }),
    );
    assert.equal(policy.showPurchaseButtons, false);
    assert.equal(policy.showNativePlanChange, true);
    assert.equal(policy.showAppleManage, true);
    assert.equal(policy.showStripeNeutralCopy, false);
    assert.equal(policy.showRestore, true);
  });

  it("trialing + apple counts as active for plan change", () => {
    const policy = paywallPolicyFor(
      state({ plan: "unlimited", status: "trialing", provider: "apple" }),
    );
    assert.equal(policy.showNativePlanChange, true);
  });

  it("apple + cancel_at_period_end (still active) keeps plan change + manage", () => {
    const policy = paywallPolicyFor(
      state({
        plan: "unlimited",
        status: "active",
        provider: "apple",
        cancelAtPeriodEnd: true,
      }),
    );
    assert.equal(policy.showNativePlanChange, true);
    assert.equal(policy.showAppleManage, true);
    assert.equal(policy.showPurchaseButtons, false);
  });

  it("apple past_due → manage link but NO plan change, NO purchase buttons", () => {
    const policy = paywallPolicyFor(
      state({ plan: "premium", status: "past_due", provider: "apple" }),
    );
    assert.equal(policy.showPurchaseButtons, false);
    assert.equal(policy.showNativePlanChange, false);
    assert.equal(policy.showAppleManage, true);
    assert.equal(policy.showRestore, true);
  });

  it("active + provider stripe → neutral copy, no purchase buttons", () => {
    const policy = paywallPolicyFor(
      state({ plan: "premium", status: "active", provider: "stripe" }),
    );
    assert.equal(policy.showPurchaseButtons, false);
    assert.equal(policy.showNativePlanChange, false);
    assert.equal(policy.showAppleManage, false);
    assert.equal(policy.showStripeNeutralCopy, true);
    assert.equal(policy.showRestore, true);
  });

  it("stripe past_due → neutral copy, no purchase buttons", () => {
    const policy = paywallPolicyFor(
      state({ plan: "unlimited", status: "past_due", provider: "stripe" }),
    );
    assert.equal(policy.showStripeNeutralCopy, true);
    assert.equal(policy.showPurchaseButtons, false);
  });

  it("legacy paid rows with provider null are treated as stripe-billed", () => {
    const policy = paywallPolicyFor(
      state({ plan: "unlimited", status: "active", provider: null }),
    );
    assert.equal(policy.showStripeNeutralCopy, true);
    assert.equal(policy.showPurchaseButtons, false);
  });

  it("lifetime (stripe) → no purchase buttons, nothing to manage, restore stays", () => {
    const policy = paywallPolicyFor(
      state({ plan: "lifetime", status: "active", provider: "stripe" }),
    );
    assert.equal(policy.showPurchaseButtons, false);
    assert.equal(policy.showNativePlanChange, false);
    assert.equal(policy.showAppleManage, false);
    assert.equal(policy.showStripeNeutralCopy, false);
    assert.equal(policy.showRestore, true);
  });

  it("lifetime (apple) → same as stripe lifetime", () => {
    const policy = paywallPolicyFor(
      state({ plan: "lifetime", status: "active", provider: "apple" }),
    );
    assert.equal(policy.showPurchaseButtons, false);
    assert.equal(policy.showAppleManage, false);
    assert.equal(policy.showRestore, true);
  });
});

describe("selectBillingProviderKind — D-seam", () => {
  it("no key → mock (CI, sim verification)", () => {
    assert.equal(selectBillingProviderKind(null), "mock");
    assert.equal(selectBillingProviderKind(undefined), "mock");
    assert.equal(selectBillingProviderKind(""), "mock");
  });

  it("key present → real SDK", () => {
    assert.equal(selectBillingProviderKind("appl_abc123"), "revenuecat");
  });
});
