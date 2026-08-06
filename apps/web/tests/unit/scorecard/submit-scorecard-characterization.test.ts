/**
 * Characterization tests for the `submitScorecard` pipeline (subplan 002 Part A).
 *
 * These tests pin the CURRENT behavior of the ~700-line tRPC mutation
 * (`round.submitScorecard`) before it is extracted into
 * `server/services/scorecard/`, and must stay green after the extraction —
 * they exercise the pipeline through the tRPC caller, which both the
 * pre-refactor inline mutation and the post-refactor thin adapter satisfy.
 *
 * The database is a fake drizzle handle (see `FakeDb` below): select results
 * are seeded per table, inserts/deletes are recorded for assertion. This keeps
 * the suite runnable everywhere (CI has no local Supabase — the integration
 * twin of this suite, `tests/integration/submit-scorecard-characterization.test.ts`,
 * covers the real transactional path and skips without a local stack).
 *
 * Golden fixtures (per the subplan): 18-hole, 9-hole front, 9-hole back,
 * course-in-catalog, course-missing-→-pending, free-tier at/over limit,
 * plus the plan gates and the self-submission guard. Part B
 * (accept-and-quarantine) replaced the post-commit delete-on-race with an
 * in-transaction active-vs-quarantined decision — covered below for both
 * policies ("reject" keeps the pre-transaction refusal; "quarantine"
 * accepts and stores over-limit rounds with `quarantined = true`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/api/trpc";
import { roundRouter } from "@/server/api/routers/round";
import {
  CourseResolutionError,
  submitScorecard as submitScorecardService,
} from "@/server/services/scorecard";
import {
  course as courseTable,
  hole as holeTable,
  profile as profileTable,
  round as roundTable,
  score as scoreTable,
  submissions as submissionsTable,
  teeInfo as teeInfoTable,
} from "@/db/schema";
import type { Scorecard } from "@/types/scorecard-input";
import { ANALYTICS_EVENTS } from "@handicappin/analytics";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { sendAdminSubmissionNotification } from "@/lib/email-service";
import { logger } from "@/lib/logging";

type Row = Record<string, unknown>;

const h = vi.hoisted(() => {
  type HoistedRow = Record<string, unknown>;
  type Resolver<T> = (
    onFulfilled?: ((value: HoistedRow[]) => T) | null,
    onRejected?: ((reason: unknown) => T) | null
  ) => Promise<T>;

  interface SelectChain {
    from(table: object): SelectChain;
    where(...args: unknown[]): SelectChain;
    limit(...args: unknown[]): SelectChain;
    orderBy(...args: unknown[]): SelectChain;
    for(...args: unknown[]): SelectChain;
    then: Resolver<unknown>;
  }

  /**
   * Minimal fake of the drizzle postgres-js handle, faithful to exactly the
   * fluent surface `submitScorecard` uses:
   *   select(...).from(t).where(...)[.limit(...)|.orderBy(...)|.for(...)] -> awaited
   *   insert(t).values(v)[.returning(...)]                               -> awaited
   *   transaction(fn) -> fn(this)
   * (`delete` is retained so a regression back to the removed post-commit
   * delete-on-race would be recorded and caught by the no-delete asserts.)
   */
  class FakeDb {
    selectQueues = new Map<object, HoistedRow[][]>();
    inserts: Array<{ table: object; values: HoistedRow | HoistedRow[] }> = [];
    deletes: object[] = [];
    private idBases = new Map<object, number>();

    reset(): void {
      this.selectQueues.clear();
      this.inserts = [];
      this.deletes = [];
      this.idBases.clear();
    }

    seedSelect(table: object, ...results: HoistedRow[][]): void {
      const queue = this.selectQueues.get(table) ?? [];
      queue.push(...results);
      this.selectQueues.set(table, queue);
    }

    setIdBase(table: object, base: number): void {
      this.idBases.set(table, base);
    }

    private nextId(table: object): number {
      const next = this.idBases.get(table) ?? 9000;
      this.idBases.set(table, next + 1);
      return next;
    }

    insertsFor(table: object): Array<HoistedRow | HoistedRow[]> {
      return this.inserts
        .filter((entry) => entry.table === table)
        .map((entry) => entry.values);
    }

    select(_fields?: unknown): SelectChain {
      let table: object | undefined;
      const queues = this.selectQueues;
      const chain: SelectChain = {
        from(t: object) {
          table = t;
          return chain;
        },
        where() {
          return chain;
        },
        limit() {
          return chain;
        },
        orderBy() {
          return chain;
        },
        for() {
          return chain;
        },
        then(onFulfilled, onRejected) {
          const queue = table ? queues.get(table) : undefined;
          const result = queue && queue.length > 0 ? queue.shift()! : [];
          return Promise.resolve(result).then(
            onFulfilled ?? undefined,
            onRejected ?? undefined
          );
        },
      };
      return chain;
    }

    insert(table: object) {
      const record = (values: HoistedRow | HoistedRow[]) => {
        this.inserts.push({ table, values });
        const rows = (Array.isArray(values) ? values : [values]).map((row) => ({
          id: this.nextId(table),
          ...row,
        }));
        return {
          returning: (_selection?: unknown) => Promise.resolve(rows),
          then: <T>(
            onFulfilled?: ((value: undefined) => T) | null,
            onRejected?: ((reason: unknown) => T) | null
          ) =>
            Promise.resolve(undefined).then(
              onFulfilled ?? undefined,
              onRejected ?? undefined
            ),
        };
      };
      return { values: record };
    }

    delete(table: object) {
      return {
        where: (..._args: unknown[]) => {
          this.deletes.push(table);
          return Promise.resolve();
        },
      };
    }

    transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T> {
      return fn(this);
    }
  }

  const fakeDb = new FakeDb();
  const capture = vi.fn();
  const flush = vi.fn(async () => {});
  return { fakeDb, posthog: { capture, flush } };
});

