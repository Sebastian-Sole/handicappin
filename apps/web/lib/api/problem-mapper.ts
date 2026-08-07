/**
 * THE central error → RFC 9457 mapper for `/v1`.
 *
 * Contract: `005-phase0-contract.md` §1 (FROZEN). Every internal error shape
 * — domain errors from `server/services/scorecard/errors.ts`, Postgres /
 * Supabase errors, zod internals — passes through here and can only surface
 * as a registry code. Handlers do not build error bodies themselves.
 *
 * The frozen domain-error table:
 *
 *   | Domain error            | /v1 result                                  |
 *   |-------------------------|---------------------------------------------|
 *   | SelfSubmissionError     | 403 forbidden                               |
 *   | PlanNotSelectedError    | 403 plan_required                           |
 *   | CourseResolutionError   | 422 course_not_found (stricter than tRPC)   |
 *   | DuplicateRoundError     | NOT mapped directly — §2's lookup decides   |
 *   | RoundLimitReachedError  | 500 internal_error + Sentry (unreachable)   |
 *   | RoundLimitRaceError     | 500 internal_error + Sentry (unreachable)   |
 *   | SQLSTATE 42501          | 403 forbidden + Sentry (routing defect)     |
 *
 * Anything not in that table is `internal_error` + a Sentry alert. That is
 * the frozen rule, and it is applied literally — including to
 * `ScoreHoleMismatchError`, which the table does not name (tRPC maps it to
 * BAD_REQUEST; §1 does not, so it does not become a 4xx here).
 */

import { ZodError, type ZodIssue } from "zod";

import { captureSentryError } from "@/lib/sentry-utils";
import {
  createProblem,
  type ProblemDocument,
  type ProblemFieldError,
} from "@/lib/api/problem";
import {
  CourseResolutionError,
  DuplicateRoundError,
  PlanNotSelectedError,
  RoundLimitReachedError,
  SelfSubmissionError,
} from "@/server/services/scorecard/errors";

/** SQLSTATE `insufficient_privilege` — an RLS denial. */
export const SQLSTATE_INSUFFICIENT_PRIVILEGE = "42501";

/**
 * `RoundLimitRaceError` is named by the frozen table but does not exist as a
 * class in `errors.ts` — 002 Part B deleted the post-commit race path it
 * belonged to (`000-INDEX.md` §Conflicts 1). The contract still requires the
 * mapping, so it is matched by `name` rather than by `instanceof`: if the
 * class is ever reintroduced, the mapping is already in place.
 */
const ROUND_LIMIT_RACE_ERROR_NAME = "RoundLimitRaceError";

export interface MapErrorContext {
  /** Request-scoped correlation id, copied into the problem's `instance`. */
  instance?: string;
  /** Authenticated principal, for the Sentry alert only — never the body. */
  userId?: string;
  /** Route identifier for Sentry tags, e.g. `POST /v1/rounds`. */
  route?: string;
  /** `first-party` | `oauth`, for Sentry tags only. */
  principalClass?: string;
}

/**
 * Walk an error's `cause` chain to the underlying Postgres error fields.
 * Drizzle wraps driver failures in `DrizzleQueryError` with the
 * `PostgresError` as `cause`; PostgREST surfaces the SQLSTATE as `code` on
 * its own error object. Both are covered by looking for a string `code`.
 *
 * A local copy of `errors.ts`'s private helper — deliberately not exported
 * from there, and `/v1` must not couple to a 002-internal function.
 */
function unwrapSqlState(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") {
      return candidate.code;
    }
    current = candidate.cause;
  }
  return undefined;
}

/**
 * Field-level code for a zod issue.
 *
 * `/v1` refinements attach an explicit, append-only field code via
 * `params.v1Code` (see `app/api/v1/_lib/schemas.ts`). Everything else falls
 * back to zod's own issue code, which is stable enough to document.
 */
function fieldCodeFor(issue: ZodIssue): string {
  const params = (issue as { params?: Record<string, unknown> }).params;
  const explicit = params?.v1Code;
  return typeof explicit === "string" && explicit.length > 0
    ? explicit
    : issue.code;
}

/** Convert a `ZodError` into the `errors[]` extension member. */
export function zodIssuesToFieldErrors(error: ZodError): ProblemFieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join(".") || "(root)",
    code: fieldCodeFor(issue),
    message: issue.message,
  }));
}

