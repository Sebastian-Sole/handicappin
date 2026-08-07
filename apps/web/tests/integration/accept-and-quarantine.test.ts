/**
 * Integration tests for accept-and-quarantine (subplan 002 Part B) against
 * the REAL local Supabase stack.
 *
 * The three merge-blocking behaviors from `plans/010-v1-implementation.md`
 * §T1 (and the contract, `plans/005-phase0-contract.md` §5):
 *
 * 1. An over-limit submission with `overLimitPolicy: "quarantine"` is
 *    accepted (no throw) and stored with `quarantined = true`.
 * 2. An at-limit race does not double-count: two concurrent submissions with
 *    one remaining round produce exactly one active and one quarantined
 *    round — nothing is deleted post-commit.
 * 3. Quarantined rounds are excluded from both counting sites
 *    (`utils/billing/access-control.ts`, `round.getCountByUserId`) and from
 *    the handicap computation (the established-handicap count inside
 *    `submit-scorecard.ts` and its copy in `scorecard.getScorecardByRoundId`)
 *    — proven end-to-end with quarantined rows created by the service itself.
 *
 * Calls the framework-free service directly (the tRPC adapter keeps
 * `overLimitPolicy: "reject"`; only the future `/v1` adapter passes
 * "quarantine"). Skips (not fails) without a local `supabase start` stack —
 * same `describeIfLocal` harness as the other integration suites.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq, and, inArray } from "drizzle-orm";

import { createCallerFactory } from "@/server/api/trpc";
import { roundRouter } from "@/server/api/routers/round";
import { scorecardRouter } from "@/server/api/routers/scorecard";
import { submitScorecard } from "@/server/services/scorecard";
import type { OverLimitPolicy } from "@/server/services/scorecard";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { createFreeTierResponse } from "@/utils/billing/access-helpers";
import type { Scorecard } from "@/types/scorecard-input";
import type { Database } from "@/types/supabase";

// Never ship test events to a real PostHog project from this suite.
vi.mock("@/lib/posthog", () => ({
  getPostHogClient: () => ({
    capture: () => {},
    flush: async () => {},
  }),
}));

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

const FREE_TIER_ROUND_LIMIT = 25;

const OVER_EMAIL = "quarantine-part-b-over@handicappin.local";
const RACE_EMAIL = "quarantine-part-b-race@handicappin.local";
const EST_EMAIL = "quarantine-part-b-established@handicappin.local";
const CTRL_EST_EMAIL = "quarantine-part-b-ctrl-established@handicappin.local";
const CTRL_NEW_EMAIL = "quarantine-part-b-ctrl-new@handicappin.local";
const COURSE_NAME = "Accept And Quarantine Course";
const TEE_NAME = "Blue";

let overUserId: string;
let raceUserId: string;
let estUserId: string;
let ctrlEstUserId: string;
let ctrlNewUserId: string;
let courseId: number;
let teeId: number;

const createRoundCaller = createCallerFactory(roundRouter);
const createScorecardCaller = createCallerFactory(scorecardRouter);

/** Same asymmetric tee as the characterization suites (18: 71.0/130). */
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

function adminClient() {
  return createClient<Database>(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createTestUser(
  email: string,
  planSelected: "free" | "unlimited"
) {
  const admin = adminClient();
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
    name: "Quarantine Part B User",
    verified: true,
    handicapIndex: 10.4,
    planSelected,
    ...(planSelected === "free" ? {} : { subscriptionStatus: "active" }),
  });
  return created.user.id;
}

/** Bulk-insert plain round rows directly (setup, not the code under test). */
async function seedRounds(
  userId: string,
  amount: number,
  {
    approvalStatus = "approved",
    quarantined = false,
    startDay = 1,
  }: {
    approvalStatus?: "approved" | "pending";
    quarantined?: boolean;
    startDay?: number;
  } = {}
) {
  await db.insert(round).values(
    Array.from({ length: amount }, (_, i) => ({
      userId,
      courseId,
      teeId,
      teeTime: new Date(Date.UTC(2026, 0, startDay + i, 10)),
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
      approvalStatus,
      quarantined,
    }))
  );
}

async function fetchDbHoles() {
  return db
    .select({ id: hole.id, holeNumber: hole.holeNumber })
    .from(hole)
    .where(eq(hole.teeId, teeId));
}

