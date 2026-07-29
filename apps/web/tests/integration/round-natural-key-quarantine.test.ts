/**
 * Integration tests for subplan 003's bundled `round` migration
 * (20260729100000_round_natural_key_and_api_columns.sql) against the REAL
 * local Supabase stack:
 *
 * - strict natural-key unique constraint ("userId","teeId","teeTime",
 *   nine_hole_section) with NULLS NOT DISTINCT — two 18-hole rounds (null
 *   section) collide, front/back 9-hole pairs at the same teeTime do not;
 * - UNIQUE("userId","externalId") idempotency key — per-user, null-tolerant;
 * - `updated_at` (timestamptz) maintained by the `round_set_updated_at`
 *   trigger;
 * - `quarantined` rounds excluded from the free-tier count
 *   (`getComprehensiveUserAccess`), from `round.getCountByUserId` (the
 *   billing-facing count native consumes), and from the established-handicap
 *   count in `scorecard.getScorecardByRoundId` — the latter two through the
 *   REAL tRPC code paths;
 * - column-privilege hardening over PostgREST as a real `authenticated`
 *   user: PATCHing `quarantined`/`approvalStatus`/`externalId` is denied
 *   (42501), legitimate edits still work, and INSERTing `quarantined: true`
 *   is blocked by the restrictive policy;
 * - a duplicate submission through the real `submitScorecard` mutation maps
 *   the 23505 to CONFLICT with user-facing copy (no raw constraint name).
 *
 * Skips (not fails) without a local `supabase start` stack — same
 * `describeIfLocal` harness as the other integration suites.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { and, asc, eq, lt, count as countFn } from "drizzle-orm";

import type { Database } from "@/types/supabase";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { createCallerFactory } from "@/server/api/trpc";
import { roundRouter } from "@/server/api/routers/round";
import { scorecardRouter } from "@/server/api/routers/scorecard";
import type { Scorecard } from "@/types/scorecard-input";

// submitScorecard captures analytics and may email admins — never ship
// either from this suite.
vi.mock("@/lib/posthog", () => ({
  getPostHogClient: () => ({
    capture: () => {},
    flush: async () => {},
  }),
}));
vi.mock("@/lib/email-service", () => ({
  sendAdminSubmissionNotification: vi.fn(async () => ({ success: true })),
}));

const { db } = await import("@/db");
const { profile, course, teeInfo, hole, round, score } = await import(
  "@/db/schema"
);

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

const USER_A_EMAIL = "round-migration-003-a@handicappin.local";
const USER_B_EMAIL = "round-migration-003-b@handicappin.local";
const USER_C_EMAIL = "round-migration-003-c@handicappin.local";
const COURSE_NAME = "Round Migration 003 Course";
const TEE_NAME = "Blue";
const FREE_TIER_LIMIT = 25;

let userAId: string;
let userBId: string;
let userCId: string;
let userCPassword: string;
let courseId: number;
let teeId: number;

const createRoundCaller = createCallerFactory(roundRouter);
const createScorecardCaller = createCallerFactory(scorecardRouter);

function adminClient() {
  return createClient<Database>(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Sign in as a real user so PostgREST sees the `authenticated` role. */
async function userClient(email: string, password: string) {
  const client = createClient<Database>(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
  return client;
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

/** Count a user's active (non-quarantined) rounds directly in the DB. */
async function activeRoundCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: countFn() })
    .from(round)
    .where(and(eq(round.userId, userId), eq(round.quarantined, false)));
  return row?.count ?? 0;
}

async function createTestUser(
  email: string,
  planSelected: "free" | "unlimited"
): Promise<{ id: string; password: string }> {
  const admin = adminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers();
  const existing = usersPage?.users.find((u) => u.email === email);
  if (existing) {
    await db.delete(round).where(eq(round.userId, existing.id));
    await db.delete(profile).where(eq(profile.id, existing.id));
    await admin.auth.admin.deleteUser(existing.id);
  }
  const password = randomUUID();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
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
    planSelected,
    // subscription_status has a DB check constraint that excludes "free".
    ...(planSelected === "free" ? {} : { subscriptionStatus: "active" }),
  });
  return { id: created.user.id, password };
}

