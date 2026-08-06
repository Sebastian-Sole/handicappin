/**
 * Integration characterization tests for `submitScorecard` (subplan 002 Part A).
 *
 * Pins the CURRENT transactional behavior of the pipeline against the REAL
 * local Supabase stack before the extraction into
 * `server/services/scorecard/`, and must stay green after it. The unit twin
 * (`tests/unit/scorecard/submit-scorecard-characterization.test.ts`) covers
 * the same golden fixtures against a fake db and runs everywhere; this suite
 * exercises the real transaction, the real access-control count, and the
 * real free-tier limit. Skips (not fails) without a local `supabase start`
 * stack — same `describeIfLocal` harness as the other integration suites.
 *
 * Golden fixtures: 18-hole, 9-hole front, 9-hole back on a catalog course;
 * course-missing-→-pending (with admin-notify + submission audit trail);
 * free-tier under/at the 25-round lifetime limit.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq, inArray } from "drizzle-orm";

import { createCallerFactory } from "@/server/api/trpc";
import { roundRouter } from "@/server/api/routers/round";
import type { Scorecard } from "@/types/scorecard-input";
import { sendAdminSubmissionNotification } from "@/lib/email-service";

vi.mock("@/lib/email-service", () => ({
  sendAdminSubmissionNotification: vi.fn(async () => ({ success: true })),
}));

// Never ship test events to a real PostHog project from this suite.
vi.mock("@/lib/posthog", () => ({
  getPostHogClient: () => ({
    capture: () => {},
    flush: async () => {},
  }),
}));

const notifyMock = vi.mocked(sendAdminSubmissionNotification);

const { db } = await import("@/db");
const { profile, course, teeInfo, hole, round, score, submissions } =
  await import("@/db/schema");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const isLocalStack =
  !!databaseUrl?.includes("127.0.0.1") || !!databaseUrl?.includes("localhost");
const hasRealSupabase =
  !!supabaseUrl &&
  !supabaseUrl.includes("dummy") &&
  !!serviceRoleKey &&
  !serviceRoleKey.includes("dummy");

const describeIfLocal =
  hasRealSupabase && isLocalStack ? describe : describe.skip;

const GOLDEN_EMAIL = "submit-scorecard-char-golden@handicappin.local";
const FREE_EMAIL = "submit-scorecard-char-free@handicappin.local";
const COURSE_NAME = "Submit Scorecard Characterization Course";
const PENDING_COURSE_NAME = "Submit Scorecard Characterization Pending Course";
const TEE_NAME = "Blue";

let goldenUserId: string;
let freeUserId: string;
let courseId: number;
let teeId: number;
const createdRoundIds: number[] = [];
let pendingCourseId: number | null = null;
let pendingTeeId: number | null = null;

const createCaller = createCallerFactory(roundRouter);

/**
 * Same asymmetric tee as the unit suite: front 9 = 9x par 4 (36) rated
 * 36.0/130, back 9 = 8x par 4 + one par 3 (35) rated 35.0/120; 18-hole
 * rating 71.0/130. Profile handicapIndex is pinned to 10.4 so the goldens
 * match the unit suite exactly.
 */
const TEE_RATINGS = {
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
} as const;

function holeSpec(i: number) {
  return {
    holeNumber: i + 1,
    par: i === 17 ? 3 : 4,
    hcp: i + 1,
    distance: 350,
  };
}

function buildHoles(withIds: { id: number; holeNumber: number }[] = []) {
  return Array.from({ length: 18 }, (_, i) => ({
    id: withIds.find((h) => h.holeNumber === i + 1)?.id,
    teeId: withIds.length > 0 ? teeId : undefined,
    ...holeSpec(i),
  }));
}

function buildScorecard(
  userId: string,
  scores: Scorecard["scores"],
  teeTime: string,
  holes: ReturnType<typeof buildHoles>,
  nineHoleSection?: "front" | "back"
): Scorecard {
  return {
    userId,
    course: {
      id: courseId,
      name: COURSE_NAME,
      approvalStatus: "approved",
      country: "Norway",
      city: "Oslo",
      tees: undefined,
    },
    teePlayed: {
      id: teeId,
      courseId,
      name: TEE_NAME,
      gender: "mens",
      ...TEE_RATINGS,
      approvalStatus: "approved",
      holes,
    },
    scores,
    teeTime,
    approvalStatus: "approved",
    notes: undefined,
    nineHoleSection,
  };
}

