/**
 * THE quarantine-unlock side effect (contract 005 §5).
 *
 * The consumer-facing promise the `/v1` contract freezes:
 *
 *   "A quarantined round is excluded from the handicap computation and from
 *    the account's round count until the account upgrades, at which point it
 *    is unlocked automatically — no resubmission is needed."
 *
 * `applyBillingEvent` is a PURE decision function — it returns an
 * `ApplyDecision` and writes nothing — so the unlock cannot live there. It
 * lives here instead, as the one helper both projection write sites call:
 *
 *   1. `guardedStripeProfileWrite` (@/lib/stripe-webhook-handlers/profile-billing-write)
 *   2. the inline projection write in `POST /api/webhooks/revenuecat`
 *
 * Those two sites share no code, so the paid-plan test lives HERE and not at
 * either caller: hand the helper the decision and it decides whether the
 * upgrade is real.
 *
 * ── HOW THE HANDICAP RECOMPUTATION IS ENQUEUED ──────────────────────────────
 * It is NOT enqueued by this module, and it is deliberately NOT computed
 * inline (a webhook handler is the wrong place to run a handicap
 * calculation). Unlocking rounds is an UPDATE on `public.round`, and the
 * database already owns that consequence:
 *
 *   trigger_handicap_recalculation
 *     AFTER INSERT OR DELETE OR UPDATE ON public.round FOR EACH ROW
 *     EXECUTE FUNCTION public.enqueue_handicap_calculation()   [SECURITY DEFINER]
 *
 * `enqueue_handicap_calculation()` UPSERTs into
 * `handicap_calculation_queue` with `on conflict (user_id) do update`, and
 * `handicap_calculation_queue_user_id_unique` makes `user_id` unique — so N
 * unlocked rounds coalesce into exactly ONE pending queue row per user,
 * picked up by the `process-handicap-queue` edge function. Writing an
 * explicit INSERT here would be a second, redundant enqueue path; there is
 * none. (Verified against the LIVE local catalog — `pg_trigger` /
 * `pg_get_triggerdef` / `pg_constraint` — not the migration-history table.)
 *
 * Idempotency falls out of the same shape: the UPDATE is predicated on
 * `quarantined = true`, so a replayed billing event matches zero rows, fires
 * no trigger, and enqueues nothing.
 *
 * ── KNOWN GAP: DOWNGRADE DOES NOT RE-QUARANTINE ─────────────────────────────
 * When a paid account lapses back to free, the rounds unlocked here STAY
 * unlocked and keep counting — a former subscriber can sit permanently above
 * the free-tier limit. That is not an oversight in this module: no decision
 * to re-quarantine on downgrade exists anywhere in the contract or the
 * codebase, and inventing one here would silently change entitlement
 * semantics (and would have to pick which rounds to re-lock, which nothing
 * specifies). The behavior is pinned by
 * `tests/integration/quarantine-unlock-on-upgrade.test.ts`
 * ("downgrade after an upgrade leaves the unlocked rounds unlocked"). If the
 * owner later decides downgrades should re-quarantine, that is a product
 * decision plus a new write site — not a change to this comment.
 */
import { and, eq } from "drizzle-orm";
import type { PlanType } from "@handicappin/billing-core";
import { db } from "@/db";
import { round } from "@/db/schema";
import { logWebhookInfo } from "@/lib/webhook-logger";
import type { ApplyDecision } from "@/utils/billing/apply-billing-event";

const PAID_PLANS: ReadonlySet<PlanType> = new Set([
  "premium",
  "unlimited",
  "lifetime",
]);

/**
 * Does this decision represent an account arriving at (or staying on) a paid
 * plan? Only an `apply` decision reaches a write site, and only a paid
 * resulting projection lifts the free-tier cap that caused the quarantine.
 */
export function decisionGrantsPaidEntitlement(
  decision: ApplyDecision,
): boolean {
  return (
    decision.action === "apply" &&
    decision.projection.plan !== null &&
    PAID_PLANS.has(decision.projection.plan)
  );
}

export interface UnlockQuarantinedRoundsResult {
  /** True when the decision was a paid `apply` and the UPDATE actually ran. */
  evaluated: boolean;
  /** Ids of the rounds this call flipped to `quarantined = false`. */
  unlockedRoundIds: number[];
}

/**
 * Unlock every quarantined round for `userId` when `decision` grants a paid
 * entitlement. A no-op for non-paid or ignored decisions, and a no-op on
 * replay (nothing is quarantined the second time).
 *
 * Deliberately NOT swallowed on failure: if the unlock throws, the caller's
 * webhook returns non-2xx and the provider redelivers, which re-runs
 * read → decide → write → unlock and converges. Swallowing the error would
 * leave the rounds locked forever — the exact bug this helper exists to fix.
 * The unlock is not in the same transaction as the profile write for the same
 * reason: provider redelivery is the repair mechanism.
 */
export async function unlockQuarantinedRoundsOnUpgrade(params: {
  userId: string;
  decision: ApplyDecision;
  /** Handler name for the webhook log line. */
  handler: string;
}): Promise<UnlockQuarantinedRoundsResult> {
  if (!decisionGrantsPaidEntitlement(params.decision)) {
    return { evaluated: false, unlockedRoundIds: [] };
  }

  const unlocked = await db
    .update(round)
    .set({ quarantined: false })
    .where(and(eq(round.userId, params.userId), eq(round.quarantined, true)))
    .returning({ id: round.id });

  if (unlocked.length > 0) {
    logWebhookInfo(
      `[${params.handler}] Upgrade to ${params.decision.projection.plan} unlocked ` +
        `${unlocked.length} quarantined round(s) for user ${params.userId} - ` +
        `handicap recomputation enqueued by trigger_handicap_recalculation`,
    );
  }

  return { evaluated: true, unlockedRoundIds: unlocked.map((r) => r.id) };
}
