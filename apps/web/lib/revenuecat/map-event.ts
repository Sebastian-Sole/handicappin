/**
 * RevenueCat event → normalized BillingFact (decision ledger D-status-mapping).
 *
 * Pure: takes the parsed RC event plus the user's current projection (some RC
 * events carry partial information — CANCELLATION says only "auto-renew off",
 * so the rest of the fact is overlaid from the same-provider contract state,
 * exactly like Stripe's subscription.updated arrives with full state).
 *
 * | RC event              | Fact                                              |
 * |-----------------------|---------------------------------------------------|
 * | INITIAL_PURCHASE      | plan from SKU, active (trialing on TRIAL period)  |
 * | RENEWAL               | same — also resolves deferred downgrades          |
 * | PRODUCT_CHANGE        | NO fact (informational; RENEWAL carries product)  |
 * | CANCELLATION          | cancel_at_period_end: true, rest from current     |
 * | UNCANCELLATION        | cancel_at_period_end: false                       |
 * | BILLING_ISSUE         | past_due (denies immediately; no grace nuance)    |
 * | EXPIRATION            | free/canceled (mirror of subscription.deleted)    |
 * | NON_RENEWING_PURCHASE | lifetime SKU → lifetime (payment_intent mirror)   |
 * | TRANSFER              | NO fact — admin alert only                        |
 */
import { appleSkuToPlan } from "@handicappin/billing-core";
import type {
  BillingFact,
  BillingProjection,
} from "@/utils/billing/apply-billing-event";
import type { RcEvent } from "./schema";

export type RcMapResult =
  | { kind: "fact"; fact: BillingFact }
  | { kind: "transfer" }
  | { kind: "skip"; reason: RcSkipReason };

export type RcSkipReason =
  | "test-event"
  | "unhandled-type"
  | "product-change-informational"
  | "unsupported-store"
  | "unknown-product";

function msToSeconds(ms: number | null | undefined): number | null {
  return typeof ms === "number" ? Math.floor(ms / 1000) : null;
}

/**
 * The same-provider contract state to overlay partial events onto — only
 * meaningful while the projection is actually attributed to Apple.
 */
function appleBase(projection: BillingProjection): BillingProjection | null {
  return projection.provider === "apple" ? projection : null;
}

export function mapRevenueCatEvent(
  event: RcEvent,
  projection: BillingProjection,
): RcMapResult {
  if (event.type === "TEST") {
    return { kind: "skip", reason: "test-event" };
  }

  if (event.type === "TRANSFER") {
    // D-status-mapping: no entitlement write, admin alert only.
    return { kind: "transfer" };
  }

  if (event.type === "PRODUCT_CHANGE") {
    // RC sends PRODUCT_CHANGE alongside (upgrade) or ahead of (downgrade)
    // the RENEWAL that actually carries the new product. Writing here would
    // either double-apply or grant the downgrade early — and advancing the
    // ordering cursor here could suppress that very RENEWAL. Skip (D24).
    return { kind: "skip", reason: "product-change-informational" };
  }

  // D-rc-scope: RevenueCat is Apple-side plumbing only. RC's Stripe/Web
  // Billing integrations are not used; PROMOTIONAL/PLAY_STORE etc. have no
  // mapping into this projection.
  if (event.store !== undefined && event.store !== "APP_STORE") {
    return { kind: "skip", reason: "unsupported-store" };
  }

  const base = appleBase(projection);
  const skuPlan = event.product_id ? appleSkuToPlan(event.product_id) : null;
  const periodEndSeconds = msToSeconds(event.expiration_at_ms);
  const common = {
    provider: "apple" as const,
    eventTimeMs: event.event_timestamp_ms,
    eventId: event.id,
  };

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL": {
      if (!skuPlan) return { kind: "skip", reason: "unknown-product" };
      return {
        kind: "fact",
        fact: {
          ...common,
          plan: skuPlan,
          status: event.period_type === "TRIAL" ? "trialing" : "active",
          currentPeriodEnd: periodEndSeconds,
          cancelAtPeriodEnd: false,
        },
      };
    }

    case "NON_RENEWING_PURCHASE": {
      // Only the lifetime SKU exists as a non-renewing product (D-products).
      if (skuPlan !== "lifetime") {
        return { kind: "skip", reason: "unknown-product" };
      }
      return {
        kind: "fact",
        fact: {
          ...common,
          plan: "lifetime",
          status: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
      };
    }

    case "CANCELLATION": {
      const plan = skuPlan ?? base?.plan ?? null;
      if (!plan) return { kind: "skip", reason: "unknown-product" };
      return {
        kind: "fact",
        fact: {
          ...common,
          plan,
          // Auto-renew off says nothing about the CURRENT status — keep it
          // (a past_due contract being cancelled must stay past_due).
          status: base?.status ?? "active",
          currentPeriodEnd: periodEndSeconds ?? base?.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: true,
        },
      };
    }

    case "UNCANCELLATION": {
      const plan = skuPlan ?? base?.plan ?? null;
      if (!plan) return { kind: "skip", reason: "unknown-product" };
      return {
        kind: "fact",
        fact: {
          ...common,
          plan,
          status: base?.status ?? "active",
          currentPeriodEnd: periodEndSeconds ?? base?.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: false,
        },
      };
    }

    case "BILLING_ISSUE": {
      const plan = skuPlan ?? base?.plan ?? null;
      if (!plan) return { kind: "skip", reason: "unknown-product" };
      return {
        kind: "fact",
        fact: {
          ...common,
          plan,
          // D-status-mapping: deny immediately, same as Stripe past_due.
          // The store grace period nuance is intentionally NOT ported.
          status: "past_due",
          currentPeriodEnd: periodEndSeconds ?? base?.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: base?.cancelAtPeriodEnd ?? false,
        },
      };
    }

    case "EXPIRATION": {
      if (!skuPlan) return { kind: "skip", reason: "unknown-product" };
      // Mirror of customer.subscription.deleted: revert to free tier.
      return {
        kind: "fact",
        fact: {
          ...common,
          plan: "free",
          status: "canceled",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
      };
    }

    default:
      return { kind: "skip", reason: "unhandled-type" };
  }
}
