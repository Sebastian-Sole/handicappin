/**
 * §2's DECISION PROCEDURE, implemented literally. `route.ts` supplies guards
 * and wiring; this module is the write path.
 *
 * ── The procedure, verbatim from contract §2 ──────────────────────────────
 *
 *   1. Replay lookup (PRE-insert):
 *        SELECT … FROM round WHERE "userId" = $1 AND "externalId" = $2
 *   2. Row found → compare bodies → 200 replay (identical) or
 *      409 `idempotency_conflict` (differs). Return WITHOUT attempting an
 *      insert. The natural key is irrelevant here whether or not it would
 *      also have collided — **a matched key wins over a simultaneous
 *      natural-key collision**, and that precedence is the whole point.
 *   3. No row → attempt the insert:
 *        - success                    → 201
 *        - ANY unique violation       → RE-RUN STEP 1 FIRST, post-rollback.
 *          Row found now → 200/409 (rule 6, the race). Still nothing →
 *          natural-key lookup → 409 `duplicate_round` + `existingRoundId`.
 *        - anything else              → unmapped → `internal_error`
 *   4. No `externalId` supplied → steps 1–2 do not apply: insert, and on a
 *      unique violation run the natural-key lookup → 409 `duplicate_round`.
 *
 * **Why the re-run on step 3 is unconditional and not gated on the constraint
 * name.** In the concurrent case the two are the SAME EVENT and Postgres
 * names the NATURAL key: the loser's step-1 lookup runs before the winner
 * commits and finds 0 rows, so it inserts the same body, violates both keys,
 * and is reported as `round_userId_teeId_teeTime_nineHoleSection_key`.
 * Routing that straight to rule 5 returns `409 duplicate_round` exactly where
 * rules 2 and 6 require the 200 replay — and that is the canonical
 * background-sync shape (a client retrying a timed-out request while the
 * original is still in flight), not an exotic one.
 *
 * ── What this module deliberately does NOT do ─────────────────────────────
 * No business logic. It calls `submitScorecard` with
 * `overLimitPolicy: "quarantine"` and lets the service decide everything
 * else. In particular there is **no limit check and no over-limit branch**:
 * §5 freezes over-limit as `201` + `status: "quarantined"`, there is no
 * `round_limit_reached` code in the registry, and `POST /v1/rounds` never
 * returns 403 because of the round limit.
 */

import { eq } from "drizzle-orm";

import {
  duplicateRoundProblem,
  idempotencyConflictProblem,
  jsonResponse,
  problemResponse,
  type V1Principal,
} from "@/app/api/v1/_lib";
import { serializeV1Round } from "@/app/api/v1/_lib/serializers/round";
import { profile } from "@/db/schema";
import { DuplicateRoundError } from "@/server/services/scorecard/errors";
import {
  submitScorecard,
  type ScorecardDb,
  type SubmitScorecardDeps,
} from "@/server/services/scorecard/submit-scorecard";
import { deriveServerHcpStrokes } from "@/app/api/v1/rounds/hcp-strokes";
import {
  comparableFromStoredRound,
  comparableFromSubmission,
  findRoundByExternalId,
  findRoundIdByNaturalKey,
  findRoundIdByNaturalKeyWithoutTee,
  roundBodiesMatch,
  type StoredRound,
} from "@/app/api/v1/rounds/idempotency";
import {
  hasTeeHoles,
  type V1RoundSubmission,
} from "@/app/api/v1/rounds/submission-schema";

/** SQLSTATE `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

/**
 * Attribution written to `round.submitted_via`. A single constant rather than
 * the `client_id`: the column is analytics-only, there is no client registry
 * yet, and putting a client identifier in a data column would give it a
 * second, unversioned life outside the token.
 */
export const V1_SUBMITTED_VIA = "api-v1";

export interface CreateV1RoundOptions {
  db: ScorecardDb;
  principal: V1Principal;
  submission: V1RoundSubmission;
  /** The `/v1` entitlement adapter — NEVER `getComprehensiveUserAccess`. */
  getUserAccess: SubmitScorecardDeps["getUserAccess"];
  notifyAdmins: SubmitScorecardDeps["notifyAdmins"];
  logger: SubmitScorecardDeps["logger"];
  analytics: SubmitScorecardDeps["analytics"];
  /** Correlation id copied into every problem's `instance`. */
  instance: string;
}

/**
 * Does this thrown value represent a unique violation on the round insert?
 *
 * Both arms matter. `mapRoundInsertError` converts a 23505 into a
 * `DuplicateRoundError` only for the two constraints it knows by NAME; §2
 * says "ANY unique violation, regardless of which constraint Postgres names",
 * so the raw SQLSTATE is accepted too. Being liberal costs nothing: if
 * neither lookup then finds a row, the error is re-thrown and takes the
 * unmapped path exactly as it would have.
 */
function isUniqueViolation(error: unknown): boolean {
  if (error instanceof DuplicateRoundError) return true;
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === UNIQUE_VIOLATION) return true;
    current = candidate.cause;
  }
  return false;
}