vi.mock("@/db", () => ({ db: h.fakeDb }) as unknown as typeof import("@/db"));

vi.mock("@/utils/billing/access-control", () => ({
  getComprehensiveUserAccess: vi.fn(),
}));

vi.mock("@/lib/email-service", () => ({
  sendAdminSubmissionNotification: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/posthog", () => ({
  getPostHogClient: () => h.posthog,
}));

vi.mock("@/lib/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const accessMock = vi.mocked(getComprehensiveUserAccess);
const notifyMock = vi.mocked(sendAdminSubmissionNotification);
const loggerMock = vi.mocked(logger);

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "660e8400-e29b-41d4-a716-446655440111";
const COURSE_ID = 501;
const TEE_ID = 601;
const TEE_TIME = "2026-07-01T10:00:00.000Z";

const unlimitedAccess = {
  plan: "unlimited" as const,
  hasAccess: true,
  hasPremiumAccess: true,
  hasUnlimitedRounds: true,
  remainingRounds: Infinity,
  status: "active" as const,
  currentPeriodEnd: null,
  isLifetime: false,
};

const freeAccess = (remainingRounds: number) => ({
  plan: "free" as const,
  hasAccess: true,
  hasPremiumAccess: false,
  hasUnlimitedRounds: false,
  remainingRounds,
  status: "free" as const,
  currentPeriodEnd: null,
  isLifetime: false,
});

const noAccess = {
  plan: null,
  hasAccess: false,
  hasPremiumAccess: false,
  hasUnlimitedRounds: false,
  remainingRounds: 0,
  status: null,
  currentPeriodEnd: null,
  isLifetime: false,
};

const profileRow = {
  id: USER_ID,
  email: "unit@handicappin.local",
  name: "Unit User",
  handicapIndex: 10.4,
  verified: true,
};

/**
 * Asymmetric 18-hole tee so front-vs-back 9-hole rounds produce different
 * goldens: front 9 = 9x par 4 (36) rated 36.0/130, back 9 = 8x par 4 + one
 * par 3 (35) rated 35.0/120. 18-hole rating 71.0/130.
 */
function buildHoles(withIds: boolean) {
  return Array.from({ length: 18 }, (_, i) => ({
    id: withIds ? 9501 + i : undefined,
    teeId: withIds ? TEE_ID : undefined,
    holeNumber: i + 1,
    par: i === 17 ? 3 : 4,
    hcp: i + 1,
    distance: 350,
  }));
}

/** The db rows for the same 18 holes (always with ids). */
function dbHoleRows(teeId: number, idBase = 9501): Row[] {
  return Array.from({ length: 18 }, (_, i) => ({
    id: idBase + i,
    teeId,
    holeNumber: i + 1,
    par: i === 17 ? 3 : 4,
    hcp: i + 1,
    distance: 350,
  }));
}

function buildTee(withIds: boolean) {
  return {
    id: withIds ? TEE_ID : -1,
    courseId: withIds ? COURSE_ID : undefined,
    name: "Blue",
    gender: "mens" as const,
    courseRating18: 71.0,
    slopeRating18: 130,
    courseRatingFront9: 36.0,
    slopeRatingFront9: 130,
    courseRatingBack9: 35.0,
    slopeRatingBack9: 120,
    outPar: 36,
    inPar: 35,
    totalPar: 71,
    outDistance: 3150,
    inDistance: 3150,
    totalDistance: 6300,
    distanceMeasurement: "yards" as const,
    approvalStatus: (withIds ? "approved" : "pending") as
      | "approved"
      | "pending",
    holes: buildHoles(withIds),
  };
}

function buildScorecard(overrides: Partial<Scorecard> = {}): Scorecard {
  return {
    userId: USER_ID,
    course: {
      id: COURSE_ID,
      name: "Characterization Course",
      approvalStatus: "approved",
      country: "Norway",
      city: "Oslo",
      tees: undefined,
    },
    teePlayed: buildTee(true),
    scores: Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 0 })),
    teeTime: TEE_TIME,
    approvalStatus: "approved",
    notes: undefined,
    nineHoleSection: undefined,
    ...overrides,
  };
}

