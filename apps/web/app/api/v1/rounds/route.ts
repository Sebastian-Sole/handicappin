/**
 * `GET /v1/rounds` (T13.3) and `POST /v1/rounds` (T13.4).
 *
 * `GET` — the principal's own rounds, for WRITE RECONCILIATION.
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
 *
 * `POST` — the write path. Guards and wiring here; §2's idempotency decision
 * procedure lives in `./create-round`, its vocabulary in `./idempotency`, and
 * the `/v1`-only request shape in `./submission-schema`. The handler adds NO
 * business logic: it calls the 002 service with `overLimitPolicy:
 * "quarantine"` and lets the service decide the rest.
 */

import {
  V1_SCOPES,
  authenticateV1Request,
  createV1UserAccess,
  errorResponse,
  fetchV1Entitlement,
  jsonResponse,
  problemResponse,
  rateLimitResponse,
  readJsonBody,
  requireScope,
  v1EntitlementProblem,
  v1EntitlementRpcFromSupabase,
  v1RateLimitPrincipal,
  validationProblem,
  type V1Principal,
} from "@/app/api/v1/_lib";
import { createBearerTokenSupabaseClient } from "@/lib/api/bearer-token";
import { enforcePublicApiRateLimit } from "@/lib/rate-limit";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { sendAdminSubmissionNotification } from "@/lib/email-service";
import { getPostHogClient } from "@/lib/posthog";
import {
  listV1Rounds,
  readV1RoundsQuery,
  v1RoundsQuerySchema,
} from "@/app/api/v1/rounds/list-rounds";
import { createV1Round } from "@/app/api/v1/rounds/create-round";
import { v1RoundSubmissionSchema } from "@/app/api/v1/rounds/submission-schema";

/** Authenticated, per-request data. Nothing here is cacheable. */
export const dynamic = "force-dynamic";

const ROUTE = "GET /v1/rounds";
const WRITE_ROUTE = "POST /v1/rounds";

export async function GET(request: Request): Promise<Response> {
  const instance = crypto.randomUUID();
  let principal: V1Principal | null = null;

  try {
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

    // ── Rate limit ──────────────────────────────────────────────────────
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
    const supabase = createBearerTokenSupabaseClient(principal.token);

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

export async function POST(request: Request): Promise<Response> {
  const instance = crypto.randomUUID();
  let principal: V1Principal | null = null;

  try {
    // ── PRE-AUTH rate limit (§3), BEFORE token validation ────────────────
    // `authenticateV1Request` → `getUserFromBearerToken` →
    // `supabase.auth.getUser(token)` is a NETWORK round trip to GoTrue, and
    // §6 forbids replacing it with local JWKS validation because that would
    // silently miss revocation. So any token-shaped string costs a real
    // upstream call, and validating first would make
    // `Authorization: Bearer <anything>` an unmetered GoTrue amplification
    // vector on the most expensive route of the surface.
    //
    // §3 (~:197) already requires this: "Pre-auth / invalid-token requests
    // (WHICH STILL COST VALIDATION WORK and must be limited): keyed
    // `ip:{ip}`". Passing no principal is how the shipped limiter keys on the
    // IP — the same call shape `GET /v1/health` uses.
    //
    // FAMILY CHOICE — `rounds-write`, deliberately:
    //   - it does NOT share a budget with authenticated traffic. The bucket
    //     key is `…:rounds-write:ip:{ip}`, a different Redis key from
    //     `…:rounds-write:user:{sub}` and `…:client:{c}:user:{sub}`, so an
    //     anonymous flood cannot consume any authenticated principal's
    //     allowance. Family picks the NUMBER, not the bucket;
    //   - 60/min rather than the reads family's 120/min because traffic that
    //     has not yet proven an identity must not get MORE headroom than an
    //     authenticated writer on the same route.
    //
    // Known limitation, reported rather than hidden: this token is spent by
    // authenticated requests too, so a consumer whose users share a small set
    // of egress IPs (fitbull runs on Convex) is capped fleet-wide at this
    // family's budget for the pre-auth stage. Fixing that needs a pre-auth
    // family with its own budget in `lib/rate-limit.ts` + `env.ts`, both of
    // which are outside this route's scope and frozen by G0.
    const preAuthLimit = await enforcePublicApiRateLimit(
      request,
      undefined,
      "rounds-write"
    );
    if (!preAuthLimit.success) {
      return rateLimitResponse(preAuthLimit, { instance });
    }

    const auth = await authenticateV1Request(request, { instance });
    if (!auth.ok) return problemResponse(auth.problem);
    principal = auth.principal;

    // §6: `rounds:write` is the scope the access-token hook stamps
    // unconditionally on every OAuth-client token; a first-party principal is
    // never scope-checked.
    const denied = requireScope(principal, V1_SCOPES.roundsWrite, { instance });
    if (denied) return problemResponse(denied);

    // ── Per-principal rate limit (§3) ────────────────────────────────────
    // PARTS, never a composed key; and the family NAMED — both fail silently
    // when wrong. See `_lib/rate-limit-seam.ts`.
    const limit = await enforcePublicApiRateLimit(
      request,
      v1RateLimitPrincipal(principal),
      "rounds-write"
    );
    if (!limit.success) return rateLimitResponse(limit, { instance });

    // ── Body ─────────────────────────────────────────────────────────────
    // Wrong content type or unparseable JSON → 400 `malformed_request`
    // (§1 resolves this in preference to a 415; the registry is closed).
    const body = await readJsonBody(request, { instance });
    if (!body.ok) return problemResponse(body.problem);

    // The shared schema COMPOSED with the `/v1` refinements — D5's `teeTime`
    // window and `externalId`. `types/scorecard-input.ts` is never tightened.
    const parsed = v1RoundSubmissionSchema.safeParse(body.value);
    if (!parsed.success) {
      return problemResponse(validationProblem(parsed.error, { instance }));
    }

    // ── Entitlement ──────────────────────────────────────────────────────
    // Injected as the service's `getUserAccess`, backed by
    // `get_connected_entitlement()`. NEVER `getComprehensiveUserAccess`:
    // under the OAuth deny policy that reads zero `profile` rows and 403s a
    // fully provisioned user on every fitbull request (§1). The service
    // raises `PlanNotSelectedError` from it, which the central mapper turns
    // into 403 `plan_required`.
    const supabase = createBearerTokenSupabaseClient(principal.token);
    const getUserAccess = createV1UserAccess(
      v1EntitlementRpcFromSupabase(supabase),
      { userId: principal.userId }
    );

    return await createV1Round({
      db,
      principal,
      submission: parsed.data,
      getUserAccess,
      notifyAdmins: sendAdminSubmissionNotification,
      logger,
      analytics: getPostHogClient(),
      instance,
    });
  } catch (error) {
    return errorResponse(error, {
      instance,
      route: WRITE_ROUTE,
      userId: principal?.userId,
      principalClass: principal?.class,
    });
  }
}
