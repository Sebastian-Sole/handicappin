/**
 * stripeRouter.updateSubscription no-longer-sends-email unit tests (plan 005).
 *
 * Lifecycle emails moved from this in-app mutation to the Stripe webhook
 * handlers (the single source of truth for ALL Stripe-side changes,
 * including portal and dunning events the mutation never sees). This test
 * calls the real mutation through a tRPC caller and asserts the email
 * service is never touched, regardless of changeType.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateStripeSubscription = vi.fn();
const mockCreateLifetimeCheckoutSession = vi.fn();
vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: vi.fn(),
  createLifetimeCheckoutSession: (...args: unknown[]) =>
    mockCreateLifetimeCheckoutSession(...args),
  createPortalSession: vi.fn(),
  updateSubscription: (...args: unknown[]) =>
    mockUpdateStripeSubscription(...args),
  PLAN_TO_PRICE_MAP: {
    premium: "price_premium",
    unlimited: "price_unlimited",
    lifetime: "price_lifetime",
  },
  stripe: {},
  mapPriceToPlan: vi.fn(),
  getPromotionCodeDetails: vi.fn(),
}));

vi.mock("@/utils/billing/pricing", () => ({
  verifyPaymentAmount: vi.fn(),
  formatAmount: vi.fn((n: number) => `$${n / 100}`),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkoutRateLimit: {
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    }),
  },
  portalRateLimit: {
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    }),
  },
}));

const mockSendUpgraded = vi.fn();
const mockSendDowngraded = vi.fn();
const mockSendCancelled = vi.fn();
vi.mock("@/lib/email-service", () => ({
  sendSubscriptionUpgradedEmail: (...args: unknown[]) =>
    mockSendUpgraded(...args),
  sendSubscriptionDowngradedEmail: (...args: unknown[]) =>
    mockSendDowngraded(...args),
  sendSubscriptionCancelledEmail: (...args: unknown[]) =>
    mockSendCancelled(...args),
}));

import { stripeRouter } from "@/server/api/routers/stripe";
import { createCallerFactory } from "@/server/api/trpc";

const createCaller = createCallerFactory(stripeRouter);

function buildCtx() {
  return {
    user: { id: "user-1", email: "user@example.com" },
    supabase: {},
    headers: new Headers(),
  } as unknown as Parameters<typeof createCaller>[0];
}

describe("stripeRouter.updateSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call any email sender on an upgrade", async () => {
    mockUpdateStripeSubscription.mockResolvedValueOnce({
      subscription: {
        id: "sub_1",
        items: { data: [{ current_period_end: 1999999999 }] },
        latest_invoice: null,
      },
      changeType: "upgrade",
    });

    const caller = createCaller(buildCtx());
    const result = await caller.updateSubscription({ newPlan: "unlimited" });

    expect(result.success).toBe(true);
    expect(result.changeType).toBe("upgrade");
    expect(mockSendUpgraded).not.toHaveBeenCalled();
    expect(mockSendDowngraded).not.toHaveBeenCalled();
    expect(mockSendCancelled).not.toHaveBeenCalled();
  });

  it("does not call any email sender on a downgrade", async () => {
    mockUpdateStripeSubscription.mockResolvedValueOnce({
      subscription: {
        id: "sub_1",
        items: { data: [{ current_period_end: 1999999999 }] },
      },
      changeType: "downgrade",
    });

    const caller = createCaller(buildCtx());
    const result = await caller.updateSubscription({ newPlan: "premium" });

    expect(result.success).toBe(true);
    expect(result.changeType).toBe("downgrade");
    expect(mockSendUpgraded).not.toHaveBeenCalled();
    expect(mockSendDowngraded).not.toHaveBeenCalled();
    expect(mockSendCancelled).not.toHaveBeenCalled();
  });

  it("does not call any email sender on a cancel", async () => {
    mockUpdateStripeSubscription.mockResolvedValueOnce({
      subscription: {
        id: "sub_1",
        items: { data: [{ current_period_end: 1999999999 }] },
      },
      changeType: "cancel",
    });

    const caller = createCaller(buildCtx());
    const result = await caller.updateSubscription({ newPlan: "free" });

    expect(result.success).toBe(true);
    expect(result.changeType).toBe("cancel");
    expect(mockSendUpgraded).not.toHaveBeenCalled();
    expect(mockSendDowngraded).not.toHaveBeenCalled();
    expect(mockSendCancelled).not.toHaveBeenCalled();
  });

  it("does not call any email sender on an already-cancelled no-op", async () => {
    mockUpdateStripeSubscription.mockResolvedValueOnce({
      subscription: null,
      changeType: "cancel",
      alreadyCancelled: true,
    });

    const caller = createCaller(buildCtx());
    const result = await caller.updateSubscription({ newPlan: "free" });

    expect(result.success).toBe(true);
    expect(mockSendUpgraded).not.toHaveBeenCalled();
    expect(mockSendDowngraded).not.toHaveBeenCalled();
    expect(mockSendCancelled).not.toHaveBeenCalled();
  });
});