const createCaller = createCallerFactory(roundRouter);

function buildCaller(authUserId: string = USER_ID) {
  // Part B removed the service's post-commit Supabase re-count; the only
  // remaining ctx.supabase consumer in this flow is the (mocked)
  // getComprehensiveUserAccess, so an inert stub suffices.
  return createCaller({
    user: { id: authUserId },
    supabase: {},
  } as unknown as Parameters<typeof createCaller>[0]);
}

/**
 * Deps for calling the service directly with a non-default
 * `overLimitPolicy` (the tRPC adapter is pinned to "reject").
 */
function serviceDeps(overLimitPolicy: "reject" | "quarantine") {
  return {
    db: h.fakeDb,
    authUserId: USER_ID,
    getUserAccess: accessMock,
    notifyAdmins: notifyMock,
    logger,
    analytics: { capture: h.posthog.capture, flush: h.posthog.flush },
    overLimitPolicy,
  } as unknown as Parameters<typeof submitScorecardService>[0];
}

/**
 * Seed the queues for the course-in-catalog + approved-tee happy path.
 *
 * `activeRoundCount` seeds the FIRST round-table select — the
 * in-transaction active (non-quarantined) count that Part B's
 * active-vs-quarantined decision runs for free-plan users. Leave it
 * undefined for non-free plans, which skip that count entirely.
 */