function buildScorecard(
  userId: string,
  teeTime: string,
  dbHoles: { id: number; holeNumber: number }[],
  strokes = 5
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
      holes: Array.from({ length: 18 }, (_, i) => ({
        id: dbHoles.find((h) => h.holeNumber === i + 1)?.id,
        teeId,
        ...holeSpec(i),
      })),
    },
    scores: Array.from({ length: 18 }, () => ({ strokes, hcpStrokes: 0 })),
    teeTime,
    approvalStatus: "approved",
    notes: undefined,
    nineHoleSection: undefined,
  };
}

/**
 * Deps for calling the service directly. `getUserAccess` defaults to the
 * REAL access-control lookup so the free-tier count is the production one;
 * the race test overrides it with a frozen pre-race snapshot.
 */
function buildDeps(
  authUserId: string,
  overLimitPolicy: OverLimitPolicy,
  getUserAccess?: Parameters<typeof submitScorecard>[0]["getUserAccess"]
): Parameters<typeof submitScorecard>[0] {
  const supabase = adminClient();
  return {
    db,
    authUserId,
    getUserAccess:
      getUserAccess ??
      ((userId: string) => getComprehensiveUserAccess(userId, supabase)),
    notifyAdmins: async () => ({ success: true }),
    logger: { warn: () => {}, error: () => {} },
    analytics: { capture: () => {}, flush: async () => {} },
    overLimitPolicy,
  };
}

function buildRoundCaller(userId: string) {
  return createRoundCaller({
    user: { id: userId },
    supabase: adminClient(),
  } as unknown as Parameters<typeof createRoundCaller>[0]);
}

function buildScorecardCaller(userId: string) {
  return createScorecardCaller({
    user: { id: userId },
    supabase: adminClient(),
  } as unknown as Parameters<typeof createScorecardCaller>[0]);
}

async function activeAndQuarantinedCounts(userId: string) {
  const rows = await db
    .select({ id: round.id, quarantined: round.quarantined })
    .from(round)
    .where(eq(round.userId, userId));
  return {
    total: rows.length,
    active: rows.filter((r) => !r.quarantined).length,
    quarantined: rows.filter((r) => r.quarantined).length,
  };
}

