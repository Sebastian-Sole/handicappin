/**
 * Integration tests for subplan 003's bundled `round` migration
 * (20260730120000_round_natural_key_and_api_columns.sql) against the REAL
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
 * - write-privilege hardening over PostgREST as a real `authenticated` user:
 *   `round` is server-written, so no authenticated INSERT reaches the table at
 *   all (42501, even for a well-formed payload) and `notes` is the ONLY column
 *   an authenticated PATCH may name — every other column (billing/moderation
 *   state, the idempotency key, the handicap computation's durable inputs and
 *   derived outputs, the ratings audit record) is refused with 42501;
 * - the restrictive INSERT policy as a SECOND layer: exercised by temporarily
 *   re-granting column-level INSERT inside one test, asserting the policy
 *   refuses a self-approved / pre-quarantined row (42501 with a
 *   row-level-security message, distinguishing it from a privilege refusal)
 *   while permitting a pending one, then revoking again;
 * - a duplicate submission through the real `submitScorecard` mutation maps
 *   the 23505 to CONFLICT with user-facing copy (no raw constraint name).
 *
 * Skips (not fails) without a local `supabase start` stack — same
 * `describeIfLocal` harness as the other integration suites.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { and, asc, eq, lt, sql, count as countFn } from "drizzle-orm";

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
const SECOND_TEE_NAME = "White";
const FREE_TIER_LIMIT = 25;

let userAId: string;
let userBId: string;
let userCId: string;
let userCPassword: string;
let courseId: number;
let teeId: number;
/** A second real tee, so the teeId-retarget denial patches a VALID target. */
let secondTeeId: number;

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

type RoundUpdate = Database["public"]["Tables"]["round"]["Update"];
type RoundInsert = Database["public"]["Tables"]["round"]["Insert"];

/**
 * Insert a round owned by user C, then PATCH it over PostgREST as that signed-in
 * user. Returns the row as inserted, the row as it stands afterwards, and the
 * PostgREST error — so a caller can assert both the refusal and the fact that
 * nothing moved.
 */
