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