/** Same asymmetric tee shape as the characterization suites. */
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

function buildSubmitScorecard(
  userId: string,
  teeTime: string,
  dbHoles: { id: number; holeNumber: number }[]
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
    scores: Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 0 })),
    teeTime,
    approvalStatus: "approved",
    notes: undefined,
    nineHoleSection: undefined,
  };
}

describeIfLocal(
  "round bundled migration (natural key, externalId, updated_at, quarantine, grants)",
  () => {
    beforeAll(async () => {
      const a = await createTestUser(USER_A_EMAIL, "free");
      const b = await createTestUser(USER_B_EMAIL, "free");
      const c = await createTestUser(USER_C_EMAIL, "unlimited");
      userAId = a.id;
      userBId = b.id;
      userCId = c.id;
      userCPassword = c.password;

      // Clean any leftover course from a previous aborted run.
      const stale = await db
        .select({ id: course.id })
        .from(course)
        .where(eq(course.name, COURSE_NAME));
      for (const cRow of stale) {
        const staleTees = await db
          .select({ id: teeInfo.id })
          .from(teeInfo)
          .where(eq(teeInfo.courseId, cRow.id));
        for (const t of staleTees) {
          await db.delete(hole).where(eq(hole.teeId, t.id));
          await db.delete(teeInfo).where(eq(teeInfo.id, t.id));
        }
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
          ...TEE_RATINGS,
          approvalStatus: "approved",
          submittedBy: userAId,
        })
        .returning();
      teeId = createdTee!.id;

      await db
        .insert(hole)
        .values(
          Array.from({ length: 18 }, (_, i) => ({ teeId, ...holeSpec(i) }))
        );
    }, 60_000);

    afterAll(async () => {
      const admin = adminClient();
      for (const uid of [userAId, userBId, userCId]) {
        if (!uid) continue;
        // score rows cascade with the round delete (score_roundId_fkey).
        await db.delete(round).where(eq(round.userId, uid));
      }
      if (teeId) {
        await db.delete(hole).where(eq(hole.teeId, teeId));
        await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
      }
      if (courseId) {
        await db.delete(course).where(eq(course.id, courseId));
      }
      for (const uid of [userAId, userBId, userCId]) {
        if (!uid) continue;
        await db.delete(profile).where(eq(profile.id, uid));
        await admin.auth.admin.deleteUser(uid);
      }
    }, 60_000);

    // ── Constraint semantics (direct DB level) ────────────────────────────

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

      // Null externalIds never collide (web/native rounds carry null).
      const [nullRow] = await db
        .insert(round)
        .values(baseRound(userAId, new Date("2026-07-14T10:00:00.000Z")))
        .returning();
      expect(nullRow?.externalId).toBeNull();
    }, 60_000);

    test("updated_at (timestamptz) is set on insert and bumped by the round_set_updated_at trigger on update", async () => {
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

    // ── Quarantine exclusion (billing + handicap consumers) ──────────────

    test("quarantined rounds do not consume free-tier quota (getComprehensiveUserAccess); the handicap-processor filter excludes them (query mirrored inline from process-handicap-queue — the edge function itself is not invoked here)", async () => {
      // Order-independent: read userB's baseline instead of assuming what
      // earlier tests inserted.
      const baselineActive = await activeRoundCount(userBId);
      const baseline = await getComprehensiveUserAccess(
        userBId,
        adminClient()
      );
      expect(baseline.plan).toBe("free");
      expect(baseline.remainingRounds).toBe(FREE_TIER_LIMIT - baselineActive);

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

      // Free-tier count: only the 2 active rounds burn quota.
      const access = await getComprehensiveUserAccess(userBId, adminClient());
      expect(access.plan).toBe("free");
      expect(access.remainingRounds).toBe(FREE_TIER_LIMIT - baselineActive - 2);

      // Same filter shape the handicap queue processor now uses
      // (supabase/functions/process-handicap-queue/index.ts): approved AND
      // not quarantined.
      const { data: handicapRounds, error } = await adminClient()
        .from("round")
        .select("*")
        .eq("userId", userBId)
        .eq("approvalStatus", "approved")
        .eq("quarantined", false)
        .order("teeTime", { ascending: true });
      expect(error).toBeNull();
      expect(handicapRounds).toHaveLength(baselineActive + 2);
      expect(handicapRounds!.every((r) => r.quarantined === false)).toBe(true);
    }, 60_000);

    test("round.getCountByUserId (native's quota gate) excludes quarantined rounds — real tRPC path", async () => {
      const caller = createRoundCaller({
        user: { id: userCId },
        supabase: adminClient(),
      } as unknown as Parameters<typeof createRoundCaller>[0]);

      await db
        .insert(round)
        .values(baseRound(userCId, new Date("2026-07-08T10:00:00.000Z")));
      const baseline = await caller.getCountByUserId({ userId: userCId });
      expect(baseline).toBe(await activeRoundCount(userCId));

      // Quarantined rounds must not move the count.
      await db.insert(round).values([
        baseRound(userCId, new Date("2026-07-08T11:00:00.000Z"), {
          quarantined: true,
        }),
        baseRound(userCId, new Date("2026-07-08T12:00:00.000Z"), {
          quarantined: true,
        }),
      ]);

      const after = await caller.getCountByUserId({ userId: userCId });
      expect(after).toBe(baseline);
    }, 60_000);

    test("scorecard.getScorecardByRoundId's established-handicap count excludes quarantined rounds — real tRPC path", async () => {
      const targetTeeTime = new Date("2026-07-26T10:00:00.000Z");

      // Earlier approved rounds for userC: 1 active + 2 quarantined (the
      // quarantined ones must NOT count toward the established-handicap
      // baseline).
      await db.insert(round).values([
        baseRound(userCId, new Date("2026-07-21T10:00:00.000Z")),
        baseRound(userCId, new Date("2026-07-22T10:00:00.000Z"), {
          quarantined: true,
        }),
        baseRound(userCId, new Date("2026-07-23T10:00:00.000Z"), {
          quarantined: true,
        }),
      ]);

      const [expectedRow] = await db
        .select({ count: countFn() })
        .from(round)
        .where(
          and(
            eq(round.userId, userCId),
            lt(round.teeTime, targetTeeTime),
            eq(round.approvalStatus, "approved"),
            eq(round.quarantined, false)
          )
        );
      const expected = expectedRow?.count ?? 0;

      // Target round with real score rows so the assembled scorecard passes
      // zod validation inside the procedure.
      const [target] = await db
        .insert(round)
        .values(baseRound(userCId, targetTeeTime))
        .returning();
      const dbHoles = await db
        .select({ id: hole.id, holeNumber: hole.holeNumber })
        .from(hole)
        .where(eq(hole.teeId, teeId))
        .orderBy(asc(hole.holeNumber));
      await db.insert(score).values(
        dbHoles.map((h) => ({
          userId: userCId,
          roundId: target!.id,
          holeId: h.id,
          strokes: 5,
          hcpStrokes: 0,
        }))
      );

      const caller = createScorecardCaller({
        user: { id: userCId },
        supabase: adminClient(),
      } as unknown as Parameters<typeof createScorecardCaller>[0]);
      const scorecard = await caller.getScorecardByRoundId({
        id: String(target!.id),
      });

      expect(scorecard).not.toBeNull();
      expect(scorecard!.roundsBeforeTeeTime).toBe(expected);
      // Sanity: without the quarantine filter the count would be strictly
      // higher (at least the 2 quarantined rounds inserted above; earlier
      // tests may have quarantined more userC rounds before the target).
      const [unfiltered] = await db
        .select({ count: countFn() })
        .from(round)
        .where(
          and(
            eq(round.userId, userCId),
            lt(round.teeTime, targetTeeTime),
            eq(round.approvalStatus, "approved")
          )
        );
      expect(unfiltered!.count).toBeGreaterThanOrEqual(expected + 2);
    }, 60_000);

    // ── Duplicate submission through the real mutation ────────────────────

    test("double submitScorecard maps the natural-key 23505 to CONFLICT with user-facing copy (no raw constraint name)", async () => {
      const dbHoles = await db
        .select({ id: hole.id, holeNumber: hole.holeNumber })
        .from(hole)
        .where(eq(hole.teeId, teeId))
        .orderBy(asc(hole.holeNumber));
      const caller = createRoundCaller({
        user: { id: userCId },
        supabase: adminClient(),
      } as unknown as Parameters<typeof createRoundCaller>[0]);
      const input = buildSubmitScorecard(
        userCId,
        "2026-07-27T10:00:00.000Z",
        dbHoles
      );

      const first = await caller.submitScorecard(input);
      expect(first.id).toBeGreaterThan(0);

      const error = await caller.submitScorecard(input).then(
        () => null,
        (e: unknown) => e
      );
      expect(error).not.toBeNull();
      expect((error as { code?: string }).code).toBe("CONFLICT");
      const message = (error as Error).message;
      expect(message).toBe(
        "This round has already been submitted. A round with the same course, tee, and tee time already exists."
      );
      // The raw Postgres constraint name must never reach the UI.
      expect(message).not.toContain("round_userId");
      expect(message).not.toContain("23505");
    }, 60_000);

    // ── Column-privilege hardening over PostgREST ─────────────────────────

    test("authenticated users cannot PATCH quarantined/approvalStatus/externalId over PostgREST (42501), but legitimate edits still work and bump updated_at", async () => {
      const [own] = await db
        .insert(round)
        .values(baseRound(userCId, new Date("2026-07-28T10:00:00.000Z")))
        .returning();
      const client = await userClient(USER_C_EMAIL, userCPassword);

      // Denied columns — each must fail with insufficient_privilege.
      const quarantinePatch = await client
        .from("round")
        .update({ quarantined: false })
        .eq("id", own!.id);
      expect(quarantinePatch.error?.code).toBe("42501");

      const approvalPatch = await client
        .from("round")
        .update({ approvalStatus: "approved" })
        .eq("id", own!.id);
      expect(approvalPatch.error?.code).toBe("42501");

      const externalIdPatch = await client
        .from("round")
        .update({ externalId: "spoofed" })
        .eq("id", own!.id);
      expect(externalIdPatch.error?.code).toBe("42501");

      // Legitimate edit of allowed columns still works...
      const notesPatch = await client
        .from("round")
        .update({ notes: "edited over PostgREST", totalStrokes: 91 })
        .eq("id", own!.id)
        .select("notes, totalStrokes, updated_at")
        .single();
      expect(notesPatch.error).toBeNull();
      expect(notesPatch.data?.notes).toBe("edited over PostgREST");
      expect(notesPatch.data?.totalStrokes).toBe(91);
      // ...and the updated_at trigger fires for authenticated writes too.
      expect(new Date(notesPatch.data!.updated_at).getTime()).toBeGreaterThan(
        own!.updatedAt.getTime()
      );
    }, 60_000);

    test("authenticated INSERT cannot self-approve or quarantine a round; a legitimate pending insert still succeeds", async () => {
      const client = await userClient(USER_C_EMAIL, userCPassword);
      // Control payload is a LEGITIMATE insert: approvalStatus omitted (the
      // column defaults to 'pending') and quarantined omitted. It must not
      // carry "approved" — column privileges do not constrain INSERT
      // payloads, so a pre-approved insert is exactly the exploit under test
      // below, never the passing control.
      const insertPayload = {
        userId: userCId,
        courseId,
        teeId,
        teeTime: "2026-07-28T12:00:00.000Z",
        totalStrokes: 90,
        parPlayed: 71,
        adjustedGrossScore: 90,
        adjustedPlayedScore: 90,
        courseHandicap: 12,
        scoreDifferential: 16.5,
        existingHandicapIndex: 10.4,
        updatedHandicapIndex: 10.4,
        course_rating_used: 71,
        slope_rating_used: 130,
        holes_played: 18,
      };

      // quarantined=true at birth: blocked (only service paths quarantine).
      const quarantineDenied = await client
        .from("round")
        .insert({ ...insertPayload, quarantined: true });
      expect(quarantineDenied.error?.code).toBe("42501");

      // approvalStatus='approved' at birth: blocked. This is the INSERT half
      // of the self-approval hole — a user could otherwise submit their own
      // unmoderated course/tee with invented ratings and POST a pre-approved
      // round straight into the handicap computation.
      const selfApproveDenied = await client
        .from("round")
        .insert({ ...insertPayload, approvalStatus: "approved" });
      expect(selfApproveDenied.error?.code).toBe("42501");

      // Belt and braces: an explicit 'pending' is allowed (only 'approved'
      // is forbidden), and both flags at once is still denied.
      const bothDenied = await client
        .from("round")
        .insert({
          ...insertPayload,
          approvalStatus: "approved",
          quarantined: true,
        });
      expect(bothDenied.error?.code).toBe("42501");

      // Legitimate insert (defaults: pending + not quarantined) passes the
      // restrictive policy — proves the hardening didn't break the normal
      // write path.
      const allowed = await client
        .from("round")
        .insert(insertPayload)
        .select("id, quarantined, approvalStatus")
        .single();
      expect(allowed.error).toBeNull();
      expect(allowed.data?.quarantined).toBe(false);
      expect(allowed.data?.approvalStatus).toBe("pending");

      // An explicitly-'pending' insert is also fine.
      const explicitPending = await client
        .from("round")
        .insert({
          ...insertPayload,
          teeTime: "2026-07-28T13:00:00.000Z",
          approvalStatus: "pending",
        })
        .select("id, approvalStatus")
        .single();
      expect(explicitPending.error).toBeNull();
      expect(explicitPending.data?.approvalStatus).toBe("pending");
    }, 60_000);

    test("authenticated INSERT cannot name externalId or submitted_via at all (column grants); a legitimate insert leaves both NULL", async () => {
      const client = await userClient(USER_C_EMAIL, userCPassword);
      const insertPayload = {
        userId: userCId,
        courseId,
        teeId,
        teeTime: "2026-07-28T14:00:00.000Z",
        totalStrokes: 90,
        parPlayed: 71,
        adjustedGrossScore: 90,
        adjustedPlayedScore: 90,
        courseHandicap: 12,
        scoreDifferential: 16.5,
        existingHandicapIndex: 10.4,
        updatedHandicapIndex: 10.4,
        course_rating_used: 71,
        slope_rating_used: 130,
        holes_played: 18,
      };

      // externalId squat: pre-inserting a fabricated round under the key a
      // connected app will derive would make its replay-by-lookup resolve to
      // the fabrication (falsifying "200 means your round is stored"), or
      // 409 its genuine round forever on a deterministic key.
      const externalIdDenied = await client.from("round").insert({
        ...insertPayload,
        externalId: "fitbull-workout-123",
      });
      expect(externalIdDenied.error?.code).toBe("42501");

      // submitted_via forgery: a client-written value is indistinguishable
      // from a genuine API submission — forged provenance.
      const submittedViaDenied = await client.from("round").insert({
        ...insertPayload,
        submitted_via: "api:fitness",
      });
      expect(submittedViaDenied.error?.code).toBe("42501");

      // Both together (the full squat payload) is likewise denied.
      const bothDenied = await client.from("round").insert({
        ...insertPayload,
        externalId: "fitbull-workout-123",
        submitted_via: "api:fitness",
      });
      expect(bothDenied.error?.code).toBe("42501");

      // A legitimate insert that simply omits them still succeeds, with both
      // columns NULL — only the server (table owner) may populate them.
      const allowed = await client
        .from("round")
        .insert(insertPayload)
        .select("id, externalId, submitted_via")
        .single();
      expect(allowed.error).toBeNull();
      expect(allowed.data?.externalId).toBeNull();
      expect(allowed.data?.submitted_via).toBeNull();
    }, 60_000);
  }
);
