/**
 * Typed domain errors for the scorecard service (subplan 002).
 *
 * Plain `Error` subclasses — deliberately NOT `TRPCError` (this directory is
 * framework-free; see the import boundary in `eslint.config.mjs`). The tRPC
 * adapter in `server/api/routers/round.ts` maps each of these back to the
 * exact `TRPCError` the inline mutation used to throw, so external behavior
 * is unchanged. A future `/v1` REST adapter (subplan 005) maps the same
 * errors to RFC 9457 problem responses instead.
 */

/** `input.userId` does not match the authenticated user. */
export class SelfSubmissionError extends Error {
  constructor() {
    super("Cannot submit a scorecard on behalf of another user");
    this.name = "SelfSubmissionError";
  }
}

/** The user has not selected a plan yet (needs onboarding). */
export class PlanNotSelectedError extends Error {
  constructor() {
    super(
      "Please select a plan to continue. Visit the onboarding page to get started."
    );
    this.name = "PlanNotSelectedError";
  }
}

/** Free-tier round limit reached (pre-transaction check). */
export class RoundLimitReachedError extends Error {
  constructor(readonly limit: number) {
    super(
      `You've reached your free tier limit of ${limit} rounds. Please upgrade to continue tracking rounds.`
    );
    this.name = "RoundLimitReachedError";
  }
}

/**
 * Free-tier limit exceeded by a concurrent submission, detected by the
 * post-commit re-check; the just-committed round was compensated away.
 * Part B (behind subplan 003's `quarantined` column) replaces this whole
 * path with an in-transaction active-vs-quarantined decision.
 */
export class RoundLimitRaceError extends Error {
  constructor() {
    super(
      "Round limit exceeded due to concurrent submissions. Your submission was not saved. Please try again."
    );
    this.name = "RoundLimitRaceError";
  }
}

/**
 * Course/tee resolution failed (e.g. a referenced tee id does not exist as
 * an approved, non-archived row). Maps to INTERNAL_SERVER_ERROR in the tRPC
 * adapter exactly like the plain `Error` it replaces.
 */
export class CourseResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseResolutionError";
  }
}

/**
 * The round insert hit one of the unique keys added by subplan 003's
 * migration — a duplicate submission (double-click, watch sync replay,
 * native offline retry). Maps to CONFLICT in the tRPC adapter; the /v1 REST
 * adapter (005) maps the same error per the recorded duplicate semantics
 * (200-replay for identical body, 409 otherwise — see plans/003-notes.md).
 */
export class DuplicateRoundError extends Error {
  constructor(readonly key: "natural-key" | "external-id") {
    super(
      key === "external-id"
        ? "This round has already been submitted. A round with the same submission reference already exists."
        : "This round has already been submitted. A round with the same course, tee, and tee time already exists."
    );
    this.name = "DuplicateRoundError";
  }
}

/**
 * A submitted score carries a `holeId` that does not belong to the resolved
 * tee's holes for the played section. Web/native submit scores with
 * `holeId: undefined` (the service assigns holes positionally), so this only
 * fires for clients that claim an explicit hole — a cross-tee or
 * cross-section reference the positional insert would otherwise silently
 * mask. Maps to BAD_REQUEST in the tRPC adapter.
 */
export class ScoreHoleMismatchError extends Error {
  constructor(
    readonly holeId: number,
    readonly teeId: number
  ) {
    super(
      `Score references hole ${holeId}, which does not belong to the played section of tee ${teeId}`
    );
    this.name = "ScoreHoleMismatchError";
  }
}

/** SQLSTATE for unique_violation. */
const UNIQUE_VIOLATION = "23505";

const NATURAL_KEY_CONSTRAINT = "round_userId_teeId_teeTime_nineHoleSection_key";
const EXTERNAL_ID_CONSTRAINT = "round_userId_externalId_key";

/**
 * Walk an error's `cause` chain to the underlying Postgres error fields
 * (Drizzle wraps driver failures in DrizzleQueryError with the PostgresError
 * as `cause`).
 */
function unwrapPgError(
  error: unknown
): { code?: string; constraint_name?: string } | undefined {
  let current = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as {
      code?: string;
      constraint_name?: string;
      cause?: unknown;
    };
    if (typeof candidate.code === "string") return candidate;
    current = candidate.cause;
  }
  return undefined;
}

/**
 * Translate a failed round INSERT into a typed domain error when it is a
 * unique violation on one of the round dedupe keys; return the original
 * error untouched otherwise (so unrelated failures keep their behavior).
 */
export function mapRoundInsertError(error: unknown): unknown {
  const pg = unwrapPgError(error);
  if (pg?.code === UNIQUE_VIOLATION) {
    if (pg.constraint_name === EXTERNAL_ID_CONSTRAINT) {
      return new DuplicateRoundError("external-id");
    }
    if (pg.constraint_name === NATURAL_KEY_CONSTRAINT) {
      return new DuplicateRoundError("natural-key");
    }
  }
  return error;
}