/** `422 validation_failed` from a zod parse failure. */
export function validationProblem(
  error: ZodError,
  context: MapErrorContext = {}
): ProblemDocument {
  return createProblem({
    code: "validation_failed",
    errors: zodIssuesToFieldErrors(error),
    instance: context.instance,
  });
}

function alert(
  error: Error,
  eventType: string,
  context: MapErrorContext,
  extra: Record<string, unknown> = {}
): void {
  captureSentryError(error, {
    level: "error",
    eventType,
    userId: context.userId,
    tags: {
      surface: "api-v1",
      ...(context.route ? { route: context.route } : {}),
      ...(context.principalClass
        ? { principal_class: context.principalClass }
        : {}),
    },
    extra: { ...extra, instance: context.instance },
  });
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : "Non-Error thrown");
}

/**
 * Map ANY thrown value to a problem document.
 *
 * `detail` is never derived from the thrown error: the registry defaults are
 * used verbatim, so an internal identifier or infrastructure reason cannot
 * reach the wire (§1). Diagnostics go to Sentry instead.
 */
export function mapErrorToProblem(
  error: unknown,
  context: MapErrorContext = {}
): ProblemDocument {
  const { instance } = context;

  // Schema / invariant violations.
  if (error instanceof ZodError) {
    return validationProblem(error, context);
  }

  // ── The frozen domain-error table ──────────────────────────────────────
  if (error instanceof SelfSubmissionError) {
    return createProblem({ code: "forbidden", instance });
  }

  if (error instanceof PlanNotSelectedError) {
    return createProblem({ code: "plan_required", instance });
  }

  if (error instanceof CourseResolutionError) {
    return createProblem({ code: "course_not_found", instance });
  }

  if (
    error instanceof RoundLimitReachedError ||
    (error instanceof Error && error.name === ROUND_LIMIT_RACE_ERROR_NAME)
  ) {
    // Deliberate: under §5 the service quarantines instead of raising, so
    // either error appearing on /v1 means the quarantine promise is broken.
    // That is a DEFECT, not a client-facing condition — hence 500 + alert,
    // and emphatically NOT a `round_limit_reached` code (none exists).
    alert(toError(error), "v1-round-limit-unreachable", context, {
      reason: "over-limit must be a 201 with status=quarantined, never an error",
    });
    return createProblem({ code: "internal_error", instance });
  }

  if (error instanceof DuplicateRoundError) {
    // §1: "not mapped directly — §2's lookup decides between 200 replay /
    // idempotency_conflict / duplicate_round". Reaching the central mapper
    // means the handler skipped that lookup, which is a handler defect. Use
    // `duplicateRoundProblem` / `idempotencyConflictProblem` below instead.
    alert(toError(error), "v1-duplicate-round-unresolved", context, {
      key: error.key,
      reason:
        "handler must run the §2 replay/natural-key lookup before surfacing a duplicate",
    });
    return createProblem({ code: "internal_error", instance });
  }

  // ── RLS denial ─────────────────────────────────────────────────────────
  if (unwrapSqlState(error) === SQLSTATE_INSUFFICIENT_PRIVILEGE) {
    // On a designed path this means a principal class reached an operation
    // RLS forbids, i.e. a routing defect — every occurrence is alerted (§1).
    alert(toError(error), "v1-rls-denied", context, {
      sqlstate: SQLSTATE_INSUFFICIENT_PRIVILEGE,
    });
    return createProblem({ code: "forbidden", instance });
  }

  // ── Everything else ────────────────────────────────────────────────────
  alert(toError(error), "v1-unmapped-error", context);
  return createProblem({ code: "internal_error", instance });
}

/**
 * `409 duplicate_round` with the id the §2 natural-key lookup found.
 * Only the handler can build this — the id is never on the domain error.
 */
export function duplicateRoundProblem(
  existingRoundId: number,
  context: MapErrorContext = {}
): ProblemDocument {
  return createProblem({
    code: "duplicate_round",
    existingRoundId,
    instance: context.instance,
  });
}

/**
 * `409 idempotency_conflict`. Deliberately carries NO `existingRoundId`
 * (§1/§2): a key match means the client already knows which round it
 * addressed.
 */
export function idempotencyConflictProblem(
  context: MapErrorContext = {}
): ProblemDocument {
  return createProblem({
    code: "idempotency_conflict",
    instance: context.instance,
  });
}
