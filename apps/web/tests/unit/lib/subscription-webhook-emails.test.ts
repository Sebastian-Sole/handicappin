/**
 * Subscription webhook lifecycle-email unit tests (plan 005).
 *
 * Part 1: `classifySubscriptionChangeEmail` is a pure function (no I/O) so
 * it's tested directly — it decides WHICH lifecycle email (if any) a
 * subscription.updated webhook event should trigger.
 *
 * Part 2: `handleSubscriptionDeleted` — the cancelled email fires only
 * when the guarded write landed AND the prior projection was an ACTIVE
 * paid plan NOT already scheduled to cancel (a past_due contract dying
 * after failed dunning was already told by the final-attempt
 * payment-failed email; a cancel-at-period-end contract was already
 * notified at cancel time, so its expected deletion at term end must not
 * double-email).
 *
 * Module-level dependencies (@/db, @/lib/stripe, email-service, the
 * precedence-guard seam) are stubbed the same way
 * apps/web/tests/unit/lib/stripe-account.test.ts stubs @/db.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// db.select(...).from(...).where(...).limit(n) → mockDbLimit(n)
// (used by resolveUserEmail inside the email helper)
const mockDbLimit = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: (n: number) => mockDbLimit(n),
        }),
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({ profile: { email: "email", id: "id" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ mapPriceToPlan: vi.fn() }));

const mockVerifyOwnership = vi.fn();
vi.mock("@/lib/stripe-security", () => ({
  verifyCustomerOwnership: (...args: unknown[]) => mockVerifyOwnership(...args),
}));
vi.mock("@/utils/billing/pricing", () => ({
  verifyPaymentAmount: vi.fn(),
  formatAmount: vi.fn(),
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

const mockGuardedWrite = vi.fn();
const mockReadProjection = vi.fn();
vi.mock("@/lib/stripe-webhook-handlers/profile-billing-write", () => ({
  guardedStripeProfileWrite: (...args: unknown[]) => mockGuardedWrite(...args),
  readBillingProjection: (...args: unknown[]) => mockReadProjection(...args),
}));

import {
  classifySubscriptionChangeEmail,
  handleSubscriptionDeleted,
} from "@/lib/stripe-webhook-handlers/subscription-handlers";
import type { WebhookContext } from "@/lib/stripe-webhook-handlers/types";

describe("classifySubscriptionChangeEmail", () => {
  it("classifies a higher-ranked plan change as an upgrade", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: "premium",
      priorCancelAtPeriodEnd: false,
      newPlan: "unlimited",
      newCancelAtPeriodEnd: false,
    });
    expect(result).toEqual({
      kind: "upgrade",
      oldPlan: "premium",
      newPlan: "unlimited",
    });
  });

  it("classifies a lower-ranked plan change as a downgrade", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: "unlimited",
      priorCancelAtPeriodEnd: false,
      newPlan: "premium",
      newCancelAtPeriodEnd: false,
    });
    expect(result).toEqual({
      kind: "downgrade",
      oldPlan: "unlimited",
      newPlan: "premium",
    });
  });

  it("classifies lifetime as the top of the hierarchy (upgrade from unlimited)", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: "unlimited",
      priorCancelAtPeriodEnd: false,
      newPlan: "lifetime",
      newCancelAtPeriodEnd: false,
    });
    expect(result.kind).toBe("upgrade");
  });

  it("sends nothing for a same-plan, non-cancelling event (renewal/metadata no-op)", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: "premium",
      priorCancelAtPeriodEnd: false,
      newPlan: "premium",
      newCancelAtPeriodEnd: false,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("sends nothing when there is no prior plan to compare against", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: null,
      priorCancelAtPeriodEnd: false,
      newPlan: "premium",
      newCancelAtPeriodEnd: false,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("classifies cancel_at_period_end flipping false -> true as cancelled", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: "premium",
      priorCancelAtPeriodEnd: false,
      newPlan: "premium",
      newCancelAtPeriodEnd: true,
    });
    expect(result).toEqual({ kind: "cancelled", plan: "premium" });
  });

  it("does not re-fire cancelled when cancel_at_period_end was already true", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: "premium",
      priorCancelAtPeriodEnd: true,
      newPlan: "premium",
      newCancelAtPeriodEnd: true,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("does not classify cancel_at_period_end flipping true -> false as anything (reactivation is out of scope)", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: "premium",
      priorCancelAtPeriodEnd: true,
      newPlan: "premium",
      newCancelAtPeriodEnd: false,
    });
    expect(result).toEqual({ kind: "none" });
  });

  it("prioritizes a real plan change over a simultaneous cancel flag", () => {
    const result = classifySubscriptionChangeEmail({
      priorPlan: "unlimited",
      priorCancelAtPeriodEnd: false,
      newPlan: "premium",
      newCancelAtPeriodEnd: true,
    });
    expect(result).toEqual({
      kind: "downgrade",
      oldPlan: "unlimited",
      newPlan: "premium",
    });
  });
});

function buildDeletedCtx(): WebhookContext {
  const subscription = {
    id: "sub_test123",
    customer: "cus_test123",
    metadata: { supabase_user_id: "user-1" },
  };
  return {
    event: {
      id: "evt_del_123",
      created: Math.floor(Date.now() / 1000),
      data: { object: subscription },
    } as unknown as Stripe.Event,
    eventId: "evt_del_123",
  };
}

describe("handleSubscriptionDeleted - cancelled email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyOwnership.mockResolvedValue({
      valid: true,
      actualUserId: "user-1",
    });
    // resolveUserEmail's profile lookup
    mockDbLimit.mockResolvedValue([{ email: "user@example.com" }]);
    mockSendCancelled.mockResolvedValue({ success: true });
  });

  it("sends the cancelled email when the prior projection was an active paid plan not scheduled to cancel", async () => {
    mockReadProjection.mockResolvedValueOnce({
      provider: "stripe",
      plan: "premium",
      status: "active",
      currentPeriodEnd: 1999999999,
      cancelAtPeriodEnd: false,
    });
    mockGuardedWrite.mockResolvedValueOnce({ written: true, verdict: null });

    await handleSubscriptionDeleted(buildDeletedCtx());

    expect(mockSendCancelled).toHaveBeenCalledTimes(1);
    expect(mockSendCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com", plan: "premium" }),
    );
  });

  it("does not send when the prior projection was already cancel-at-period-end (notified at cancel time)", async () => {
    mockReadProjection.mockResolvedValueOnce({
      provider: "stripe",
      plan: "premium",
      status: "active",
      currentPeriodEnd: 1999999999,
      cancelAtPeriodEnd: true,
    });
    mockGuardedWrite.mockResolvedValueOnce({ written: true, verdict: null });

    await handleSubscriptionDeleted(buildDeletedCtx());

    expect(mockSendCancelled).not.toHaveBeenCalled();
  });

  it("does not send when the prior projection was past_due (dunning already emailed)", async () => {
    mockReadProjection.mockResolvedValueOnce({
      provider: "stripe",
      plan: "premium",
      status: "past_due",
      currentPeriodEnd: 1999999999,
      cancelAtPeriodEnd: false,
    });
    mockGuardedWrite.mockResolvedValueOnce({ written: true, verdict: null });

    await handleSubscriptionDeleted(buildDeletedCtx());

    expect(mockSendCancelled).not.toHaveBeenCalled();
  });

  it("does not send when the prior projection was already free", async () => {
    mockReadProjection.mockResolvedValueOnce({
      provider: null,
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    mockGuardedWrite.mockResolvedValueOnce({ written: true, verdict: null });

    await handleSubscriptionDeleted(buildDeletedCtx());

    expect(mockSendCancelled).not.toHaveBeenCalled();
  });

  it("does not send when the write is blocked by the precedence guard", async () => {
    mockReadProjection.mockResolvedValueOnce({
      provider: "apple",
      plan: "unlimited",
      status: "active",
      currentPeriodEnd: 1999999999,
      cancelAtPeriodEnd: false,
    });
    mockGuardedWrite.mockResolvedValueOnce({ written: false, verdict: null });

    await handleSubscriptionDeleted(buildDeletedCtx());

    expect(mockSendCancelled).not.toHaveBeenCalled();
  });
});
