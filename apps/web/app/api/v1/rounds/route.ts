/**
 * `GET /v1/rounds` — the principal's own rounds, for WRITE RECONCILIATION.
 *
 * fitbull never renders a handicap; it calls this to answer "did the round I
 * sent get stored, and what happened to it". Hence `?externalId=`, hence the
 * `status` / `handicapRevision` fields on every entry, and hence no display
 * affordances (no per-hole scores, no client-chosen ordering).
 *
 * The handler is guards + wiring only. The query contract and the read live
 * in `./list-rounds`; the response shape lives in
 * `../_lib/serializers/round`, shared byte-for-byte with `POST /v1/rounds`
 * (T13.4) so the 201 body, the 200 replay body and these list entries cannot
 * drift (§2 rule 2, §5).
 */

import {
  V1_SCOPES,
  authenticateV1Request,
  errorResponse,
  fetchV1Entitlement,
  jsonResponse,
  problemResponse,
  rateLimitResponse,
  requireScope,
  v1EntitlementProblem,
  v1EntitlementRpcFromSupabase,
  v1RateLimitPrincipal,
  validationProblem,
  type V1Principal,
} from "@/app/api/v1/_lib";
import { rlsScopedClient } from "@/app/api/v1/_lib/rls-client";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import {
  listV1Rounds,
  readV1RoundsQuery,
  v1RoundsQuerySchema,
} from "@/app/api/v1/rounds/list-rounds";

/** Authenticated, per-request data. Nothing here is cacheable. */
export const dynamic = "force-dynamic";

const ROUTE = "GET /v1/rounds";

