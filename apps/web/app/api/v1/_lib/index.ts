/**
 * The shared `/v1` scaffolding, in one import.
 *
 * `apps/web/app/api/v1/` is the tree the five day-one routes (D9) branch
 * from: `GET /health`, `GET /courses`, `GET /tees`, `GET /rounds`,
 * `POST /rounds`. `_lib` is a Next.js private folder — the leading underscore
 * keeps it out of the router, so nothing here is ever addressable.
 *
 * Shape of a route handler built on this scaffolding:
 *
 *   export async function POST(request: Request) {
 *     const instance = crypto.randomUUID();
 *     try {
 *       const auth = await authenticateV1Request(request, { instance });
 *       if (!auth.ok) return problemResponse(auth.problem);
 *
 *       const denied = requireScope(auth.principal, V1_SCOPES.roundsWrite, { instance });
 *       if (denied) return problemResponse(denied);
 *
 *       const limit = await <T13.0a's limiter>(request, v1RateLimitIdentifier(auth.principal));
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
  rateLimitHeaders,
  rateLimitProblem,
  rateLimitResponse,
  retryAfterSeconds,
  v1RateLimitIdentifier,
  type V1RateLimitOutcome,
} from "./rate-limit-seam";

export {
  V1_SCOPES,
  authenticateV1Request,
  hasScope,
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