async function patchOwnRoundAsUserC(
  teeTime: string,
  patch: RoundUpdate,
  seed: Partial<typeof round.$inferInsert> = {}
) {
  const [before] = await db
    .insert(round)
    .values(baseRound(userCId, new Date(teeTime), seed))
    .returning();
  const client = await userClient(USER_C_EMAIL, userCPassword);
  const { error } = await client
    .from("round")
    .update(patch)
    .eq("id", before!.id);
  const [after] = await db
    .select()
    .from(round)
    .where(eq(round.id, before!.id));
  return { before: before!, after: after!, error };
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

      // A second tee on the same course. Only the teeId-retarget denial uses
      // it: patching to a real, FK-valid tee means the refusal can only come
      // from the column grant (a bogus id would be refused by the foreign key
      // regardless of privileges, which proves nothing).
      const [createdSecondTee] = await db
        .insert(teeInfo)
        .values({
          courseId,
          name: SECOND_TEE_NAME,
          gender: "mens",
          ...TEE_RATINGS,
          approvalStatus: "approved",
          submittedBy: userAId,
        })
        .returning();
      secondTeeId = createdSecondTee!.id;
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
      if (secondTeeId) {
        await db.delete(teeInfo).where(eq(teeInfo.id, secondTeeId));
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

    test("billing state, moderation state and the idempotency key are server-written — an authenticated PATCH of quarantined/approvalStatus/externalId is refused", async () => {
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
    }, 60_000);

    test("notes is the only client-editable round column — a notes-only PATCH succeeds, bumps updated_at, and leaves createdAt untouched", async () => {
      const [own] = await db
        .insert(round)
        .values(baseRound(userCId, new Date("2026-07-28T11:00:00.000Z")))
        .returning();
      const client = await userClient(USER_C_EMAIL, userCPassword);

      const notesPatch = await client
        .from("round")
        .update({ notes: "edited over PostgREST" })
        .eq("id", own!.id)
        .select("notes, updated_at")
        .single();
      expect(notesPatch.error).toBeNull();
      expect(notesPatch.data?.notes).toBe("edited over PostgREST");
      // The updated_at trigger fires for authenticated writes too. `updated_at`
      // is timestamptz, so the PostgREST string carries its offset and parses
      // unambiguously.
      expect(new Date(notesPatch.data!.updated_at).getTime()).toBeGreaterThan(
        own!.updatedAt.getTime()
      );

      // ...while createdAt is untouched (it is not in the grant at all).
      // Compared through Drizzle on both sides: `createdAt` is a NAIVE
      // timestamp, so a PostgREST round-trip yields a zone-less string that
      // `new Date()` would read as local time and spuriously fail.
      const [after] = await db
        .select()
        .from(round)
        .where(eq(round.id, own!.id));
      expect(after!.createdAt.getTime()).toBe(own!.createdAt.getTime());
    }, 60_000);

    // Every other `round` column is server-written: the handicap computation's
    // durable inputs, its derived outputs, and the ratings audit record. Each
    // test below asserts the PATCH is refused (42501) AND that the stored value
    // did not move.

    test("round ordering in the handicap window is server-owned — an authenticated PATCH of teeTime is refused", async () => {
      const { before, after, error } = await patchOwnRoundAsUserC(
        "2026-08-01T10:00:00.000Z",
        { teeTime: "2020-01-02T08:00:00.000Z" }
      );
      expect(error?.code).toBe("42501");
      expect(after.teeTime.getTime()).toBe(before.teeTime.getTime());
    }, 60_000);

    test("9-hole front/back rating selection is server-owned — an authenticated PATCH of nine_hole_section is refused", async () => {
      // Seeded as a real 9-hole 'front' round: the section only selects
      // ratings for 9-hole rounds, and an 18-hole row would be rejected by
      // round_nine_hole_section_requires_9 regardless of privileges.
      const { before, after, error } = await patchOwnRoundAsUserC(
        "2026-08-02T10:00:00.000Z",
        { nine_hole_section: "back" },
        {
          holesPlayed: 9,
          nineHoleSection: "front",
          parPlayed: 36,
          courseRatingUsed: 36,
        }
      );
      expect(error?.code).toBe("42501");
      expect(after.nineHoleSection).toBe(before.nineHoleSection);
      expect(after.nineHoleSection).toBe("front");
    }, 60_000);

    test("the tee a round was played from is server-owned — an authenticated PATCH of teeId is refused", async () => {
      const { before, after, error } = await patchOwnRoundAsUserC(
        "2026-08-03T10:00:00.000Z",
        { teeId: secondTeeId }
      );
      expect(error?.code).toBe("42501");
      expect(after.teeId).toBe(before.teeId);
      expect(after.teeId).toBe(teeId);
    }, 60_000);

    test("derived handicap outputs are server-owned — an authenticated PATCH of scoreDifferential is refused", async () => {
      const { before, after, error } = await patchOwnRoundAsUserC(
        "2026-08-04T10:00:00.000Z",
        { scoreDifferential: -30 }
      );
      expect(error?.code).toBe("42501");
      expect(after.scoreDifferential).toBe(before.scoreDifferential);
    }, 60_000);

    test("the ratings audit record is server-owned — an authenticated PATCH of course_rating_used is refused", async () => {
      const { before, after, error } = await patchOwnRoundAsUserC(
        "2026-08-05T10:00:00.000Z",
        { course_rating_used: 99.9 }
      );
      expect(error?.code).toBe("42501");
      expect(after.courseRatingUsed).toBe(before.courseRatingUsed);
    }, 60_000);

    test("the scored gross total is server-owned — an authenticated PATCH of totalStrokes is refused", async () => {
      const { before, after, error } = await patchOwnRoundAsUserC(
        "2026-08-06T10:00:00.000Z",
        { totalStrokes: 58 }
      );
      expect(error?.code).toBe("42501");
      expect(after.totalStrokes).toBe(before.totalStrokes);
    }, 60_000);

    // ── INSERT: two layers, proven separately ────────────────────────────
    //
    // Layer 1 (privileges, 6b) is the live control: `authenticated`/`anon` hold
    // no INSERT on `round` at any granularity, so nothing gets in. Layer 2
    // (the restrictive policy, 6c) is defense-in-depth for the day a migration
    // blanket-restores `grant insert on public.round` — a table-level grant
    // overrides every column-level decision at once. Because layer 1 refuses
    // first, layer 2 can only be exercised by temporarily granting INSERT, so
    // the second test does exactly that and puts it back.

    test("round is server-written: no authenticated PostgREST insert reaches the table, however well-formed", async () => {
      const client = await userClient(USER_C_EMAIL, userCPassword);
      const wellFormed = {
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

      // The control case is the one that used to SUCCEED: a payload with
      // nothing wrong with it, owned by the caller, pending by default. Users
      // log rounds through submitScorecard (server-side, table owner); this
      // door is simply not a supported path.
      const wellFormedDenied = await client.from("round").insert(wellFormed);
      expect(wellFormedDenied.error?.code).toBe("42501");

      // Payloads that were individually refused before are still refused —
      // now by privilege rather than by column grant or policy.
      const cases: RoundInsert[] = [
        // Idempotency-key squat: a fabricated row under the key a connected
        // app derives would answer that app's replay for a round it never
        // wrote, or collide with its genuine deterministic key.
        { ...wellFormed, externalId: "fitbull-workout-123" },
        // Forged provenance: indistinguishable from a genuine API submission.
        { ...wellFormed, submitted_via: "api:fitness" },
        // Billing state at birth.
        { ...wellFormed, quarantined: true },
        // Self-approval past moderation.
        { ...wellFormed, approvalStatus: "approved" },
        // Explicitly benign values are refused too — the door is shut, not
        // filtered.
        { ...wellFormed, approvalStatus: "pending", quarantined: false },
      ];
      for (const payload of cases) {
        const denied = await client.from("round").insert(payload);
        expect(denied.error?.code).toBe("42501");
      }

      // Nothing landed.
      const [row] = await db
        .select({ count: countFn() })
        .from(round)
        .where(
          and(
            eq(round.userId, userCId),
            eq(round.teeTime, new Date("2026-07-28T12:00:00.000Z"))
          )
        );
      expect(row?.count).toBe(0);
    }, 60_000);

    test("the restrictive INSERT policy still refuses self-approved and self-un-quarantined rounds if INSERT is ever re-granted", async () => {
      const client = await userClient(USER_C_EMAIL, userCPassword);
      const payload = {
        userId: userCId,
        courseId,
        teeId,
        teeTime: "2026-07-28T13:00:00.000Z",
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

      // Grant only the columns this payload names — deliberately NOT a
      // table-level grant, so the test cannot mask a 6b regression.
      await db.execute(sql`
        grant insert (
          "userId", "courseId", "teeId", "teeTime", "totalStrokes", "parPlayed",
          "adjustedGrossScore", "adjustedPlayedScore", "courseHandicap",
          "scoreDifferential", "existingHandicapIndex", "updatedHandicapIndex",
          course_rating_used, slope_rating_used, holes_played,
          quarantined, "approvalStatus"
        ) on public.round to authenticated
      `);
      try {
        // Value axis: a restrictive-policy refusal is also 42501, so assert the
        // MESSAGE to prove it was the policy and not a privilege refusal.
        const selfApproved = await client
          .from("round")
          .insert({ ...payload, approvalStatus: "approved" });
        expect(selfApproved.error?.code).toBe("42501");
        expect(selfApproved.error?.message).toContain(
          "row-level security policy"
        );

        const preQuarantined = await client
          .from("round")
          .insert({ ...payload, quarantined: true });
        expect(preQuarantined.error?.code).toBe("42501");
        expect(preQuarantined.error?.message).toContain(
          "row-level security policy"
        );

        // ...and it permits the benign values, so it is a value filter rather
        // than a blanket denial. This is what proves 6c does real work.
        const pending = await client
          .from("round")
          .insert({ ...payload, approvalStatus: "pending", quarantined: false })
          .select("id, approvalStatus, quarantined")
          .single();
        expect(pending.error).toBeNull();
        expect(pending.data?.approvalStatus).toBe("pending");
        expect(pending.data?.quarantined).toBe(false);
      } finally {
        // Always put 6b back, even if an assertion above threw.
        await db.execute(
          sql`revoke insert on public.round from authenticated, anon`
        );
      }

      // The door is shut again — guards against this test leaking privilege
      // into the rest of the suite.
      const reclosed = await client.from("round").insert({
        ...payload,
        teeTime: "2026-07-28T15:00:00.000Z",
      });
      expect(reclosed.error?.code).toBe("42501");
      expect(reclosed.error?.message).not.toContain("row-level security policy");
    }, 60_000);
  }
);