/**
 * The account's current handicap index, for the server-side `hcpStrokes`
 * derivation. Scoped to the principal's own id; a missing row returns null and
 * the derivation is skipped (the entitlement gate inside the service answers
 * that case with `403 plan_required` a moment later).
 */
async function readHandicapIndex(
  db: ScorecardDb,
  userId: string
): Promise<number | null> {
  const [row] = await db
    .select({ handicapIndex: profile.handicapIndex })
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);
  if (!row) return null;
  const value = Number(row.handicapIndex);
  return Number.isFinite(value) ? value : null;
}

/**
 * §2 rules 2 and 3, from a row the replay lookup found.
 *
 * The 200 body is `serializeV1Round` of the STORED row, so it reflects
 * CURRENT server state — its `status` may be `quarantined`, and it is the
 * identical shape as the 201 because it is the identical function. Replay
 * never re-runs limit checks and never mutates.
 */
async function replayOrConflict(
  db: ScorecardDb,
  existing: StoredRound,
  submission: V1RoundSubmission,
  instance: string
): Promise<Response> {
  const stored = await comparableFromStoredRound(db, existing);
  if (roundBodiesMatch(comparableFromSubmission(submission), stored)) {
    return jsonResponse(serializeV1Round(existing), 200);
  }
  // Documented as NON-ESCALATING: the round exists, the client must stop
  // retrying that key. `idempotency_conflict` deliberately carries no
  // `existingRoundId` — a key match means the client already knows which
  // round it addressed.
  return problemResponse(idempotencyConflictProblem({ instance }));
}

/** §2 rules 4/5 — the `409 duplicate_round` that carries `existingRoundId`. */
async function duplicateRoundOrRethrow(
  db: ScorecardDb,
  userId: string,
  submission: V1RoundSubmission,
  error: unknown,
  instance: string
): Promise<Response> {
  const comparable = comparableFromSubmission(submission);
  const teeTime = new Date(submission.teeTime);

  const existingRoundId =
    comparable.teeId !== null
      ? await findRoundIdByNaturalKey(
          db,
          userId,
          comparable.teeId,
          teeTime,
          comparable.nineHoleSection
        )
      : await findRoundIdByNaturalKeyWithoutTee(
          db,
          userId,
          teeTime,
          comparable.nineHoleSection
        );

  if (existingRoundId === null) {
    // §2: "If the lookup finds no row, the violation was not one of these two
    // keys and the error passes through unmapped." Naming a round we did not
    // find would be a guess on the product's core artifact.
    throw error;
  }

  return problemResponse(duplicateRoundProblem(existingRoundId, { instance }));
}

/**
 * Run the write path and return the `/v1` response.
 *
 * Throws only for genuinely unmapped failures; the caller's `errorResponse`
 * catch-all turns those into `500 internal_error` + a Sentry alert.
 */
export async function createV1Round(
  options: CreateV1RoundOptions
): Promise<Response> {
  const { db, principal, submission, instance } = options;
  const userId = principal.userId;
  const externalId = submission.externalId ?? null;

  // ── §2 step 1: the replay lookup, PRE-insert ────────────────────────────
  if (externalId !== null) {
    const existing = await findRoundByExternalId(db, userId, externalId);
    if (existing) {
      // §2 step 2. Return WITHOUT attempting an insert.
      return replayOrConflict(db, existing, submission, instance);
    }
  }

  // ── The server-side `hcpStrokes` derivation (§2's build dependency) ─────
  // Before the service call, so the 201's adjusted scores and differential
  // are computed from the server's stroke allocation and not the client's.
  const derived = hasTeeHoles(submission)
    ? deriveServerHcpStrokes(
        submission,
        await readHandicapIndex(db, userId)
      )
    : submission;

  // ── §2 step 3: attempt the insert ───────────────────────────────────────
  try {
    const stored = await submitScorecard(
      {
        db,
        // The SESSION's user id, never `input.userId` — a mismatch is
        // `SelfSubmissionError` → 403 forbidden, which is the only thing
        // stopping a token from writing rounds onto another account.
        authUserId: userId,
        getUserAccess: options.getUserAccess,
        notifyAdmins: options.notifyAdmins,
        logger: options.logger,
        analytics: options.analytics,
        // §5: over-limit is STORED, not refused. Never 403, never a
        // `round_limit_reached` code — there is none.
        overLimitPolicy: "quarantine",
        externalId,
        submittedVia: V1_SUBMITTED_VIA,
      },
      derived
    );

    // §5: 201 Created, SYNCHRONOUSLY. Never 202, never 200 on first write.
    return jsonResponse(serializeV1Round(stored), 201);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // §2 step 3, the unconditional re-run. NOT gated on the constraint name:
    // the concurrent case violates BOTH keys and Postgres names the natural
    // one, and rules 2/6 require the 200 replay there.
    if (externalId !== null) {
      const existing = await findRoundByExternalId(db, userId, externalId);
      if (existing) {
        return replayOrConflict(db, existing, submission, instance);
      }
    }

    // Only now: rules 4/5.
    return duplicateRoundOrRethrow(db, userId, submission, error, instance);
  }
}