function seedApprovedCourseAndTee({
  priorApprovedRounds = 5,
  activeRoundCount,
}: { priorApprovedRounds?: number; activeRoundCount?: number } = {}) {
  h.fakeDb.setIdBase(roundTable, 9301);
  h.fakeDb.setIdBase(submissionsTable, 9401);
  h.fakeDb.seedSelect(profileTable, [profileRow]);
  h.fakeDb.seedSelect(courseTable, [{ id: COURSE_ID, name: "Characterization Course" }]);
  h.fakeDb.seedSelect(teeInfoTable, [{ id: TEE_ID, approvalStatus: "approved" }]);
  if (activeRoundCount !== undefined) {
    h.fakeDb.seedSelect(roundTable, [{ count: activeRoundCount }]);
  }
  h.fakeDb.seedSelect(roundTable, [{ count: priorApprovedRounds }]);
  h.fakeDb.seedSelect(holeTable, dbHoleRows(TEE_ID));
}

beforeEach(() => {
  h.fakeDb.reset();
  h.posthog.capture.mockClear();
  h.posthog.flush.mockClear();
  accessMock.mockReset();
  notifyMock.mockClear();
  loggerMock.warn.mockClear();
  loggerMock.error.mockClear();
});

describe("submitScorecard characterization — golden rounds", () => {
  it("18-hole round on a catalog course with an approved tee: exact persisted round shape", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);
    seedApprovedCourseAndTee();

    const result = await buildCaller().submitScorecard(buildScorecard());

    // CH = round(10.4 * 130/113 + (71.0 - 71)) = 12
    // APS = AGS = 90 (18 x 5, no net-double-bogey cap triggered)
    // SD = (90 - 71.0) * 113/130 = 16.5154 -> 16.5
    expect(result).toEqual({
      id: 9301,
      userId: USER_ID,
      courseId: COURSE_ID,
      teeId: TEE_ID,
      teeTime: new Date(TEE_TIME),
      existingHandicapIndex: 10.4,
      updatedHandicapIndex: 10.4,
      scoreDifferential: 16.5,
      totalStrokes: 90,
      adjustedGrossScore: 90,
      adjustedPlayedScore: 90,
      parPlayed: 71,
      notes: undefined,
      exceptionalScoreAdjustment: 0,
      courseHandicap: 12,
      approvalStatus: "approved",
      courseRatingUsed: 71,
      slopeRatingUsed: 130,
      holesPlayed: 18,
      nineHoleSection: null,
      quarantined: false,
    });

    // Score rows: one per hole, paired positionally to db holes 1..18.
    const scoreInserts = h.fakeDb.insertsFor(scoreTable);
    expect(scoreInserts).toHaveLength(1);
    const scoreRows = scoreInserts[0] as Row[];
    expect(scoreRows).toHaveLength(18);
    scoreRows.forEach((row, i) => {
      expect(row).toEqual({
        userId: USER_ID,
        roundId: 9301,
        holeId: 9501 + i,
        strokes: 5,
        hcpStrokes: 0,
        putts: null,
        fairwayHit: null,
        penaltyStrokes: null,
      });
    });

    // Nothing pending: no submissions, no course/tee inserts, no admin email.
    expect(h.fakeDb.insertsFor(submissionsTable)).toHaveLength(0);
    expect(h.fakeDb.insertsFor(courseTable)).toHaveLength(0);
    expect(h.fakeDb.insertsFor(teeInfoTable)).toHaveLength(0);
    expect(notifyMock).not.toHaveBeenCalled();
    expect(h.fakeDb.deletes).toHaveLength(0);

    // Analytics side-effect.
    expect(h.posthog.capture).toHaveBeenCalledTimes(1);
    expect(h.posthog.capture).toHaveBeenCalledWith({
      distinctId: USER_ID,
      event: ANALYTICS_EVENTS.ROUND_SUBMITTED,
      properties: {
        round_id: 9301,
        holes_played: 18,
        approval_status: "approved",
        course_is_new: false,
        score_differential: 16.5,
        total_strokes: 90,
      },
    });
    expect(h.posthog.flush).toHaveBeenCalledTimes(1);
  });

  it("9-hole front round: front-9 ratings, front par, section stored as 'front'", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);
    seedApprovedCourseAndTee();

    const result = await buildCaller().submitScorecard(
      buildScorecard({
        scores: Array.from({ length: 9 }, () => ({ strokes: 5, hcpStrokes: 0 })),
        nineHoleSection: "front",
      })
    );

    // 9-hole CH = round(5.2 * 130/113 + (36.0 - 36)) = 6
    // APS = 45; expected diff = ((36 + 6) - 36.0) * 113/130 = 5.2154
    // played diff = (45 - 36.0) * 113/130 = 7.8231; SD = 13.0385 -> 13
    expect(result).toMatchObject({
      id: 9301,
      scoreDifferential: 13,
      totalStrokes: 45,
      adjustedGrossScore: 45,
      adjustedPlayedScore: 45,
      parPlayed: 36,
      courseHandicap: 6,
      courseRatingUsed: 36,
      slopeRatingUsed: 130,
      holesPlayed: 9,
      nineHoleSection: "front",
      approvalStatus: "approved",
    });

    // Scores pair against db holes 1..9.
    const scoreRows = h.fakeDb.insertsFor(scoreTable)[0] as Row[];
    expect(scoreRows.map((r) => r.holeId)).toEqual(
      Array.from({ length: 9 }, (_, i) => 9501 + i)
    );
  });

  it("9-hole back round: back-9 ratings, back par, holes 10-18, section 'back'", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);
    seedApprovedCourseAndTee();

    const result = await buildCaller().submitScorecard(
      buildScorecard({
        scores: Array.from({ length: 9 }, () => ({ strokes: 5, hcpStrokes: 0 })),
        nineHoleSection: "back",
      })
    );

    // 9-hole CH = round(5.2 * 120/113 + (35.0 - 35)) = 6
    // APS = 45 (8x par-4 cap 6, 1x par-3 cap 5 -> all 5s kept)
    // expected diff = ((35 + 6) - 35.0) * 113/120 = 5.65
    // played diff = (45 - 35.0) * 113/120 = 9.4167; SD = 15.0667 -> 15.1
    expect(result).toMatchObject({
      id: 9301,
      scoreDifferential: 15.1,
      totalStrokes: 45,
      adjustedGrossScore: 45,
      adjustedPlayedScore: 45,
      parPlayed: 35,
      courseHandicap: 6,
      courseRatingUsed: 35,
      slopeRatingUsed: 120,
      holesPlayed: 9,
      nineHoleSection: "back",
      approvalStatus: "approved",
    });

    // Scores pair against db holes 10..18.
    const scoreRows = h.fakeDb.insertsFor(scoreTable)[0] as Row[];
    expect(scoreRows.map((r) => r.holeId)).toEqual(
      Array.from({ length: 9 }, (_, i) => 9510 + i)
    );
  });

  it("course-missing -> pending: creates pending course, tee, holes, submission, and notifies admins", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);
    h.fakeDb.setIdBase(courseTable, 9101);
    h.fakeDb.setIdBase(teeInfoTable, 9201);
    h.fakeDb.setIdBase(roundTable, 9301);
    h.fakeDb.setIdBase(submissionsTable, 9401);
    h.fakeDb.seedSelect(profileTable, [profileRow]);
    h.fakeDb.seedSelect(courseTable, []); // no catalog match
    h.fakeDb.seedSelect(teeInfoTable, []); // no approved tee match
    h.fakeDb.seedSelect(roundTable, [{ count: 0 }]); // no established handicap
    h.fakeDb.seedSelect(holeTable, dbHoleRows(9201, 7001));

    const pendingTee = buildTee(false);
    const result = await buildCaller().submitScorecard(
      buildScorecard({
        course: {
          id: undefined,
          name: "Brand New Course",
          approvalStatus: "pending",
          country: "Norway",
          city: "Oslo",
          website: "",
          tees: [pendingTee],
        },
        teePlayed: pendingTee,
        approvalStatus: "pending",
      })
    );

    expect(result).toMatchObject({
      id: 9301,
      courseId: 9101,
      teeId: 9201,
      approvalStatus: "pending",
      scoreDifferential: 16.5,
      totalStrokes: 90,
      parPlayed: 71,
      courseHandicap: 12,
      holesPlayed: 18,
    });

    // Pending course insert.
    expect(h.fakeDb.insertsFor(courseTable)).toEqual([
      {
        name: "Brand New Course",
        approvalStatus: "pending",
        country: "Norway",
        city: "Oslo",
        website: "",
        submittedBy: USER_ID,
      },
    ]);

    // Pending tee insert (brand-new tee branch).
    const teeInserts = h.fakeDb.insertsFor(teeInfoTable);
    expect(teeInserts).toHaveLength(1);
    expect(teeInserts[0]).toMatchObject({
      courseId: 9101,
      name: "Blue",
      gender: "mens",
      approvalStatus: "pending",
      submittedBy: USER_ID,
    });

    // 18 hole rows for the new tee.
    const holeInserts = h.fakeDb.insertsFor(holeTable);
    expect(holeInserts).toHaveLength(1);
    expect(holeInserts[0]).toHaveLength(18);

    // Audit-trail submission: new_course.
    expect(h.fakeDb.insertsFor(submissionsTable)).toEqual([
      {
        submittedBy: USER_ID,
        roundId: 9301,
        courseId: 9101,
        teeId: 9201,
        submissionType: "new_course",
        parentTeeId: null,
      },
    ]);

    // Admin notification with the exact summary payload.
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith({
      submitterEmail: "unit@handicappin.local",
      submitterName: "Unit User",
      courseName: "Brand New Course",
      courseCity: "Oslo",
      courseCountry: "Norway",
      courseId: 9101,
      courseIsNew: true,
      submissions: [
        {
          type: "new_course",
          teeName: "Blue",
          teeGender: "mens",
          submissionId: 9401,
          teeId: 9201,
        },
      ],
      roundId: 9301,
    });
  });
});

