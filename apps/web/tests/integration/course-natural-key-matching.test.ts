/**
 * Integration test: course resolution in `submitScorecard` must match on the
 * FULL natural key (name, country, city) — the unique index
 * `course_name_country_city_key` — not on name alone.
 *
 * Regression scenario: two approved courses share a name but live in
 * different countries/cities. A name-only lookup (`round.ts:370` before the
 * service extraction; `submit-scorecard.ts` step 2 today) returned whichever
 * same-name row sorted first and silently rebound the round to the wrong
 * course. Here the WRONG course (no tees) is inserted first so the old
 * behavior would pick it; the fix must resolve the course the player
 * actually identified by (name, country, city).
 *
 * Real local Supabase stack only — skips without one, same harness as
 * `submit-scorecard-characterization.test.ts`.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq, inArray } from "drizzle-orm";

import { createCallerFactory } from "@/server/api/trpc";
import { roundRouter } from "@/server/api/routers/round";
import type { Scorecard } from "@/types/scorecard-input";

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

const { db } = await import("@/db");
const { profile, course, teeInfo, hole, round } = await import("@/db/schema");

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

const USER_EMAIL = "course-natural-key-matching@handicappin.local";
const COURSE_NAME = "Natural Key Twin Course";
const TEE_NAME = "Blue";

let userId: string;
let wrongCourseId: number; // same name, Norway/Oslo — inserted FIRST
let rightCourseId: number; // same name, Scotland/St Andrews — the one played
let teeId: number;
const createdRoundIds: number[] = [];

const createCaller = createCallerFactory(roundRouter);

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

function buildScorecard(dbHoles: { id: number; holeNumber: number }[]): Scorecard {
  return {
    userId,
    course: {
      id: rightCourseId,
      name: COURSE_NAME,
      approvalStatus: "approved",
      country: "Scotland",
      city: "St. Andrews",
      tees: undefined,
    },
    teePlayed: {
      id: teeId,
      courseId: rightCourseId,
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
    scores: Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 0 })),
    teeTime: "2026-08-01T10:00:00.000Z",
    approvalStatus: "approved",
    notes: undefined,
    nineHoleSection: undefined,
  };
}

describeIfLocal("course natural-key matching (real local Supabase)", () => {
  beforeAll(async () => {
    const admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Recreate the test user from scratch.
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
    await db.insert(profile).values({
      id: userId,
      email: USER_EMAIL,
      name: "Natural Key User",
      verified: true,
      handicapIndex: 10.4,
      planSelected: "unlimited",
      subscriptionStatus: "active",
    });

    // Clean any same-name leftovers from a previous aborted run.
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

    // The decoy FIRST (lower id) so a name-only `limit 1` lookup finds it.
    const [wrongCourse] = await db
      .insert(course)
      .values({
        name: COURSE_NAME,
        country: "Norway",
        city: "Oslo",
        approvalStatus: "approved",
      })
      .returning();
    wrongCourseId = wrongCourse!.id;

    const [rightCourse] = await db
      .insert(course)
      .values({
        name: COURSE_NAME,
        country: "Scotland",
        city: "St. Andrews",
        approvalStatus: "approved",
      })
      .returning();
    rightCourseId = rightCourse!.id;

    const [createdTee] = await db
      .insert(teeInfo)
      .values({
        courseId: rightCourseId,
        name: TEE_NAME,
        gender: "mens",
        ...TEE_RATINGS,
        approvalStatus: "approved",
        submittedBy: userId,
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
      // score rows cascade on round delete.
      await db.delete(round).where(inArray(round.id, createdRoundIds));
    }
    if (userId) {
      await db.delete(round).where(eq(round.userId, userId));
    }
    if (teeId) {
      await db.delete(hole).where(eq(hole.teeId, teeId));
      await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    }
    for (const id of [wrongCourseId, rightCourseId]) {
      if (id) await db.delete(course).where(eq(course.id, id));
    }
    if (userId) {
      await db.delete(profile).where(eq(profile.id, userId));
      await admin.auth.admin.deleteUser(userId);
    }
  }, 60_000);

  test("resolves the course by (name, country, city), not by name alone", async () => {
    const dbHoles = await db
      .select({ id: hole.id, holeNumber: hole.holeNumber })
      .from(hole)
      .where(eq(hole.teeId, teeId));

    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const caller = createCaller({
      user: { id: userId },
      supabase,
    } as unknown as Parameters<typeof createCaller>[0]);

    const result = await caller.submitScorecard(buildScorecard(dbHoles));
    createdRoundIds.push(result.id);

    // The round must bind to the Scotland/St Andrews course the player
    // identified — with name-only matching it bound to the Norway decoy.
    expect(result.courseId).toBe(rightCourseId);
    expect(result.courseId).not.toBe(wrongCourseId);
    expect(result.teeId).toBe(teeId);

    const [row] = await db.select().from(round).where(eq(round.id, result.id));
    expect(row?.courseId).toBe(rightCourseId);
  }, 60_000);
});
