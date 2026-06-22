/**
 * THE cross-provider merge chokepoint (decision ledger D-precedence).
 *
 * Every webhook-driven write to the profile's billing projection — Stripe
 * or RevenueCat/Apple — is decided here, as a pure function over normalized
 * facts. The DB is the single source of truth for ENTITLEMENT; each provider
 * is the source of truth only for the contract IT bills (D-arch), so:
 *
 *   1. lifetime is never overwritten by any event;
 *   2. a provider's own facts replace its own contract state verbatim;
 *   3. across providers: active beats non-active; between actives the
 *      higher tier wins (lifetime > unlimited > premium > free), then the
 *      later expiry; ties keep the current contract;
 *   4. per-provider ordering: facts older than the last evaluated fact
 *      from the same provider are ignored (the caller supplies the cursor);
 *   5. double-contract (both providers active): keep max entitlement,
 *      surface an admin alert, NEVER auto-cancel the other provider.
 *
 * Units: `currentPeriodEnd` is unix SECONDS (the profile column);
 * `eventTimeMs` is epoch MILLISECONDS (providers' own event clocks).
 */
import type { BillingProviderId, PlanType } from "@handicappin/billing-core";
import { planRank } from "@handicappin/billing-core";
import type { SubscriptionStatus } from "@/lib/stripe-types";

/** A provider's claim about the contract it bills, normalized. */
export interface BillingFact {
  provider: BillingProviderId;
  plan: PlanType | null;
  status: SubscriptionStatus | null;
  /** Unix seconds; null when not applicable (lifetime / no contract). */
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  /** The provider's own event timestamp (epoch ms) — orders same-provider facts. */
  eventTimeMs: number;
  /** The provider's event id — idempotence key. */
  eventId: string;
}

/** The billing slice of the profile row (the stored projection). */
export interface BillingProjection {
  provider: BillingProviderId | null;
  plan: PlanType | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

/** What the caller knows before merging: the projection + the provider cursor. */
export interface CurrentBillingState {
  projection: BillingProjection;
  /**
   * Last successfully EVALUATED event from the INCOMING fact's provider
   * (webhook_events cursor), or null to skip ordering enforcement — the
   * Stripe handlers pass null to preserve their existing semantics.
   */
  lastApplied: { eventTimeMs: number; eventId: string } | null;
}

export interface DoubleContractAlert {
  kind: "double_contract";
  currentProvider: BillingProviderId;
  incomingProvider: BillingProviderId;
  currentPlan: PlanType | null;
  incomingPlan: PlanType | null;
  keptProvider: BillingProviderId;
  eventId: string;
}

export type ApplyReason =
  | "initial" // no current contract — fact lands verbatim
  | "same-provider-update" // provider updated its own contract
  | "active-beats-inactive" // cross-provider: active fact displaces dead contract
  | "double-contract-incoming-wins" // both active; incoming is max entitlement
  | "double-contract-current-wins" // both active; current is max entitlement
  | "idempotent-duplicate" // same eventId as last applied
  | "stale-out-of-order" // older than the provider cursor
  | "lifetime-locked" // current plan is lifetime — absorbing state
  | "inactive-foreign-contract"; // other provider's dead contract — irrelevant

export interface ApplyDecision {
  action: "apply" | "ignore";
  reason: ApplyReason;
  /** The resulting projection (=== input projection content when ignoring). */
  projection: BillingProjection;
  /** True iff action==="apply" AND the projection materially differs. */
  changed: boolean;
  alert: DoubleContractAlert | null;
}

const ACTIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "active",
  "trialing",
]);

function isPaidPlan(plan: PlanType | null): boolean {
  return plan === "premium" || plan === "unlimited" || plan === "lifetime";
}

/** An ACTIVE CONTRACT: a paid plan that is lifetime or currently billing. */
function isActiveContract(c: {
  plan: PlanType | null;
  status: SubscriptionStatus | null;
}): boolean {
  if (!isPaidPlan(c.plan)) return false;
  if (c.plan === "lifetime") return true;
  return c.status !== null && ACTIVE_STATUSES.has(c.status);
}

/**
 * Normalize a fact into the projection it would produce if applied.
 * A fact that ends entitlement (plan free/null) clears the contract
 * metadata — mirroring the existing subscription.deleted write.
 */