describe("submitScorecard characterization — gates and races", () => {
  it("rejects submitting on behalf of another user with FORBIDDEN before any db work", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);

    const error = await buildCaller(OTHER_USER_ID)
      .submitScorecard(buildScorecard())
      .then(
        () => null,
        (e: unknown) => e
      );

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("FORBIDDEN");
    expect((error as TRPCError).message).toBe(
      "Cannot submit a scorecard on behalf of another user"
    );
    expect(accessMock).not.toHaveBeenCalled();
    expect(h.fakeDb.inserts).toHaveLength(0);
  });

  it("rejects when no plan is selected with FORBIDDEN and the onboarding message", async () => {
    accessMock.mockResolvedValue(noAccess);

    const error = await buildCaller()
      .submitScorecard(buildScorecard())
      .then(
        () => null,
        (e: unknown) => e
      );

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("FORBIDDEN");
    expect((error as TRPCError).message).toBe(
      "Please select a plan to continue. Visit the onboarding page to get started."
    );
    expect(h.fakeDb.inserts).toHaveLength(0);
  });

  it("rejects a free-tier user at the round limit with FORBIDDEN and the upgrade message", async () => {
    accessMock.mockResolvedValue(freeAccess(0));

    const error = await buildCaller()
      .submitScorecard(buildScorecard())
      .then(
        () => null,
        (e: unknown) => e
      );

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("FORBIDDEN");
    expect((error as TRPCError).message).toBe(
      "You've reached your free tier limit of 25 rounds. Please upgrade to continue tracking rounds."
    );
    expect(h.fakeDb.inserts).toHaveLength(0);
  });

  it("free-tier user under the limit submits successfully and lands active (quarantined = false)", async () => {
    accessMock.mockResolvedValue(freeAccess(5));
    seedApprovedCourseAndTee({ activeRoundCount: 20 });

    const result = await buildCaller().submitScorecard(buildScorecard());

    expect(result.id).toBe(9301);
    expect(result.quarantined).toBe(false);
    expect(h.fakeDb.deletes).toHaveLength(0);
  });

  it("at-limit race under 'reject': the in-transaction re-count quarantines the loser — stored, never deleted (Part B replaces the delete-on-race)", async () => {
    // The pre-transaction gate saw 1 remaining round (a stale read: a
    // concurrent submission commits first), but the authoritative
    // in-transaction count already reports the limit reached.
    accessMock.mockResolvedValue(freeAccess(1));
    seedApprovedCourseAndTee({ activeRoundCount: 25 });

    const result = await buildCaller().submitScorecard(buildScorecard());

    // Accepted and stored quarantined — no FORBIDDEN, no compensation.
    expect(result.id).toBe(9301);
    expect(result.quarantined).toBe(true);
    expect(h.fakeDb.deletes).toHaveLength(0);
    expect(loggerMock.warn).not.toHaveBeenCalled();

    const [roundInsert] = h.fakeDb.insertsFor(roundTable) as Row[];
    expect(roundInsert.quarantined).toBe(true);

    // A quarantined round is a real round: scores stored, analytics fired.
    expect(h.fakeDb.insertsFor(scoreTable)).toHaveLength(1);
    expect(h.posthog.capture).toHaveBeenCalledTimes(1);
  });
});

