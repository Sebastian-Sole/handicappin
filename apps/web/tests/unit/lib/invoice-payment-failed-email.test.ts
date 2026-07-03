/**
 * handleInvoicePaymentFailed lifecycle-email unit tests (plan 005).
 *
 * Verifies the payment-failed email is only sent when the precedence-
 * guarded write actually landed (an Apple/lifetime user's blocked write
 * must NOT trigger a Stripe dunning email), and that isFinalAttempt tracks
 * the existing attempt_count >= 3 threshold in invoice-handlers.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ profile: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), sql: vi.fn() }));

const mockRetrieveSubscription = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      retrieve: (...args: unknown[]) => mockRetrieveSubscription(...args),
    },
  },
}));

const mockVerifyOwnership = vi.fn();
vi.mock("@/lib/stripe-security", () => ({
  verifyCustomerOwnership: (...args: unknown[]) => mockVerifyOwnership(...args),
}));

const mockSendPaymentFailed = vi.fn();
vi.mock("@/lib/email-service", () => ({
  sendPaymentFailedEmail: (...args: unknown[]) => mockSendPaymentFailed(...args),
}));

const mockGuardedWrite = vi.fn();
const mockReadProjection = vi.fn();
vi.mock("@/lib/stripe-webhook-handlers/profile-billing-write", () => ({
  guardedStripeProfileWrite: (...args: unknown[]) => mockGuardedWrite(...args),
  readBillingProjection: (...args: unknown[]) => mockReadProjection(...args),
}));

import { handleInvoicePaymentFailed } from "@/lib/stripe-webhook-handlers/invoice-handlers";
import type { WebhookContext } from "@/lib/stripe-webhook-handlers/types";

function buildCtx(overrides: {
  attemptCount?: number;
  customerEmail?: string | null;
} = {}): WebhookContext {
  const invoice = {
    id: "in_test123",
    subscription: "sub_test123",
    customer: "cus_test123",
    customer_email:
      overrides.customerEmail === undefined
        ? "user@example.com"
        : overrides.customerEmail,
    attempt_count: overrides.attemptCount ?? 1,
  };

  return {
    event: {
      id: "evt_test123",
      created: Math.floor(Date.now() / 1000),
      data: { object: invoice },
    } as unknown as Stripe.Event,
    eventId: "evt_test123",
  };
}

describe("handleInvoicePaymentFailed - payment-failed email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyOwnership.mockResolvedValue({ valid: true, actualUserId: "user-1" });
    mockRetrieveSubscription.mockResolvedValue({
      metadata: { supabase_user_id: "user-1" },
    });
    mockReadProjection.mockResolvedValue({
      provider: "stripe",
      plan: "premium",
      status: "active",
      currentPeriodEnd: 9999999999,
      cancelAtPeriodEnd: false,
    });
  });

  it("sends the email with isFinalAttempt=false when written and below the retry threshold", async () => {
    mockGuardedWrite.mockResolvedValueOnce({ written: true, verdict: null });

    await handleInvoicePaymentFailed(buildCtx({ attemptCount: 1 }));

    expect(mockSendPaymentFailed).toHaveBeenCalledTimes(1);
    expect(mockSendPaymentFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        isFinalAttempt: false,
      }),
    );
  });

  it("sends the email with isFinalAttempt=true at the attempt_count >= 3 boundary", async () => {
    mockGuardedWrite.mockResolvedValueOnce({ written: true, verdict: null });

    await handleInvoicePaymentFailed(buildCtx({ attemptCount: 3 }));

    expect(mockSendPaymentFailed).toHaveBeenCalledTimes(1);
    expect(mockSendPaymentFailed).toHaveBeenCalledWith(
      expect.objectContaining({ isFinalAttempt: true }),
    );
  });

  it("does not send when the write is blocked by the precedence guard", async () => {
    mockGuardedWrite.mockResolvedValueOnce({ written: false, verdict: null });

    await handleInvoicePaymentFailed(buildCtx({ attemptCount: 1 }));

    expect(mockSendPaymentFailed).not.toHaveBeenCalled();
  });

  it("does not send when the invoice carries no customer email", async () => {
    mockGuardedWrite.mockResolvedValueOnce({ written: true, verdict: null });

    await handleInvoicePaymentFailed(buildCtx({ customerEmail: null }));

    expect(mockSendPaymentFailed).not.toHaveBeenCalled();
  });
});
