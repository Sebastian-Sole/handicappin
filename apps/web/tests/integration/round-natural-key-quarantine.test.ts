/**
 * Integration tests for subplan 003's bundled `round` migration
 * (20260729100000_round_natural_key_and_api_columns.sql) against the REAL
 * local Supabase stack:
 *
 * - strict natural-key unique constraint ("userId","teeId","teeTime",
 *   nine_hole_section) with NULLS NOT DISTINCT — two 18-hole rounds (null
 *   section) collide, front/back 9-hole pairs at the same teeTime do not;
 * - UNIQUE("userId","externalId") idempotency key — per-user, null-tolerant;
 * - `updated_at` maintained by the `round_set_updated_at` trigger;
 * - `quarantined` rounds excluded from the free-tier count
 *   (`getComprehensiveUserAccess`) and from the handicap queue processor's
 *   round fetch (same filter shape as
 *   supabase/functions/process-handicap-queue/index.ts).
 *
 * Skips (not fails) without a local `supabase start` stack — same
 * `describeIfLocal` harness as the other integration suites.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import type { Database } from "@/types/supabase";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";

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

const USER_A_EMAIL = "round-migration-003-a@handicappin.local";
const USER_B_EMAIL = "round-migration-003-b@handicappin.local";
const COURSE_NAME = "Round Migration 003 Course";

let userAId: string;
let userBId: string;
let courseId: number;
let teeId: number;

function adminClient() {
  return createClient<Database>(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Drizzle wraps driver failures in DrizzleQueryError with the PostgresError
 * as `cause`; walk the cause chain to the underlying SQLSTATE fields.
 */
function pgError(
  e: unknown
): { code?: string; constraint_name?: string } | undefined {
  let current = e;
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

function pgCode(e: unknown): string | undefined {
  return pgError(e)?.code;
}

function pgConstraint(e: unknown): string | undefined {
  return pgError(e)?.constraint_name;
}

function baseRound(
  userId: string,
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

async function createTestUser(email: string): Promise<string> {
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
    name: "Round Migration 003 User",
    verified: true,
    handicapIndex: 10.4,
    planSelected: "free",
  });
  return created.user.id;
}

