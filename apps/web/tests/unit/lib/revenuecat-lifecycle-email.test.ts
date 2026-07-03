/**
 * RevenueCat webhook lifecycle-email mapping unit tests (plan 005).
 *
 * `classifyRevenueCatLifecycleEmail` in
 * apps/web/app/api/webhooks/revenuecat/route.ts is a pure function (no
 * I/O) so it's tested directly: exactly two event families produce an
 * email, everything else is a no-op.
 *
 * Importing route.ts pulls in its module-level dependencies (@/db, @/env,
 * rate limiting, admin alerts, email-service) which have real side effects
 * (DB client construction, env var validation) outside a configured
 * environment — all stubbed here the same way
 * apps/web/tests/unit/lib/stripe-account.test.ts stubs @/db, since none of
 * them are exercised by the pure classifier under test.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    NODE_ENV: "test",
    REVENUECAT_WEBHOOK_AUTH_TOKEN: "test-token",
    ADMIN_ALERT_EMAILS: "",
  },
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ profile: {}, webhookEvents: {} }));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  isNotNull: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  webhookRateLimit: { limit: vi.fn() },
  getIdentifier: vi.fn(),
}));
vi.mock("@/lib/admin-alerts", () => ({
  sendDoubleContractAlert: vi.fn(),
  sendTransferAlert: vi.fn(),
}));
vi.mock("@/lib/email-service", () => ({
  sendSubscriptionCancelledEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
}));

import { classifyRevenueCatLifecycleEmail } from "@/app/api/webhooks/revenuecat/route";

describe("classifyRevenueCatLifecycleEmail", () => {
  it("maps CANCELLATION to the cancelled email", () => {
    expect(classifyRevenueCatLifecycleEmail("CANCELLATION")).toBe("cancelled");
  });

  it("maps BILLING_ISSUE to the payment-failed email", () => {
    expect(classifyRevenueCatLifecycleEmail("BILLING_ISSUE")).toBe(
      "payment-failed",
    );
  });

  it.each([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "EXPIRATION",
    "NON_RENEWING_PURCHASE",
    "PRODUCT_CHANGE",
    "TRANSFER",
    "TEST",
    "SOME_FUTURE_EVENT_TYPE",
  ])("maps %s to no email", (eventType) => {
    expect(classifyRevenueCatLifecycleEmail(eventType)).toBeNull();
  });
});
