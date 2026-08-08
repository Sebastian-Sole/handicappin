/**
 * The shared `/v1` scaffolding, in one import.
 *
 * `apps/web/app/api/v1/` is the tree the five day-one routes (D9) branch
 * from: `GET /health`, `GET /courses`, `GET /tees`, `GET /rounds`,
 * `POST /rounds`. `_lib` is a Next.js private folder — the leading underscore
 * keeps it out of the router, so nothing here is ever addressable.
 *
 * Shape of a route handler built on this scaffolding. **The order of the
 * first four guards is load-bearing** — see the note under the snippet:
 *
 *   export async function POST(request: Request) {
 *     const instance = crypto.randomUUID();
 *     try {
 *       // 1. PRE-AUTH limit, IP-keyed. `undefined` principal ⇒ `getIdentifier`
 *       //    falls through to `ip:{ip}`, which is what §3 prescribes for
 *       //    pre-auth / invalid-token traffic. Family `preauth` (D15): the
 *       //    dedicated pre-auth budget, never a route family.
 *       const preAuth = await enforcePublicApiRateLimit(request, undefined, "preauth");
 *       if (!preAuth.success) return rateLimitResponse(preAuth, { instance });
 *
 *       // 2. Authenticate — this is the step the call above is protecting.
 *       const auth = await authenticateV1Request(request, { instance });
 *       if (!auth.ok) return problemResponse(auth.problem);
 *
 *       // 3. Scope.
 *       const denied = requireScope(auth.principal, V1_SCOPES.roundsWrite, { instance });
 *       if (denied) return problemResponse(denied);
 *
 *       // 4. PER-PRINCIPAL limit. Pass the principal PARTS (never a composed
 *       //    key) and ALWAYS name the family — both fail quietly if you get
 *       //    them wrong. See `rate-limit-seam.ts` for exactly how.
 *       const limit = await enforcePublicApiRateLimit(
 *         request,
 *         v1RateLimitPrincipal(auth.principal),
 *         "rounds-write",
 *       );
 *       if (!limit.success) return rateLimitResponse(limit, { instance });
 *
 *       const body = await readJsonBody(request, { instance });
 *       if (!body.ok) return problemResponse(body.problem);
 *
 *       const parsed = v1ScorecardSchema.safeParse(body.value);
 *       if (!parsed.success) return problemResponse(validationProblem(parsed.error, { instance }));
 *
 *       … service call with `getUserAccess: createV1UserAccess(…)`,
 *         `overLimitPolicy: "quarantine"` …
 *     } catch (error) {
 *       return errorResponse(error, { instance, route: "POST /v1/rounds" });
 *     }
 *   }
 *
 * **Why TWO limiter calls, and why the first one comes before
 * `authenticateV1Request`.** `authenticateV1Request` → `extractBearerToken`
 * short-circuits without a network call only when the `Authorization` header
 * is absent, has no space, carries the wrong scheme, or has an empty token.
 * Any non-empty `Bearer <anything>` reaches `supabase.auth.getUser(token)`,
 * an HTTP call to GoTrue — so a handler that authenticates first is a 1:1
 * unauthenticated amplifier against the identity service that web sign-in,
 * native, the watch bridge and the OAuth token exchange all share. Contract
 * §3 requires both buckets: `ip:{ip}` for "pre-auth / invalid-token requests
 * (which still cost validation work and must be limited)", and the
 * per-principal key for authenticated traffic. They do not contend —
 * `ip:{…}` and `user:{…}` / `client:{…}:user:{…}` are disjoint key spaces, so
 * an anonymous flood cannot exhaust a real client's budget even when both
 * calls name the same family.
 *
 * Invariants the scaffolding enforces so routes cannot relitigate them:
 *   - every application-emitted non-2xx is RFC 9457 `application/problem+json`
 *     with a REQUIRED `code` from the closed registry;
 *   - there is no `round_limit_reached` code — over-limit is a 201 with
 *     `status: "quarantined"`;
 *   - principal class keys on `client_id` presence, and a `client_id` token
 *     without `scope` is a 401, never a first-party promotion;
 *   - token validation is the network `auth.getUser` path;
 *   - the shared zod schema is composed, never tightened.
 */

export {
  PROBLEM_CODES,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_REGISTRY,
  PROBLEM_TYPE_BASE,
  createProblem,
  problemTypeUri,
  type CreateProblemOptions,
  type PlainProblemCode,
  type ProblemCode,
  type ProblemDocument,
  type ProblemFieldError,
} from "@/lib/api/problem";

export {
  SQLSTATE_INSUFFICIENT_PRIVILEGE,
  duplicateRoundProblem,
  idempotencyConflictProblem,
  mapErrorToProblem,
  validationProblem,
  zodIssuesToFieldErrors,
  type MapErrorContext,
} from "@/lib/api/problem-mapper";

export {
  API_STABILITY_HEADER,
  API_STABILITY_VALUE,
  errorResponse,
  jsonResponse,
  problemResponse,
  problemResponseFor,
  v1BaseHeaders,
} from "./problem-response";

export { isAcceptedJsonContentType, readJsonBody, type JsonBodyResult } from "./request";

export {
  SERVICE_UNAVAILABLE_RETRY_AFTER_SECONDS,
  UNKNOWN_RESET_RETRY_AFTER_SECONDS,
  rateLimitHeaders,
  rateLimitProblem,
  rateLimitResponse,
  retryAfterSeconds,
  v1RateLimitIdentifier,
  v1RateLimitPrincipal,
  type V1RateLimitOutcome,
} from "./rate-limit-seam";

export {
  V1_SCOPES,
  authenticateV1Request,
  hasScope,
  requireAnyScope,
  requireScope,
  type AuthenticateOptions,
  type AuthenticateResult,
  type V1FirstPartyPrincipal,
  type V1OAuthPrincipal,
  type V1Principal,
} from "./principal";

export {
  V1_ENTITLEMENT_RPC,
  V1_NO_PROFILE_ACCESS,
  V1EntitlementRpcError,
  createV1UserAccess,
  fetchV1Entitlement,
  toV1FeatureAccess,
  v1EntitlementProblem,
  v1EntitlementRowSchema,
  v1EntitlementRpcFromSupabase,
  type EntitlementRpcCaller,
  type EntitlementRpcResponse,
  type V1EntitlementRow,
} from "./entitlement";

export {
  TEE_TIME_FIELD_CODE,
  TEE_TIME_MAX_SKEW_MS,
  TEE_TIME_MIN_ISO,
  TEE_TIME_MIN_MS,
  addTeeTimeWindowIssue,
  checkTeeTimeWindow,
  createV1ScorecardSchema,
  v1ScorecardSchema,
  type TeeTimeWindowVerdict,
  type V1Scorecard,
} from "./schemas";
