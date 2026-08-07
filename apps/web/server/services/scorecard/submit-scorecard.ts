/**
 * `submitScorecard(deps, input)` — the full scorecard submission pipeline,
 * extracted verbatim from the tRPC mutation in
 * `server/api/routers/round.ts` (subplan 002 Part A, behavior-preserving).
 *
 * Framework-free by construction (enforced by the import boundary in
 * `eslint.config.mjs`): no Next.js, no tRPC, no Sentry, no `@/env`. All
 * side-effects — the drizzle handle, the access check, admin notification,
 * logging, and analytics — are injected through `SubmitScorecardDeps`, and
 * failures surface as the typed domain errors in `./errors`. The tRPC
 * procedure is a thin adapter over this function; the `/v1` REST handler
 * (subplan 005) will be another.
 */
import { eq, and, lt, count, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  round,
  score,
  profile,
  teeInfo,
  course,
  hole,
  submissions,
} from "@/db/schema";
import type { FeatureAccess } from "@/types/billing";
import type { Scorecard } from "@/types/scorecard-input";
import { FREE_TIER_ROUND_LIMIT } from "@/utils/billing/constants";
import {
  calculateAdjustedPlayedScore,
  calculateCourseHandicap,
  calculateScoreDifferential,
  calculateAdjustedGrossScore,
  calculateExpected9HoleDifferential,
  calculate9HoleScoreDifferential,
} from "@handicappin/handicap-core";
import { ANALYTICS_EVENTS } from "@handicappin/analytics";

import {
  CourseResolutionError,
  PlanNotSelectedError,
  RoundLimitReachedError,
  ScoreHoleMismatchError,
  SelfSubmissionError,
  mapRoundInsertError,
} from "./errors";

/** The drizzle handle shape the service needs (the app's `db` satisfies it). */
export type ScorecardDb = PostgresJsDatabase<Record<string, never>>;

/**
 * One pending course/tee submission produced by a round, as reported to the
 * admin notification channel. Structurally identical to the
 * `SubmissionSummary` type of `emails/admin-submission-notification` — the
 * service defines its own copy so it never imports from the email layer.
 */
export interface ScorecardSubmissionSummary {
  type: "new_course" | "new_tee" | "tee_edit";
  teeName: string;
  teeGender: string;
  submissionId?: number;
  teeId?: number;
  parentTeeId?: number | null;
}

/** Payload handed to `deps.notifyAdmins` when a round produced pending submissions. */
export interface AdminSubmissionNotification {
  submitterEmail: string;
  submitterName?: string | null;
  courseName: string;
  courseCity?: string | null;
  courseCountry?: string | null;
  courseId?: number;
  courseIsNew: boolean;
  submissions: ScorecardSubmissionSummary[];
  roundId?: number;
}

export interface ScorecardLogger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ScorecardAnalytics {
  capture(message: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): void;
  flush(): Promise<void>;
}

/**
 * What happens to a round submitted over the free-tier limit (subplan 002
 * Part B, accept-and-quarantine).
 *
 * - `"reject"` — the web/native behavior: an at-limit submission is refused
 *   up front with `RoundLimitReachedError`.
 * - `"quarantine"` — the `/v1` behavior (billing gate, DECISIONS
 *   2026-07-27): an over-limit round is accepted and stored with
 *   `quarantined = true`, excluded from the free-tier count and from every
 *   handicap input until the account upgrades.
 *
 * Under BOTH policies the authoritative active-vs-quarantined decision is
 * made inside the transaction, so an at-limit race quarantines the loser —
 * it is never deleted post-commit and never double-counted as active.
 */
export type OverLimitPolicy = "reject" | "quarantine";

export interface SubmitScorecardDeps {
  db: ScorecardDb;
  /** The authenticated user's id from the session — never trust `input.userId`. */
  authUserId: string;
  /**
   * Plan/limit lookup (`getComprehensiveUserAccess` in the web adapter).
   * Deliberately narrowed to the three fields the service reads, so a
   * non-web adapter (the `/v1` entitlement RPC) only has to supply those.
   */
  getUserAccess(
    userId: string
  ): Promise<Pick<FeatureAccess, "hasAccess" | "plan" | "remainingRounds">>;
  /** Best-effort admin notification for pending course/tee submissions. */
  notifyAdmins(notification: AdminSubmissionNotification): Promise<unknown>;
  logger: ScorecardLogger;
  analytics: ScorecardAnalytics;
  overLimitPolicy: OverLimitPolicy;
}

