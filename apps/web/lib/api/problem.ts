/**
 * RFC 9457 `application/problem+json` — the `/v1` error envelope.
 *
 * Contract: `docs/research/api-platform/plans/005-phase0-contract.md` §1
 * (FROZEN). This module owns the **closed, append-only** code registry and
 * the document builder. It is framework-free on purpose: `Response`
 * construction lives in `app/api/v1/_lib/problem-response.ts`, error →
 * problem translation in `./problem-mapper.ts`.
 *
 * Rules this file encodes, each one straight from §1:
 *
 * - `type` is always `https://api.handicappin.com/problems/{code}`.
 *   `about:blank` is NEVER used — every error carries a registry code.
 * - `code` is a REQUIRED extension member (the RFC requires none). It is the
 *   machine key clients switch on; `title` is human-facing and keying on it
 *   is unsupported.
 * - `detail` NEVER contains internal identifiers, stack traces, or
 *   infrastructure reasons. The registry therefore ships a fixed, vetted
 *   default detail per code, and callers may only override it with a string
 *   that is safe to hand a stranger.
 * - `errors[]` exists on `validation_failed` ONLY; `existingRoundId` on
 *   `duplicate_round` ONLY. Both constraints are enforced by the builder's
 *   option type, not by convention.
 * - The registry is CLOSED and APPEND-ONLY. Adding a code is a non-breaking
 *   change; repurposing or removing one requires `/v2` (§4).
 *
 * `round_limit_reached` is deliberately ABSENT and must not be added: an
 * over-limit round is a **201 with `status: "quarantined"`** (§5), never an
 * error. There is no 403-for-over-limit anywhere in `/v1`.
 */

/** Base URI for the (currently non-dereferenceable) problem type registry. */
export const PROBLEM_TYPE_BASE = "https://api.handicappin.com/problems";

/** RFC 9457 media type. Every application-emitted `/v1` non-2xx uses it. */
export const PROBLEM_CONTENT_TYPE = "application/problem+json";

interface ProblemCodeDefinition {
  /** HTTP status mirrored into the body's `status` member. */
  readonly status: number;
  /** Short, human-readable, fixed per code. Changing it is non-breaking. */
  readonly title: string;
  /** Default `detail`. Vetted to leak nothing — see the file header. */
  readonly detail: string;
}

/**
 * THE registry (contract §1). Twelve codes, closed and append-only.
 *
 * Deliberate choices recorded in §1 that a reader may otherwise "fix":
 * - `plan_required` is 403, not 402.
 * - `course_not_found` is 422, not 404.
 * - `not_found` conflates absent with RLS-invisible (no existence oracle).
 * - Wrong content type maps to `malformed_request` (400), NOT 415.
 * - The fail-closed rate limiter surfaces as `service_unavailable` (503),
 *   not as a 429.
 */
export const PROBLEM_REGISTRY = {
  malformed_request: {
    status: 400,
    title: "Malformed request",
    detail: "The request body could not be parsed as JSON of the expected media type.",
  },
  unauthorized: {
    status: 401,
    title: "Unauthorized",
    detail: "A valid Bearer access token is required.",
  },
  forbidden: {
    status: 403,
    title: "Forbidden",
    detail: "This token is not permitted to perform this operation.",
  },
  plan_required: {
    status: 403,
    title: "Plan required",
    detail:
      "This account has not completed plan selection. The account holder must finish setup in the handicappin app before rounds can be written.",
  },
  not_found: {
    status: 404,
    title: "Not found",
    detail: "The requested resource does not exist.",
  },
  idempotency_conflict: {
    status: 409,
    title: "Idempotency conflict",
    detail:
      "This idempotency key already identifies a stored round whose contents differ from what you sent. The round exists — do not retry with the same key.",
  },
  duplicate_round: {
    status: 409,
    title: "Duplicate round",
    detail:
      "A round with the same course, tee and tee time already exists for this account.",
  },
  validation_failed: {
    status: 422,
    title: "Validation failed",
    detail: "The request body failed validation. See `errors` for details.",
  },
  course_not_found: {
    status: 422,
    title: "Course not found",
    detail: "The referenced course or tee is not in the catalog.",
  },
  rate_limited: {
    status: 429,
    title: "Rate limited",
    detail: "The request budget for this principal is exhausted.",
  },
  internal_error: {
    status: 500,
    title: "Internal error",
    detail: "The request could not be completed.",
  },
  service_unavailable: {
    status: 503,
    title: "Service unavailable",
    detail: "A dependency is unavailable. Retry later.",
  },
} as const satisfies Record<string, ProblemCodeDefinition>;