/**
 * CourseResolutionError characterization (a PR #165 coverage gap) plus the
 * Part B `overLimitPolicy` behaviors: "quarantine" accepts over-limit
 * rounds and stores them quarantined; "reject" (web/native) still refuses
 * them up front.
 */
describe("submitScorecard characterization — course resolution failures and the Part B policies", () => {
  it("approved tee referenced by an id that no longer resolves: INTERNAL_SERVER_ERROR with the exact CourseResolutionError message, nothing persisted", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);
    // Catalog course matches, but NO teeInfo rows are seeded, so both the
    // name+gender lookup (3b) and the by-id verification return empty and
    // the by-id branch throws CourseResolutionError. The adapter does not
    // catch it — tRPC's errorFormatter wraps it as INTERNAL_SERVER_ERROR
    // with the error's own message (pinned pre-refactor behavior).
    h.fakeDb.seedSelect(profileTable, [profileRow]);
    h.fakeDb.seedSelect(courseTable, [
      { id: COURSE_ID, name: "Characterization Course" },
    ]);

    const error = await buildCaller()
      .submitScorecard(buildScorecard())
      .then(
        () => null,
        (e: unknown) => e
      );

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
    expect((error as TRPCError).message).toBe(
      `Approved, non-archived tee with ID ${TEE_ID} not found in database`
    );
    expect((error as TRPCError).cause).toBeInstanceOf(CourseResolutionError);

    // The transaction aborted before any round/score/submission insert.
    expect(h.fakeDb.insertsFor(roundTable)).toHaveLength(0);
    expect(h.fakeDb.insertsFor(scoreTable)).toHaveLength(0);
    expect(h.fakeDb.insertsFor(submissionsTable)).toHaveLength(0);
    expect(notifyMock).not.toHaveBeenCalled();
    expect(h.posthog.capture).not.toHaveBeenCalled();
  });

  it('policy "quarantine": an over-limit submission is accepted and stored with quarantined = true', async () => {
    accessMock.mockResolvedValue(freeAccess(0));
    seedApprovedCourseAndTee({ activeRoundCount: 25 });

    const result = await submitScorecardService(
      serviceDeps("quarantine"),
      buildScorecard()
    );

    expect(result.id).toBe(9301);
    expect(result.quarantined).toBe(true);

    const [roundInsert] = h.fakeDb.insertsFor(roundTable) as Row[];
    expect(roundInsert.quarantined).toBe(true);

    // Stored as a full round: scores persisted, nothing deleted.
    expect(h.fakeDb.insertsFor(scoreTable)).toHaveLength(1);
    expect(h.fakeDb.deletes).toHaveLength(0);
  });

  it('policy "quarantine": an under-limit submission lands active (quarantined = false)', async () => {
    accessMock.mockResolvedValue(freeAccess(3));
    seedApprovedCourseAndTee({ activeRoundCount: 22 });

    const result = await submitScorecardService(
      serviceDeps("quarantine"),
      buildScorecard()
    );

    expect(result.quarantined).toBe(false);
    const [roundInsert] = h.fakeDb.insertsFor(roundTable) as Row[];
    expect(roundInsert.quarantined).toBe(false);
    expect(h.fakeDb.deletes).toHaveLength(0);
  });

  it('policy "reject" is unchanged: an at-limit submission is refused before any db work', async () => {
    accessMock.mockResolvedValue(freeAccess(0));

    await expect(
      submitScorecardService(serviceDeps("reject"), buildScorecard())
    ).rejects.toThrow(
      "You've reached your free tier limit of 25 rounds. Please upgrade to continue tracking rounds."
    );
    expect(h.fakeDb.inserts).toHaveLength(0);
  });
});

