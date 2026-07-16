/**
 * Shot-level detail persistence through the REAL round write path
 * (plans/010-shot-level-stats-v1).
 *
 * Exercises `round.submitScorecard` — the same tRPC procedure both apps
 * call — against the REAL local Supabase stack via `createCallerFactory`:
 *
 *   1. A scorecard WITH putts/fairwayHit/penaltyStrokes → score rows
 *      persisted with those exact values.
 *   2. An identical scorecard WITHOUT them → columns NULL.
 *   3. Handicap math unaffected: both rounds (same strokes) produce the
 *      identical scoreDifferential / adjustedGrossScore, proving the
 *      detail fields never feed the engine input.
 *
 * There was no pre-existing submitScorecard integration test to model on;
 * this combines the `describeIfLocal` harness from
 * admin-approve-submission.test.ts with the router-caller pattern from
 * tests/unit/routers/stripe-update-subscription.test.ts. Skips (not fails)
 * when no real local `supabase start` stack is available.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq, inArray } from "drizzle-orm";

import { createCallerFactory } from "@/server/api/trpc";
import { roundRouter } from "@/server/api/routers/round";
import { scorecardRouter } from "@/server/api/routers/scorecard";
import type { Scorecard } from "@/types/scorecard-input";

const { db } = await import("@/db");
const { profile, course, teeInfo, hole, round, score } = await import(
  "@/db/schema"
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const isLocalStack =
  !!databaseUrl?.includes("127.0.0.1") || !!databaseUrl?.includes("localhost");

// Same dummy-credential guard as the other integration suites: CI supplies
// DUMMY Supabase credentials, which must count as "no local stack".
const hasRealSupabase =
  !!supabaseUrl &&
  !supabaseUrl.includes("dummy") &&
  !!serviceRoleKey &&
  !serviceRoleKey.includes("dummy");

const describeIfLocal =
  hasRealSupabase && isLocalStack ? describe : describe.skip;

const TEST_EMAIL = "shot-detail-persistence-test@handicappin.local";
const TEE_NAME = "Blue";

let userId: string;
let courseId: number;
let teeId: number;
const createdRoundIds: number[] = [];

const createCaller = createCallerFactory(roundRouter);
const createScorecardCaller = createCallerFactory(scorecardRouter);

/** 18 schema-valid holes: par 4, unique hcp 1..18, 350y each. */
function buildHoles(withIds: { id: number; holeNumber: number }[] = []) {
  return Array.from({ length: 18 }, (_, i) => ({
    id: withIds.find((h) => h.holeNumber === i + 1)?.id,
    teeId,
    holeNumber: i + 1,
    par: 4,
    hcp: i + 1,
    distance: 350,
  }));
}

function buildScorecard(
  scores: Scorecard["scores"],
  teeTime: string,
  holes: ReturnType<typeof buildHoles>,
): Scorecard {
  return {
    userId,
    course: {
      id: courseId,
      name: "Shot Detail Persistence Test Course",
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
      courseRating18: 72.0,
      slopeRating18: 130,
      courseRatingFront9: 36.0,
      slopeRatingFront9: 130,
      courseRatingBack9: 36.0,
      slopeRatingBack9: 130,
      outPar: 36,
      inPar: 36,
      totalPar: 72,
      outDistance: 3150,
      inDistance: 3150,
      totalDistance: 6300,
      distanceMeasurement: "yards",
      approvalStatus: "approved",
      holes,
    },
    scores,
    teeTime,
    approvalStatus: "approved",
    notes: undefined,
    nineHoleSection: undefined,
  };
}

