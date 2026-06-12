/**
 * Unit tests for the reconcile script's pure diff logic
 * (scripts/lib/reconcile-billing-core.mjs — handoff DoD #6).
 */
import { describe, test, expect } from "vitest";
// eslint-disable-next-line import/no-relative-packages
import {
  normalizeStripeSubscriptions,
  normalizeRevenueCatSubscriber,
  diffBillingState,
  decideApply,
} from "../../../../../scripts/lib/reconcile-billing-core.mjs";

const PRICE_TO_PLAN = {
  price_premium: "premium",
  price_unlimited: "unlimited",
};

const NOW = Date.parse("2026-06-12T00:00:00Z");
const FUTURE_ISO = "2027-06-12T00:00:00Z";
const FUTURE_S = Math.floor(Date.parse(FUTURE_ISO) / 1000);
const PAST_ISO = "2025-06-12T00:00:00Z";

function stripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    created: 1_700_000_000,
    cancel_at_period_end: false,
    cancel_at: null,
    items: {
      data: [
        {
          price: { id: "price_premium" },
          current_period_end: FUTURE_S,
        },
      ],
    },
    ...overrides,
  };
}

describe("normalizeStripeSubscriptions", () => {
  test("empty list → null (no record)", () => {
    expect(normalizeStripeSubscriptions([], PRICE_TO_PLAN)).toBeNull();
    expect(normalizeStripeSubscriptions(undefined, PRICE_TO_PLAN)).toBeNull();
  });

  test("active subscription maps plan/status/period/cap", () => {
    const state = normalizeStripeSubscriptions([stripeSub()], PRICE_TO_PLAN);
    expect(state).toEqual({
      plan: "premium",
      status: "active",
      currentPeriodEnd: FUTURE_S,
      cancelAtPeriodEnd: false,
    });
  });

  test("cancel_at_period_end flows through", () => {
    const state = normalizeStripeSubscriptions(
      [stripeSub({ cancel_at_period_end: true })],
      PRICE_TO_PLAN,
    );
    expect(state?.cancelAtPeriodEnd).toBe(true);
  });

  test("canceled subscription projects as the free tier", () => {
    const state = normalizeStripeSubscriptions(
      [stripeSub({ status: "canceled" })],
      PRICE_TO_PLAN,
    );
    expect(state).toEqual({
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  test("prefers the live subscription over an old canceled one", () => {
    const state = normalizeStripeSubscriptions(
      [
        stripeSub({ id: "sub_old", status: "canceled", created: 1 }),
        stripeSub({
          id: "sub_live",
          created: 2,
          items: {
            data: [
              { price: { id: "price_unlimited" }, current_period_end: FUTURE_S },
            ],
          },
        }),
      ],
      PRICE_TO_PLAN,
    );
    expect(state?.plan).toBe("unlimited");
    expect(state?.status).toBe("active");
  });

  test("past_due ranks above canceled but below active", () => {
    const state = normalizeStripeSubscriptions(
      [
        stripeSub({ id: "a", status: "canceled", created: 3 }),
        stripeSub({ id: "b", status: "past_due", created: 1 }),
      ],
      PRICE_TO_PLAN,
    );
    expect(state?.status).toBe("past_due");
  });

  test("unknown price maps plan to null (caught as a diff)", () => {
    const state = normalizeStripeSubscriptions(
      [
        stripeSub({
          items: {
            data: [{ price: { id: "price_mystery" }, current_period_end: FUTURE_S }],
          },
        }),
      ],
      PRICE_TO_PLAN,
    );
    expect(state?.plan).toBeNull();
  });
});

describe("normalizeRevenueCatSubscriber", () => {
  test("null/empty subscriber → null", () => {
    expect(normalizeRevenueCatSubscriber(null, NOW)).toBeNull();
    expect(normalizeRevenueCatSubscriber({}, NOW)).toBeNull();
  });

  test("live app_store subscription maps to active with period end", () => {
    const state = normalizeRevenueCatSubscriber(
      {
        subscriptions: {
          "com.handicappin.premium.yearly": {
            expires_date: FUTURE_ISO,
            period_type: "normal",
            store: "app_store",
            unsubscribe_detected_at: null,
            billing_issues_detected_at: null,
          },
        },
      },
      NOW,
    );
    expect(state).toEqual({
      plan: "premium",
      status: "active",
      currentPeriodEnd: Math.floor(Date.parse(FUTURE_ISO) / 1000),
      cancelAtPeriodEnd: false,
    });
  });

  test("trial period maps to trialing", () => {
    const state = normalizeRevenueCatSubscriber(
      {
        subscriptions: {
          "com.handicappin.unlimited.yearly": {
            expires_date: FUTURE_ISO,
            period_type: "trial",
            store: "app_store",
          },
        },
      },
      NOW,
    );
    expect(state?.status).toBe("trialing");
    expect(state?.plan).toBe("unlimited");
  });

  test("billing issue maps to past_due", () => {
    const state = normalizeRevenueCatSubscriber(
      {
        subscriptions: {
          "com.handicappin.premium.yearly": {
            expires_date: FUTURE_ISO,
            period_type: "normal",
            store: "app_store",
            billing_issues_detected_at: "2026-06-01T00:00:00Z",
          },
        },
      },
      NOW,
    );
    expect(state?.status).toBe("past_due");
  });

  test("unsubscribe detected maps to cancelAtPeriodEnd", () => {
    const state = normalizeRevenueCatSubscriber(
      {
        subscriptions: {
          "com.handicappin.premium.yearly": {
            expires_date: FUTURE_ISO,
            period_type: "normal",
            store: "app_store",
            unsubscribe_detected_at: "2026-06-01T00:00:00Z",
          },
        },
      },
      NOW,
    );
    expect(state?.cancelAtPeriodEnd).toBe(true);
    expect(state?.status).toBe("active");
  });

  test("expired subscription projects as free tier", () => {
    const state = normalizeRevenueCatSubscriber(
      {
        subscriptions: {
          "com.handicappin.premium.yearly": {
            expires_date: PAST_ISO,
            period_type: "normal",
            store: "app_store",
          },
        },
      },
      NOW,
    );
    expect(state).toEqual({
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  test("refunded subscription projects as free tier even if unexpired", () => {
    const state = normalizeRevenueCatSubscriber(
      {
        subscriptions: {
          "com.handicappin.premium.yearly": {
            expires_date: FUTURE_ISO,
            period_type: "normal",
            store: "app_store",
            refunded_at: "2026-06-01T00:00:00Z",
          },
        },
      },
      NOW,
    );
    expect(state?.plan).toBe("free");
  });

  test("lifetime non-subscription purchase wins over everything", () => {
    const state = normalizeRevenueCatSubscriber(
      {
        subscriptions: {
          "com.handicappin.premium.yearly": {
            expires_date: PAST_ISO,
            period_type: "normal",
            store: "app_store",
          },
        },
        non_subscriptions: {
          "com.handicappin.lifetime": [
            { id: "txn1", purchase_date: PAST_ISO, store: "app_store" },
          ],
        },
      },
      NOW,
    );
    expect(state).toEqual({
      plan: "lifetime",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  test("non-app_store subscriptions are ignored (D-rc-scope)", () => {
    const state = normalizeRevenueCatSubscriber(
      {
        subscriptions: {
          "com.handicappin.premium.yearly": {
            expires_date: FUTURE_ISO,
            period_type: "normal",
            store: "stripe",
          },
        },
      },
      NOW,
    );
    expect(state).toBeNull();
  });
});

describe("diffBillingState", () => {
  const projection = {
    plan: "premium",
    status: "active",
    currentPeriodEnd: FUTURE_S,
    cancelAtPeriodEnd: false,
    provider: "stripe",
  };

  test("identical states produce no diffs", () => {
    expect(
      diffBillingState(projection, {
        plan: "premium",
        status: "active",
        currentPeriodEnd: FUTURE_S,
        cancelAtPeriodEnd: false,
      }),
    ).toEqual([]);
  });

  test("field mismatches are reported individually", () => {
    const diffs = diffBillingState(projection, {
      plan: "unlimited",
      status: "active",
      currentPeriodEnd: FUTURE_S,
      cancelAtPeriodEnd: true,
    });
    expect(diffs.map((d: { field: string }) => d.field).sort()).toEqual([
      "cancelAtPeriodEnd",
      "plan",
    ]);
  });

  test("missing provider record is a presence diff", () => {
    const diffs = diffBillingState(projection, null);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe("presence");
  });
});

describe("decideApply (conservative --apply policy)", () => {
  const projection = {
    plan: "premium",
    status: "active",
    currentPeriodEnd: FUTURE_S,
    cancelAtPeriodEnd: false,
    provider: "stripe",
  };
  const providerState = {
    plan: "premium",
    status: "past_due",
    currentPeriodEnd: FUTURE_S,
    cancelAtPeriodEnd: false,
  };
  const someDiff = [{ field: "status", projection: "active", provider: "past_due" }];

  test("in-sync → no apply", () => {
    expect(decideApply(projection, providerState, [], "stripe").apply).toBe(false);
  });

  test("same-provider drift → apply", () => {
    const verdict = decideApply(projection, providerState, someDiff, "stripe");
    expect(verdict.apply).toBe(true);
  });

  test("lifetime projection is never auto-corrected", () => {
    const verdict = decideApply(
      { ...projection, plan: "lifetime" },
      providerState,
      someDiff,
      "stripe",
    );
    expect(verdict.apply).toBe(false);
    expect(verdict.reason).toContain("lifetime");
  });

  test("provider-has-no-record is never auto-corrected", () => {
    const verdict = decideApply(
      projection,
      null,
      [{ field: "presence", projection: "premium/active", provider: "no record" }],
      "stripe",
    );
    expect(verdict.apply).toBe(false);
    expect(verdict.reason).toContain("no record");
  });

  test("cross-provider ownership is never auto-corrected", () => {
    const verdict = decideApply(
      { ...projection, provider: "apple" },
      providerState,
      someDiff,
      "stripe",
    );
    expect(verdict.apply).toBe(false);
  });
});
