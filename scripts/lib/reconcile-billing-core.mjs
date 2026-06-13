/**
 * Pure reconcile logic for scripts/reconcile-billing.mjs (handoff DoD #6).
 * No I/O here — fetching lives in the CLI; this module normalizes provider
 * payloads into the projection shape and diffs them, so the logic is
 * unit-testable from the web vitest suite.
 *
 * "Projection" = the profile row's billing slice:
 *   { plan, status, currentPeriodEnd (unix s), cancelAtPeriodEnd, provider }
 */

export const APPLE_SKU_TO_PLAN = {
  "com.handicappin.premium.yearly": "premium",
  "com.handicappin.unlimited.yearly": "unlimited",
  "com.handicappin.lifetime": "lifetime",
};

/**
 * Normalize a Stripe subscription list (GET /v1/subscriptions?customer=...,
 * status=all) into the provider-truth billing state for the contract Stripe
 * bills. Picks the newest relevant subscription: actives first, then
 * past_due/trialing, then anything else.
 *
 * @param subscriptions Stripe subscription objects
 * @param priceToPlan map of stripe price id -> plan
 * @returns provider state or null when Stripe shows no subscription at all
 */
export function normalizeStripeSubscriptions(subscriptions, priceToPlan) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) return null;

  const rank = (sub) => {
    if (sub.status === "active" || sub.status === "trialing") return 2;
    if (sub.status === "past_due" || sub.status === "unpaid") return 1;
    return 0;
  };
  const sorted = [...subscriptions].sort(
    (a, b) => rank(b) - rank(a) || (b.created ?? 0) - (a.created ?? 0),
  );
  const sub = sorted[0];
  const item = sub.items?.data?.[0];
  const plan = item?.price?.id ? (priceToPlan[item.price.id] ?? null) : null;

  // Stripe ended subscriptions project as the free tier (mirror of
  // customer.subscription.deleted).
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    return {
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  return {
    plan,
    status: sub.status ?? null,
    currentPeriodEnd: item?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
  };
}

/**
 * Normalize a RevenueCat GET /v1/subscribers/{id} response into provider
 * truth for the apple-billed contract.
 *
 * RC subscriber shape (official REST docs): subscriber.subscriptions is a
 * map of product_id -> { expires_date, unsubscribe_detected_at,
 * billing_issues_detected_at, period_type, store }, and
 * subscriber.non_subscriptions maps product_id -> purchase list.
 */
export function normalizeRevenueCatSubscriber(subscriber, nowMs) {
  if (!subscriber || typeof subscriber !== "object") return null;

  // Lifetime: any recorded purchase of the lifetime SKU wins.
  const nonSubs = subscriber.non_subscriptions ?? {};
  for (const [productId, purchases] of Object.entries(nonSubs)) {
    if (
      APPLE_SKU_TO_PLAN[productId] === "lifetime" &&
      Array.isArray(purchases) &&
      purchases.length > 0
    ) {
      return {
        plan: "lifetime",
        status: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }
  }

  const subs = subscriber.subscriptions ?? {};
  let best = null;
  for (const [productId, sub] of Object.entries(subs)) {
    const plan = APPLE_SKU_TO_PLAN[productId];
    if (!plan || sub?.store !== "app_store") continue;
    const expiresMs = sub.expires_date ? Date.parse(sub.expires_date) : null;
    const isLive =
      expiresMs !== null && expiresMs > nowMs && !sub.refunded_at;
    const candidate = {
      plan,
      expiresMs,
      isLive,
      hasBillingIssue: Boolean(sub.billing_issues_detected_at),
      unsubscribed: Boolean(sub.unsubscribe_detected_at),
      periodType: sub.period_type ?? "normal",
    };
    if (
      !best ||
      Number(candidate.isLive) - Number(best.isLive) > 0 ||
      (candidate.isLive === best.isLive &&
        (candidate.expiresMs ?? 0) > (best.expiresMs ?? 0))
    ) {
      best = candidate;
    }
  }

  if (!best) return null;

  if (!best.isLive) {
    return {
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  return {
    plan: best.plan,
    status: best.hasBillingIssue
      ? "past_due"
      : best.periodType === "trial"
        ? "trialing"
        : "active",
    currentPeriodEnd: best.expiresMs !== null ? Math.floor(best.expiresMs / 1000) : null,
    cancelAtPeriodEnd: best.unsubscribed,
  };
}

/**
 * Field-level diff between the stored projection and provider truth.
 * `providerState === null` means the provider has no record — reported as a
 * single "presence" diff (ambiguous: could be env mismatch; never auto-fixed).
 */
export function diffBillingState(projection, providerState) {
  if (providerState === null) {
    return [
      {
        field: "presence",
        projection: `${projection.plan}/${projection.status}`,
        provider: "no record",
      },
    ];
  }
  const diffs = [];
  const fields = ["plan", "status", "currentPeriodEnd", "cancelAtPeriodEnd"];
  for (const field of fields) {
    const a = projection[field] ?? null;
    const b = providerState[field] ?? null;
    if (a !== b) {
      diffs.push({ field, projection: a, provider: b });
    }
  }
  return diffs;
}

/**
 * Whether --apply may write this correction. Conservative by design:
 *  - never touches lifetime projections (D-precedence: absorbing);
 *  - never acts on "no record" presence diffs (ambiguous);
 *  - only corrects the projection from the provider that OWNS the contract
 *    (projection.provider must match the side being reconciled).
 */
export function decideApply(projection, providerState, diffs, side) {
  if (diffs.length === 0) return { apply: false, reason: "in-sync" };
  if (projection.plan === "lifetime") {
    return { apply: false, reason: "lifetime-locked (manual only)" };
  }
  if (providerState === null) {
    return { apply: false, reason: "provider has no record (ambiguous)" };
  }
  if (projection.provider !== side) {
    return { apply: false, reason: "projection owned by other provider" };
  }
  return { apply: true, reason: "provider is source of truth for its contract" };
}