async function createTestUser(
  email: string,
  planSelected: "free" | "unlimited"
) {
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: usersPage } = await admin.auth.admin.listUsers();
  const existing = usersPage?.users.find((u) => u.email === email);
  if (existing) {
    await db.delete(round).where(eq(round.userId, existing.id));
    await db.delete(profile).where(eq(profile.id, existing.id));
    await admin.auth.admin.deleteUser(existing.id);
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomUUID(),
  });
  if (error || !created.user) {
    throw new Error(`Failed to create test user: ${error?.message}`);
  }
  await db.insert(profile).values({
    id: created.user.id,
    email,
    name: "Characterization User",
    verified: true,
    handicapIndex: 10.4,
    planSelected,
    // The free plan gate reads only plan_selected + the round count;
    // subscription_status has a DB check constraint that excludes "free".
    ...(planSelected === "free" ? {} : { subscriptionStatus: "active" }),
  });
  return created.user.id;
}

function buildCaller(userId: string) {
  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return createCaller({
    user: { id: userId },
    supabase,
  } as unknown as Parameters<typeof createCaller>[0]);
}

describeIfLocal(
  "submitScorecard characterization (real local Supabase)",
  () => {
    beforeAll(async () => {
      goldenUserId = await createTestUser(GOLDEN_EMAIL, "unlimited");
      freeUserId = await createTestUser(FREE_EMAIL, "free");

      // Clean any leftovers from a previous aborted run.
      const stale = await db
        .select({ id: course.id })
        .from(course)
        .where(inArray(course.name, [COURSE_NAME, PENDING_COURSE_NAME]));
      for (const c of stale) {
        const staleTees = await db
          .select({ id: teeInfo.id })
          .from(teeInfo)
          .where(eq(teeInfo.courseId, c.id));
        const staleTeeIds = staleTees.map((t) => t.id);
        if (staleTeeIds.length > 0) {
          await db.delete(hole).where(inArray(hole.teeId, staleTeeIds));
          await db.delete(teeInfo).where(inArray(teeInfo.id, staleTeeIds));
        }
        await db.delete(course).where(eq(course.id, c.id));
      }

      const [createdCourse] = await db
        .insert(course)
        .values({
          name: COURSE_NAME,
          country: "Norway",
          city: "Oslo",
          approvalStatus: "approved",
        })
        .returning();
      courseId = createdCourse!.id;

      const [createdTee] = await db
        .insert(teeInfo)
        .values({
          courseId,
          name: TEE_NAME,
          gender: "mens",
          ...TEE_RATINGS,
          approvalStatus: "approved",
          submittedBy: goldenUserId,
        })
        .returning();
      teeId = createdTee!.id;

      await db
        .insert(hole)
        .values(Array.from({ length: 18 }, (_, i) => ({ teeId, ...holeSpec(i) })));
    }, 60_000);

    afterAll(async () => {
      const admin = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      if (createdRoundIds.length > 0) {
        await db
          .delete(submissions)
          .where(inArray(submissions.roundId, createdRoundIds));
        await db.delete(round).where(inArray(round.id, createdRoundIds));
      }
      for (const uid of [goldenUserId, freeUserId]) {
        if (!uid) continue;
        await db.delete(round).where(eq(round.userId, uid));
      }
      if (pendingTeeId) {
        await db.delete(hole).where(eq(hole.teeId, pendingTeeId));
        await db.delete(teeInfo).where(eq(teeInfo.id, pendingTeeId));
      }
      if (pendingCourseId) {
        await db.delete(course).where(eq(course.id, pendingCourseId));
      }
      if (teeId) {
        await db.delete(hole).where(eq(hole.teeId, teeId));
        await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
      }
      if (courseId) {
        await db.delete(course).where(eq(course.id, courseId));
      }
      for (const uid of [goldenUserId, freeUserId]) {
        if (!uid) continue;
        await db.delete(profile).where(eq(profile.id, uid));
        await admin.auth.admin.deleteUser(uid);
      }
    }, 60_000);

    test("18-hole golden round persists the exact round shape and score rows", async () => {
      const dbHoles = await db
        .select({ id: hole.id, holeNumber: hole.holeNumber })
        .from(hole)
        .where(eq(hole.teeId, teeId));
      const caller = buildCaller(goldenUserId);

      const result = await caller.submitScorecard(
        buildScorecard(
          goldenUserId,
          Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 0 })),
          "2026-07-01T10:00:00.000Z",
          buildHoles(dbHoles)
        )
      );
      createdRoundIds.push(result.id);

      // Same goldens as the unit suite: CH 12, APS/AGS 90, SD 16.5.
      expect(result.userId).toBe(goldenUserId);
      expect(result.courseId).toBe(courseId);
      expect(result.teeId).toBe(teeId);
      expect(result.totalStrokes).toBe(90);
      expect(result.adjustedGrossScore).toBe(90);
      expect(result.adjustedPlayedScore).toBe(90);
      expect(result.parPlayed).toBe(71);
      expect(result.courseHandicap).toBe(12);
      expect(Number(result.scoreDifferential)).toBe(16.5);
      expect(Number(result.existingHandicapIndex)).toBe(10.4);
      expect(Number(result.updatedHandicapIndex)).toBe(10.4);
      expect(Number(result.exceptionalScoreAdjustment)).toBe(0);
      expect(result.courseRatingUsed).toBe(71);
      expect(result.slopeRatingUsed).toBe(130);
      expect(result.holesPlayed).toBe(18);
      expect(result.nineHoleSection).toBeNull();
      expect(result.approvalStatus).toBe("approved");

      // Persisted row matches what the mutation returned.
      const [row] = await db.select().from(round).where(eq(round.id, result.id));
      expect(row).toBeDefined();
      expect(Number(row!.scoreDifferential)).toBe(16.5);
      expect(row!.approvalStatus).toBe("approved");

      // One score row per hole, all 18 holes covered.
      const scoreRows = await db
        .select()
        .from(score)
        .where(eq(score.roundId, result.id));
      expect(scoreRows).toHaveLength(18);
      expect(new Set(scoreRows.map((r) => r.holeId))).toEqual(
        new Set(dbHoles.map((h) => h.id))
      );

      // Catalog course: no submissions, no admin email.
      const submissionRows = await db
        .select()
        .from(submissions)
        .where(eq(submissions.roundId, result.id));
      expect(submissionRows).toHaveLength(0);
      expect(notifyMock).not.toHaveBeenCalled();
    }, 60_000);

    test("9-hole front golden round uses front-9 ratings and stores section 'front'", async () => {
      const dbHoles = await db
        .select({ id: hole.id, holeNumber: hole.holeNumber })
        .from(hole)
        .where(eq(hole.teeId, teeId));
      const caller = buildCaller(goldenUserId);

      const result = await caller.submitScorecard(
        buildScorecard(
          goldenUserId,
          Array.from({ length: 9 }, () => ({ strokes: 5, hcpStrokes: 0 })),
          "2026-07-02T10:00:00.000Z",
          buildHoles(dbHoles),
          "front"
        )
      );
      createdRoundIds.push(result.id);

      expect(result.totalStrokes).toBe(45);
      expect(result.adjustedPlayedScore).toBe(45);
      expect(result.adjustedGrossScore).toBe(45);
      expect(result.parPlayed).toBe(36);
      expect(result.courseHandicap).toBe(6);
      expect(Number(result.scoreDifferential)).toBe(13);
      expect(result.courseRatingUsed).toBe(36);
      expect(result.slopeRatingUsed).toBe(130);
      expect(result.holesPlayed).toBe(9);
      expect(result.nineHoleSection).toBe("front");

      // Scores attach to holes 1..9.
      const scoreRows = await db
        .select()
        .from(score)
        .where(eq(score.roundId, result.id));
      const frontHoleIds = new Set(
        dbHoles.filter((h) => h.holeNumber <= 9).map((h) => h.id)
      );
      expect(new Set(scoreRows.map((r) => r.holeId))).toEqual(frontHoleIds);
    }, 60_000);

    test("9-hole back golden round uses back-9 ratings, holes 10-18, section 'back'", async () => {
      const dbHoles = await db
        .select({ id: hole.id, holeNumber: hole.holeNumber })
        .from(hole)
        .where(eq(hole.teeId, teeId));
      const caller = buildCaller(goldenUserId);

      const result = await caller.submitScorecard(
        buildScorecard(
          goldenUserId,
          Array.from({ length: 9 }, () => ({ strokes: 5, hcpStrokes: 0 })),
          "2026-07-03T10:00:00.000Z",
          buildHoles(dbHoles),
          "back"
        )
      );
      createdRoundIds.push(result.id);

      expect(result.totalStrokes).toBe(45);
      expect(result.adjustedPlayedScore).toBe(45);
      expect(result.adjustedGrossScore).toBe(45);
      expect(result.parPlayed).toBe(35);
      expect(result.courseHandicap).toBe(6);
      expect(Number(result.scoreDifferential)).toBe(15.1);
      expect(result.courseRatingUsed).toBe(35);
      expect(result.slopeRatingUsed).toBe(120);
      expect(result.holesPlayed).toBe(9);
      expect(result.nineHoleSection).toBe("back");

      // Scores attach to holes 10..18.
      const scoreRows = await db
        .select()
        .from(score)
        .where(eq(score.roundId, result.id));
      const backHoleIds = new Set(
        dbHoles.filter((h) => h.holeNumber >= 10).map((h) => h.id)
      );
      expect(new Set(scoreRows.map((r) => r.holeId))).toEqual(backHoleIds);
    }, 60_000);

    test("course-missing -> pending: creates pending course/tee/holes, audit submission, and notifies admins", async () => {
      notifyMock.mockClear();
      const caller = buildCaller(goldenUserId);

      const pendingTee = {
        id: -1,
        name: TEE_NAME,
        gender: "mens" as const,
        ...TEE_RATINGS,
        approvalStatus: "pending" as const,
        holes: Array.from({ length: 18 }, (_, i) => ({
          id: undefined,
          teeId: undefined,
          ...holeSpec(i),
        })),
      };

      const result = await caller.submitScorecard({
        userId: goldenUserId,
        course: {
          id: undefined,
          name: PENDING_COURSE_NAME,
          approvalStatus: "pending",
          country: "Norway",
          city: "Oslo",
          website: "",
          tees: [pendingTee],
        },
        teePlayed: pendingTee,
        scores: Array.from({ length: 18 }, () => ({
          strokes: 5,
          hcpStrokes: 0,
        })),
        teeTime: "2026-07-04T10:00:00.000Z",
        approvalStatus: "pending",
        notes: undefined,
        nineHoleSection: undefined,
      });
      createdRoundIds.push(result.id);

      expect(result.approvalStatus).toBe("pending");
      pendingCourseId = result.courseId;
      pendingTeeId = result.teeId;

      // Pending course row.
      const [courseRow] = await db
        .select()
        .from(course)
        .where(eq(course.id, result.courseId));
      expect(courseRow).toMatchObject({
        name: PENDING_COURSE_NAME,
        approvalStatus: "pending",
        submittedBy: goldenUserId,
      });

      // Pending tee row + 18 holes.
      const [teeRow] = await db
        .select()
        .from(teeInfo)
        .where(eq(teeInfo.id, result.teeId));
      expect(teeRow).toMatchObject({
        courseId: result.courseId,
        name: TEE_NAME,
        approvalStatus: "pending",
        submittedBy: goldenUserId,
      });
      const holeRows = await db
        .select()
        .from(hole)
        .where(eq(hole.teeId, result.teeId));
      expect(holeRows).toHaveLength(18);

      // Audit-trail submission row: new_course.
      const submissionRows = await db
        .select()
        .from(submissions)
        .where(eq(submissions.roundId, result.id));
      expect(submissionRows).toHaveLength(1);
      expect(submissionRows[0]).toMatchObject({
        submittedBy: goldenUserId,
        courseId: result.courseId,
        teeId: result.teeId,
        submissionType: "new_course",
        parentTeeId: null,
      });

      // Admin notification fired once for the pending submission.
      expect(notifyMock).toHaveBeenCalledTimes(1);
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          submitterEmail: GOLDEN_EMAIL,
          courseName: PENDING_COURSE_NAME,
          courseIsNew: true,
          roundId: result.id,
          submissions: [
            expect.objectContaining({
              type: "new_course",
              teeName: TEE_NAME,
              teeGender: "mens",
            }),
          ],
        })
      );
    }, 60_000);

    test("free-tier user one under the limit submits round #25 successfully", async () => {
      // 24 pre-existing rounds -> remainingRounds 1 -> submit allowed.
      await db.insert(round).values(
        Array.from({ length: 24 }, (_, i) => ({
          userId: freeUserId,
          courseId,
          teeId,
          teeTime: new Date(Date.UTC(2026, 0, 1 + i, 10)),
          totalStrokes: 90,
          parPlayed: 71,
          adjustedGrossScore: 90,
          adjustedPlayedScore: 90,
          courseHandicap: 12,
          scoreDifferential: 16.5,
          existingHandicapIndex: 10.4,
          updatedHandicapIndex: 10.4,
          courseRatingUsed: 71,
          slopeRatingUsed: 130,
          holesPlayed: 18,
          approvalStatus: "approved",
        }))
      );

      const dbHoles = await db
        .select({ id: hole.id, holeNumber: hole.holeNumber })
        .from(hole)
        .where(eq(hole.teeId, teeId));
      const caller = buildCaller(freeUserId);

      const result = await caller.submitScorecard(
        buildScorecard(
          freeUserId,
          Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 0 })),
          "2026-07-05T10:00:00.000Z",
          buildHoles(dbHoles)
        )
      );
      createdRoundIds.push(result.id);

      expect(result.userId).toBe(freeUserId);
      expect(Number(result.scoreDifferential)).toBe(16.5);

      const [{ total }] = await db
        .select({ total: round.id })
        .from(round)
        .where(eq(round.userId, freeUserId))
        .then((rows) => [{ total: rows.length }]);
      expect(total).toBe(25);
    }, 60_000);

    test("free-tier user at the limit is rejected with FORBIDDEN and nothing is persisted", async () => {
      const dbHoles = await db
        .select({ id: hole.id, holeNumber: hole.holeNumber })
        .from(hole)
        .where(eq(hole.teeId, teeId));
      const caller = buildCaller(freeUserId);

      const error = await caller
        .submitScorecard(
          buildScorecard(
            freeUserId,
            Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 0 })),
            "2026-07-06T10:00:00.000Z",
            buildHoles(dbHoles)
          )
        )
        .then(
          () => null,
          (e: unknown) => e
        );

      expect(error).not.toBeNull();
      expect((error as { code?: string }).code).toBe("FORBIDDEN");
      expect((error as Error).message).toBe(
        "You've reached your free tier limit of 25 rounds. Please upgrade to continue tracking rounds."
      );

      const rows = await db
        .select({ id: round.id })
        .from(round)
        .where(eq(round.userId, freeUserId));
      expect(rows).toHaveLength(25);
    }, 60_000);

    test("cross-section score.holeId is rejected with BAD_REQUEST and the round row is rolled back", async () => {
      const dbHoles = await db
        .select({ id: hole.id, holeNumber: hole.holeNumber })
        .from(hole)
        .where(eq(hole.teeId, teeId));
      const backNineHoleId = dbHoles.find((h) => h.holeNumber === 18)!.id;
      const caller = buildCaller(goldenUserId);

      const roundsBefore = await db
        .select({ id: round.id })
        .from(round)
        .where(eq(round.userId, goldenUserId));

      // A front-9 round whose first score claims hole 18 of the same tee.
      // The hole exists on `teePlayed.holes` so the handicap calculation
      // still resolves it — only the DB-hole set for the played section
      // rejects it, and that check runs AFTER the round row is inserted.
      // Real Postgres must therefore roll the round back; the unit
      // characterization suite's fake `transaction()` cannot prove this.
      const scores: Scorecard["scores"] = Array.from({ length: 9 }, (_, i) => ({
        strokes: 5,
        hcpStrokes: 0,
        ...(i === 0 ? { holeId: backNineHoleId } : {}),
      }));

      const error = await caller
        .submitScorecard(
          buildScorecard(
            goldenUserId,
            scores,
            "2026-07-09T10:00:00.000Z",
            buildHoles(dbHoles),
            "front"
          )
        )
        .then(
          () => null,
          (e: unknown) => e
        );

      expect(error).not.toBeNull();
      expect((error as { code?: string }).code).toBe("BAD_REQUEST");
      expect((error as Error).message).toContain(
        `Score references hole ${backNineHoleId}`
      );

      // The round insert that preceded the check must not have survived.
      const roundsAfter = await db
        .select({ id: round.id })
        .from(round)
        .where(eq(round.userId, goldenUserId));
      expect(roundsAfter.map((r) => r.id).sort()).toEqual(
        roundsBefore.map((r) => r.id).sort()
      );
    }, 60_000);
  }
);
