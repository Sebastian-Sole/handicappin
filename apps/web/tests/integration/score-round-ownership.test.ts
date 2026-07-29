/**
 * Integration tests for 20260730090000_score_round_ownership_and_grants.sql
 * against the REAL local Supabase stack.
 *
 * THE INVARIANT under test: a `score` row written by a non-owner role must
 * attach to a `round` that belongs to the caller. `score`'s permissive policies
 * are all `auth.uid() = "userId"` — they constrain who a row says it belongs
 * to, but place no constraint on `roundId`, the column that decides which
 * round's scorecard, statistics and handicap the row feeds into.
 *
 * The suite drives PostgREST with a real anon-key client plus
 * `signInWithPassword`, NOT the service role, so PostgREST sees the genuine
 * `authenticated` role and both RLS and column privileges apply — same harness
 * as round-natural-key-quarantine.test.ts.
 *
 * Both axes of the fix are covered:
 *  - the restrictive relational-ownership policies (INSERT and UPDATE), and
 *  - the column-grant sweep (`id` non-insertable; `roundId`/`holeId`/`userId`
 *    non-updatable),
 * alongside the control cases that prove the legitimate write path still works.
 *
 * Skips (not fails) without a local `supabase start` stack.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import type { Database } from "@/types/supabase";

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

const USER_A_EMAIL = "score-round-ownership-a@handicappin.local";
const USER_B_EMAIL = "score-round-ownership-b@handicappin.local";
const COURSE_NAME = "Score Round Ownership Course";
const TEE_NAME = "White";

/** The writing user. Signs in for real, so PostgREST sees `authenticated`. */
let userAId: string;
let userAPassword: string;
/** A second, unrelated user — the other side of the ownership boundary. */
let userBId: string;

let courseId: number;
let teeId: number;
let holeIds: number[];
/** Round owned by user A. */
let roundAId: number;
/** Round owned by user B. */
let roundBId: number;

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

async function createTestUser(
  email: string
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
    name: "Score Round Ownership Test User",
    verified: true,
    handicapIndex: 10.4,
    planSelected: "unlimited",
    subscriptionStatus: "active",
  });
  return { id: created.user.id, password };
}

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

function baseRound(
  userId: string,
  teeTime: Date
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
  };
}

/**
 * Count score rows sitting on a round, read as the table OWNER (Drizzle
 * bypasses RLS). Reading as the owner is required for these assertions to mean
 * anything: `score`'s SELECT policy is scoped by `userId`, so a per-user
 * PostgREST read cannot observe rows belonging to a different user.
 */
async function scoreRowsOnRound(roundId: number) {
  return db.select().from(score).where(eq(score.roundId, roundId));
}

