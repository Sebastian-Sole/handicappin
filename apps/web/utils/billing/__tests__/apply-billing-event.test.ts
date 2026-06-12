import { describe, test, expect } from "vitest";
import {
  applyBillingEvent,
  type BillingFact,
  type BillingProjection,
  type CurrentBillingState,
} from "../apply-billing-event";
import type { BillingProviderId, PlanType } from "@handicappin/billing-core";
import type { SubscriptionStatus } from "@/lib/stripe-types";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const T0 = 1_750_000_000_000; // arbitrary fixed epoch ms
const PERIOD_END = 1_780_000_000; // unix seconds, far future
const LATER_PERIOD_END = PERIOD_END + 86_400 * 30;

let eventCounter = 0;

function fact(overrides: Partial<BillingFact> = {}): BillingFact {
  eventCounter += 1;
  return {
    provider: "apple",
    plan: "premium",
    status: "active",
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    eventTimeMs: T0,
    eventId: `evt_${eventCounter}`,
    ...overrides,
  };
}

function projection(
  overrides: Partial<BillingProjection> = {},
): BillingProjection {
  return {
    provider: null,
    plan: null,
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function state(
  proj: BillingProjection,
  lastApplied: CurrentBillingState["lastApplied"] = null,
): CurrentBillingState {
  return { projection: proj, lastApplied };
}

const stripeActivePremium = () =>
  projection({
    provider: "stripe",
    plan: "premium",
    status: "active",
    currentPeriodEnd: PERIOD_END,
  });

const stripeActiveUnlimited = () =>
  projection({
    provider: "stripe",
    plan: "unlimited",
    status: "active",
    currentPeriodEnd: PERIOD_END,
  });

const stripeLifetime = () =>
  projection({ provider: "stripe", plan: "lifetime", status: "active" });

const freeProjection = () =>
  projection({ provider: null, plan: "free", status: "active" });

// ---------------------------------------------------------------------------
// 1. Idempotence
// ---------------------------------------------------------------------------

describe("idempotence", () => {
  test("re-delivery of the exact same event id is a no-op", () => {
    const proj = stripeActivePremium();
    const incoming = fact({ provider: "stripe", eventId: "evt_dup" });
    const decision = applyBillingEvent(
      state(proj, { eventTimeMs: T0, eventId: "evt_dup" }),
      incoming,
    );
    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("idempotent-duplicate");
    expect(decision.changed).toBe(false);
    expect(decision.projection).toEqual(proj);
    expect(decision.alert).toBeNull();
  });

  test("applying the same fact twice yields no change the second time", () => {
    const incoming = fact({
      provider: "apple",
      plan: "unlimited",
      eventId: "evt_once",
    });
    const first = applyBillingEvent(state(projection()), incoming);
    expect(first.action).toBe("apply");
    expect(first.changed).toBe(true);

    // Second application: cursor now points at the same event.
    const second = applyBillingEvent(
      state(first.projection, { eventTimeMs: T0, eventId: "evt_once" }),
      incoming,
    );
    expect(second.action).toBe("ignore");
    expect(second.reason).toBe("idempotent-duplicate");
    expect(second.projection).toEqual(first.projection);
  });

  test("re-applying identical state without a cursor applies but reports changed=false", () => {
    const proj = projection({
      provider: "apple",
      plan: "premium",
      status: "active",
      currentPeriodEnd: PERIOD_END,
    });
    const incoming = fact({ provider: "apple" });
    const decision = applyBillingEvent(state(proj), incoming);
    expect(decision.action).toBe("apply");
    expect(decision.changed).toBe(false);
    expect(decision.projection).toEqual(proj);
  });
});

// ---------------------------------------------------------------------------
// 2. Out-of-order guard
// ---------------------------------------------------------------------------

describe("per-provider out-of-order guard", () => {
  test("a fact older than the provider cursor is ignored as stale", () => {
    const proj = projection({
      provider: "apple",
      plan: "premium",
      status: "active",
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: true, // user cancelled (newer info)
    });
    // Older INITIAL_PURCHASE-shaped fact arrives late.
    const stale = fact({ provider: "apple", eventTimeMs: T0 - 60_000 });
    const decision = applyBillingEvent(
      state(proj, { eventTimeMs: T0, eventId: "evt_newer" }),
      stale,
    );
    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("stale-out-of-order");
    expect(decision.projection).toEqual(proj);
  });

  test("an equal-timestamp fact with a different id is NOT stale", () => {
    const proj = projection({
      provider: "apple",
      plan: "premium",
      status: "active",
      currentPeriodEnd: PERIOD_END,
    });
    const sameMs = fact({
      provider: "apple",
      plan: "unlimited",
      eventTimeMs: T0,
    });
    const decision = applyBillingEvent(
      state(proj, { eventTimeMs: T0, eventId: "evt_other" }),
      sameMs,
    );
    expect(decision.action).toBe("apply");
    expect(decision.projection.plan).toBe("unlimited");
  });

  test("no cursor (lastApplied null) skips ordering enforcement", () => {
    const proj = projection({
      provider: "apple",
      plan: "premium",
      status: "active",
      currentPeriodEnd: PERIOD_END,
    });
    const old = fact({
      provider: "apple",
      plan: "unlimited",
      eventTimeMs: T0 - 999_999,
    });
    const decision = applyBillingEvent(state(proj), old);
    expect(decision.action).toBe("apply");
  });

  test("staleness wins over idempotence only when ids differ", () => {
    const proj = stripeActivePremium();
    const older = fact({
      provider: "stripe",
      plan: "unlimited",
      eventTimeMs: T0 - 1,
      eventId: "evt_old",
    });
    const decision = applyBillingEvent(
      state(proj, { eventTimeMs: T0, eventId: "evt_new" }),
      older,
    );
    expect(decision.reason).toBe("stale-out-of-order");
  });
});

// ---------------------------------------------------------------------------
// 3. Lifetime is absorbing
// ---------------------------------------------------------------------------

describe("lifetime lock", () => {
  const lifetimeOwners: BillingProviderId[] = ["stripe", "apple"];

  test.each(lifetimeOwners)(
    "no event overwrites a %s-owned lifetime",
    (owner) => {
      const proj = projection({
        provider: owner,
        plan: "lifetime",
        status: "active",
      });
      const attempts: BillingFact[] = [
        fact({ provider: "stripe", plan: "premium", status: "active" }),
        fact({ provider: "apple", plan: "unlimited", status: "active" }),
        fact({ provider: owner, plan: "free", status: "canceled" }), // own EXPIRATION
        fact({ provider: owner, plan: "premium", status: "past_due" }),
        fact({ provider: owner, plan: "lifetime", status: "active" }),
      ];
      for (const attempt of attempts) {
        const decision = applyBillingEvent(state(proj), attempt);
        expect(decision.action).toBe("ignore");
        expect(decision.reason).toBe("lifetime-locked");
        expect(decision.projection).toEqual(proj);
      }
    },
  );

  test("cross-provider ACTIVE fact against lifetime raises the double-contract alert", () => {
    const decision = applyBillingEvent(
      state(stripeLifetime()),
      fact({ provider: "apple", plan: "unlimited", status: "active" }),
    );
    expect(decision.action).toBe("ignore");
    expect(decision.alert).not.toBeNull();
    expect(decision.alert?.kind).toBe("double_contract");
    expect(decision.alert?.keptProvider).toBe("stripe");
    expect(decision.alert?.currentPlan).toBe("lifetime");
    expect(decision.alert?.incomingPlan).toBe("unlimited");
  });

  test("cross-provider lifetime purchase against lifetime also alerts", () => {
    const decision = applyBillingEvent(
      state(stripeLifetime()),
      fact({ provider: "apple", plan: "lifetime", status: "active" }),
    );
    expect(decision.reason).toBe("lifetime-locked");
    expect(decision.alert?.keptProvider).toBe("stripe");
  });

  test("same-provider events against lifetime do not alert", () => {
    const decision = applyBillingEvent(
      state(stripeLifetime()),
      fact({ provider: "stripe", plan: "premium", status: "active" }),
    );
    expect(decision.reason).toBe("lifetime-locked");
    expect(decision.alert).toBeNull();
  });

  test("cross-provider INACTIVE fact against lifetime does not alert", () => {
    const decision = applyBillingEvent(
      state(stripeLifetime()),
      fact({ provider: "apple", plan: "premium", status: "past_due" }),
    );
    expect(decision.reason).toBe("lifetime-locked");
    expect(decision.alert).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Initial application (no attributed contract)
// ---------------------------------------------------------------------------

describe("initial application", () => {
  test("first paid fact lands verbatim on a never-paid profile", () => {
    const decision = applyBillingEvent(
      state(projection()),
      fact({
        provider: "apple",
        plan: "premium",
        status: "active",
        currentPeriodEnd: PERIOD_END,
      }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.reason).toBe("initial");
    expect(decision.projection).toEqual({
      provider: "apple",
      plan: "premium",
      status: "active",
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: false,
    });
  });

  test("first paid fact lands on a free-tier profile (provider null)", () => {
    const decision = applyBillingEvent(
      state(freeProjection()),
      fact({ provider: "apple", plan: "unlimited", status: "active" }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.projection.plan).toBe("unlimited");
    expect(decision.projection.provider).toBe("apple");
  });

  test("a non-active fact also lands when there is no contract to defend", () => {
    // e.g. CANCELLATION arrives before the (lost) INITIAL_PURCHASE: the user
    // is entitled until period end, matching web's canceled+grace semantics.
    const decision = applyBillingEvent(
      state(projection()),
      fact({
        provider: "apple",
        plan: "premium",
        status: "active",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: PERIOD_END,
      }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.projection.cancelAtPeriodEnd).toBe(true);
  });

  test("lifetime fact normalizes period fields", () => {
    const decision = applyBillingEvent(
      state(projection()),
      fact({
        provider: "apple",
        plan: "lifetime",
        status: "active",
        currentPeriodEnd: PERIOD_END, // bogus input — must be cleared
        cancelAtPeriodEnd: true, // bogus input — must be cleared
      }),
    );
    expect(decision.projection).toEqual({
      provider: "apple",
      plan: "lifetime",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  test("free fact clears contract metadata (provider, period, cap)", () => {
    const decision = applyBillingEvent(
      state(projection()),
      fact({
        provider: "apple",
        plan: "free",
        status: "canceled",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: true,
      }),
    );
    expect(decision.projection).toEqual({
      provider: null,
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Same-provider lifecycle (provider owns its own contract)
// ---------------------------------------------------------------------------

describe("same-provider lifecycle", () => {
  test("renewal extends the period", () => {
    const proj = projection({
      provider: "apple",
      plan: "premium",
      status: "active",
      currentPeriodEnd: PERIOD_END,
    });
    const decision = applyBillingEvent(
      state(proj),
      fact({
        provider: "apple",
        plan: "premium",
        currentPeriodEnd: LATER_PERIOD_END,
      }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.reason).toBe("same-provider-update");
    expect(decision.projection.currentPeriodEnd).toBe(LATER_PERIOD_END);
  });

  test("upgrade applies (premium → unlimited)", () => {
    const decision = applyBillingEvent(
      state(
        projection({
          provider: "apple",
          plan: "premium",
          status: "active",
          currentPeriodEnd: PERIOD_END,
        }),
      ),
      fact({ provider: "apple", plan: "unlimited" }),
    );
    expect(decision.projection.plan).toBe("unlimited");
  });

  test("downgrade applies (unlimited → premium) — the provider is source of truth for its contract", () => {
    const decision = applyBillingEvent(
      state(
        projection({
          provider: "apple",
          plan: "unlimited",
          status: "active",
          currentPeriodEnd: PERIOD_END,
        }),
      ),
      fact({ provider: "apple", plan: "premium" }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.projection.plan).toBe("premium");
  });

  test("cancellation sets cancel_at_period_end without dropping entitlement", () => {
    const decision = applyBillingEvent(
      state(
        projection({
          provider: "apple",
          plan: "premium",
          status: "active",
          currentPeriodEnd: PERIOD_END,
        }),
      ),
      fact({
        provider: "apple",
        plan: "premium",
        status: "active",
        cancelAtPeriodEnd: true,
      }),
    );
    expect(decision.projection.cancelAtPeriodEnd).toBe(true);
    expect(decision.projection.plan).toBe("premium");
    expect(decision.projection.status).toBe("active");
  });

  test("uncancellation clears cancel_at_period_end", () => {
    const decision = applyBillingEvent(
      state(
        projection({
          provider: "apple",
          plan: "premium",
          status: "active",
          currentPeriodEnd: PERIOD_END,
          cancelAtPeriodEnd: true,
        }),
      ),
      fact({ provider: "apple", plan: "premium", cancelAtPeriodEnd: false }),
    );
    expect(decision.projection.cancelAtPeriodEnd).toBe(false);
  });

  test("billing issue moves status to past_due", () => {
    const decision = applyBillingEvent(
      state(
        projection({
          provider: "apple",
          plan: "unlimited",
          status: "active",
          currentPeriodEnd: PERIOD_END,
        }),
      ),
      fact({ provider: "apple", plan: "unlimited", status: "past_due" }),
    );
    expect(decision.projection.status).toBe("past_due");
    expect(decision.projection.provider).toBe("apple");
  });

  test("expiration reverts to free and clears the provider", () => {
    const decision = applyBillingEvent(
      state(
        projection({
          provider: "apple",
          plan: "premium",
          status: "active",
          currentPeriodEnd: PERIOD_END,
        }),
      ),
      fact({
        provider: "apple",
        plan: "free",
        status: "canceled",
        currentPeriodEnd: null,
      }),
    );
    expect(decision.projection).toEqual({
      provider: null,
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  test("recovery from past_due applies (renewal after billing issue)", () => {
    const decision = applyBillingEvent(
      state(
        projection({
          provider: "apple",
          plan: "unlimited",
          status: "past_due",
          currentPeriodEnd: PERIOD_END,
        }),
      ),
      fact({
        provider: "apple",
        plan: "unlimited",
        status: "active",
        currentPeriodEnd: LATER_PERIOD_END,
      }),
    );
    expect(decision.projection.status).toBe("active");
    expect(decision.projection.currentPeriodEnd).toBe(LATER_PERIOD_END);
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-provider arbitration
// ---------------------------------------------------------------------------

describe("cross-provider: active beats non-active", () => {
  const deadStates: Array<Partial<BillingProjection>> = [
    { status: "past_due" },
    { status: "canceled", cancelAtPeriodEnd: true },
    { status: "unpaid" },
    { status: "incomplete" },
    { status: "paused" },
  ];

  test.each(deadStates)(
    "incoming apple-active displaces a dead stripe contract (%o)",
    (dead) => {
      const proj = projection({
        provider: "stripe",
        plan: "premium",
        currentPeriodEnd: PERIOD_END,
        ...dead,
      });
      const decision = applyBillingEvent(
        state(proj),
        fact({ provider: "apple", plan: "premium", status: "active" }),
      );
      expect(decision.action).toBe("apply");
      expect(decision.reason).toBe("active-beats-inactive");
      expect(decision.projection.provider).toBe("apple");
      expect(decision.alert).toBeNull();
    },
  );

  test("incoming stripe-active displaces a dead apple contract", () => {
    const proj = projection({
      provider: "apple",
      plan: "unlimited",
      status: "past_due",
      currentPeriodEnd: PERIOD_END,
    });
    const decision = applyBillingEvent(
      state(proj),
      fact({ provider: "stripe", plan: "premium", status: "active" }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.projection.provider).toBe("stripe");
    expect(decision.projection.plan).toBe("premium");
  });

  test("an inactive fact about the OTHER provider's contract is ignored", () => {
    // stripe-active user; apple says some apple contract expired. Irrelevant.
    const proj = stripeActivePremium();
    const decision = applyBillingEvent(
      state(proj),
      fact({ provider: "apple", plan: "free", status: "canceled" }),
    );
    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("inactive-foreign-contract");
    expect(decision.projection).toEqual(proj);
    expect(decision.alert).toBeNull();
  });

  test("two dead contracts: current stands", () => {
    const proj = projection({
      provider: "stripe",
      plan: "premium",
      status: "past_due",
      currentPeriodEnd: PERIOD_END,
    });
    const decision = applyBillingEvent(
      state(proj),
      fact({ provider: "apple", plan: "premium", status: "past_due" }),
    );
    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("inactive-foreign-contract");
  });
});

describe("cross-provider: double contract (both active)", () => {
  test("higher incoming tier wins and alerts (stripe premium vs apple unlimited)", () => {
    const decision = applyBillingEvent(
      state(stripeActivePremium()),
      fact({ provider: "apple", plan: "unlimited", status: "active" }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.reason).toBe("double-contract-incoming-wins");
    expect(decision.projection.provider).toBe("apple");
    expect(decision.projection.plan).toBe("unlimited");
    expect(decision.alert).toEqual({
      kind: "double_contract",
      currentProvider: "stripe",
      incomingProvider: "apple",
      currentPlan: "premium",
      incomingPlan: "unlimited",
      keptProvider: "apple",
      eventId: decision.alert?.eventId,
    });
  });

  test("higher current tier stands and alerts (stripe unlimited vs apple premium)", () => {
    const proj = stripeActiveUnlimited();
    const decision = applyBillingEvent(
      state(proj),
      fact({ provider: "apple", plan: "premium", status: "active" }),
    );
    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("double-contract-current-wins");
    expect(decision.projection).toEqual(proj);
    expect(decision.alert?.keptProvider).toBe("stripe");
  });

  test("equal tier: later expiry wins (incoming later)", () => {
    const decision = applyBillingEvent(
      state(stripeActivePremium()),
      fact({
        provider: "apple",
        plan: "premium",
        status: "active",
        currentPeriodEnd: LATER_PERIOD_END,
      }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.reason).toBe("double-contract-incoming-wins");
    expect(decision.projection.currentPeriodEnd).toBe(LATER_PERIOD_END);
    expect(decision.alert).not.toBeNull();
  });

  test("equal tier: earlier incoming expiry loses", () => {
    const proj = projection({
      provider: "stripe",
      plan: "premium",
      status: "active",
      currentPeriodEnd: LATER_PERIOD_END,
    });
    const decision = applyBillingEvent(
      state(proj),
      fact({
        provider: "apple",
        plan: "premium",
        status: "active",
        currentPeriodEnd: PERIOD_END,
      }),
    );
    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("double-contract-current-wins");
    expect(decision.alert).not.toBeNull();
  });

  test("exact tie keeps the current contract (no flapping)", () => {
    const decision = applyBillingEvent(
      state(stripeActivePremium()),
      fact({
        provider: "apple",
        plan: "premium",
        status: "active",
        currentPeriodEnd: PERIOD_END,
      }),
    );
    expect(decision.action).toBe("ignore");
    expect(decision.reason).toBe("double-contract-current-wins");
  });

  test("incoming apple lifetime purchase beats an active stripe sub and alerts", () => {
    const decision = applyBillingEvent(
      state(stripeActiveUnlimited()),
      fact({
        provider: "apple",
        plan: "lifetime",
        status: "active",
        currentPeriodEnd: null,
      }),
    );
    expect(decision.action).toBe("apply");
    expect(decision.projection.plan).toBe("lifetime");
    expect(decision.projection.provider).toBe("apple");
    expect(decision.alert?.keptProvider).toBe("apple");
  });

  test("trialing counts as active on both sides", () => {
    const proj = projection({
      provider: "stripe",
      plan: "premium",
      status: "trialing",
      currentPeriodEnd: PERIOD_END,
    });
    const decision = applyBillingEvent(
      state(proj),
      fact({ provider: "apple", plan: "premium", status: "trialing" }),
    );
    expect(decision.reason).toBe("double-contract-current-wins");
    expect(decision.alert).not.toBeNull();
  });

  test("never auto-cancels: losing decision leaves the other contract untouched", () => {
    // The decision only ever returns a projection — there is no side channel
    // that could cancel anything. Assert the losing fact changes nothing.
    const proj = stripeActiveUnlimited();
    const decision = applyBillingEvent(
      state(proj),
      fact({ provider: "apple", plan: "premium", status: "active" }),
    );
    expect(decision.projection).toEqual(proj);
    expect(decision.changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Full precedence matrix (programmatic sweep)
// ---------------------------------------------------------------------------

describe("precedence matrix sweep", () => {
  const tiers: PlanType[] = ["premium", "unlimited"];
  const statuses: SubscriptionStatus[] = ["active", "past_due", "canceled"];

  for (const curPlan of tiers) {
    for (const curStatus of statuses) {
      for (const inPlan of tiers) {
        for (const inStatus of statuses) {
          const curActive = curStatus === "active";
          const inActive = inStatus === "active";
          test(`stripe ${curPlan}/${curStatus} vs apple ${inPlan}/${inStatus}`, () => {
            const proj = projection({
              provider: "stripe",
              plan: curPlan,
              status: curStatus,
              currentPeriodEnd: PERIOD_END,
            });
            const decision = applyBillingEvent(
              state(proj),
              fact({
                provider: "apple",
                plan: inPlan,
                status: inStatus,
                currentPeriodEnd: PERIOD_END,
              }),
            );

            if (curActive && inActive) {
              // Double contract: tier decides (equal tier + equal expiry → current).
              const inWins =
                (inPlan === "unlimited" ? 2 : 1) >
                (curPlan === "unlimited" ? 2 : 1);
              expect(decision.action).toBe(inWins ? "apply" : "ignore");
              expect(decision.alert?.kind).toBe("double_contract");
            } else if (!curActive && inActive) {
              expect(decision.action).toBe("apply");
              expect(decision.reason).toBe("active-beats-inactive");
              expect(decision.alert).toBeNull();
            } else {
              // Incoming inactive never displaces a foreign contract.
              expect(decision.action).toBe("ignore");
              expect(decision.reason).toBe("inactive-foreign-contract");
              expect(decision.alert).toBeNull();
            }
          });
        }
      }
    }
  }
});