describeIfLocal("submitScorecard shot-level detail (real local Supabase)", () => {
  beforeAll(async () => {
    const admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: usersPage } = await admin.auth.admin.listUsers();
    const existing = usersPage?.users.find((u) => u.email === TEST_EMAIL);
    if (existing) {
      await db.delete(profile).where(eq(profile.id, existing.id));
      await admin.auth.admin.deleteUser(existing.id);
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      password: randomUUID(),
    });
    if (error || !created.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }
    userId = created.user.id;
    await db.insert(profile).values({
      id: userId,
      email: TEST_EMAIL,
      name: "Shot Detail Persistence Test",
      verified: true,
      // Unlimited: passes the plan gate without round-count bookkeeping.
      planSelected: "unlimited",
      subscriptionStatus: "active",
    });

    const [createdCourse] = await db
      .insert(course)
      .values({
        name: "Shot Detail Persistence Test Course",
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
        courseRating18: 72.0,
        slopeRating18: 130,
        courseRatingFront9: 36.0,
        slopeRatingFront9: 130,
        courseRatingBack9: 36.0,
        slopeRatingBack9: 130,
        outPar: 36,
        inPar: 36,
        totalPar: 72,
        outDistance: 3150,
        inDistance: 3150,
        totalDistance: 6300,
        distanceMeasurement: "yards",
        approvalStatus: "approved",
        submittedBy: userId,
      })
      .returning();
    teeId = createdTee!.id;

    await db.insert(hole).values(
      Array.from({ length: 18 }, (_, i) => ({
        teeId,
        holeNumber: i + 1,
        par: 4,
        hcp: i + 1,
        distance: 350,
      })),
    );
  }, 30_000);

  afterAll(async () => {
    if (!userId) return;
    const admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    if (createdRoundIds.length > 0) {
      // score rows cascade on round delete
      await db.delete(round).where(inArray(round.id, createdRoundIds));
    }
    if (teeId) {
      await db.delete(hole).where(eq(hole.teeId, teeId));
      await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    }
    if (courseId) {
      await db.delete(course).where(eq(course.id, courseId));
    }
    await db.delete(profile).where(eq(profile.id, userId));
    await admin.auth.admin.deleteUser(userId);
  }, 30_000);

  function buildCaller() {
    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return createCaller({
      user: { id: userId },
      supabase,
    } as unknown as Parameters<typeof createCaller>[0]);
  }

  function buildScorecardCaller() {
    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return createScorecardCaller({
      user: { id: userId },
      supabase,
    } as unknown as Parameters<typeof createScorecardCaller>[0]);
  }

  test("detailed scorecard persists putts/fairwayHit/penaltyStrokes; plain scorecard leaves them NULL; handicap math identical", async () => {
    const dbHoles = await db
      .select({ id: hole.id, holeNumber: hole.holeNumber })
      .from(hole)
      .where(eq(hole.teeId, teeId));
    const holes = buildHoles(dbHoles);
    const caller = buildCaller();

    // Same strokes in both rounds — 5 on every hole (89 total would differ;
    // 90 here) — so any differential divergence can only come from the
    // detail fields.
    const detailedScores = Array.from({ length: 18 }, (_, i) => ({
      strokes: 5,
      hcpStrokes: 0,
      putts: (i % 3) + 1, // 1..3
      fairwayHit: i % 2 === 0,
      penaltyStrokes: i === 3 ? 1 : 0,
    }));
    const plainScores = Array.from({ length: 18 }, () => ({
      strokes: 5,
      hcpStrokes: 0,
    }));

    const detailedRound = await caller.submitScorecard(
      buildScorecard(detailedScores, "2026-07-01T10:00:00.000Z", holes),
    );
    createdRoundIds.push(detailedRound.id);

    const plainRound = await caller.submitScorecard(
      buildScorecard(plainScores, "2026-07-02T10:00:00.000Z", holes),
    );
    createdRoundIds.push(plainRound.id);

    // 1. Detailed rows persisted with the exact submitted values.
    const detailedRows = await db
      .select()
      .from(score)
      .where(eq(score.roundId, detailedRound.id));
    expect(detailedRows).toHaveLength(18);
    const byHole = new Map(dbHoles.map((h) => [h.id, h.holeNumber]));
    for (const row of detailedRows) {
      const idx = byHole.get(row.holeId)! - 1;
      expect(row.putts).toBe((idx % 3) + 1);
      expect(row.fairwayHit).toBe(idx % 2 === 0);
      expect(row.penaltyStrokes).toBe(idx === 3 ? 1 : 0);
    }

    // 2. Plain rows leave all three columns NULL.
    const plainRows = await db
      .select()
      .from(score)
      .where(eq(score.roundId, plainRound.id));
    expect(plainRows).toHaveLength(18);
    for (const row of plainRows) {
      expect(row.putts).toBeNull();
      expect(row.fairwayHit).toBeNull();
      expect(row.penaltyStrokes).toBeNull();
    }

    // 3. Engine untouched: identical strokes → identical handicap inputs
    // and outputs regardless of the detail fields.
    expect(detailedRound.totalStrokes).toBe(plainRound.totalStrokes);
    expect(detailedRound.adjustedGrossScore).toBe(
      plainRound.adjustedGrossScore,
    );
    expect(detailedRound.adjustedPlayedScore).toBe(
      plainRound.adjustedPlayedScore,
    );
    expect(Number(detailedRound.scoreDifferential)).toBe(
      Number(plainRound.scoreDifferential),
    );
  }, 60_000);

  test("post-round form and live-round payload shapes are byte-identical and persist identically (plan 013 D1)", async () => {
    const dbHoles = await db
      .select({ id: hole.id, holeNumber: hole.holeNumber })
      .from(hole)
      .where(eq(hole.teeId, teeId));
    const holes = buildHoles(dbHoles);
    const caller = buildCaller();

    // The same logical detailed round captured through both UIs. The
    // post-round form (golf-scorecard.tsx onSubmit) leaves unrecorded
    // fields as explicit `undefined`; the live path (to-scorecard.ts)
    // OMITS unrecorded keys. Both default penalties to 0 for entered
    // holes. Over the wire (JSON) those must be the same bytes.
    const formScores = Array.from({ length: 18 }, (_, i) => ({
      strokes: 5,
      hcpStrokes: 0,
      putts: i === 0 ? 2 : undefined,
      fairwayHit: i === 0 ? true : undefined,
      penaltyStrokes: i === 3 ? 1 : 0,
    }));
    const liveScores = Array.from({ length: 18 }, (_, i) => ({
      strokes: 5,
      hcpStrokes: 0,
      ...(i === 0 ? { putts: 2, fairwayHit: true } : {}),
      penaltyStrokes: i === 3 ? 1 : 0,
    }));
    expect(JSON.stringify(formScores)).toBe(JSON.stringify(liveScores));

    const formRound = await caller.submitScorecard(
      buildScorecard(formScores, "2026-07-03T10:00:00.000Z", holes),
    );
    createdRoundIds.push(formRound.id);
    const liveRound = await caller.submitScorecard(
      buildScorecard(liveScores, "2026-07-04T10:00:00.000Z", holes),
    );
    createdRoundIds.push(liveRound.id);

    // Persisted rows identical hole-for-hole across the two paths.
    const byHole = new Map(dbHoles.map((h) => [h.id, h.holeNumber]));
    const normalize = (
      rows: (typeof score.$inferSelect)[],
    ): Array<Record<string, unknown>> =>
      rows
        .map((row) => ({
          holeNumber: byHole.get(row.holeId),
          strokes: row.strokes,
          putts: row.putts,
          fairwayHit: row.fairwayHit,
          penaltyStrokes: row.penaltyStrokes,
        }))
        .sort((a, b) => (a.holeNumber as number) - (b.holeNumber as number));
    const formRows = normalize(
      await db.select().from(score).where(eq(score.roundId, formRound.id)),
    );
    const liveRows = normalize(
      await db.select().from(score).where(eq(score.roundId, liveRound.id)),
    );
    expect(formRows).toEqual(liveRows);
    expect(formRows[0]).toEqual({
      holeNumber: 1,
      strokes: 5,
      putts: 2,
      fairwayHit: true,
      penaltyStrokes: 0,
    });
    // Unrecorded fields land as NULL (never zero-filled) on both paths.
    expect(formRows[1]).toEqual({
      holeNumber: 2,
      strokes: 5,
      putts: null,
      fairwayHit: null,
      penaltyStrokes: 0,
    });
    expect(formRound.totalStrokes).toBe(liveRound.totalStrokes);
    expect(Number(formRound.scoreDifferential)).toBe(
      Number(liveRound.scoreDifferential),
    );
  }, 60_000);

  test("NULL-detail round survives the real read path's scorecardSchema parse (.nullish() regression guard)", async () => {
    // scoreSchema uses .nullish() (not .optional()) BECAUSE the same schema
    // validates rows read back from the DB, where untracked detail is NULL
    // (types/scorecard-input.ts). getScorecardByRoundId safeParses the
    // assembled scorecard and throws INTERNAL_SERVER_ERROR on failure — so
    // a regression to .optional() makes this test fail loudly.
    const dbHoles = await db
      .select({ id: hole.id, holeNumber: hole.holeNumber })
      .from(hole)
      .where(eq(hole.teeId, teeId));
    const holes = buildHoles(dbHoles);
    const caller = buildCaller();

    const plainRound = await caller.submitScorecard(
      buildScorecard(
        Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 0 })),
        "2026-07-05T10:00:00.000Z",
        holes,
      ),
    );
    createdRoundIds.push(plainRound.id);

    const readBack = await buildScorecardCaller().getScorecardByRoundId({
      id: String(plainRound.id),
    });
    expect(readBack).not.toBeNull();
    expect(readBack!.scores).toHaveLength(18);
    for (const row of readBack!.scores) {
      expect(row.putts).toBeNull();
      expect(row.fairwayHit).toBeNull();
      expect(row.penaltyStrokes).toBeNull();
    }
  }, 60_000);

  test("out-of-range detail is rejected at the tRPC boundary (the only enforcement layer — no DB CHECKs)", async () => {
    const dbHoles = await db
      .select({ id: hole.id, holeNumber: hole.holeNumber })
      .from(hole)
      .where(eq(hole.teeId, teeId));
    const holes = buildHoles(dbHoles);
    const caller = buildCaller();

    const withDetail = (detail: Partial<Scorecard["scores"][number]>) =>
      buildScorecard(
        Array.from({ length: 18 }, (_, i) => ({
          strokes: 5,
          hcpStrokes: 0,
          ...(i === 0 ? detail : {}),
        })),
        "2026-07-06T10:00:00.000Z",
        holes,
      );

    // scoreSchema bounds: putts [0,20], penaltyStrokes [0,10].
    await expect(
      caller.submitScorecard(withDetail({ putts: 21 })),
    ).rejects.toThrow();
    await expect(
      caller.submitScorecard(withDetail({ putts: -1 })),
    ).rejects.toThrow();
    await expect(
      caller.submitScorecard(withDetail({ penaltyStrokes: 11 })),
    ).rejects.toThrow();

    // None of the rejected submissions may have left a round behind.
    const rows = await db
      .select({ id: round.id })
      .from(round)
      .where(eq(round.userId, userId));
    expect(rows.map((r) => r.id).sort()).toEqual([...createdRoundIds].sort());
  }, 60_000);
});