/** The closed set of machine-readable error keys clients switch on. */
export type ProblemCode = keyof typeof PROBLEM_REGISTRY;

/** Every registry code, in registry (ascending-status) order. */
export const PROBLEM_CODES = Object.keys(PROBLEM_REGISTRY) as ProblemCode[];

/**
 * A field-level item inside `validation_failed`'s `errors[]`.
 *
 * `code` is a FIELD-level code (e.g. `tee_time_out_of_window`,
 * `putts_penalties_exceed_strokes`) — a separate, also append-only namespace
 * from `ProblemCode`, documented in the OpenAPI prose (§1).
 */
export interface ProblemFieldError {
  /** Dotted path into the request body, e.g. `scores.3.putts`. */
  path: string;
  /** Append-only field-level code. */
  code: string;
  /** Human-readable message. Safe to show a developer, never internal. */
  message: string;
}

/** An RFC 9457 problem document as `/v1` emits it. */
export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  /** REQUIRED extension member (§1). */
  code: ProblemCode;
  detail?: string;
  /** Request-scoped id for support correlation. */
  instance?: string;
  /** `validation_failed` only. */
  errors?: ProblemFieldError[];
  /** `duplicate_round` only. */
  existingRoundId?: number;
}

/** Codes that carry neither `errors[]` nor `existingRoundId`. */
export type PlainProblemCode = Exclude<
  ProblemCode,
  "validation_failed" | "duplicate_round"
>;

interface ProblemOptionsBase {
  /**
   * Overrides the registry default. Must be safe to hand a stranger: no
   * internal identifiers, no stack traces, no infrastructure reasons (§1).
   */
  detail?: string;
  /** Request-scoped correlation id. */
  instance?: string;
}

/**
 * Builder options. The union is the enforcement mechanism for "`errors[]` is
 * `validation_failed` only, `existingRoundId` is `duplicate_round` only" —
 * attaching either to the wrong code is a type error, not a review catch.
 */
export type CreateProblemOptions =
  | (ProblemOptionsBase & { code: PlainProblemCode })
  | (ProblemOptionsBase & {
      code: "validation_failed";
      errors: ProblemFieldError[];
    })
  | (ProblemOptionsBase & {
      code: "duplicate_round";
      /** The id of the already-stored round (§2 rules 4–5). */
      existingRoundId: number;
    });

/** `https://api.handicappin.com/problems/{code}` — never `about:blank`. */
export function problemTypeUri(code: ProblemCode): string {
  return `${PROBLEM_TYPE_BASE}/${code}`;
}

/**
 * Build a problem document. The ONLY way `/v1` constructs one — per-route
 * bespoke error bodies are the exact drift the central mapper prevents (§1
 * "Rejected alternatives").
 */
export function createProblem(options: CreateProblemOptions): ProblemDocument {
  const definition = PROBLEM_REGISTRY[options.code];

  const problem: ProblemDocument = {
    type: problemTypeUri(options.code),
    title: definition.title,
    status: definition.status,
    code: options.code,
    detail: options.detail ?? definition.detail,
  };

  if (options.instance !== undefined) {
    problem.instance = options.instance;
  }
  if (options.code === "validation_failed") {
    problem.errors = options.errors;
  }
  if (options.code === "duplicate_round") {
    problem.existingRoundId = options.existingRoundId;
  }

  return problem;
}