describeIfLocal("accept-and-quarantine (002 Part B, real local Supabase)", () => {
  beforeAll(async () => {
    overUserId = await createTestUser(OVER_EMAIL, "free");
    raceUserId = await createTestUser(RACE_EMAIL, "free");
    estUserId = await createTestUser(EST_EMAIL, "free");
    ctrlEstUserId = await createTestUser(CTRL_EST_EMAIL, "unlimited");
    ctrlNewUserId = await createTestUser(CTRL_NEW_EMAIL, "unlimited");

    // Clean any leftovers from a previous aborted run.
    const stale = await db
      .select({ id: course.id })
      .from(course)
      .where(eq(course.name, COURSE_NAME));
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
        submittedBy: overUserId,
      })
      .returning();
    teeId = createdTee!.id;

    await db
      .insert(hole)
      .values(
        Array.from({ length: 18 }, (_, i) => ({ teeId, ...holeSpec(i) }))
      );
  }, 120_000);

  afterAll(async () => {
    const admin = adminClient();
    const userIds = [
      overUserId,
      raceUserId,
      estUserId,
      ctrlEstUserId,
      ctrlNewUserId,
    ].filter(Boolean);
    if (userIds.length > 0) {
      const userRounds = await db
        .select({ id: round.id })
        .from(round)
        .where(inArray(round.userId, userIds));
      const roundIds = userRounds.map((r) => r.id);
      if (roundIds.length > 0) {
        await db
          .delete(submissions)
          .where(inArray(submissions.roundId, roundIds));
      }
      await db.delete(score).where(inArray(score.userId, userIds));
      await db.delete(round).where(inArray(round.userId, userIds));
    }
    if (teeId) {
      await db.delete(hole).where(eq(hole.teeId, teeId));
      await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    }
    if (courseId) {
      await db.delete(course).where(eq(course.id, courseId));
    }
    for (const uid of userIds) {
      await db.delete(profile).where(eq(profile.id, uid));
      await admin.auth.admin.deleteUser(uid);
    }
  }, 120_000);

  test("over-limit submission with policy 'quarantine' is accepted and stored with quarantined = true", async () => {
    await seedRounds(overUserId, FREE_TIER_ROUND_LIMIT); // 25 active
    const dbHoles = await fetchDbHoles();

    const result = await submitScorecard(
      buildDeps(overUserId, "quarantine"),
      buildScorecard(overUserId, "2026-07-01T10:00:00.000Z", dbHoles)
    );

    expect(result.quarantined).toBe(true);

    const [row] = await db
      .select()
      .from(round)
      .where(eq(round.id, result.id));
    expect(row).toBeDefined();
    expect(row!.quarantined).toBe(true);
    expect(row!.approvalStatus).toBe("approved");

    // The round's scores were stored normally (a quarantined round is a
    // full round — only counting/handicap treat it differently).
    const scoreRows = await db
      .select()
      .from(score)
      .where(eq(score.roundId, result.id));
    expect(scoreRows).toHaveLength(18);
  }, 60_000);

  test("quarantined rounds are excluded from both counting sites (getCountByUserId + access-control)", async () => {
    // State from the previous test: 25 active + 1 quarantined = 26 rows.
    expect(await activeAndQuarantinedCounts(overUserId)).toEqual({
      total: 26,
      active: 25,
      quarantined: 1,
    });

    // Counting site 1: round.getCountByUserId (native quota gate/homepage).
    const countBefore = await buildRoundCaller(overUserId).getCountByUserId({
      userId: overUserId,
    });
    expect(countBefore).toBe(25); // not 26

    // Free two slots, keeping the quarantined row in place.
    const activeRows = await db
      .select({ id: round.id })
      .from(round)
      .where(and(eq(round.userId, overUserId), eq(round.quarantined, false)))
      .limit(2);
    await db.delete(round).where(
      inArray(
        round.id,
        activeRows.map((r) => r.id)
      )
    );

    // Counting site 1 again: 23 active, quarantined row still ignored.
    const countAfter = await buildRoundCaller(overUserId).getCountByUserId({
      userId: overUserId,
    });
    expect(countAfter).toBe(23);

    // Counting site 2: the free-tier gate in access-control. 23 active + 1
    // quarantined must leave 2 remaining rounds — it would be 1 if the
    // quarantined row consumed quota.
    const access = await getComprehensiveUserAccess(overUserId, adminClient());
    expect(access.plan).toBe("free");
    expect(access.remainingRounds).toBe(2);

    // And the freed quota is really usable end-to-end: a "reject"-policy
    // submission (the unchanged web path) succeeds and lands active.
    const dbHoles = await fetchDbHoles();
    const rejectPathRound = await submitScorecard(
      buildDeps(overUserId, "reject"),
      buildScorecard(overUserId, "2026-07-02T10:00:00.000Z", dbHoles)
    );
    expect(rejectPathRound.quarantined).toBe(false);
  }, 60_000);

  test("under-limit submission with policy 'quarantine' stores quarantined = false", async () => {
    // State: 24 active + 1 quarantined -> 1 remaining round.
    const dbHoles = await fetchDbHoles();

    const result = await submitScorecard(
      buildDeps(overUserId, "quarantine"),
      buildScorecard(overUserId, "2026-07-03T10:00:00.000Z", dbHoles)
    );

    expect(result.quarantined).toBe(false);
    const [row] = await db
      .select()
      .from(round)
      .where(eq(round.id, result.id));
    expect(row!.quarantined).toBe(false);

    expect(await activeAndQuarantinedCounts(overUserId)).toEqual({
      total: 26,
      active: 25,
      quarantined: 1,
    });
  }, 60_000);

  test("at-limit race: two concurrent submissions with 1 remaining round -> exactly one active, one quarantined, nothing deleted", async () => {
    await seedRounds(raceUserId, FREE_TIER_ROUND_LIMIT - 1); // 24 active
    const dbHoles = await fetchDbHoles();

    // Freeze the pre-race access snapshot for BOTH submissions — each
    // believes one round remains, exactly the stale-read race the old
    // post-commit delete-on-race compensated for. The in-transaction
    // decision must resolve it without deleting anything.
    const frozenAccess = createFreeTierResponse(FREE_TIER_ROUND_LIMIT - 1);
    const frozenGetUserAccess = async () => frozenAccess;

    const [first, second] = await Promise.all([
      submitScorecard(
        buildDeps(raceUserId, "quarantine", frozenGetUserAccess),
        buildScorecard(raceUserId, "2026-07-01T10:00:00.000Z", dbHoles)
      ),
      submitScorecard(
        buildDeps(raceUserId, "quarantine", frozenGetUserAccess),
        buildScorecard(raceUserId, "2026-07-02T10:00:00.000Z", dbHoles)
      ),
    ]);

    // Both submissions were accepted — no throw, no post-commit deletion.
    expect(first.id).not.toBe(second.id);
    const persisted = await db
      .select({ id: round.id, quarantined: round.quarantined })
      .from(round)
      .where(inArray(round.id, [first.id, second.id]));
    expect(persisted).toHaveLength(2);

    // Exactly one landed active; the loser was quarantined, not deleted.
    const quarantinedFlags = persisted.map((r) => r.quarantined).sort();
    expect(quarantinedFlags).toEqual([false, true]);

    // No double-count: the user sits exactly at the limit.
    expect(await activeAndQuarantinedCounts(raceUserId)).toEqual({
      total: 26,
      active: 25,
      quarantined: 1,
    });
    const activeCount = await buildRoundCaller(raceUserId).getCountByUserId({
      userId: raceUserId,
    });
    expect(activeCount).toBe(25);
  }, 60_000);

  test("quarantined rounds are excluded from the handicap computation (established-handicap count + getScorecardByRoundId)", async () => {
    // estUser: fill the quota with 25 PENDING active rounds (they consume
    // quota but are never handicap inputs), so every subsequent submission
    // is quarantined by the service itself while the established-handicap
    // count sees only approved rows.
    await seedRounds(estUserId, FREE_TIER_ROUND_LIMIT, {
      approvalStatus: "pending",
    });
    const dbHoles = await fetchDbHoles();

    // Three APPROVED rounds created through the service, all quarantined.
    const priorIds: number[] = [];
    for (const day of [1, 2, 3]) {
      const prior = await submitScorecard(
        buildDeps(estUserId, "quarantine"),
        buildScorecard(estUserId, `2026-07-0${day}T10:00:00.000Z`, dbHoles)
      );
      expect(prior.quarantined).toBe(true);
      expect(prior.approvalStatus).toBe("approved");
      priorIds.push(prior.id);
    }

    // Controls submit the identical strokes-10 scorecard: with an
    // established handicap (3+ prior approved active rounds) USGA Rule 3.1b
    // caps holes at net double bogey; without one, Rule 3.1a caps at par+5 —
    // so the two produce different score differentials.
    const ctrlNewRound = await submitScorecard(
      buildDeps(ctrlNewUserId, "reject"),
      buildScorecard(ctrlNewUserId, "2026-07-10T10:00:00.000Z", dbHoles, 10)
    );
    await seedRounds(ctrlEstUserId, 3, { startDay: 1 });
    const ctrlEstRound = await submitScorecard(
      buildDeps(ctrlEstUserId, "reject"),
      buildScorecard(ctrlEstUserId, "2026-07-10T10:00:00.000Z", dbHoles, 10)
    );
    expect(Number(ctrlEstRound.scoreDifferential)).not.toBe(
      Number(ctrlNewRound.scoreDifferential)
    );

    // estUser has 3 approved rounds before July 10 — but all quarantined.
    // The submission must therefore be computed WITHOUT an established
    // handicap, matching the zero-prior control exactly. (If quarantined
    // rounds leaked into the established-handicap count, it would match the
    // established control instead.)
    const observed = await submitScorecard(
      buildDeps(estUserId, "quarantine"),
      buildScorecard(estUserId, "2026-07-10T10:00:00.000Z", dbHoles, 10)
    );
    expect(observed.quarantined).toBe(true);
    expect(Number(observed.scoreDifferential)).toBe(
      Number(ctrlNewRound.scoreDifferential)
    );

    // Second copy of the same count: scorecard.getScorecardByRoundId must
    // also report 0 approved rounds before this tee time — it would report
    // 3 if the quarantined filter were missing.
    const scorecard = await buildScorecardCaller(estUserId).getScorecardByRoundId(
      { id: String(observed.id) }
    );
    expect(scorecard).not.toBeNull();
    expect(scorecard!.roundsBeforeTeeTime).toBe(0);
  }, 120_000);
});