type RoundCalculations = {
  adjustedGrossScore: number;
  adjustedPlayedScore: number;
  scoreDifferential: number;
  courseHandicap: number;
  courseRatingUsed: number;
  slopeRatingUsed: number;
  holesPlayed: number;
};

const getRoundCalculations = (
  scorecard: Scorecard,
  handicapIndex: number,
  hasEstablishedHandicap: boolean = true
): RoundCalculations => {
  const { teePlayed, scores, nineHoleSection } = scorecard;

  if (!teePlayed.holes) {
    throw new Error("Tee played has no holes");
  }

  const numberOfHolesPlayed = scores.length;
  // Default to "front" when not provided so legacy behavior is preserved.
  const section: "front" | "back" = nineHoleSection ?? "front";

  const courseHandicap = calculateCourseHandicap(
    handicapIndex,
    teePlayed,
    numberOfHolesPlayed,
    section
  );

  // The form (`golf-scorecard.tsx`) submits scores with `holeId: undefined`.
  // The canonical calc functions (`calculateAdjustedPlayedScore` and
  // `calculateAdjustedGrossScore` in `@handicappin/handicap-core`) match
  // scores to holes by `score.holeId === hole.id` and throw on a miss, so
  // we must populate holeIds here using section-aware positional pairing
  // against `teePlayed.holes` before invoking either calc. The round-insert
  // path (step 5 below) does its own equivalent slice against persisted db
  // holes for the score insert; that logic is independent of this mapping.
  let holesForSection: typeof teePlayed.holes;
  if (numberOfHolesPlayed === 18) {
    holesForSection = teePlayed.holes.slice(0, 18);
  } else if (numberOfHolesPlayed === 9 && section === "back") {
    holesForSection = teePlayed.holes.slice(9, 18);
  } else {
    holesForSection = teePlayed.holes.slice(0, 9);
  }
  if (holesForSection.length !== numberOfHolesPlayed) {
    throw new Error(
      `Tee played has ${holesForSection.length} holes for the played section but ${numberOfHolesPlayed} scores were submitted (section=${nineHoleSection ?? "n/a"})`
    );
  }
  const scoresWithHoleIds = scores.map((s, i) => ({
    ...s,
    holeId: s.holeId ?? holesForSection[i]?.id,
  }));

  const adjustedPlayedScore = calculateAdjustedPlayedScore(
    teePlayed.holes,
    scoresWithHoleIds,
    hasEstablishedHandicap
  );

  const adjustedGrossScore = calculateAdjustedGrossScore(
    adjustedPlayedScore,
    courseHandicap,
    numberOfHolesPlayed,
    teePlayed.holes,
    scoresWithHoleIds
  );

  // Calculate score differential and determine ratings based on holes played
  // Per USGA Rule 5.1b, 9-hole rounds use 9-hole ratings and combine with expected differential
  let scoreDifferential: number;
  let courseRatingUsed: number;
  let slopeRatingUsed: number;

  if (numberOfHolesPlayed === 9) {
    // Pick front-9 or back-9 ratings/par per USGA Rule 5.1b based on section played
    const isBack = section === "back";
    courseRatingUsed = isBack
      ? teePlayed.courseRatingBack9
      : teePlayed.courseRatingFront9;
    slopeRatingUsed = isBack
      ? teePlayed.slopeRatingBack9
      : teePlayed.slopeRatingFront9;
    const nineHolePar = isBack ? teePlayed.inPar : teePlayed.outPar;

    // Calculate expected differential for unplayed 9 holes
    const expectedDifferential = calculateExpected9HoleDifferential(
      handicapIndex,
      courseRatingUsed,
      slopeRatingUsed,
      nineHolePar
    );

    // Calculate 18-hole equivalent differential
    scoreDifferential = calculate9HoleScoreDifferential(
      adjustedPlayedScore,
      courseRatingUsed,
      slopeRatingUsed,
      expectedDifferential
    );

  } else {
    // 18-hole calculation uses 18-hole ratings
    courseRatingUsed = teePlayed.courseRating18;
    slopeRatingUsed = teePlayed.slopeRating18;

    scoreDifferential = calculateScoreDifferential(
      adjustedGrossScore,
      courseRatingUsed,
      slopeRatingUsed
    );

  }

  return {
    adjustedGrossScore,
    adjustedPlayedScore,
    scoreDifferential,
    courseHandicap,
    courseRatingUsed,
    slopeRatingUsed,
    holesPlayed: numberOfHolesPlayed,
  };
};

