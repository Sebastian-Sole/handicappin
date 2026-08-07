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

/** Serialize a problem document as `application/problem+json`. */
export function problemResponse(
  problem: ProblemDocument,
  init: { headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: {
      "Content-Type": `${PROBLEM_CONTENT_TYPE}; charset=utf-8`,
      ...v1BaseHeaders(),
      ...init.headers,
    },
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
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...v1BaseHeaders(),
      ...init.headers,
    },
  });
}
