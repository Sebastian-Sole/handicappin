/**
 * Quarantine UNLOCK on upgrade (T15) — integration tests against the REAL
 * local Supabase stack.
 *
 * The consumer-facing promise frozen in
 * `docs/research/api-platform/plans/005-phase0-contract.md` §5:
 *
 *   "A quarantined round is excluded from the handicap computation and from
 *    the account's round count until the account upgrades, at which point it
 *    is unlocked automatically — no resubmission is needed."
 *
 * There are exactly TWO write sites that project a paid entitlement onto the
 * profile, and they share no code:
 *
 *   1. `guardedStripeProfileWrite` (`@/lib/stripe-webhook-handlers/profile-billing-write`)
 *   2. the inline projection write in `POST /api/webhooks/revenuecat`
 *
 * Both are exercised here — one provider is never assumed from the other.
 *
 * RECOMPUTATION: the unlock must ENQUEUE, never compute inline. The enqueue
 * is not written by application code: `trigger_handicap_recalculation`
 * (AFTER INSERT OR DELETE OR UPDATE ON public.round FOR EACH ROW) UPSERTs
 * into `handicap_calculation_queue` on the unique `user_id`, so N unlocked
 * rounds coalesce into exactly ONE queue row. Verified against the live
 * catalog, not the migration-history table. These tests pin that: they clear
 * the queue AFTER seeding and assert exactly one pending row afterwards.
 *
 * Skips (does not fail) without a local `supabase start` stack — the same
 * `describeIfLocal` harness the other integration suites use.
 */
import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { eq, inArray, sql } from "drizzle-orm";

import { createCallerFactory } from "@/server/api/trpc";
import { roundRouter } from "@/server/api/routers/round";
import type { Database } from "@/types/supabase";

// Never ship test events to a real PostHog project from this suite.
vi.mock("@/lib/posthog", () => ({
  getPostHogClient: () => ({
    capture: () => {},
    flush: async () => {},
    captureException: () => {},
  }),
}));

// Keep webhook-driven lifecycle email sends out of this suite entirely.
vi.mock("@/lib/email-service", () => ({
  sendSubscriptionCancelledEmail: async () => ({ success: true }),
  sendPaymentFailedEmail: async () => ({ success: true }),
}));

const WEBHOOK_AUTH_TOKEN = "Bearer rc-quarantine-unlock-secret";
process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = WEBHOOK_AUTH_TOKEN;

// Import AFTER the env var is set — @/env snapshots process.env at import.
const { POST } = await import("@/app/api/webhooks/revenuecat/route");
const { db } = await import("@/db");
const {
  profile,
  course,
  teeInfo,
  hole,
  round,
  webhookEvents,
  handicapCalculationQueue,
} = await import("@/db/schema");
const { guardedStripeProfileWrite } = await import(
  "@/lib/stripe-webhook-handlers/profile-billing-write"
);
const { APPLE_SKUS } = await import("@handicappin/billing-core");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const isLocalStack =
  !!databaseUrl?.includes("127.0.0.1") || !!databaseUrl?.includes("localhost");

// CI points DATABASE_URL at a localhost placeholder but supplies DUMMY
// Supabase credentials (no real stack is provisioned). Dummy creds must count
// as "no local stack" so this suite skips in CI and runs only against a real
// `supabase start`.
const hasRealSupabase =
  !!supabaseUrl &&
  !supabaseUrl.includes("dummy") &&
  !!serviceRoleKey &&
  !serviceRoleKey.includes("dummy");

const describeIfLocal =
  hasRealSupabase && isLocalStack ? describe : describe.skip;

const FREE_TIER_ROUND_LIMIT = 25;
const QUARANTINED_COUNT = 2;

const STRIPE_EMAIL = "quarantine-unlock-stripe@handicappin.local";
const RC_EMAIL = "quarantine-unlock-rc@handicappin.local";
const COURSE_NAME = "Quarantine Unlock Course";
const TEE_NAME = "Blue";

const FUTURE_MS = Date.parse("2027-06-12T00:00:00.000Z");
const FUTURE_S = Math.floor(FUTURE_MS / 1000);

let stripeUserId: string;
let rcUserId: string;
let courseId: number;
let teeId: number;