describeIfLocal("score round-ownership enforcement", () => {
  beforeAll(async () => {
    const a = await createTestUser(USER_A_EMAIL);
    const b = await createTestUser(USER_B_EMAIL);
    userAId = a.id;
    userAPassword = a.password;
    userBId = b.id;

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

    const createdHoles = await db
      .insert(hole)
      .values(Array.from({ length: 18 }, (_, i) => ({ teeId, ...holeSpec(i) })))
      .returning({ id: hole.id });
    holeIds = createdHoles.map((h) => h.id);

    // Rounds are created as the table owner (Drizzle) — `round` itself is
    // column-hardened, and round creation is not what is under test here.
    const [rA] = await db
      .insert(round)
      .values(baseRound(userAId, new Date("2026-07-30T08:00:00.000Z")))
      .returning({ id: round.id });
    roundAId = rA!.id;

    const [rB] = await db
      .insert(round)
      .values(baseRound(userBId, new Date("2026-07-30T09:00:00.000Z")))
      .returning({ id: round.id });
    roundBId = rB!.id;
  }, 60_000);

  afterAll(async () => {
    const admin = adminClient();
    for (const uid of [userAId, userBId]) {
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
    for (const uid of [userAId, userBId]) {
      if (!uid) continue;
      await db.delete(profile).where(eq(profile.id, uid));
      await admin.auth.admin.deleteUser(uid);
    }
  }, 60_000);

  // ── Axis 1: relational ownership policies ─────────────────────────────────

  test("rejects a score whose roundId names another user's round", async () => {
    const client = await userClient(USER_A_EMAIL, userAPassword);

    const before = await scoreRowsOnRound(roundBId);

    const denied = await client.from("score").insert({
      userId: userAId,
      roundId: roundBId,
      holeId: holeIds[0]!,
      strokes: 15,
      hcpStrokes: 0,
    });

    // 42501 = insufficient_privilege, which PostgREST surfaces as 403. The
    // restrictive INSERT policy denies it: the row's own `userId` is honest,
    // but the round it names belongs to someone else.
    expect(denied.error?.code).toBe("42501");

    // Read as the OWNER — a per-user read cannot observe rows carrying a
    // different `userId`, so only the owner's view proves nothing landed.
    const after = await scoreRowsOnRound(roundBId);
    expect(after).toHaveLength(before.length);
    expect(after.some((row) => row.userId === userAId)).toBe(false);
  }, 60_000);

  test("rejects a bulk insert mixing an own-round row with another user's round, without applying it partially", async () => {
    const client = await userClient(USER_A_EMAIL, userAPassword);

    const ownBefore = await scoreRowsOnRound(roundAId);
    const otherBefore = await scoreRowsOnRound(roundBId);

    const bulk = await client.from("score").insert([
      // A legitimate row, to prove the denial is not "bulk inserts are broken".
      {
        userId: userAId,
        roundId: roundAId,
        holeId: holeIds[1]!,
        strokes: 4,
        hcpStrokes: 0,
      },
      // A row naming user B's round.
      {
        userId: userAId,
        roundId: roundBId,
        holeId: holeIds[1]!,
        strokes: 15,
        hcpStrokes: 0,
      },
    ]);
    expect(bulk.error?.code).toBe("42501");

    // One statement, so the legitimate row must roll back with the rejected
    // one — a partial apply would let a disallowed row ride along with a valid
    // batch.
    expect(await scoreRowsOnRound(roundAId)).toHaveLength(ownBefore.length);
    expect(await scoreRowsOnRound(roundBId)).toHaveLength(otherBefore.length);
  }, 60_000);

  test("rejects re-pointing an existing score's roundId at another user's round", async () => {
    const client = await userClient(USER_A_EMAIL, userAPassword);

    const [own] = await db
      .insert(score)
      .values({
        userId: userAId,
        roundId: roundAId,
        holeId: holeIds[2]!,
        strokes: 5,
        hcpStrokes: 0,
      })
      .returning();

    const repointed = await client
      .from("score")
      .update({ roundId: roundBId })
      .eq("id", own!.id);

    // Denied by the column grant (axis 2) before the policy is even
    // consulted: `roundId` is not in the UPDATE grant list, so Postgres
    // raises insufficient_privilege on the privilege check. Deliberately
    // belt-and-braces — the restrictive UPDATE policy would also reject the
    // post-image.
    expect(repointed.error?.code).toBe("42501");

    const [reread] = await db
      .select()
      .from(score)
      .where(eq(score.id, own!.id));
    expect(reread!.roundId).toBe(roundAId);

    await db.delete(score).where(eq(score.id, own!.id));
  }, 60_000);

  test("a score sitting on another user's round is not updatable by the user named in its userId (restrictive UPDATE USING, policy axis in isolation)", async () => {
    // A row that violates the invariant, written as the table owner — the
    // client-side path that could create one is closed, but rows predating this
    // migration may exist, and they must be frozen rather than left editable.
    const [preexisting] = await db
      .insert(score)
      .values({
        userId: userAId,
        roundId: roundBId,
        holeId: holeIds[3]!,
        strokes: 15,
        hcpStrokes: 0,
      })
      .returning();

    const client = await userClient(USER_A_EMAIL, userAPassword);

    // `strokes` IS in the UPDATE grant list, so this reaches RLS. The
    // restrictive policy's USING clause does not match the row, so it is
    // filtered out: PostgREST reports success over zero rows rather than
    // 42501. The row must be unchanged.
    const edit = await client
      .from("score")
      .update({ strokes: 20 })
      .eq("id", preexisting!.id)
      .select();
    expect(edit.error).toBeNull();
    expect(edit.data ?? []).toHaveLength(0);

    const [reread] = await db
      .select()
      .from(score)
      .where(eq(score.id, preexisting!.id));
    expect(reread!.strokes).toBe(15);

    await db.delete(score).where(eq(score.id, preexisting!.id));
  }, 60_000);

  // ── Controls: the legitimate write path is untouched ──────────────────────

  test("control — a user can insert a score on their own round and update its mutable payload", async () => {
    const client = await userClient(USER_A_EMAIL, userAPassword);

    const inserted = await client
      .from("score")
      .insert({
        userId: userAId,
        roundId: roundAId,
        holeId: holeIds[4]!,
        strokes: 4,
        hcpStrokes: 1,
        putts: 2,
        fairwayHit: true,
        penaltyStrokes: 0,
      })
      .select()
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.roundId).toBe(roundAId);
    expect(inserted.data?.putts).toBe(2);

    const patched = await client
      .from("score")
      .update({
        strokes: 5,
        hcpStrokes: 0,
        putts: 3,
        fairwayHit: false,
        penaltyStrokes: 1,
      })
      .eq("id", inserted.data!.id)
      .select()
      .single();
    expect(patched.error).toBeNull();
    expect(patched.data?.strokes).toBe(5);
    expect(patched.data?.putts).toBe(3);
    expect(patched.data?.fairwayHit).toBe(false);
    expect(patched.data?.penaltyStrokes).toBe(1);

    await db.delete(score).where(eq(score.id, inserted.data!.id));
  }, 60_000);

  // ── Axis 2: column-grant sweep ────────────────────────────────────────────

  test("authenticated INSERT cannot name `id` (sequence-owned); omitting it still works", async () => {
    const client = await userClient(USER_A_EMAIL, userAPassword);

    const denied = await client.from("score").insert({
      id: 2_000_000_001,
      userId: userAId,
      roundId: roundAId,
      holeId: holeIds[5]!,
      strokes: 4,
      hcpStrokes: 0,
    });
    expect(denied.error?.code).toBe("42501");

    const allowed = await client
      .from("score")
      .insert({
        userId: userAId,
        roundId: roundAId,
        holeId: holeIds[5]!,
        strokes: 4,
        hcpStrokes: 0,
      })
      .select("id")
      .single();
    expect(allowed.error).toBeNull();
    expect(allowed.data?.id).toBeLessThan(2_000_000_001);

    await db.delete(score).where(eq(score.id, allowed.data!.id));
  }, 60_000);

  test("authenticated UPDATE cannot name the structural columns `roundId`, `holeId`, `userId` or `id`", async () => {
    const client = await userClient(USER_A_EMAIL, userAPassword);

    const [own] = await db
      .insert(score)
      .values({
        userId: userAId,
        roundId: roundAId,
        holeId: holeIds[6]!,
        strokes: 5,
        hcpStrokes: 0,
      })
      .returning();

    // Even re-pointing at a round the caller OWNS is denied — the grant is
    // existence-based, so the column simply cannot be named.
    const roundIdPatch = await client
      .from("score")
      .update({ roundId: roundAId })
      .eq("id", own!.id);
    expect(roundIdPatch.error?.code).toBe("42501");

    const holeIdPatch = await client
      .from("score")
      .update({ holeId: holeIds[7]! })
      .eq("id", own!.id);
    expect(holeIdPatch.error?.code).toBe("42501");

    const userIdPatch = await client
      .from("score")
      .update({ userId: userBId })
      .eq("id", own!.id);
    expect(userIdPatch.error?.code).toBe("42501");

    const idPatch = await client
      .from("score")
      .update({ id: 2_000_000_002 })
      .eq("id", own!.id);
    expect(idPatch.error?.code).toBe("42501");

    // Nothing moved.
    const [reread] = await db
      .select()
      .from(score)
      .where(eq(score.id, own!.id));
    expect(reread!.roundId).toBe(roundAId);
    expect(reread!.holeId).toBe(holeIds[6]!);
    expect(reread!.userId).toBe(userAId);

    await db.delete(score).where(eq(score.id, own!.id));
  }, 60_000);
});
