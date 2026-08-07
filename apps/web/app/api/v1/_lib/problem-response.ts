/**
 * Turning a problem document into an HTTP response.
 *
 * Contract: `005-phase0-contract.md` §1 (envelope) and §4 (stability header).
 * The mapper (`@/lib/api/problem-mapper`) is framework-free; this is the only
 * place `/v1` builds a `Response` for an error.
 *
 * Every application-emitted `/v1` response — success or problem — carries
 * `X-API-Stability: internal` (§4). Framework-emitted 404/405 and
 * infrastructure-emitted 429/5xx are outside the envelope and outside this
 * module; the OpenAPI prose tells clients to tolerate them.
 */

import {
  PROBLEM_CONTENT_TYPE,
  createProblem,
  type CreateProblemOptions,
  type ProblemDocument,
} from "@/lib/api/problem";
import {
  mapErrorToProblem,
  type MapErrorContext,
} from "@/lib/api/problem-mapper";

/** §4: the surface is internal/unstable until a second consumer exists. */
export const API_STABILITY_HEADER = "X-API-Stability";
export const API_STABILITY_VALUE = "internal";

/** Headers every `/v1` response carries. */
export function v1BaseHeaders(): Record<string, string> {
  return { [API_STABILITY_HEADER]: API_STABILITY_VALUE };
}

/**
 * Merge a caller's extra headers UNDER the two mandatory ones.
 *
 * The media type (§1) and `X-API-Stability` (§4) are contract requirements,
 * not defaults, so a caller must not be able to displace them — spreading
 * `init.headers` last would have let `rateLimitHeaders()` or any future
 * header contributor turn a problem document into `text/html`, or downgrade
 * the stability marker, with nothing failing.
 *
 * A `Headers` object rather than object spread, deliberately: header names
 * are case-insensitive, so a caller passing `content-type` would survive an
 * object-literal override and the two would be COMBINED into
 * `text/html, application/problem+json` by the `Response` constructor.
 * `Headers.set` replaces case-insensitively.
 */
function v1Headers(
  contentType: string,
  extra: Record<string, string> | undefined
): Headers {
  const headers = new Headers(extra);
  headers.set("Content-Type", contentType);
  headers.set(API_STABILITY_HEADER, API_STABILITY_VALUE);
  return headers;
}

/** Serialize a problem document as `application/problem+json`. */
export function problemResponse(
  problem: ProblemDocument,
  init: { headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: v1Headers(`${PROBLEM_CONTENT_TYPE}; charset=utf-8`, init.headers),
  });
}

/** Build and serialize in one step. */
export function problemResponseFor(
  options: CreateProblemOptions,
  init: { headers?: Record<string, string> } = {}
): Response {
  return problemResponse(createProblem(options), init);
}

/**
 * The catch-all a route handler wraps its body in: map any thrown value
 * through the central mapper, then serialize. Never leaks the thrown value.
 */
export function errorResponse(
  error: unknown,
  context: MapErrorContext = {},
  init: { headers?: Record<string, string> } = {}
): Response {
  return problemResponse(mapErrorToProblem(error, context), init);
}

/** JSON success response carrying the `/v1` base headers. */
export function jsonResponse(
  body: unknown,
  status: number,
  init: { headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: v1Headers("application/json; charset=utf-8", init.headers),
  });
}