// These types match exactly what Drizzle expects for an insert
type TeeInfoInsert = typeof teeInfo.$inferInsert;
type RoundInsert = typeof round.$inferInsert;

/**
 * Submit a scorecard: authorize, gate on plan/limit, resolve course + tee
 * (creating pending rows when missing), insert the round + scores +
 * submission audit trail in one transaction, then notify admins and capture
 * analytics. Returns the persisted round row.
 */
export async function submitScorecard(
  deps: SubmitScorecardDeps,
  input: Scorecard
) {
  const {
    teePlayed,
    scores,
    notes,
    approvalStatus,
    course: coursePlayed,
    teeTime,
    userId,
    nineHoleSection,
  } = input;

  // Prevent submitting on behalf of another user — input.userId must match
  // the authenticated session.
  if (userId !== deps.authUserId) {
    throw new SelfSubmissionError();
  }

  if (!teePlayed.holes) {
    throw new Error("Tee played has no holes");
  }

  // 0. Check user access (plan selected)
  const access = await deps.getUserAccess(userId);

  // 0a. First check: Has user selected a plan?
  if (!access.hasAccess) {
    throw new PlanNotSelectedError();
  }

  // 0b. Second check: free-tier round limit. Under "reject" (web/native)
  // an at-limit submission is refused up front. Under "quarantine" (/v1)
  // it is accepted — the in-transaction decision below stores it with
  // `quarantined = true` instead (billing gate: over-limit is not an
  // error on that surface).
  if (
    deps.overLimitPolicy === "reject" &&
    access.plan === "free" &&
    access.remainingRounds <= 0
  ) {
    throw new RoundLimitReachedError(FREE_TIER_ROUND_LIMIT);
  }

  // Wrap all database mutations in a transaction so partial failures roll back
  const newRound = await deps.db.transaction(async (tx) => {
    // 1. Get user profile for handicap calculations. For free-tier users
    // the row is locked FOR UPDATE so concurrent submissions by the same
    // user serialize on it — the active-vs-quarantined count below then
    // cannot race: at the limit, exactly one concurrent submission lands
    // active and the rest land quarantined.
    const profileQuery = tx
      .select()
      .from(profile)
      .where(eq(profile.id, userId))
      .limit(1);
    const userProfile =
      access.plan === "free"
        ? await profileQuery.for("update")
        : await profileQuery;

    if (!userProfile[0]) {
      throw new Error("User profile not found");
    }

    // 1b. In-transaction active-vs-quarantined decision (subplan 002
    // Part B). The authoritative free-tier count lives HERE, under the
    // profile lock — it replaces the old pre-commit trust in
    // `access.remainingRounds` alone and the old post-commit
    // delete-on-race. An over-limit round is stored with
    // `quarantined = true`: excluded from the free-tier count
    // (`utils/billing/access-control.ts`, `round.getCountByUserId`) and
    // from every handicap input, and unlocked by upgrading — never
    // rejected here (the billing gate refused rejection), never deleted.
    let quarantined = false;
    if (access.plan === "free") {
      const activeRounds = await tx
        .select({ count: count() })
        .from(round)
        .where(and(eq(round.userId, userId), eq(round.quarantined, false)));
      quarantined = (activeRounds[0]?.count ?? 0) >= FREE_TIER_ROUND_LIMIT;
    }

    // 2. Handle course
    let courseId = coursePlayed.id;
    let courseIsNew = false;

    // Match on the FULL natural key — (name, country, city) is the unique
    // index on `course` (course_name_country_city_key). A name-only lookup
    // silently rebinds the round to whichever same-name course sorts first,
    // e.g. two "Royal Golf Club"s in different countries.
    const existingCourse = await tx
      .select()
      .from(course)
      .where(
        and(
          eq(course.name, coursePlayed.name),
          eq(course.country, coursePlayed.country),
          eq(course.city, coursePlayed.city)
        )
      )
      .limit(1);

    if (existingCourse[0]) {
      courseId = existingCourse[0].id;
    } else if (coursePlayed.approvalStatus === "pending") {
      const [newCourse] = await tx
        .insert(course)
        .values({
          name: coursePlayed.name,
          approvalStatus: "pending",
          country: coursePlayed.country,
          city: coursePlayed.city,
          website: coursePlayed.website,
          submittedBy: userId,
        })
        .returning();
      courseId = newCourse.id;
      courseIsNew = true;
    }

    if (!courseId) {
      throw new CourseResolutionError("Course ID not found");
    }

    // 3. Handle tee
    let teeId = teePlayed.id;
    let teeIsNew = false;
    let teeIsEdit = false;
    let teeResolved = false;
    let parentTeeId: number | null = null;
    let resolvedApprovalStatus = approvalStatus;

    // Helper for comparing decimal ratings with tolerance
    const ratingEqual = (a: unknown, b: unknown): boolean =>
      Math.abs(Number(a) - Number(b)) < 0.001;

    // 3a. Check if user selected their own pending tee (not editing it)
    if (
      teePlayed.approvalStatus === "pending" &&
      teePlayed.id &&
      teePlayed.id > 0
    ) {
      const pendingTee = await tx
        .select()
        .from(teeInfo)
        .where(
          and(
            eq(teeInfo.id, teePlayed.id),
            eq(teeInfo.approvalStatus, "pending"),
            eq(teeInfo.submittedBy, userId)
          )
        )
        .limit(1);

      if (pendingTee.length > 0) {
        teeId = pendingTee[0]!.id;
        resolvedApprovalStatus = "pending";
        parentTeeId = pendingTee[0]!.parentTeeId;
        teeResolved = true;
      }
    }

    // 3b. Find existing APPROVED non-archived tee by courseId + name + gender
    // Skip if 3a already resolved the tee (user reusing their own pending tee)
    if (!teeResolved && !teeIsNew && !teeIsEdit) {
      const existingTee = await tx
        .select()
        .from(teeInfo)
        .where(
          and(
            eq(teeInfo.courseId, courseId),
            eq(teeInfo.name, teePlayed.name),
            eq(teeInfo.gender, teePlayed.gender),
            eq(teeInfo.approvalStatus, "approved"),
            eq(teeInfo.isArchived, false)
          )
        )
        .limit(1);

      if (existingTee.length > 0 && teePlayed.approvalStatus === "pending") {
        const existing = existingTee[0]!;

        // Compare submitted tee data against existing approved row
        const hasRatingChanges =
          !ratingEqual(existing.courseRating18, teePlayed.courseRating18) ||
          Number(existing.slopeRating18) !==
            Number(teePlayed.slopeRating18) ||
          !ratingEqual(
            existing.courseRatingFront9,
            teePlayed.courseRatingFront9
          ) ||
          Number(existing.slopeRatingFront9) !==
            Number(teePlayed.slopeRatingFront9) ||
          !ratingEqual(
            existing.courseRatingBack9,
            teePlayed.courseRatingBack9
          ) ||
          Number(existing.slopeRatingBack9) !==
            Number(teePlayed.slopeRatingBack9);

        const hasParChanges =
          existing.outPar !== teePlayed.outPar ||
          existing.inPar !== teePlayed.inPar ||
          existing.totalPar !== teePlayed.totalPar;

        const hasDistanceChanges =
          existing.outDistance !== teePlayed.outDistance ||
          existing.inDistance !== teePlayed.inDistance ||
          existing.totalDistance !== teePlayed.totalDistance;

        // Also compare hole-level data
        const existingHoles = await tx
          .select()
          .from(hole)
          .where(eq(hole.teeId, existing.id))
          .orderBy(hole.holeNumber);

        const hasHoleChanges = teePlayed.holes
          ? teePlayed.holes.some((submittedHole, holeIndex) => {
              const existingHole = existingHoles[holeIndex];
              if (!existingHole) return true;
              return (
                submittedHole.par !== existingHole.par ||
                submittedHole.distance !== existingHole.distance ||
                submittedHole.hcp !== existingHole.hcp
              );
            })
          : false;

        if (
          hasRatingChanges ||
          hasParChanges ||
          hasDistanceChanges ||
          hasHoleChanges
        ) {
          // Real changes detected -- create a new pending tee row
          const [newTee] = await tx
            .insert(teeInfo)
            .values({
              courseId: courseId!,
              name: teePlayed.name,
              gender: teePlayed.gender,
              courseRating18: teePlayed.courseRating18,
              slopeRating18: teePlayed.slopeRating18,
              courseRatingFront9: teePlayed.courseRatingFront9,
              slopeRatingFront9: teePlayed.slopeRatingFront9,
              courseRatingBack9: teePlayed.courseRatingBack9,
              slopeRatingBack9: teePlayed.slopeRatingBack9,
              outPar: teePlayed.outPar,
              inPar: teePlayed.inPar,
              totalPar: teePlayed.totalPar,
              outDistance: teePlayed.outDistance,
              inDistance: teePlayed.inDistance,
              totalDistance: teePlayed.totalDistance,
              distanceMeasurement: teePlayed.distanceMeasurement,
              approvalStatus: "pending",
              parentTeeId: existing.id,
              submittedBy: userId,
              version: existing.version + 1,
            })
            .returning({ id: teeInfo.id });

          teeId = newTee!.id;
          teeIsEdit = true;
          parentTeeId = existing.id;
          resolvedApprovalStatus = "pending";

          // Insert holes for the new pending tee
          if (teePlayed.holes) {
            const holeValues = teePlayed.holes.map((h) => ({
              teeId: teeId!,
              holeNumber: h.holeNumber,
              par: h.par,
              distance: h.distance,
              hcp: h.hcp,
            }));
            await tx.insert(hole).values(holeValues);
          }
        } else {
          // No real changes -- user opened edit dialog but didn't change anything
          // Use existing tee and keep its approval status
          teeId = existing.id;
          resolvedApprovalStatus = existing.approvalStatus as
            | "approved"
            | "pending";
        }
      } else if (existingTee.length > 0) {
        // Tee is approved and not edited -- reuse as-is
        teeId = existingTee[0]!.id;
      } else if (teePlayed.id && teePlayed.id > 0) {
        // Tee referenced by a real (positive) DB id — verify it's actually
        // approved and active. Client-side temp ids are negative (see
        // useTeeManagement.generateTempId); those are NOT DB references and
        // must fall through to the brand-new-tee insert branch below. This
        // guard mirrors block 3a, which already gates on `id > 0`.
        const teeById = await tx
          .select()
          .from(teeInfo)
          .where(
            and(
              eq(teeInfo.id, teePlayed.id),
              eq(teeInfo.approvalStatus, "approved"),
              eq(teeInfo.isArchived, false),
            )
          )
          .limit(1);

        if (teeById[0]) {
          teeId = teeById[0].id;
        } else {
          throw new CourseResolutionError(
            `Approved, non-archived tee with ID ${teePlayed.id} not found in database`
          );
        }
      } else if (teePlayed.approvalStatus === "pending") {
        // Brand new tee (no existing approved match)
        const teeInsert: TeeInfoInsert = {
          courseId: courseId!,
          name: teePlayed.name,
          gender: teePlayed.gender,
          courseRating18: teePlayed.courseRating18,
          slopeRating18: teePlayed.slopeRating18,
          courseRatingFront9: teePlayed.courseRatingFront9,
          slopeRatingFront9: teePlayed.slopeRatingFront9,
          courseRatingBack9: teePlayed.courseRatingBack9,
          slopeRatingBack9: teePlayed.slopeRatingBack9,
          outPar: teePlayed.outPar,
          inPar: teePlayed.inPar,
          totalPar: teePlayed.totalPar,
          outDistance: teePlayed.outDistance,
          inDistance: teePlayed.inDistance,
          totalDistance: teePlayed.totalDistance,
          distanceMeasurement: teePlayed.distanceMeasurement,
          approvalStatus: "pending",
          submittedBy: userId,
        };

        const [newTee] = await tx
          .insert(teeInfo)
          .values(teeInsert)
          .returning();
        teeId = newTee.id;
        teeIsNew = true;
        resolvedApprovalStatus = "pending";

        if (teeId === null) {
          throw new CourseResolutionError("Failed to insert tee");
        }

        if (teePlayed.holes) {
          const holeInserts = teePlayed.holes.map((h) => ({
            teeId: teeId!,
            holeNumber: h.holeNumber,
            par: h.par,
            hcp: h.hcp,
            distance: h.distance,
          }));

          await tx.insert(hole).values(holeInserts);
        }
      }
    }

    // 4. Persist additional tees from the course (not the played tee)
    const additionalTees: Array<{
      id: number;
      name: string;
      gender: string;
    }> = [];
    if (coursePlayed.tees && coursePlayed.tees.length > 1) {
      for (const additionalTee of coursePlayed.tees) {
        if (
          additionalTee.name === teePlayed.name &&
          additionalTee.gender === teePlayed.gender
        ) {
          continue;
        }

        // Check for existing approved OR pending (same submitter) tee to avoid duplicates
        const existingAdditionalTee = await tx
          .select()
          .from(teeInfo)
          .where(
            and(
              eq(teeInfo.courseId, courseId!),
              eq(teeInfo.name, additionalTee.name),
              eq(teeInfo.gender, additionalTee.gender),
              or(
                and(
                  eq(teeInfo.approvalStatus, "approved"),
                  eq(teeInfo.isArchived, false),
                ),
                and(
                  eq(teeInfo.approvalStatus, "pending"),
                  eq(teeInfo.submittedBy, userId),
                ),
              ),
            ),
          )
          .limit(1);

        if (existingAdditionalTee[0]) {
          continue;
        }

        const [newAdditionalTee] = await tx
          .insert(teeInfo)
          .values({
            courseId: courseId!,
            name: additionalTee.name,
            gender: additionalTee.gender,
            courseRating18: additionalTee.courseRating18,
            slopeRating18: additionalTee.slopeRating18,
            courseRatingFront9: additionalTee.courseRatingFront9,
            slopeRatingFront9: additionalTee.slopeRatingFront9,
            courseRatingBack9: additionalTee.courseRatingBack9,
            slopeRatingBack9: additionalTee.slopeRatingBack9,
            outPar: additionalTee.outPar,
            inPar: additionalTee.inPar,
            totalPar: additionalTee.totalPar,
            outDistance: additionalTee.outDistance,
            inDistance: additionalTee.inDistance,
            totalDistance: additionalTee.totalDistance,
            distanceMeasurement: additionalTee.distanceMeasurement,
            approvalStatus: "pending",
            submittedBy: userId,
          })
          .returning();

        if (newAdditionalTee) {
          additionalTees.push({
            id: newAdditionalTee.id,
            name: additionalTee.name,
            gender: additionalTee.gender,
          });
        }

        if (additionalTee.holes && newAdditionalTee) {
          const additionalHoleInserts = additionalTee.holes.map((h) => ({
            teeId: newAdditionalTee.id,
            holeNumber: h.holeNumber,
            par: h.par,
            hcp: h.hcp,
            distance: h.distance,
          }));

          await tx.insert(hole).values(additionalHoleInserts);
        }
      }
    }

    // Match scores with holes to calculate the par played.
    // For 9-hole back rounds, the played holes are 10..18 (not 1..9).
    let parPlayed = 0;
    if (teePlayed.holes && Array.isArray(scores)) {
      const holeParMap = new Map<number, number>();
      teePlayed.holes.forEach((h) => {
        holeParMap.set(h.holeNumber, h.par);
      });

      const startingHoleNumber =
        scores.length === 9 && nineHoleSection === "back" ? 10 : 1;

      parPlayed = scores.reduce((sum, _score, idx) => {
        const holeNumber = startingHoleNumber + idx;
        const par = holeParMap.get(holeNumber) ?? 0;
        return sum + par;
      }, 0);
    }

    // Determine if player has an established handicap (USGA requires 3+ approved rounds).
    // Quarantined rounds (accept-and-quarantine, subplan 003) are excluded
    // from every handicap-computation input, including this count.
    const roundTeeTime = new Date(teeTime);
    const roundsBeforeThis = await tx
      .select({ count: count() })
      .from(round)
      .where(
        and(
          eq(round.userId, userId),
          lt(round.teeTime, roundTeeTime),
          eq(round.approvalStatus, "approved"),
          eq(round.quarantined, false)
        )
      );
    const hasEstablishedHandicap = (roundsBeforeThis[0]?.count ?? 0) >= 3;

    const {
      adjustedGrossScore: tempAdjustedGrossScore,
      adjustedPlayedScore: tempAdjustedPlayedScore,
      scoreDifferential: tempScoreDifferential,
      courseHandicap: tempCourseHandicap,
      courseRatingUsed: tempCourseRatingUsed,
      slopeRatingUsed: tempSlopeRatingUsed,
      holesPlayed: tempHolesPlayed,
    } = getRoundCalculations(input, Number(userProfile[0].handicapIndex), hasEstablishedHandicap);

    if (!teeId) {
      throw new CourseResolutionError("Course or tee ID not found");
    }

    const roundInsert: RoundInsert = {
      userId: userId,
      courseId: courseId,
      teeId: teeId,
      teeTime: new Date(teeTime),
      existingHandicapIndex: userProfile[0].handicapIndex,
      updatedHandicapIndex: userProfile[0].handicapIndex,
      scoreDifferential: tempScoreDifferential,
      totalStrokes: scores.reduce((sum, score) => sum + score.strokes, 0),
      adjustedGrossScore: tempAdjustedGrossScore,
      adjustedPlayedScore: tempAdjustedPlayedScore,
      parPlayed: parPlayed,
      notes,
      exceptionalScoreAdjustment: 0,
      courseHandicap: tempCourseHandicap,
      approvalStatus: resolvedApprovalStatus,
      courseRatingUsed: tempCourseRatingUsed,
      slopeRatingUsed: tempSlopeRatingUsed,
      holesPlayed: tempHolesPlayed,
      nineHoleSection:
        scores.length === 9 ? (nineHoleSection ?? null) : null,
      quarantined,
    };

    // 5. Insert round. A duplicate submission (double-click, watch sync
    // replay, native offline retry) surfaces here as a 23505 on one of the
    // subplan-003 unique keys — map it to a typed DuplicateRoundError so the
    // raw Postgres constraint message never reaches the UI.
    let insertedRound;
    try {
      [insertedRound] = await tx.insert(round).values(roundInsert).returning();
    } catch (error) {
      throw mapRoundInsertError(error);
    }

    if (!insertedRound) {
      throw new Error("Failed to insert round");
    }

    // Get the actual hole IDs from the database
    const dbHoles = await tx
      .select()
      .from(hole)
      .where(eq(hole.teeId, teeId))
      .orderBy(hole.holeNumber);

    if (dbHoles.length < scores.length) {
      throw new Error(
        `Expected at least ${scores.length} holes but found ${dbHoles.length} in database`
      );
    }

    // Section-aware slice of the 18 db holes for 9-hole rounds:
    // - 18-hole          -> holes 0..17
    // - 9-hole front     -> holes 0..8
    // - 9-hole back      -> holes 9..17
    let holesToUse;
    if (scores.length === 18) {
      holesToUse = dbHoles.slice(0, 18);
    } else if (scores.length === 9 && nineHoleSection === "back") {
      holesToUse = dbHoles.slice(9, 18);
    } else {
      holesToUse = dbHoles.slice(0, 9);
    }
    if (holesToUse.length !== scores.length) {
      throw new Error(
        `Selected ${holesToUse.length} holes for ${scores.length} scores (section=${nineHoleSection ?? "n/a"})`
      );
    }

    // Insert-time integrity: when a client supplies an explicit score.holeId
    // (web/native submit `holeId: undefined` and rely on the positional
    // assignment below), it must reference one of the resolved tee's holes
    // for the played section. Anything else is a cross-tee or cross-section
    // claim that the positional overwrite would otherwise silently mask.
    const sectionHoleIds = new Set(holesToUse.map((dbHole) => dbHole.id));
    for (const submitted of scores) {
      if (
        submitted.holeId !== undefined &&
        !sectionHoleIds.has(submitted.holeId)
      ) {
        throw new ScoreHoleMismatchError(submitted.holeId, teeId);
      }
    }

    const scoreInserts = scores.map((score, index) => ({
      userId,
      roundId: insertedRound.id,
      holeId: holesToUse[index].id,
      strokes: score.strokes,
      hcpStrokes: score.hcpStrokes,
      // Optional shot-level detail (plans/010): persisted verbatim,
      // NULL when not tracked. Never read by the handicap engine.
      putts: score.putts ?? null,
      fairwayHit: score.fairwayHit ?? null,
      penaltyStrokes: score.penaltyStrokes ?? null,
    }));

    await tx.insert(score).values(scoreInserts);

    // 7. Create submission records for audit trail
    const submissionSummaries: ScorecardSubmissionSummary[] = [];

    if (courseIsNew) {
      const [inserted] = await tx
        .insert(submissions)
        .values({
          submittedBy: userId,
          roundId: insertedRound.id,
          courseId: courseId,
          teeId: teeId,
          submissionType: "new_course",
          parentTeeId: null,
        })
        .returning({ id: submissions.id });
      submissionSummaries.push({
        type: "new_course",
        teeName: teePlayed.name,
        teeGender: teePlayed.gender,
        submissionId: inserted?.id,
        teeId: teeId ?? undefined,
      });
    } else if (teeIsEdit) {
      const [inserted] = await tx
        .insert(submissions)
        .values({
          submittedBy: userId,
          roundId: insertedRound.id,
          courseId: courseId,
          teeId: teeId,
          submissionType: "tee_edit",
          parentTeeId: parentTeeId,
        })
        .returning({ id: submissions.id });
      submissionSummaries.push({
        type: "tee_edit",
        teeName: teePlayed.name,
        teeGender: teePlayed.gender,
        submissionId: inserted?.id,
        teeId: teeId ?? undefined,
        parentTeeId: parentTeeId,
      });
    } else if (teeIsNew) {
      const [inserted] = await tx
        .insert(submissions)
        .values({
          submittedBy: userId,
          roundId: insertedRound.id,
          courseId: courseId,
          teeId: teeId,
          submissionType: "new_tee",
          parentTeeId: null,
        })
        .returning({ id: submissions.id });
      submissionSummaries.push({
        type: "new_tee",
        teeName: teePlayed.name,
        teeGender: teePlayed.gender,
        submissionId: inserted?.id,
        teeId: teeId ?? undefined,
      });
    }

    // 8. Create submission records for additional tees so admins can approve them
    for (const extraTee of additionalTees) {
      const [inserted] = await tx
        .insert(submissions)
        .values({
          submittedBy: userId,
          roundId: insertedRound.id,
          courseId: courseId,
          teeId: extraTee.id,
          submissionType: "new_tee",
          parentTeeId: null,
        })
        .returning({ id: submissions.id });

      submissionSummaries.push({
        type: "new_tee",
        teeName: extraTee.name,
        teeGender: extraTee.gender,
        submissionId: inserted?.id,
        teeId: extraTee.id,
      });
    }

    return {
      round: insertedRound,
      createdCourseId: courseIsNew ? courseId : null,
      createdTeeId: (teeIsNew || teeIsEdit) ? teeId : null,
      additionalTeeIds: additionalTees.map((extraTee) => extraTee.id),
      submissionSummaries,
      courseIsNew,
      submitterEmail: userProfile[0].email,
      submitterName: userProfile[0].name,
      courseName: coursePlayed.name,
      courseCity: coursePlayed.city,
      courseCountry: coursePlayed.country,
    };
  });

  // NOTE (subplan 002 Part B): the post-commit "race condition protection"
  // re-count that used to live here — delete the committed round when a
  // concurrent submission pushed the user over the limit — is gone. The
  // active-vs-quarantined decision inside the transaction above is
  // authoritative: a race loser is stored quarantined, never deleted and
  // never double-counted as active.

  // Notify admins (best-effort) if this round produced any pending submissions.
  if (newRound.submissionSummaries.length > 0) {
    try {
      await deps.notifyAdmins({
        submitterEmail: newRound.submitterEmail,
        submitterName: newRound.submitterName,
        courseName: newRound.courseName,
        courseCity: newRound.courseCity,
        courseCountry: newRound.courseCountry,
        courseId: newRound.createdCourseId ?? newRound.round.courseId,
        courseIsNew: newRound.courseIsNew,
        submissions: newRound.submissionSummaries,
        roundId: newRound.round.id,
      });
    } catch (error) {
      // Never fail the user's round submission on email failure.
      deps.logger.error(
        "Failed to send admin submission notification (non-fatal)",
        {
          error: error instanceof Error ? error.message : String(error),
          roundId: newRound.round.id,
          userId,
        }
      );
    }
  }

  deps.analytics.capture({
    distinctId: userId,
    event: ANALYTICS_EVENTS.ROUND_SUBMITTED,
    properties: {
      round_id: newRound.round.id,
      holes_played: newRound.round.holesPlayed,
      approval_status: newRound.round.approvalStatus,
      course_is_new: newRound.courseIsNew,
      score_differential: newRound.round.scoreDifferential,
      total_strokes: newRound.round.totalStrokes,
    },
  });
  await deps.analytics.flush();

  return newRound.round;
}
