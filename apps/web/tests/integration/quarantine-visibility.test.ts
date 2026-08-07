/**
 * Integration tests for decision D4 (quarantine UI: badge in lists, filter
 * from statistics) against the REAL local Supabase stack, through the REAL
 * tRPC code paths:
 *
 * - `round.getBestRound` excludes quarantined rounds: a quarantined round
 *   with the lowest scoreDifferential is never returned as the user's
 *   "best", and an all-quarantined history yields null;
 * - `round.getAllByUserId` deliberately does NOT filter: quarantined rounds
 *   remain visible in the list, and every row carries the `quarantined`
 *   column so the UI can badge them;
 * - `stats.getCourseDetail` keeps quarantined rounds visible in the
 *   per-course rounds list (flag surfaced) while excluding them from every
 *   derived statistic (summary roundCount / avg / best / worst).
 *
 * Skips (not fails) without a local `supabase start` stack — same
 * `describeIfLocal` harness as the other integration suites.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import type { Database } from "@/types/supabase";
import { createCallerFactory } from "@/server/api/trpc";
import { roundRouter } from "@/server/api/routers/round";
import { statsRouter } from "@/server/api/routers/stats";

const { db } = await import("@/db");
const { profile, course, teeInfo, round } = await import("@/db/schema");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const isLocalStack =
  !!databaseUrl?.includes("127.0.0.1") || !!databaseUrl?.includes("localhost");
const hasRealSupabase =
  !!supabaseUrl &&
  !supabaseUrl.includes("dummy") &&
  !!serviceRoleKey &&
  !serviceRoleKey.includes("dummy") &&
  !!anonKey;

const describeIfLocal =
  hasRealSupabase && isLocalStack ? describe : describe.skip;

const USER_EMAIL = "quarantine-visibility-d4@handicappin.local";
const COURSE_NAME = "Quarantine Visibility D4 Course";
const TEE_NAME = "Blue";

let userId: string;
let courseId: number;
let teeId: number;

const createRoundCaller = createCallerFactory(roundRouter);
const createStatsCaller = createCallerFactory(statsRouter);

function adminClient() {
  return createClient<Database>(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function baseRound(
  teeTime: Date,
  overrides: Partial<typeof round.$inferInsert> = {}
): typeof round.$inferInsert {
  return {
    userId,
    courseId,
    teeId,
    teeTime,
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
    ...overrides,
  };
}

describeIfLocal("quarantine visibility (D4): lists show, stats don't count", () => {
  beforeAll(async () => {
    const admin = adminClient();
    const { data: usersPage } = await admin.auth.admin.listUsers();
    const existing = usersPage?.users.find((u) => u.email === USER_EMAIL);
    if (existing) {
      await db.delete(round).where(eq(round.userId, existing.id));
      await db.delete(profile).where(eq(profile.id, existing.id));
      await admin.auth.admin.deleteUser(existing.id);
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email: USER_EMAIL,
      email_confirm: true,
      password: randomUUID(),
    });
    if (error || !created.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }
    userId = created.user.id;
    // `unlimited` so stats.getCourseDetail's plan gate passes; quarantined
    // rounds can still exist in the data (e.g. produced while the user was
    // on free) and the stats filter must hold regardless of plan.
    await db.insert(profile).values({
      id: userId,
      email: USER_EMAIL,
      name: "Quarantine Visibility D4 User",
      verified: true,
      handicapIndex: 10.4,
      planSelected: "unlimited",
      subscriptionStatus: "active",
    });

    // Clean any leftover course from a previous aborted run.
    const stale = await db
      .select({ id: course.id })
      .from(course)
      .where(eq(course.name, COURSE_NAME));
    for (const cRow of stale) {
      await db.delete(teeInfo).where(eq(teeInfo.courseId, cRow.id));
      await db.delete(course).where(eq(course.id, cRow.id));
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
        distanceMeasurement: "yards",
        approvalStatus: "approved",
        submittedBy: userId,
      })
      .returning();
    teeId = createdTee!.id;
  }, 60_000);

  afterAll(async () => {
    const admin = adminClient();
    if (userId) {
      await db.delete(round).where(eq(round.userId, userId));
    }
    if (teeId) await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    if (courseId) await db.delete(course).where(eq(course.id, courseId));
    if (userId) {
      await db.delete(profile).where(eq(profile.id, userId));
      await admin.auth.admin.deleteUser(userId);
    }
  }, 60_000);

  function roundCaller() {
    return createRoundCaller({
      user: { id: userId },
      supabase: adminClient(),
    } as unknown as Parameters<typeof createRoundCaller>[0]);
  }

  function statsCaller() {
    return createStatsCaller({
      user: { id: userId },
      supabase: adminClient(),
    } as unknown as Parameters<typeof createStatsCaller>[0]);
  }

  test("getBestRound never returns a quarantined round, even when it has the lowest differential", async () => {
    // Quarantined "career round" (diff 1.1) + ordinary counted rounds.
    await db.insert(round).values([
      baseRound(new Date("2026-07-01T10:00:00.000Z"), {
        scoreDifferential: 16.5,
      }),
      baseRound(new Date("2026-07-02T10:00:00.000Z"), {
        scoreDifferential: 12.3,
      }),
      baseRound(new Date("2026-07-03T10:00:00.000Z"), {
        scoreDifferential: 1.1,
        quarantined: true,
      }),
    ]);

    const best = await roundCaller().getBestRound({ userId });
    expect(best).not.toBeNull();
    expect(best!.quarantined).toBe(false);
    expect(best!.scoreDifferential).toBe(12.3);
  }, 60_000);

  test("getBestRound returns null when every round is quarantined", async () => {
    await db.delete(round).where(eq(round.userId, userId));
    await db.insert(round).values([
      baseRound(new Date("2026-07-04T10:00:00.000Z"), {
        scoreDifferential: 2.0,
        quarantined: true,
      }),
      baseRound(new Date("2026-07-05T10:00:00.000Z"), {
        scoreDifferential: 3.0,
        quarantined: true,
      }),
    ]);

    const best = await roundCaller().getBestRound({ userId });
    expect(best).toBeNull();
  }, 60_000);

  test("getAllByUserId still returns quarantined rounds, with the quarantined flag surfaced", async () => {
    await db.delete(round).where(eq(round.userId, userId));
    await db.insert(round).values([
      baseRound(new Date("2026-07-06T10:00:00.000Z")),
      baseRound(new Date("2026-07-07T10:00:00.000Z"), { quarantined: true }),
      baseRound(new Date("2026-07-08T10:00:00.000Z")),
    ]);

    const rounds = await roundCaller().getAllByUserId({ userId });
    // All three rounds are visible — a 201-accepted round is never hidden.
    expect(rounds).toHaveLength(3);
    // ...and the flag is present on every row so the UI can badge it.
    const flags = [...rounds]
      .sort(
        (a, b) =>
          new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime()
      )
      .map((r) => r.quarantined);
    expect(flags).toEqual([false, true, false]);
  }, 60_000);

  test("stats.getCourseDetail keeps quarantined rounds in the list but out of every statistic", async () => {
    await db.delete(round).where(eq(round.userId, userId));
    await db.insert(round).values([
      baseRound(new Date("2026-07-09T10:00:00.000Z"), {
        scoreDifferential: 16.5,
        totalStrokes: 92,
      }),
      baseRound(new Date("2026-07-10T10:00:00.000Z"), {
        scoreDifferential: 12.3,
        totalStrokes: 88,
      }),
      baseRound(new Date("2026-07-11T10:00:00.000Z"), {
        scoreDifferential: 1.1,
        totalStrokes: 72,
        quarantined: true,
      }),
    ]);

    const detail = await statsCaller().getCourseDetail({ courseId });
    expect(detail).not.toBeNull();

    // List: all three visible, flag surfaced.
    expect(detail!.rounds).toHaveLength(3);
    const quarantinedRow = detail!.rounds.find((r) => r.quarantined);
    expect(quarantinedRow?.scoreDifferential).toBe(1.1);

    // Statistics: only the 2 counted rounds feed the summary.
    expect(detail!.summary.roundCount).toBe(2);
    expect(detail!.summary.bestDifferential).toBe(12.3);
    expect(detail!.summary.worstDifferential).toBe(16.5);
    expect(detail!.summary.avgScore).toBe((92 + 88) / 2);
    expect(detail!.summary.avgDifferential).toBeCloseTo(
      (16.5 + 12.3) / 2,
      6
    );
  }, 60_000);

  test("stats.getCourseDetail with an all-quarantined history: list stays populated, summary counts nothing", async () => {
    await db.delete(round).where(eq(round.userId, userId));
    await db.insert(round).values([
      baseRound(new Date("2026-07-12T10:00:00.000Z"), {
        scoreDifferential: 2.0,
        quarantined: true,
      }),
    ]);

    const detail = await statsCaller().getCourseDetail({ courseId });
    expect(detail).not.toBeNull();
    expect(detail!.rounds).toHaveLength(1);
    expect(detail!.rounds[0]?.quarantined).toBe(true);
    expect(detail!.summary.roundCount).toBe(0);
    expect(detail!.summary.avgScore).toBeNull();
    expect(detail!.summary.avgDifferential).toBeNull();
    expect(detail!.summary.bestDifferential).toBeNull();
    expect(detail!.summary.worstDifferential).toBeNull();
  }, 60_000);
});