describe("submitScorecard — score.holeId insert-time integrity", () => {
  it("accepts explicit holeIds that match the played tee's db holes", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);
    seedApprovedCourseAndTee();

    // Same ids as the db holes (9501..9518), submitted explicitly.
    const result = await buildCaller().submitScorecard(
      buildScorecard({
        scores: Array.from({ length: 18 }, (_, i) => ({
          holeId: 9501 + i,
          strokes: 5,
          hcpStrokes: 0,
        })),
      })
    );

    expect(result.id).toBe(9301);
    const scoreRows = h.fakeDb.insertsFor(scoreTable)[0] as Row[];
    expect(scoreRows.map((r) => r.holeId)).toEqual(
      Array.from({ length: 18 }, (_, i) => 9501 + i)
    );
  });

  it("rejects a score whose holeId belongs to a different tee (BAD_REQUEST, nothing persisted)", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);
    seedApprovedCourseAndTee();

    // The client's teePlayed.holes and score holeIds are internally
    // consistent (8001..8018), so the pre-insert handicap calculation
    // succeeds — but they are NOT the resolved tee's db holes (9501..9518).
    // Before the fix this cross-tee claim was silently masked by the
    // positional overwrite; now it must surface as a typed rejection.
    const spoofedTee = buildTee(true);
    spoofedTee.holes = spoofedTee.holes.map((holeRow, i) => ({
      ...holeRow,
      id: 8001 + i,
    }));

    await expect(
      buildCaller().submitScorecard(
        buildScorecard({
          teePlayed: spoofedTee,
          scores: Array.from({ length: 18 }, (_, i) => ({
            holeId: 8001 + i,
            strokes: 5,
            hcpStrokes: 0,
          })),
        })
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("does not belong to the played section"),
    });

    expect(h.fakeDb.insertsFor(scoreTable)).toHaveLength(0);
  });

  it("rejects a back-9 round claiming a front-9 hole of the same tee", async () => {
    accessMock.mockResolvedValue(unlimitedAccess);
    seedApprovedCourseAndTee();

    // Scores claim holes 1..9 (ids 9501..9509) but the round is section
    // "back", whose db slice is holes 10..18 (ids 9510..9518).
    await expect(
      buildCaller().submitScorecard(
        buildScorecard({
          scores: Array.from({ length: 9 }, (_, i) => ({
            holeId: 9501 + i,
            strokes: 5,
            hcpStrokes: 0,
          })),
          nineHoleSection: "back",
        })
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(h.fakeDb.insertsFor(scoreTable)).toHaveLength(0);
  });
});
