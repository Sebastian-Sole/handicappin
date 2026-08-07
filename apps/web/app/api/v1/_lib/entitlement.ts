/**
 * `/v1`-ONLY entitlement adapter — `get_connected_entitlement()` injected as
 * the 002 service's `getUserAccess`.
 *
 * ⚠️ NOT A GENERAL-PURPOSE `FeatureAccess` SOURCE. `plan`, `status` and
 * `currentPeriodEnd` are SYNTHESIZED (see the mapping table below), because
 * the RPC is deliberately plan-blind. Reusing this adapter on any path that
 * reads those fields — billing UI, upgrade prompts, Stripe reconciliation —
 * will read fabricated values. Every export here is named `v1*` for that
 * reason. Contract §1 requires exactly this warning.
 *
 * ── Why this exists at all ────────────────────────────────────────────────
 * `getComprehensiveUserAccess` (`utils/billing/access-control.ts:24-36`)
 * reads `profile` through the request-scoped RLS client with `.single()`. For
 * a `client_id`-bearing token the restrictive policy "OAuth client tokens
 * cannot select profile" (`20260728091000_oauth_client_rls_deny.sql:50-55`)
 * returns ZERO rows → `.single()` errors → `createNoAccessResponse()` →
 * `PlanNotSelectedError` → **403 `plan_required` for a fully provisioned
 * user, on every fitbull request**. So:
 *
 *   - `getComprehensiveUserAccess` must NEVER be injected on `/v1`. Doing so
 *     moves the false positive INSIDE the service instead of fixing it.
 *   - The fix is NOT a service-role client. That would move the
 *     authorization boundary into app code — the posture DECISIONS #3
 *     explicitly rejects. The RPC keeps the boundary in the database
 *     (SECURITY DEFINER, `search_path = ''`, row filter hard-coded to
 *     `auth.uid()`), which is why it is callable by both principal classes.
 *
 * The RPC is applied and verified: `20260805120000_get_connected_entitlement.sql`,
 * pinned by `tests/integration/get-connected-entitlement.test.ts`.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { captureSentryError } from "@/lib/sentry-utils";
import { createProblem, type ProblemDocument } from "@/lib/api/problem";
import type { FeatureAccess } from "@/types/billing";
import type { Database } from "@/types/supabase";
import type { SubmitScorecardDeps } from "@/server/services/scorecard/submit-scorecard";

/** The SECURITY DEFINER accessor. Takes no arguments; filters on auth.uid(). */
export const V1_ENTITLEMENT_RPC = "get_connected_entitlement";

/**
 * The four derived facts the RPC returns — and the only four. It exposes no
 * `plan_selected`, `subscription_status`, `current_period_end`,
 * `cancel_at_period_end`, `billing_version`, `billing_provider`, or Stripe
 * identifier: a connected app learns whether the user may write another
 * round, never what they pay.
 *
 * Parsed with zod because a PostgREST response is a trust boundary.
 */
export const v1EntitlementRowSchema = z.object({
  /** `profile.plan_selected IS NOT NULL`. */
  is_provisioned: z.boolean(),
  /** Derived from the plan; hides WHICH plan. */
  has_unlimited_rounds: z.boolean(),
  /** NULL when unlimited; the free-tier lifetime cap otherwise. */
  rounds_limit: z.number().int().nullable(),
  /** COUNT of the caller's NON-quarantined rounds. */
  rounds_used: z.number().int(),
});

export type V1EntitlementRow = z.infer<typeof v1EntitlementRowSchema>;

/** PostgREST shape, narrowed to what this module reads. */
export interface EntitlementRpcResponse {
  data: unknown;
  error: { message?: string; code?: string | null } | null;
}

/** The one seam the adapter needs. Injectable, so unit tests need no client. */
export type EntitlementRpcCaller = () => Promise<EntitlementRpcResponse>;

/**
 * An RPC failure, carrying the SQLSTATE/PostgREST code so the central mapper
 * can route `42501` to `403 forbidden` and everything else to
 * `internal_error` + Sentry (§1). The message never reaches the wire.
 */
export class V1EntitlementRpcError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "V1EntitlementRpcError";
  }
}

