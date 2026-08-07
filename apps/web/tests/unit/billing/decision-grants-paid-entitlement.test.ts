/**
 * `decisionGrantsPaidEntitlement` — the guard at the centre of the
 * quarantine-unlock feature (contract 005 §5).
 *
 * It is a PURE predicate, and its behaviour is what decides whether an
 * account's quarantined rounds come back. Its only other coverage lives in
 * `tests/integration/quarantine-unlock-on-upgrade.test.ts`, which sits behind
 * the `describeIfLocal` guard and therefore SKIPS in CI. These unit tests run
 * in CI (`pnpm test:unit`), so the guard is enforced on every push.
 *
 * `@/db` is mocked because importing the module under test otherwise opens a
 * postgres client; the predicate itself touches no I/O.
 */
import { describe, test, expect, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import {
  applyBillingEvent,
  type ApplyDecision,
  type BillingFact,
  type BillingProjection,
} from "@/utils/billing/apply-billing-event";
import { decisionGrantsPaidEntitlement } from "@/utils/billing/unlock-quarantined-rounds";
import type { PlanType } from "@handicappin/billing-core";

const FUTURE_S = Math.floor(Date.parse("2027-06-12T00:00:00.000Z") / 1000);

/** A decision carrying `plan` as its RESULTING projection. */
function decisionWithPlan(plan: PlanType | null): ApplyDecision {
  return {
    action: "apply",
    reason: "same-provider-update",
    projection: {
      provider: "stripe",
      plan,
      status: plan === null || plan === "free" ? null : "active",
      currentPeriodEnd: plan === "lifetime" ? null : FUTURE_S,
      cancelAtPeriodEnd: false,
    },
    changed: true,
    alert: null,
  };
}

function stripeFact(overrides: Partial<BillingFact> = {}): BillingFact {
  return {
    provider: "stripe",
    plan: "premium",
    status: "active",
    currentPeriodEnd: FUTURE_S,
    cancelAtPeriodEnd: false,
    eventTimeMs: Date.parse("2026-08-01T00:00:00.000Z"),
    eventId: "evt_unit_1",
    ...overrides,
  };
}

describe("decisionGrantsPaidEntitlement", () => {
  // -------------------------------------------------------------------------
  // Paid plans unlock
  // -------------------------------------------------------------------------

  test.each(["premium", "unlimited", "lifetime"] as const)(
    "a resulting projection on %s grants the paid entitlement",
    (plan) => {
      expect(decisionGrantsPaidEntitlement(decisionWithPlan(plan))).toBe(true);
    }
  );

  // -------------------------------------------------------------------------
  // Non-paid plans do not
  // -------------------------------------------------------------------------

  test("a resulting projection on free does NOT grant the paid entitlement", () => {
    expect(decisionGrantsPaidEntitlement(decisionWithPlan("free"))).toBe(false);
  });

  test("a null resulting plan does NOT grant the paid entitlement", () => {
    expect(decisionGrantsPaidEntitlement(decisionWithPlan(null))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // The case this feature exists for: the predicate reads the RESULTING
  // PROJECTION, never `action === "apply"`.
  // -------------------------------------------------------------------------

  test("an IGNORE decision whose projection is lifetime still grants the entitlement", () => {
    // Built by the real chokepoint, not hand-rolled: an already-lifetime
    // profile makes `applyBillingEvent` absorbing — step 3 returns
    // `lifetime-locked` → ignore before any same-provider apply. This is the
    // shape EVERY redelivery takes for a lifetime account after a failed
    // unlock, so if the guard rejected it the rounds would stay quarantined
    // forever (no re-quarantine or re-unlock path exists to correct it).
    const lifetimeProjection: BillingProjection = {
      provider: "stripe",
      plan: "lifetime",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
    const decision = applyBillingEvent(
      { projection: lifetimeProjection, lastApplied: null },
      stripeFact({ plan: "lifetime", currentPeriodEnd: null })
    );

    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("lifetime-locked");
    expect(decision.projection.plan).toBe("lifetime");
    expect(decisionGrantsPaidEntitlement(decision)).toBe(true);
  });

  test("an IGNORE decision whose projection is free does NOT grant the entitlement", () => {
    // The mirror case, from the same real chokepoint: a free profile stamped
    // with the other provider plus an inactive incoming fact is decided
    // `inactive-foreign-contract` → ignore. Widening the guard to the
    // resulting projection must not accidentally unlock a still-capped
    // account.
    const decision = applyBillingEvent(
      {
        projection: {
          provider: "apple",
          plan: "free",
          status: "canceled",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
        lastApplied: null,
      },
      stripeFact({ status: "canceled", currentPeriodEnd: null })
    );

    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("inactive-foreign-contract");
    expect(decision.projection.plan).toBe("free");
    expect(decisionGrantsPaidEntitlement(decision)).toBe(false);
  });
});