const createRoundCaller = createCallerFactory(roundRouter);

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
  return { holeNumber: i + 1, par: i === 17 ? 3 : 4, hcp: i + 1, distance: 350 };
}

function adminClient() {
  return createClient<Database>(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Targeted lookup of a leftover auth user by email.
 *
 * Deliberately NOT `admin.auth.admin.listUsers()`: that is paginated and
 * returns only the first page, so on a busy local stack a stale test user
 * could sit beyond page 1, go unseen, and make the cleanup below silently
 * no-op — leaving `createUser` to fail on the unique email. (@supabase/auth-js
 * 2.95.3 exposes `getUserById` but no `getUserByEmail`, and `PageParams`
 * carries no filter, so the direct `auth.users` read is the targeted lookup
 * available here.) Returns null when no user matches.
 */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.execute<{ id: string }>(
    sql`select id from auth.users where email = ${email} limit 1`
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function createTestUser(email: string) {
  const admin = adminClient();
  const existingId = await findAuthUserIdByEmail(email);
  if (existingId) {
    await db.delete(round).where(eq(round.userId, existingId));
    await db.delete(webhookEvents).where(eq(webhookEvents.userId, existingId));
    await db
      .delete(handicapCalculationQueue)
      .where(eq(handicapCalculationQueue.userId, existingId));
    await db.delete(profile).where(eq(profile.id, existingId));
    await admin.auth.admin.deleteUser(existingId);
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
    name: "Quarantine Unlock User",
    verified: true,
    handicapIndex: 10.4,
    planSelected: "free",
  });
  return created.user.id;
}

/**
 * Put a user in the baseline scenario: free tier, AT the limit, with
 * `QUARANTINED_COUNT` quarantined rounds waiting to be unlocked, no billing
 * projection, an empty handicap queue and no webhook-event cursor.
 *
 * The queue is cleared LAST: seeding rounds fires the recomputation trigger,
 * so clearing before the inserts would leave a row behind and make the
 * "enqueued exactly once" assertions meaningless.
 */
async function resetScenario(userId: string) {
  await db.delete(round).where(eq(round.userId, userId));
  await db.insert(round).values(
    Array.from({ length: FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT }, (_, i) => ({
      userId,
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
      approvalStatus: "approved" as const,
      // The last QUARANTINED_COUNT rounds are the over-limit ones.
      quarantined: i >= FREE_TIER_ROUND_LIMIT,
    }))
  );
  await db
    .update(profile)
    .set({
      planSelected: "free",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      billingProvider: null,
    })
    .where(eq(profile.id, userId));
  await db.delete(webhookEvents).where(eq(webhookEvents.userId, userId));
  await clearQueue(userId);
}

async function clearQueue(userId: string) {
  await db
    .delete(handicapCalculationQueue)
    .where(eq(handicapCalculationQueue.userId, userId));
}

async function queueRows(userId: string) {
  return db
    .select({
      id: handicapCalculationQueue.id,
      eventType: handicapCalculationQueue.eventType,
      status: handicapCalculationQueue.status,
      lastUpdated: handicapCalculationQueue.lastUpdated,
    })
    .from(handicapCalculationQueue)
    .where(eq(handicapCalculationQueue.userId, userId));
}

async function quarantineCounts(userId: string) {
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

/** The billing-facing round count the app and native surfaces consume. */
async function countedRounds(userId: string): Promise<number> {
  const caller = createRoundCaller({
    user: { id: userId },
    supabase: adminClient(),
  } as unknown as Parameters<typeof createRoundCaller>[0]);
  return caller.getCountByUserId({ userId });
}

async function getProfileRow(userId: string) {
  const rows = await db
    .select({
      planSelected: profile.planSelected,
      subscriptionStatus: profile.subscriptionStatus,
      billingProvider: profile.billingProvider,
      currentPeriodEnd: profile.currentPeriodEnd,
      billingVersion: profile.billingVersion,
    })
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Stripe side
// ---------------------------------------------------------------------------

let stripeFactCounter = 0;

function stripeFact(overrides: Record<string, unknown> = {}) {
  stripeFactCounter += 1;
  return {
    provider: "stripe" as const,
    plan: "premium" as const,
    status: "active" as const,
    currentPeriodEnd: FUTURE_S,
    cancelAtPeriodEnd: false,
    eventTimeMs: Date.now(),
    eventId: `evt_unlock_${stripeFactCounter}`,
    ...overrides,
  };
}

/** The handler-supplied write payload, exactly as the real handlers build it. */
function stripeWrite(userId: string, fact: ReturnType<typeof stripeFact>) {
  return async () => {
    await db
      .update(profile)
      .set({
        planSelected: fact.plan,
        subscriptionStatus: fact.status,
        currentPeriodEnd: fact.currentPeriodEnd,
        cancelAtPeriodEnd: fact.cancelAtPeriodEnd,
        billingProvider: "stripe",
      })
      .where(eq(profile.id, userId));
  };
}

async function runStripeEvent(
  userId: string,
  fact: ReturnType<typeof stripeFact>
) {
  return guardedStripeProfileWrite({
    userId,
    handler: "quarantine-unlock-test",
    fact,
    write: stripeWrite(userId, fact),
  });
}

// ---------------------------------------------------------------------------
// RevenueCat side
// ---------------------------------------------------------------------------

let rcClockMs = Date.now();
function nextEventTime(): number {
  rcClockMs += 1000;
  return rcClockMs;
}

function rcPayload(
  type: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    api_version: "1.0",
    event: {
      id: randomUUID(),
      type,
      event_timestamp_ms: nextEventTime(),
      app_user_id: rcUserId,
      original_app_user_id: rcUserId,
      aliases: [rcUserId],
      store: "APP_STORE",
      environment: "SANDBOX",
      period_type: "NORMAL",
      ...overrides,
    },
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/revenuecat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: WEBHOOK_AUTH_TOKEN,
    },
    body: JSON.stringify(body),
  });
}

describeIfLocal("quarantine unlock on upgrade (T15, real local Supabase)", () => {
  beforeAll(async () => {
    stripeUserId = await createTestUser(STRIPE_EMAIL);
    rcUserId = await createTestUser(RC_EMAIL);

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
        await db.delete(round).where(inArray(round.teeId, staleTeeIds));
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
        submittedBy: stripeUserId,
      })
      .returning();
    teeId = createdTee!.id;

    await db
      .insert(hole)
      .values(Array.from({ length: 18 }, (_, i) => ({ teeId, ...holeSpec(i) })));
  }, 120_000);

  afterAll(async () => {
    const admin = adminClient();
    for (const id of [stripeUserId, rcUserId].filter(Boolean)) {
      await db.delete(round).where(eq(round.userId, id));
      await db.delete(webhookEvents).where(eq(webhookEvents.userId, id));
      await db
        .delete(handicapCalculationQueue)
        .where(eq(handicapCalculationQueue.userId, id));
      await db.delete(profile).where(eq(profile.id, id));
      await admin.auth.admin.deleteUser(id);
    }
    if (teeId) {
      await db.delete(hole).where(eq(hole.teeId, teeId));
      await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    }
    if (courseId) {
      await db.delete(course).where(eq(course.id, courseId));
    }
  }, 60_000);

  beforeEach(async () => {
    await resetScenario(stripeUserId);
    await resetScenario(rcUserId);
  });

  // -------------------------------------------------------------------------
  // Baseline sanity — the scenario really is "at the limit with quarantine"
  // -------------------------------------------------------------------------

  test("baseline: a free user at the limit has quarantined rounds that are not counted", async () => {
    const counts = await quarantineCounts(stripeUserId);
    expect(counts.total).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(counts.quarantined).toBe(QUARANTINED_COUNT);
    expect(await countedRounds(stripeUserId)).toBe(FREE_TIER_ROUND_LIMIT);
    expect(await queueRows(stripeUserId)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // MERGE-BLOCKING: Stripe path, both paid shapes
  // -------------------------------------------------------------------------

  test("Stripe premium upgrade unlocks every quarantined round", async () => {
    const result = await runStripeEvent(stripeUserId, stripeFact());
    expect(result.written).toBe(true);

    const counts = await quarantineCounts(stripeUserId);
    expect(counts.quarantined).toBe(0);
    expect(counts.active).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
  });

  test("Stripe premium upgrade makes the unlocked rounds count toward the account total", async () => {
    await runStripeEvent(stripeUserId, stripeFact());
    expect(await countedRounds(stripeUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
  });

  test("Stripe premium upgrade enqueues exactly one handicap recomputation", async () => {
    await runStripeEvent(stripeUserId, stripeFact());

    const rows = await queueRows(stripeUserId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    // Written by trigger_handicap_recalculation, not by application code.
    expect(rows[0].eventType).toBe("round_update");
  });

  test("Stripe LIFETIME upgrade unlocks and enqueues exactly once", async () => {
    const result = await runStripeEvent(
      stripeUserId,
      stripeFact({ plan: "lifetime", status: "active", currentPeriodEnd: null })
    );
    expect(result.written).toBe(true);

    expect((await quarantineCounts(stripeUserId)).quarantined).toBe(0);
    expect(await countedRounds(stripeUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
    expect(await queueRows(stripeUserId)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // MERGE-BLOCKING: RevenueCat path, both paid shapes
  // -------------------------------------------------------------------------

  test("RevenueCat premium purchase unlocks, counts, and enqueues exactly once", async () => {
    const res = await POST(
      makeRequest(
        rcPayload("INITIAL_PURCHASE", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_at_ms: FUTURE_MS,
        })
      )
    );
    expect(res.status).toBe(200);

    const row = await getProfileRow(rcUserId);
    expect(row.planSelected).toBe("premium");
    expect(row.billingProvider).toBe("apple");

    const counts = await quarantineCounts(rcUserId);
    expect(counts.quarantined).toBe(0);
    expect(counts.active).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(await countedRounds(rcUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
    expect(await queueRows(rcUserId)).toHaveLength(1);
  });

  test("RevenueCat LIFETIME purchase unlocks, counts, and enqueues exactly once", async () => {
    const res = await POST(
      makeRequest(
        rcPayload("NON_RENEWING_PURCHASE", {
          product_id: APPLE_SKUS.lifetime,
        })
      )
    );
    expect(res.status).toBe(200);

    const row = await getProfileRow(rcUserId);
    expect(row.planSelected).toBe("lifetime");

    const counts = await quarantineCounts(rcUserId);
    expect(counts.quarantined).toBe(0);
    expect(counts.active).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(await countedRounds(rcUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
    expect(await queueRows(rcUserId)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // MERGE-BLOCKING: idempotency — billing webhooks replay routinely
  // -------------------------------------------------------------------------

  test("Stripe: a replayed billing event does not re-enqueue and does not corrupt state", async () => {
    const fact = stripeFact();
    await runStripeEvent(stripeUserId, fact);
    expect(await queueRows(stripeUserId)).toHaveLength(1);

    // Drop the queue row so a second enqueue would be unmistakable.
    await clearQueue(stripeUserId);

    // The SAME fact re-delivered — Stripe replays on its own retry schedule.
    await runStripeEvent(stripeUserId, fact);

    expect(await queueRows(stripeUserId)).toHaveLength(0);
    const counts = await quarantineCounts(stripeUserId);
    expect(counts.total).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(counts.quarantined).toBe(0);
    expect(await countedRounds(stripeUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
    expect((await getProfileRow(stripeUserId)).planSelected).toBe("premium");
  });

  test("RevenueCat: the same event id re-delivered does not re-enqueue", async () => {
    const payload = rcPayload("INITIAL_PURCHASE", {
      product_id: APPLE_SKUS.premiumYearly,
      expiration_at_ms: FUTURE_MS,
    });

    expect((await POST(makeRequest(payload))).status).toBe(200);
    expect(await queueRows(rcUserId)).toHaveLength(1);
    await clearQueue(rcUserId);

    const replay = await POST(makeRequest(payload));
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ duplicate: true });

    expect(await queueRows(rcUserId)).toHaveLength(0);
    expect((await quarantineCounts(rcUserId)).quarantined).toBe(0);
    expect((await getProfileRow(rcUserId)).planSelected).toBe("premium");
  });

  test("RevenueCat: a distinct follow-up event on an already-unlocked account does not re-enqueue", async () => {
    expect(
      (
        await POST(
          makeRequest(
            rcPayload("INITIAL_PURCHASE", {
              product_id: APPLE_SKUS.premiumYearly,
              expiration_at_ms: FUTURE_MS,
            })
          )
        )
      ).status
    ).toBe(200);
    await clearQueue(rcUserId);

    // A RENEWAL carrying the identical projection: the unlock re-runs and
    // must find nothing to do.
    const res = await POST(
      makeRequest(
        rcPayload("RENEWAL", {
          product_id: APPLE_SKUS.premiumYearly,
          expiration_at_ms: FUTURE_MS,
        })
      )
    );
    expect(res.status).toBe(200);

    expect(await queueRows(rcUserId)).toHaveLength(0);
    const counts = await quarantineCounts(rcUserId);
    expect(counts.total).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(counts.quarantined).toBe(0);
  });

  // -------------------------------------------------------------------------
  // MERGE-BLOCKING: downgrade must NOT re-quarantine
  // -------------------------------------------------------------------------

  test("downgrade after an upgrade leaves the unlocked rounds unlocked (no re-quarantine)", async () => {
    await runStripeEvent(stripeUserId, stripeFact());
    expect((await quarantineCounts(stripeUserId)).quarantined).toBe(0);
    await clearQueue(stripeUserId);

    // Subscription ends: the profile reverts to free. NO decision to
    // re-quarantine exists anywhere in the codebase, and none is invented
    // here — the rounds deliberately stay unlocked and keep counting. See
    // the "known gap" note in
    // `@/utils/billing/unlock-quarantined-rounds`.
    const result = await runStripeEvent(
      stripeUserId,
      stripeFact({ plan: "free", status: "canceled", currentPeriodEnd: null })
    );
    expect(result.written).toBe(true);
    expect((await getProfileRow(stripeUserId)).planSelected).toBe("free");

    const counts = await quarantineCounts(stripeUserId);
    expect(counts.quarantined).toBe(0);
    expect(counts.active).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(await countedRounds(stripeUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
    // And nothing was enqueued: the downgrade touched no round row.
    expect(await queueRows(stripeUserId)).toHaveLength(0);
  });

  test("a non-paid decision never unlocks quarantined rounds", async () => {
    // A free-plan fact against a still-free profile: an apply decision whose
    // resulting projection is NOT paid. Quarantine state must be untouched.
    const result = await runStripeEvent(
      stripeUserId,
      stripeFact({ plan: "free", status: "canceled", currentPeriodEnd: null })
    );
    expect(result.written).toBe(true);

    const counts = await quarantineCounts(stripeUserId);
    expect(counts.quarantined).toBe(QUARANTINED_COUNT);
    expect(await countedRounds(stripeUserId)).toBe(FREE_TIER_ROUND_LIMIT);
    expect(await queueRows(stripeUserId)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // The unlock is scoped to the upgrading account only
  // -------------------------------------------------------------------------

  test("an upgrade never unlocks another account's quarantined rounds", async () => {
    await runStripeEvent(stripeUserId, stripeFact());

    // rcUserId is untouched by the Stripe event.
    const otherCounts = await quarantineCounts(rcUserId);
    expect(otherCounts.quarantined).toBe(QUARANTINED_COUNT);
    expect(await queueRows(rcUserId)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // A blocked write must not WRITE — but it must still converge the rounds
  // -------------------------------------------------------------------------

  test("a Stripe write blocked by the lifetime guard writes nothing but still unlocks", async () => {
    // The account is already lifetime. Under the OLD guard
    // (`decision.action === "apply"`) this decision — `lifetime-locked` →
    // ignore — unlocked nothing, which is exactly what stranded the rounds
    // when the unlock failed after the profile write committed. The blocked
    // write must still leave the projection untouched...
    await db
      .update(profile)
      .set({ planSelected: "lifetime", billingProvider: "apple" })
      .where(eq(profile.id, stripeUserId));
    await clearQueue(stripeUserId);

    const result = await runStripeEvent(stripeUserId, stripeFact());
    expect(result.written).toBe(false);
    expect(result.verdict?.decision.reason).toBe("lifetime-locked");

    // ...the incoming stripe/premium fact did NOT overwrite the lifetime
    // projection (the whole point of the precedence guard).
    const after = await getProfileRow(stripeUserId);
    expect(after.planSelected).toBe("lifetime");
    expect(after.billingProvider).toBe("apple");

    // ...and the rounds converged with the paid projection the profile
    // already holds, because the guard now tests the RESULTING projection.
    expect((await quarantineCounts(stripeUserId)).quarantined).toBe(0);
    expect(await queueRows(stripeUserId)).toHaveLength(1);
  });

  test("a blocked write on a still-FREE account unlocks nothing", async () => {
    // The failure mode the blocked-branch unlock call could have introduced:
    // it runs on EVERY blocked verdict, not just lifetime ones. The helper
    // must reject this one on the resulting projection alone.
    //
    // `inactive-foreign-contract` is the only blocked reason that can reach a
    // free projection from this call site: `guardedStripeProfileWrite` always
    // passes `lastApplied: null`, which makes `idempotent-duplicate` and
    // `stale-out-of-order` unreachable, and both `lifetime-locked` and
    // `double-contract-current-wins` require an already-paid current
    // contract. So: a free profile still stamped with the OTHER provider,
    // plus an inactive stripe fact.
    await db
      .update(profile)
      .set({
        planSelected: "free",
        subscriptionStatus: "canceled",
        billingProvider: "apple",
      })
      .where(eq(profile.id, stripeUserId));
    await clearQueue(stripeUserId);

    const result = await runStripeEvent(
      stripeUserId,
      stripeFact({ plan: "premium", status: "canceled", currentPeriodEnd: null })
    );
    expect(result.written).toBe(false);
    expect(result.verdict?.decision.action).toBe("ignore");
    expect(result.verdict?.decision.reason).toBe("inactive-foreign-contract");

    // The resulting projection is still free, so the free-tier cap still
    // applies and the rounds stay exactly where they were.
    expect(result.verdict?.decision.projection.plan).toBe("free");
    const counts = await quarantineCounts(stripeUserId);
    expect(counts.quarantined).toBe(QUARANTINED_COUNT);
    expect(await countedRounds(stripeUserId)).toBe(FREE_TIER_ROUND_LIMIT);
    expect(await queueRows(stripeUserId)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // MERGE-BLOCKING: convergence after a failed unlock — the LIFETIME case
  //
  // The helper deliberately does not share a transaction with the profile
  // write and deliberately does not swallow errors: a throw returns non-2xx
  // and the provider redelivers. Lifetime is the one plan where that
  // redelivery can never produce an `apply` again (applyBillingEvent step 3
  // returns `lifetime-locked` before the same-provider apply at step 5), so
  // the post-failure state is seeded directly here: profile ALREADY lifetime,
  // rounds STILL quarantined, no successful event recorded.
  // -------------------------------------------------------------------------

  /** The exact state a crash between the profile write and the unlock leaves. */
  async function seedFailedUnlockState(
    userId: string,
    provider: "stripe" | "apple"
  ) {
    await db
      .update(profile)
      .set({
        planSelected: "lifetime",
        subscriptionStatus: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingProvider: provider,
      })
      .where(eq(profile.id, userId));
    // No webhook_events row: recordEvent never ran, so the provider redelivers.
    await db.delete(webhookEvents).where(eq(webhookEvents.userId, userId));
    await clearQueue(userId);
    // Precondition: the rounds really are still stranded.
    expect((await quarantineCounts(userId)).quarantined).toBe(QUARANTINED_COUNT);
  }

  test("Stripe: redelivery after a failed unlock converges a LIFETIME account", async () => {
    await seedFailedUnlockState(stripeUserId, "stripe");

    // Stripe redelivers the very event that granted lifetime. The profile is
    // already lifetime, so the decision is now `lifetime-locked` → ignore.
    const result = await runStripeEvent(
      stripeUserId,
      stripeFact({ plan: "lifetime", status: "active", currentPeriodEnd: null })
    );
    expect(result.written).toBe(false);
    expect(result.verdict?.decision.action).toBe("ignore");
    expect(result.verdict?.decision.reason).toBe("lifetime-locked");

    // Converged: the rounds are unlocked, they count, and the recomputation
    // was enqueued exactly once (all QUARANTINED_COUNT rows collapse into one
    // queue row via trigger_handicap_recalculation's unique user_id upsert).
    const counts = await quarantineCounts(stripeUserId);
    expect(counts.quarantined).toBe(0);
    expect(counts.active).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(await countedRounds(stripeUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
    expect(await queueRows(stripeUserId)).toHaveLength(1);
  });

  test("RevenueCat: redelivery after a failed unlock converges a LIFETIME account", async () => {
    await seedFailedUnlockState(rcUserId, "apple");

    // A fresh event id: RevenueCat's redelivery of an unrecorded event is not
    // caught by the idempotency check, and reaches the chokepoint — which now
    // decides `lifetime-locked` → ignore against the committed profile.
    const res = await POST(
      makeRequest(
        rcPayload("NON_RENEWING_PURCHASE", { product_id: APPLE_SKUS.lifetime })
      )
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      applied: false,
      changed: false,
      reason: "lifetime-locked",
    });

    // The projection is untouched (it was already correct) and the rounds
    // caught up with it.
    expect((await getProfileRow(rcUserId)).planSelected).toBe("lifetime");
    const counts = await quarantineCounts(rcUserId);
    expect(counts.quarantined).toBe(0);
    expect(counts.active).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(await countedRounds(rcUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
    expect(await queueRows(rcUserId)).toHaveLength(1);
  });

  test("the convergence pass is itself idempotent: a second redelivery enqueues nothing", async () => {
    await seedFailedUnlockState(stripeUserId, "stripe");

    const lifetimeFact = () =>
      stripeFact({
        plan: "lifetime",
        status: "active",
        currentPeriodEnd: null,
      });

    await runStripeEvent(stripeUserId, lifetimeFact());
    expect((await quarantineCounts(stripeUserId)).quarantined).toBe(0);
    expect(await queueRows(stripeUserId)).toHaveLength(1);

    // Drop the queue row so a second enqueue would be unmistakable, then let
    // the provider redeliver once more. The UPDATE is predicated on
    // `quarantined = true`, so this pass matches zero rows, fires no trigger
    // and enqueues nothing.
    await clearQueue(stripeUserId);
    await runStripeEvent(stripeUserId, lifetimeFact());

    expect(await queueRows(stripeUserId)).toHaveLength(0);
    const counts = await quarantineCounts(stripeUserId);
    expect(counts.total).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(counts.quarantined).toBe(0);
    expect((await getProfileRow(stripeUserId)).planSelected).toBe("lifetime");
  });

  // -------------------------------------------------------------------------
  // MERGE-BLOCKING: the unlock must NOT swallow its own failure.
  //
  // Every convergence test above depends on ONE unstated property: when the
  // unlock fails, the webhook must fail with it. `unlockQuarantinedRoundsOnUpgrade`
  // deliberately lets the error escape, and the caller's catch turns it into a
  // non-2xx so the provider redelivers — that redelivery IS the repair
  // mechanism, and it only happens if the request failed AND no `success` row
  // was recorded (a success row makes the idempotency check short-circuit the
  // redelivery into a 200 no-op, stranding the rounds forever).
  //
  // Nothing above would notice a `try { ... } catch {}` around the unlock:
  // every other test runs on a healthy database where the UPDATE succeeds.
  // These two tests are the only thing standing between that one-line change
  // and silently re-introducing the exact bug this feature fixes.
  //
  // FAILURE INJECTION: a real BEFORE UPDATE trigger on `public.round`, scoped
  // by its WHEN clause to this user's quarantined rows, that RAISEs. The
  // UPDATE genuinely fails in Postgres and the error propagates through
  // drizzle exactly as a lock timeout, permission error or constraint
  // violation would in production. No production code is touched, no module is
  // mocked, and the helper gets no test-only branch — the test-only artifact
  // lives entirely in the database and is dropped in a `finally`.
  // -------------------------------------------------------------------------

  const BLOCK_TRIGGER = "__test_block_quarantine_unlock";

  async function withBlockedRoundUnlock<T>(
    userId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await db.execute(
      sql.raw(`
        create or replace function public.${BLOCK_TRIGGER}() returns trigger
        language plpgsql as $trg$
        begin
          raise exception 'injected failure: quarantine unlock UPDATE blocked';
        end;
        $trg$
      `)
    );
    // The WHEN clause keeps the injection surgical: only THIS user's
    // still-quarantined rows fail, so the seeding and assertions around it
    // (and the other test user) are untouched. `userId` is a uuid minted by
    // `admin.auth.admin.createUser`, and the ::uuid cast rejects anything else.
    await db.execute(
      sql.raw(`
        create trigger ${BLOCK_TRIGGER}
          before update on public.round
          for each row
          when (old."userId" = '${userId}'::uuid and old.quarantined = true)
          execute function public.${BLOCK_TRIGGER}()
      `)
    );
    try {
      return await fn();
    } finally {
      await db.execute(
        sql.raw(`drop trigger if exists ${BLOCK_TRIGGER} on public.round`)
      );
      await db.execute(
        sql.raw(`drop function if exists public.${BLOCK_TRIGGER}()`)
      );
    }
  }

  async function webhookEventRows(eventId: string) {
    return db
      .select({
        eventId: webhookEvents.eventId,
        status: webhookEvents.status,
        eventTimeMs: webhookEvents.eventTimeMs,
      })
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId));
  }

  test("RevenueCat: a failing unlock returns 500 and records NO success event", async () => {
    const payload = rcPayload("INITIAL_PURCHASE", {
      product_id: APPLE_SKUS.premiumYearly,
      expiration_at_ms: FUTURE_MS,
    });
    const eventId = (payload.event as { id: string }).id;

    const res = await withBlockedRoundUnlock(rcUserId, () =>
      POST(makeRequest(payload))
    );

    // 1. The failure is NOT swallowed: non-2xx is what makes RevenueCat
    //    redeliver (5/10/20/40/80 min). A 200 here means the rounds are
    //    stranded with nobody coming back for them.
    expect(res.status).toBe(500);

    // 2. No success row for this event id. The route's idempotency check
    //    short-circuits any event already recorded `success` into a 200
    //    no-op, so a success row would neutralize the redelivery even though
    //    the rounds never unlocked. (A `failed` row is expected and fine —
    //    the route only skips on `success`.)
    const rows = await webhookEventRows(eventId);
    expect(rows.filter((r) => r.status === "success")).toHaveLength(0);

    // The split-transaction shape this whole design rests on: the profile
    // write COMMITTED (it does not share a transaction with the unlock) while
    // the rounds stayed quarantined. That divergence is exactly what the
    // redelivery has to repair.
    expect((await getProfileRow(rcUserId)).planSelected).toBe("premium");
    expect((await quarantineCounts(rcUserId)).quarantined).toBe(
      QUARANTINED_COUNT
    );
    expect(await queueRows(rcUserId)).toHaveLength(0);
  });

  test("RevenueCat: the redelivery after a failed unlock converges", async () => {
    const payload = rcPayload("INITIAL_PURCHASE", {
      product_id: APPLE_SKUS.premiumYearly,
      expiration_at_ms: FUTURE_MS,
    });

    const failed = await withBlockedRoundUnlock(rcUserId, () =>
      POST(makeRequest(payload))
    );
    expect(failed.status).toBe(500);
    expect((await quarantineCounts(rcUserId)).quarantined).toBe(
      QUARANTINED_COUNT
    );

    // RevenueCat redelivers the SAME event id. Because no `success` row was
    // written, the idempotency check lets it through to the chokepoint, which
    // re-decides against the now-committed premium profile and re-runs the
    // unlock — this time against a healthy table.
    const retry = await POST(makeRequest(payload));
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.not.toMatchObject({ duplicate: true });

    const counts = await quarantineCounts(rcUserId);
    expect(counts.quarantined).toBe(0);
    expect(counts.active).toBe(FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT);
    expect(await countedRounds(rcUserId)).toBe(
      FREE_TIER_ROUND_LIMIT + QUARANTINED_COUNT
    );
    expect(await queueRows(rcUserId)).toHaveLength(1);
  });
});