/**
 * Bind the RPC to a request-scoped, RLS-scoped Supabase client (build it with
 * `createBearerTokenSupabaseClient` so `auth.uid()` resolves to the caller).
 *
 * The cast exists because `types/supabase.ts` was generated before
 * `20260805120000_get_connected_entitlement.sql` and does not yet know the
 * function; regenerating it is `pnpm gen:local`/`gen:types` work, not this
 * PR's. The response is zod-parsed downstream regardless, so the cast buys
 * no unchecked trust.
 */
export function v1EntitlementRpcFromSupabase(
  client: SupabaseClient<Database>
): EntitlementRpcCaller {
  const untyped = client as unknown as {
    rpc: (fn: string) => PromiseLike<EntitlementRpcResponse>;
  };
  return async () => untyped.rpc(V1_ENTITLEMENT_RPC);
}

/**
 * Call the RPC.
 *
 * Returns `null` for ZERO ROWS — the caller has no `profile` row at all.
 * That is reachable (the provisioning invariant is literally "create the
 * profile row if missing") and is NOT the same as `is_provisioned = false`,
 * though both map to the same response.
 */
export async function fetchV1Entitlement(
  rpc: EntitlementRpcCaller
): Promise<V1EntitlementRow | null> {
  const { data, error } = await rpc();

  if (error) {
    throw new V1EntitlementRpcError(
      error.message ?? "get_connected_entitlement failed",
      error.code ?? undefined
    );
  }

  // The parse failure must NOT escape as a ZodError. `mapErrorToProblem`
  // checks `instanceof ZodError` first, so a raw one would surface as a
  // client-facing **422 validation_failed** carrying the internal RPC column
  // name and row index — telling a client its body was invalid when the body
  // was fine (so a correct client stops retrying a purely server-side fault),
  // and firing NO Sentry alert, because the ZodError branch does not alert.
  //
  // Rethrown as `V1EntitlementRpcError`, RPC shape drift routes to
  // `internal_error` + Sentry like any other server fault. The ZodError is
  // kept as `cause` for the alert; `unwrapSqlState` walks the chain looking
  // for a STRING `code`, which a ZodError does not carry, so this cannot be
  // mistaken for a SQLSTATE. A test pins that.
  try {
    const rows = z.array(v1EntitlementRowSchema).parse(data ?? []);
    return rows[0] ?? null;
  } catch (error) {
    throw new V1EntitlementRpcError(
      "get_connected_entitlement returned an unexpected shape",
      undefined,
      { cause: error },
    );
  }
}

/**
 * The `FeatureAccess` mapping table, frozen in contract §1.
 *
 * | field              | from                                              |
 * |--------------------|---------------------------------------------------|
 * | hasAccess          | `is_provisioned` — the only input to plan_required |
 * | hasUnlimitedRounds | `has_unlimited_rounds` (passthrough)              |
 * | plan               | `has_unlimited_rounds ? "lifetime" : "free"`      |
 * | remainingRounds    | unlimited ? Infinity : max(0, limit − used)       |
 * | isLifetime         | `has_unlimited_rounds`                            |
 * | hasPremiumAccess   | `has_unlimited_rounds`                            |
 * | status             | `"active"` (synthesized)                          |
 * | currentPeriodEnd   | `null` (synthesized)                              |
 *
 * **`plan` is the load-bearing line.** The service's free-tier branch keys on
 * `access.plan === "free"` (`submit-scorecard.ts:306-312` and the profile
 * `FOR UPDATE` lock at `:326-329`), so a wrong value here silently skips or
 * wrongly applies the round-limit branch. `"lifetime"` is the only acceptable
 * unlimited stand-in: `access-control.ts:74-77` treats BOTH `"premium"` and
 * `"unlimited"` as recurring subscriptions — requiring `subscription_status`
 * of active/trialing, returning a real `currentPeriodEnd`, and
 * `isLifetime: false` — i.e. exactly the period/renewal semantics the RPC
 * cannot supply, so either would produce an incoherent record (a subscription
 * plan carrying a null period and `isLifetime: true`). `"lifetime"` is the
 * one value whose canonical shape IS a null period, which is how the codebase
 * already models it: `utils/billing/apply-billing-event.ts:129-130` forces
 * `currentPeriodEnd: null` whenever `plan === "lifetime"`.
 *
 * `status` is synthesized as `"active"` because the RPC cannot distinguish a
 * lapsed subscription. If `/v1` ever needs that nuance, **add a derived
 * boolean to the RPC — never guess it here.**
 */