describeIfLocal(
  "round bundled migration (natural key, externalId, updated_at, quarantine)",
  () => {
    beforeAll(async () => {
      userAId = await createTestUser(USER_A_EMAIL);
      userBId = await createTestUser(USER_B_EMAIL);

      // Clean any leftover course from a previous aborted run.
      const stale = await db
        .select({ id: course.id })
        .from(course)
        .where(eq(course.name, COURSE_NAME));
      for (const c of stale) {
        const staleTees = await db
          .select({ id: teeInfo.id })
          .from(teeInfo)
          .where(eq(teeInfo.courseId, c.id));
        for (const t of staleTees) {
          await db.delete(hole).where(eq(hole.teeId, t.id));
          await db.delete(teeInfo).where(eq(teeInfo.id, t.id));
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
          name: "Blue",
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
          submittedBy: userAId,
        })
        .returning();
      teeId = createdTee!.id;
    }, 60_000);

    afterAll(async () => {
      const admin = adminClient();
      for (const uid of [userAId, userBId]) {
        if (!uid) continue;
        await db.delete(round).where(eq(round.userId, uid));
      }
      if (teeId) {
        await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
      }
      if (courseId) {
        await db.delete(course).where(eq(course.id, courseId));
      }
      for (const uid of [userAId, userBId]) {
        if (!uid) continue;
        await db.delete(profile).where(eq(profile.id, uid));
        await admin.auth.admin.deleteUser(uid);
      }
    }, 60_000);

    test("duplicate 18-hole round (null nine_hole_section) violates the natural key — NULLS NOT DISTINCT holds", async () => {
      const teeTime = new Date("2026-07-10T10:00:00.000Z");
      await db.insert(round).values(baseRound(userAId, teeTime));

      const error = await db
        .insert(round)
        .values(baseRound(userAId, teeTime))
        .then(
          () => null,
          (e: unknown) => e
        );

      expect(error).not.toBeNull();
      expect(pgCode(error)).toBe("23505");
      expect(pgConstraint(error)).toBe(
        "round_userId_teeId_teeTime_nineHoleSection_key"
      );
    }, 60_000);

    test("front and back 9-hole rounds at the same teeTime coexist; a second 'front' collides", async () => {
      const teeTime = new Date("2026-07-11T10:00:00.000Z");
      await db.insert(round).values(
        baseRound(userAId, teeTime, {
          holesPlayed: 9,
          nineHoleSection: "front",
          parPlayed: 36,
          courseRatingUsed: 36,
        })
      );
      // Legitimate same-day pair: the back nine at the identical teeTime.
      await db.insert(round).values(
        baseRound(userAId, teeTime, {
          holesPlayed: 9,
          nineHoleSection: "back",
          parPlayed: 35,
          courseRatingUsed: 35,
          slopeRatingUsed: 120,
        })
      );

      const error = await db
        .insert(round)
        .values(
          baseRound(userAId, teeTime, {
            holesPlayed: 9,
            nineHoleSection: "front",
            parPlayed: 36,
            courseRatingUsed: 36,
          })
        )
        .then(
          () => null,
          (e: unknown) => e
        );

      expect(pgCode(error)).toBe("23505");
      expect(pgConstraint(error)).toBe(
        "round_userId_teeId_teeTime_nineHoleSection_key"
      );
    }, 60_000);

    test("externalId is unique per user, null-tolerant, and does not collide across users", async () => {
      const externalId = "fitbull-round-42";
      await db.insert(round).values(
        baseRound(userAId, new Date("2026-07-12T10:00:00.000Z"), {
          externalId,
          submittedVia: "api:fitness",
        })
      );

      // Same user + same externalId (different teeTime): idempotency-key hit.
      const error = await db
        .insert(round)
        .values(
          baseRound(userAId, new Date("2026-07-13T10:00:00.000Z"), {
            externalId,
            submittedVia: "api:fitness",
          })
        )
        .then(
          () => null,
          (e: unknown) => e
        );
      expect(pgCode(error)).toBe("23505");
      expect(pgConstraint(error)).toBe("round_userId_externalId_key");

      // A DIFFERENT user may reuse the same externalId (key is per-user).
      const [otherUsers] = await db
        .insert(round)
        .values(
          baseRound(userBId, new Date("2026-07-12T10:00:00.000Z"), {
            externalId,
            submittedVia: "api:fitness",
          })
        )
        .returning();
      expect(otherUsers?.externalId).toBe(externalId);

      // Null externalIds never collide (web/native rounds carry null) —
      // userA already has several null-externalId rounds from prior tests.
      const [nullRow] = await db
        .insert(round)
        .values(baseRound(userAId, new Date("2026-07-14T10:00:00.000Z")))
        .returning();
      expect(nullRow?.externalId).toBeNull();
    }, 60_000);

    test("updated_at is set on insert and bumped by the round_set_updated_at trigger on update", async () => {
      const [inserted] = await db
        .insert(round)
        .values(baseRound(userAId, new Date("2026-07-15T10:00:00.000Z")))
        .returning();
      expect(inserted?.updatedAt).toBeInstanceOf(Date);

      // CURRENT_TIMESTAMP is transaction-scoped; a subsequent statement in a
      // new transaction gets a strictly later clock reading.
      await new Promise((resolve) => setTimeout(resolve, 25));
      await db
        .update(round)
        .set({ notes: "edited" })
        .where(eq(round.id, inserted!.id));

      const [reread] = await db
        .select()
        .from(round)
        .where(eq(round.id, inserted!.id));
      expect(reread?.notes).toBe("edited");
      expect(reread!.updatedAt.getTime()).toBeGreaterThan(
        inserted!.updatedAt.getTime()
      );
      expect(reread!.createdAt.getTime()).toBe(inserted!.createdAt.getTime());
    }, 60_000);

    test("quarantined rounds do not consume free-tier quota and are excluded from the handicap fetch", async () => {
      // userB has exactly 1 active round so far (from the externalId test).
      // Add 2 active + 3 quarantined rounds.
      await db.insert(round).values([
        baseRound(userBId, new Date("2026-07-16T10:00:00.000Z")),
        baseRound(userBId, new Date("2026-07-17T10:00:00.000Z")),
        baseRound(userBId, new Date("2026-07-18T10:00:00.000Z"), {
          quarantined: true,
        }),
        baseRound(userBId, new Date("2026-07-19T10:00:00.000Z"), {
          quarantined: true,
        }),
        baseRound(userBId, new Date("2026-07-20T10:00:00.000Z"), {
          quarantined: true,
        }),
      ]);

      // Free-tier count (getComprehensiveUserAccess): 3 active rounds used,
      // the 3 quarantined ones do NOT burn quota (25-round lifetime limit).
      const access = await getComprehensiveUserAccess(userBId, adminClient());
      expect(access.plan).toBe("free");
      expect(access.remainingRounds).toBe(25 - 3);

      // Handicap queue processor fetch shape (process-handicap-queue):
      // approved + not-quarantined only.
      const { data: handicapRounds, error } = await adminClient()
        .from("round")
        .select("*")
        .eq("userId", userBId)
        .eq("approvalStatus", "approved")
        .eq("quarantined", false)
        .order("teeTime", { ascending: true });
      expect(error).toBeNull();
      expect(handicapRounds).toHaveLength(3);
      expect(handicapRounds!.every((r) => r.quarantined === false)).toBe(true);
    }, 60_000);
  }
);