function projectionFromFact(fact: BillingFact): BillingProjection {
  if (!isPaidPlan(fact.plan)) {
    return {
      provider: null,
      plan: fact.plan ?? null,
      status: fact.status,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
  return {
    provider: fact.provider,
    plan: fact.plan,
    status: fact.status,
    currentPeriodEnd: fact.plan === "lifetime" ? null : fact.currentPeriodEnd,
    cancelAtPeriodEnd: fact.plan === "lifetime" ? false : fact.cancelAtPeriodEnd,
  };
}

function projectionsEqual(a: BillingProjection, b: BillingProjection): boolean {
  return (
    a.provider === b.provider &&
    a.plan === b.plan &&
    a.status === b.status &&
    a.currentPeriodEnd === b.currentPeriodEnd &&
    a.cancelAtPeriodEnd === b.cancelAtPeriodEnd
  );
}

/** Higher tier wins; equal tiers fall back to later expiry; tie → current. */
function incomingBeatsCurrentAmongActives(
  current: BillingProjection,
  incoming: BillingFact,
): boolean {
  const rankDelta = planRank(incoming.plan) - planRank(current.plan);
  if (rankDelta !== 0) return rankDelta > 0;
  const currentEnd = current.currentPeriodEnd ?? 0;
  const incomingEnd = incoming.currentPeriodEnd ?? 0;
  return incomingEnd > currentEnd;
}

function ignore(
  projection: BillingProjection,
  reason: ApplyReason,
  alert: DoubleContractAlert | null = null,
): ApplyDecision {
  return { action: "ignore", reason, projection, changed: false, alert };
}

function apply(
  current: BillingProjection,
  incoming: BillingFact,
  reason: ApplyReason,
  alert: DoubleContractAlert | null = null,
): ApplyDecision {
  const next = projectionFromFact(incoming);
  return {
    action: "apply",
    reason,
    projection: next,
    changed: !projectionsEqual(current, next),
    alert,
  };
}

function doubleContractAlert(
  current: BillingProjection,
  incoming: BillingFact,
  keptProvider: BillingProviderId,
): DoubleContractAlert {
  return {
    kind: "double_contract",
    // current.provider is non-null on every double-contract path
    currentProvider: current.provider as BillingProviderId,
    incomingProvider: incoming.provider,
    currentPlan: current.plan,
    incomingPlan: incoming.plan,
    keptProvider,
    eventId: incoming.eventId,
  };
}

/**
 * Decide what an incoming billing fact does to the stored projection.
 * Pure — no I/O, no clock, no randomness. The caller persists
 * `decision.projection` (and bumps billing_version) iff `decision.changed`,
 * and routes `decision.alert` to admin alerting.
 */
export function applyBillingEvent(
  current: CurrentBillingState,
  incoming: BillingFact,
): ApplyDecision {
  const { projection, lastApplied } = current;

  // 1. Idempotence: the exact same event re-delivered is a no-op.
  if (lastApplied !== null && lastApplied.eventId === incoming.eventId) {
    return ignore(projection, "idempotent-duplicate");
  }

  // 2. Per-provider ordering: never let an older fact rewind newer state.
  if (lastApplied !== null && incoming.eventTimeMs < lastApplied.eventTimeMs) {
    return ignore(projection, "stale-out-of-order");
  }

  // 3. Lifetime is absorbing — no event overwrites it. Still surface the
  //    double-pay alert when ANOTHER provider claims an active contract.
  if (projection.plan === "lifetime") {
    const crossProviderActive =
      projection.provider !== null &&
      incoming.provider !== projection.provider &&
      isActiveContract(incoming);
    return ignore(
      projection,
      "lifetime-locked",
      crossProviderActive
        ? doubleContractAlert(projection, incoming, projection.provider as BillingProviderId)
        : null,
    );
  }

  // 4. No attributed contract yet (never paid, or reverted to free):
  //    the fact lands verbatim.
  if (projection.provider === null) {
    return apply(projection, incoming, "initial");
  }

  // 5. A provider's own facts replace its own contract state — it is the
  //    source of truth for the contract it bills (D-arch).
  if (incoming.provider === projection.provider) {
    return apply(projection, incoming, "same-provider-update");
  }

  // 6. Cross-provider arbitration.
  const currentActive = isActiveContract(projection);
  const incomingActive = isActiveContract(incoming);

  if (currentActive && incomingActive) {
    // Double contract: keep max entitlement, alert, never auto-cancel.
    if (incomingBeatsCurrentAmongActives(projection, incoming)) {
      return apply(
        projection,
        incoming,
        "double-contract-incoming-wins",
        doubleContractAlert(projection, incoming, incoming.provider),
      );
    }
    return ignore(
      projection,
      "double-contract-current-wins",
      doubleContractAlert(projection, incoming, projection.provider),
    );
  }

  if (incomingActive) {
    // Current contract is dead (canceled/past_due/...) — the new provider's
    // active contract takes over.
    return apply(projection, incoming, "active-beats-inactive");
  }

  // Incoming describes the OTHER provider's inactive contract — it says
  // nothing about the contract that owns the projection.
  return ignore(projection, "inactive-foreign-contract");
}