export function toV1FeatureAccess(row: V1EntitlementRow): FeatureAccess {
  const unlimited = row.has_unlimited_rounds;

  return {
    hasAccess: row.is_provisioned,
    hasUnlimitedRounds: unlimited,
    plan: unlimited ? "lifetime" : "free",
    // `rounds_limit` is non-null whenever `has_unlimited_rounds` is false (the
    // RPC's CASE guarantees it). The `?? 0` is a fail-safe for an impossible
    // row: zero remaining means the round is QUARANTINED under /v1's
    // `overLimitPolicy: "quarantine"`, never rejected — the safe direction.
    remainingRounds: unlimited
      ? Infinity
      : Math.max(0, (row.rounds_limit ?? 0) - row.rounds_used),
    isLifetime: unlimited,
    hasPremiumAccess: unlimited,
    // Synthesized — see the doc comment. Not a fact about this account.
    status: "active",
    currentPeriodEnd: null,
  };
}

/**
 * The record used when the RPC returns ZERO ROWS (no profile row at all).
 *
 * `hasAccess: false` is what carries the frozen mapping: the service reads it
 * at `submit-scorecard.ts:297-299` and throws `PlanNotSelectedError`, which
 * the central mapper turns into **403 `plan_required`** — the same response
 * as `is_provisioned = false`, exactly as §1 requires. From a client's
 * perspective both mean "this account cannot write rounds until it is set
 * up", and the remedy is identical; a 500 would tell a truthful client to
 * retry something no retry fixes.
 *
 * Shape mirrors `createNoAccessResponse()` so the two stay recognizable.
 */
export const V1_NO_PROFILE_ACCESS: Readonly<FeatureAccess> = Object.freeze({
  plan: null,
  hasAccess: false,
  hasPremiumAccess: false,
  hasUnlimitedRounds: false,
  remainingRounds: 0,
  status: null,
  isLifetime: false,
  currentPeriodEnd: null,
});

/**
 * Sentry alert for the zero-row case. A user holding a VALID access token
 * with no profile row indicates a provisioning defect worth seeing (§1) —
 * the 403 alone would be silent.
 */
function alertMissingProfile(userId: string): void {
  captureSentryError(
    new Error("Valid /v1 token with no profile row — provisioning defect"),
    {
      level: "error",
      eventType: "v1-entitlement-missing-profile",
      userId,
      tags: { surface: "api-v1" },
      extra: {
        rpc: V1_ENTITLEMENT_RPC,
        reason:
          "get_connected_entitlement() returned zero rows; mapped to 403 plan_required",
      },
    }
  );
}

/**
 * `403 plan_required` when the account has not completed plan selection,
 * else null. For read routes that need the gate without calling the service.
 *
 * `null` row (zero rows) and `is_provisioned = false` both gate — §1's
 * registry wording is "has not completed plan selection", which covers the
 * missing-row and the null-plan case alike.
 */
export function v1EntitlementProblem(
  row: V1EntitlementRow | null,
  context: { instance?: string } = {}
): ProblemDocument | null {
  if (row !== null && row.is_provisioned) {
    return null;
  }
  return createProblem({ code: "plan_required", instance: context.instance });
}

/**
 * Build the `getUserAccess` dependency for the 002 service.
 *
 * THIS is what a `/v1` handler injects:
 *
 *   const supabase = createBearerTokenSupabaseClient(principal.token);
 *   const deps: SubmitScorecardDeps = {
 *     …,
 *     getUserAccess: createV1UserAccess(
 *       v1EntitlementRpcFromSupabase(supabase),
 *       { userId: principal.userId },
 *     ),
 *     overLimitPolicy: "quarantine",
 *   };
 *
 * The `userId` argument the service passes is IGNORED for the lookup: the
 * RPC's row filter is hard-coded to `auth.uid()`, which is the whole point —
 * app code cannot ask about another user. It is used only to tag the alert.
 */
export function createV1UserAccess(
  rpc: EntitlementRpcCaller,
  options: { userId: string }
): SubmitScorecardDeps["getUserAccess"] {
  return async () => {
    const row = await fetchV1Entitlement(rpc);

    if (row === null) {
      alertMissingProfile(options.userId);
      return V1_NO_PROFILE_ACCESS;
    }

    return toV1FeatureAccess(row);
  };
}