export async function GET(request: Request): Promise<Response> {
  const instance = crypto.randomUUID();
  let principal: V1Principal | null = null;

  try {
    // ── Pre-auth rate limit (IP-keyed) ──────────────────────────────────
    // FIRST statement in the handler, BEFORE `authenticateV1Request`, and
    // that ordering is the whole point.
    //
    // `extractBearerToken` short-circuits to 401 with no network only when
    // the header is absent, has no space, carries the wrong scheme, or has an
    // empty token. Any non-empty `Bearer <anything>` — including pure garbage
    // — reaches `supabase.auth.getUser(token)`, an HTTP call to GoTrue. So
    // authenticating first makes every unauthenticated request a 1:1
    // amplifier against GoTrue, which is shared with web sign-in, native, the
    // watch bridge and the OAuth token exchange: flooding this read route
    // would degrade LOGIN product-wide. The Vercel WAF is explicitly a
    // non-contractual backstop (§3), so without this call nothing contractual
    // sits between the internet and GoTrue.
    //
    // Contract §3 already prescribes it verbatim: "Pre-auth / invalid-token
    // requests (which still cost validation work and must be limited): keyed
    // `ip:{ip}` via the existing CLIENT_IP_HEADERS trust order." Passing
    // `undefined` for the principal is what selects that key — `getIdentifier`
    // falls through to `ip:{ip}` only when there is no `userId`. Passing a
    // hand-composed string instead would take the limiter's `string` branch
    // (`{ userId: <that string> }`) and mis-key it. `GET /v1/health` is the
    // shipped precedent for exactly this call.
    //
    // Family `"reads"` — the same family as the per-principal call below.
    // The two do NOT contend: `ip:{…}` and `user:{…}` / `client:{…}:user:{…}`
    // are disjoint key spaces, so an anonymous flood exhausts its own IP
    // bucket and can never consume a legitimate client's budget. Inventing a
    // `pre-auth` family would mean an env var and a budget in `env.ts` +
    // `lib/rate-limit.ts`, both frozen shared surface, and `reads` is already
    // defined as "Every `/v1` GET".
    const preAuthLimit = await enforcePublicApiRateLimit(
      request,
      undefined,
      "reads"
    );
    if (!preAuthLimit.success) {
      return rateLimitResponse(preAuthLimit, { instance });
    }

    const auth = await authenticateV1Request(request, { instance });
    if (!auth.ok) return problemResponse(auth.problem);
    principal = auth.principal;

    // ── Scope ───────────────────────────────────────────────────────────
    // `rounds:write` is the ONLY scope that exists: the access-token hook
    // stamps it unconditionally on every OAuth-client token
    // (20260728090000), and there is no `rounds:read`. §10.5 of the fitbull
    // notes records that the contract never says which scope authorizes a
    // GET, so this is a decision, not an inherited rule.
    //
    // Gating on `rounds:write` rather than on nothing, because the asymmetry
    // runs one way: RELAXING a scope requirement later is non-breaking, ADDING
    // one to a shipped endpoint removes a capability from a live client and
    // is not. No real token is denied today — every OAuth token carries it,
    // and a first-party principal is never scope-checked (§6).
    const denied = requireScope(principal, V1_SCOPES.roundsWrite, { instance });
    if (denied) return problemResponse(denied);

    // ── Rate limit (per-principal) ──────────────────────────────────────
    // The SECOND bucket. The pre-auth call above bounds what an anonymous
    // caller can spend; this one bounds what an authenticated principal can.
    // Two arguments, both load-bearing, both silent when wrong:
    //   1. the principal PARTS via `v1RateLimitPrincipal` — a pre-composed
    //      key string would be re-prefixed into `user:client:…:user:…` and
    //      collapse every OAuth fail-closed alert's `identifierKind`;
    //   2. the FAMILY `"reads"` — omitting it falls back to the legacy
    //      unfamilied bucket at 60/min instead of this family's 120/min.
    const limit = await enforcePublicApiRateLimit(
      request,
      v1RateLimitPrincipal(principal),
      "reads"
    );
    if (!limit.success) return rateLimitResponse(limit, { instance });

    // ── Query ───────────────────────────────────────────────────────────
    const parsed = v1RoundsQuerySchema.safeParse(
      readV1RoundsQuery(new URL(request.url))
    );
    if (!parsed.success) {
      return problemResponse(validationProblem(parsed.error, { instance }));
    }

    // ── RLS-scoped client ───────────────────────────────────────────────
    // The bearer token, not the service role: `auth.uid() = "userId"` on
    // `round` is what actually holds cross-user isolation, and it only holds
    // for a client that carries this principal's own token.
    //
    // `rlsScopedClient` returns a BRANDED client, and `listV1Rounds` requires
    // that brand — so swapping in `createAdminClient()` (same nominal type,
    // bypasses RLS) does not compile. The constraint is mechanical rather
    // than documentary.
    const supabase = rlsScopedClient(principal.token);

    // ── Entitlement ─────────────────────────────────────────────────────
    // Through the /v1 adapter's RPC, NEVER `getComprehensiveUserAccess`:
    // under the OAuth deny policy that function reads zero `profile` rows and
    // 403s a fully provisioned user on every fitbull request (§1).
    //
    // Gating a READ on plan selection is this route's choice, taken on the
    // same asymmetry as the scope check: an ungated endpoint cannot be gated
    // later without breaking a live client, while a gate can always be lifted.
    // A read needs only the row, so it calls the RPC directly rather than
    // through `createV1UserAccess` (which exists to feed the write service).
    const entitlement = await fetchV1Entitlement(
      v1EntitlementRpcFromSupabase(supabase)
    );
    const planProblem = v1EntitlementProblem(entitlement, { instance });
    if (planProblem) return problemResponse(planProblem);

    // ── Read ────────────────────────────────────────────────────────────
    const page = await listV1Rounds(supabase, principal.userId, parsed.data);

    return jsonResponse(page, 200);
  } catch (error) {
    return errorResponse(error, {
      instance,
      route: ROUTE,
      userId: principal?.userId,
      principalClass: principal?.class,
    });
  }
}
