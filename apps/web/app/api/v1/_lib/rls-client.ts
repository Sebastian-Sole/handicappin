/**
 * The RLS-scoped Supabase client, as a TYPE rather than as a docstring.
 *
 * Every `/v1` read that returns user data rests on one control: PostgREST
 * evaluating `auth.uid() = "userId"` under the PRINCIPAL'S OWN bearer token.
 * That control does not exist for a client built from the service-role key —
 * `createAdminClient()` bypasses RLS entirely and would happily return every
 * user's rows through the exact same query.
 *
 * The problem is that `createBearerTokenSupabaseClient(token)` and
 * `createAdminClient()` both produce a `SupabaseClient<Database>`. A reader
 * function typed on that parameter accepts either, so the whole cross-user
 * guarantee reduces to a comment asking the caller to pass the right one — and
 * a one-line swap silently converts a correct route into a data leak with no
 * type error and (because every test mints a real per-user token) quite
 * possibly no test failure either.
 *
 * `RlsScopedClient` closes that. The brand is a private `unique symbol` no
 * other module can produce, so the ONLY way to obtain the type is
 * `rlsScopedClient(token)` below — which takes a token, not a client. The
 * admin client is not assignable, and making it assignable requires writing a
 * cast at the call site, which is a visible, reviewable act rather than an
 * invisible substitution.
 *
 * IS:     a compile-time proof that a client was built from a principal token.
 * IS NOT: a runtime check, and not a claim about which USER the token belongs
 *         to. Row scoping still passes `principal.userId` as an independent
 *         predicate (see `listV1Rounds`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import { createBearerTokenSupabaseClient } from "@/lib/api/bearer-token";

/**
 * The brand. `declare const` of a `unique symbol` exists only in the type
 * system — nothing is emitted, and no other module can name it, so no other
 * module can construct a value of the branded type.
 */
declare const RLS_SCOPED_BRAND: unique symbol;

/**
 * A Supabase client that provably carries a `/v1` principal's own access
 * token, and therefore runs under RLS.
 *
 * Structurally a `SupabaseClient<Database>`, so it can be passed anywhere one
 * is expected (the entitlement RPC adapter, PostgREST builders) with no
 * adapter. The brand only restricts the other direction.
 */
export type RlsScopedClient = SupabaseClient<Database> & {
  readonly [RLS_SCOPED_BRAND]: true;
};

/**
 * The one constructor. Takes the TOKEN, so there is no client-shaped argument
 * an admin client could be handed to.
 *
 * The cast is the single place the brand is minted, and it is sound here
 * because `createBearerTokenSupabaseClient` sends the token as the request's
 * `Authorization` header — which is exactly what makes `auth.uid()` resolve to
 * this principal.
 */
export function rlsScopedClient(accessToken: string): RlsScopedClient {
  return createBearerTokenSupabaseClient(accessToken) as RlsScopedClient;
}
