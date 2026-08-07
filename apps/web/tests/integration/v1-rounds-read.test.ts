/**
 * `GET /v1/rounds` (T13.3) against the REAL local Supabase stack, through the
 * REAL route handler.
 *
 * Contract §6 requires that "**integration tests must cover both principal
 * classes per route**" — the same route, same code path, same user can see
 * different data depending on whether the token carries `client_id`, and a
 * route tested only with a first-party token is untested on the path that
 * matters. So every data-shape assertion below runs twice, once per class,
 * driven by `helpers/v1-principals`.
 *
 * Real: tokens (password sign-in and the full OAuth 2.1 authorization-code +
 * PKCE flow), RLS, the `get_connected_entitlement()` RPC, PostgREST, and the
 * handler itself.
 *
 * Mocked: the rate limiter, and ONLY it. `RATE_LIMIT_ENABLED` is unset
 * locally, so the real fail-closed limiter would deny every request with a
 * 503 and nothing else in this file could be exercised; and the 429 / 503
 * branches are otherwise unreachable without a live Upstash bucket. The mock
 * also lets the suite assert what the handler PASSES the limiter — the two
 * arguments that fail silently when wrong.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

import {
  hasLocalStack,
  adminClient,
  deleteAuthUserByEmail,
  mintFirstPartyPrincipal,
  mintOAuthPrincipal,
  sweepStaleOAuthTestClients,
  v1Request,
  type TestPrincipal,
} from "./helpers/v1-principals";

/**
 * Limiter double. `vi.hoisted` because `vi.mock`'s factory is hoisted above
 * every import and cannot close over ordinary module-scope bindings.
 */
const limiter = vi.hoisted(() => ({
  calls: [] as { principal: unknown; family: unknown }[],
  state: {
    outcome: {
      success: true,
      failedClosed: false,
      limit: 120,
      remaining: 119,
      reset: 0,
    } as {
      success: boolean;
      failedClosed: boolean;
      limit: number;
      remaining: number;
      reset: number;
      reason?: string;
      family?: string;
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforcePublicApiRateLimit: async (
    _request: Request,
    principal: unknown,
    family: unknown
  ) => {
    limiter.calls.push({ principal, family });
    return limiter.state.outcome;
  },
}));

const { GET } = await import("@/app/api/v1/rounds/route");
const { serializeV1Round } = await import(
  "@/app/api/v1/_lib/serializers/round"
);
const { db } = await import("@/db");
const { profile, course, teeInfo, round } = await import("@/db/schema");

const describeIfLocal = hasLocalStack ? describe : describe.skip;

const EMAILS = {
  owner: "v1-rounds-read-owner@handicappin.local",
  decoy: "v1-rounds-read-decoy@handicappin.local",
  planless: "v1-rounds-read-planless@handicappin.local",
} as const;
const COURSE_NAME = "V1 Rounds Read Course";

let firstParty: TestPrincipal;
let oauth: TestPrincipal;
let decoy: TestPrincipal;
let planless: TestPrincipal;
let ownerId: string;
let decoyId: string;
let courseId: number;
let teeId: number;

/** Round ids by role, so assertions can name them. */
const ids = {
  oldest: 0,
  quarantined: 0,
  newest: 0,
  decoy: 0,
};

const EXTERNAL_ID = `fitbull-${randomUUID()}`;

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

function allowLimiter() {
  limiter.state.outcome = {
    success: true,
    failedClosed: false,
    limit: 120,
    remaining: 119,
    reset: Date.now() + 60_000,
  };
}

interface RoundsPageBody {
  data: Record<string, unknown>[];
  pagination: { limit: number; offset: number; count: number; hasMore: boolean };
}

async function getRounds(
  principal: TestPrincipal,
  query = ""
): Promise<{ response: Response; body: RoundsPageBody }> {
  const response = await GET(v1Request(principal, `/rounds${query}`));
  return { response, body: (await response.clone().json()) as RoundsPageBody };
}

describeIfLocal("GET /v1/rounds (real local Supabase)", () => {
  beforeAll(async () => {
    await sweepStaleOAuthTestClients();
    for (const email of Object.values(EMAILS)) {
      const admin = adminClient();
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = data?.users.find((u) => u.email === email);
      if (existing) {
        await db.delete(round).where(eq(round.userId, existing.id));
        await db.delete(profile).where(eq(profile.id, existing.id));
      }
      await deleteAuthUserByEmail(email);
    }

    // Stale course/tee from an aborted run.
    for (const stale of await db
      .select({ id: course.id })
      .from(course)
      .where(eq(course.name, COURSE_NAME))) {
      await db.delete(teeInfo).where(eq(teeInfo.courseId, stale.id));
      await db.delete(course).where(eq(course.id, stale.id));
    }

    const owner = await mintFirstPartyPrincipal(EMAILS.owner);
    firstParty = owner;
    ownerId = owner.userId;
    oauth = await mintOAuthPrincipal({
      userClient: owner.userClient,
      userId: owner.userId,
    });

    const decoyOwner = await mintFirstPartyPrincipal(EMAILS.decoy);
    decoy = decoyOwner;
    decoyId = decoyOwner.userId;

    planless = await mintFirstPartyPrincipal(EMAILS.planless);

    await db.insert(profile).values([
      {
        id: ownerId,
        email: EMAILS.owner,
        name: "V1 Rounds Owner",
        verified: true,
        handicapIndex: 10.4,
        planSelected: "unlimited",
        subscriptionStatus: "active",
      },
      {
        id: decoyId,
        email: EMAILS.decoy,
        name: "V1 Rounds Decoy",
        verified: true,
        handicapIndex: 20.1,
        planSelected: "unlimited",
        subscriptionStatus: "active",
      },
      {
        // No `planSelected` → `is_provisioned = false` → 403 plan_required.
        id: planless.userId,
        email: EMAILS.planless,
        name: "V1 Rounds Planless",
        verified: true,
        handicapIndex: 0,
      },
    ]);

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
        submittedBy: ownerId,
      })
      .returning();
    teeId = createdTee!.id;

    const inserted = await db
      .insert(round)
      .values([
        baseRound(ownerId, new Date("2026-07-01T10:00:00.000Z"), {
          externalId: EXTERNAL_ID,
          notes: "oldest",
        }),
        baseRound(ownerId, new Date("2026-07-02T10:00:00.000Z"), {
          quarantined: true,
          notes: "over the free-tier limit",
        }),
        baseRound(ownerId, new Date("2026-07-03T10:00:00.000Z"), {
          notes: "newest",
          nineHoleSection: "back",
          holesPlayed: 9,
        }),
        baseRound(decoyId, new Date("2026-07-04T10:00:00.000Z"), {
          notes: "another user's round",
        }),
      ])
      .returning();

    ids.oldest = inserted[0]!.id;
    ids.quarantined = inserted[1]!.id;
    ids.newest = inserted[2]!.id;
    ids.decoy = inserted[3]!.id;
  }, 120_000);

  afterAll(async () => {
    for (const userId of [ownerId, decoyId, planless?.userId]) {
      if (userId) await db.delete(round).where(eq(round.userId, userId));
    }
    if (teeId) await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    if (courseId) await db.delete(course).where(eq(course.id, courseId));
    for (const userId of [ownerId, decoyId, planless?.userId]) {
      if (userId) await db.delete(profile).where(eq(profile.id, userId));
    }
    await oauth?.cleanup();
    await firstParty?.cleanup();
    await decoy?.cleanup();
    await planless?.cleanup();
  }, 120_000);

  beforeEach(() => {
    limiter.calls.length = 0;
    allowLimiter();
  });

  // ── Both principal classes (§6) ─────────────────────────────────────────
  for (const className of ["first-party", "oauth"] as const) {
    const principalFor = () => (className === "oauth" ? oauth : firstParty);

    describe(`principal class: ${className}`, () => {
      test("200 with the caller's rounds and the stability header", async () => {
        const { response, body } = await getRounds(principalFor());

        expect(response.status).toBe(200);
        expect(response.headers.get("X-API-Stability")).toBe("internal");
        expect(response.headers.get("Content-Type")).toContain(
          "application/json"
        );
        expect(body.data.map((entry) => entry.id).sort()).toEqual(
          [ids.oldest, ids.quarantined, ids.newest].sort()
        );
      }, 60_000);

      test("a QUARANTINED round APPEARS in the list, with status 'quarantined'", async () => {
        const { body } = await getRounds(principalFor());
        const entry = body.data.find((r) => r.id === ids.quarantined);

        expect(entry, "quarantined round must not be filtered out").toBeDefined();
        expect(entry!.status).toBe("quarantined");
        // The raw column never ships — §5 rejects a `quarantined: boolean`.
        expect(entry).not.toHaveProperty("quarantined");
      }, 60_000);

      test("an active round shows status 'active'", async () => {
        const { body } = await getRounds(principalFor());
        const entry = body.data.find((r) => r.id === ids.newest);
        expect(entry!.status).toBe("active");
      }, 60_000);

      test("every entry carries a 'pending' handicapRevision and a provisional handicapIndex", async () => {
        const { body } = await getRounds(principalFor());
        expect(body.data.length).toBeGreaterThan(0);
        for (const entry of body.data) {
          expect(entry.handicapRevision).toBe("pending");
          expect(typeof entry.handicapIndex).toBe("number");
        }
      }, 60_000);

      test("CROSS-USER ISOLATION: another user's round is never returned", async () => {
        const { body } = await getRounds(principalFor());
        expect(body.data.map((entry) => entry.id)).not.toContain(ids.decoy);
        // And the decoy's own token sees only its own round.
        const { body: decoyBody } = await getRounds(decoy);
        expect(decoyBody.data.map((entry) => entry.id)).toEqual([ids.decoy]);
      }, 60_000);

      test("ordering is teeTime DESC, id DESC", async () => {
        const { body } = await getRounds(principalFor());
        expect(body.data.map((entry) => entry.id)).toEqual([
          ids.newest,
          ids.quarantined,
          ids.oldest,
        ]);
      }, 60_000);

      test("?externalId= returns exactly the round stored under that key", async () => {
        const { body } = await getRounds(
          principalFor(),
          `?externalId=${encodeURIComponent(EXTERNAL_ID)}`
        );
        expect(body.data.map((entry) => entry.id)).toEqual([ids.oldest]);
        expect(body.data[0]!.externalId).toBe(EXTERNAL_ID);
      }, 60_000);

      test("?externalId= for an unknown key is an empty page, not a 404", async () => {
        const { response, body } = await getRounds(
          principalFor(),
          "?externalId=never-submitted"
        );
        expect(response.status).toBe(200);
        expect(body.data).toEqual([]);
        expect(body.pagination.hasMore).toBe(false);
      }, 60_000);

      test("limit/offset paginate and hasMore is honest", async () => {
        const first = await getRounds(principalFor(), "?limit=2");
        expect(first.body.data.map((e) => e.id)).toEqual([
          ids.newest,
          ids.quarantined,
        ]);
        expect(first.body.pagination).toEqual({
          limit: 2,
          offset: 0,
          count: 2,
          hasMore: true,
        });

        const second = await getRounds(principalFor(), "?limit=2&offset=2");
        expect(second.body.data.map((e) => e.id)).toEqual([ids.oldest]);
        expect(second.body.pagination).toEqual({
          limit: 2,
          offset: 2,
          count: 1,
          hasMore: false,
        });
      }, 60_000);

      test("TWO limiter calls: pre-auth IP-keyed, then per-principal — both in the 'reads' family", async () => {
        await getRounds(principalFor());

        expect(limiter.calls).toHaveLength(2);

        // 1. Pre-auth, BEFORE `authenticateV1Request`. No principal argument
        //    at all ⇒ `getIdentifier` falls through to `ip:{ip}` (§3). This is
        //    what keeps an unauthenticated caller from turning a `Bearer
        //    <garbage>` into an unlimited 1:1 amplifier against GoTrue.
        const preAuth = limiter.calls[0]!;
        expect(preAuth.principal).toBeUndefined();
        expect(preAuth.family).toBe("reads");

        // 2. Per-principal, after auth + scope. Disjoint key space from the
        //    IP bucket, so the two never contend despite sharing the family.
        const call = limiter.calls[1]!;
        // Named family — omitting it falls back to the legacy 60/min bucket.
        expect(call.family).toBe("reads");
        // PARTS, never a composed key string.
        expect(typeof call.principal).toBe("object");
        const parts = call.principal as { userId: string; clientId?: string };
        expect(parts.userId).toBe(ownerId);
        if (className === "oauth") {
          expect(parts.clientId).toBe(oauth.clientId);
        } else {
          expect(parts.clientId).toBeUndefined();
        }
      }, 60_000);
    });
  }

  // ── The serializer reuse guarantee (§2 rule 2 / §5) ─────────────────────
  //
  // The live comparison runs over EVERY seeded round shape, not just one.
  // Both sides are real: the left is the PostgREST → handler → JSON
  // round-trip, the right is `serializeV1Round` over the Drizzle row
  // `submitScorecard` returns. Comparing a single shape leaves the fields
  // that only VARY between shapes — a non-null `externalId`, a non-null
  // `nineHoleSection`, `holesPlayed: 9`, `status: "active"` — pinned on both
  // sides only by hand-written fixtures, i.e. by nothing. This is the exact
  // guarantee `POST /v1/rounds` (T13.4) inherits, so it is worth the loop.
  const parityShapes = [
    { name: "quarantined · null externalId · 18 holes", id: () => ids.quarantined },
    { name: "active · real externalId · 18 holes", id: () => ids.oldest },
    { name: "active · 9-hole 'back' section", id: () => ids.newest },
  ] as const;

  for (const shape of parityShapes) {
    test(`a list entry is byte-identical to serializeV1Round of the stored row — ${shape.name}`, async () => {
      const roundId = shape.id();
      const [storedRow] = await db
        .select()
        .from(round)
        .where(eq(round.id, roundId));

      const { body } = await getRounds(oauth);
      const entry = body.data.find((r) => r.id === roundId);

      expect(entry, "the round must be present in the page").toBeDefined();
      // `storedRow` is exactly what `submitScorecard` returns as `round`, so
      // this is the assertion that T13.4's 201 body and this list entry
      // cannot diverge.
      expect(entry).toEqual(
        JSON.parse(JSON.stringify(serializeV1Round(storedRow!)))
      );
    }, 60_000);
  }

  test("the three compared shapes really are distinct — the loop above is not one case run three times", async () => {
    const { body } = await getRounds(oauth);
    const byId = (id: number) => body.data.find((r) => r.id === id)!;

    expect(byId(ids.quarantined).externalId).toBeNull();
    expect(byId(ids.quarantined).status).toBe("quarantined");
    expect(byId(ids.quarantined).nineHoleSection).toBeNull();
    expect(byId(ids.quarantined).holesPlayed).toBe(18);

    expect(byId(ids.oldest).externalId).toBe(EXTERNAL_ID);
    expect(byId(ids.oldest).status).toBe("active");
    expect(byId(ids.oldest).nineHoleSection).toBeNull();

    expect(byId(ids.newest).nineHoleSection).toBe("back");
    expect(byId(ids.newest).holesPlayed).toBe(9);
    expect(byId(ids.newest).status).toBe("active");
  }, 60_000);

  test("teeTime round-trips as the UTC instant it was stored as", async () => {
    const { body } = await getRounds(firstParty);
    const entry = body.data.find((r) => r.id === ids.oldest);
    expect(entry!.teeTime).toBe("2026-07-01T10:00:00.000Z");
  }, 60_000);

  // ── Auth, entitlement, validation ──────────────────────────────────────
  test("no Bearer token → 401 unauthorized as problem+json", async () => {
    const response = await GET(
      new Request("https://api.handicappin.com/api/v1/rounds")
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain(
      "application/problem+json"
    );
    expect(response.headers.get("X-API-Stability")).toBe("internal");
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
    // ONE limiter call, and it is the pre-auth IP-keyed one: an
    // unauthenticated request must still be limited (§3), because deciding
    // whether it is authenticated is itself a network call to GoTrue for any
    // non-empty `Bearer` value. The per-principal call is never reached —
    // there is no principal.
    expect(limiter.calls).toHaveLength(1);
    expect(limiter.calls[0]!.principal).toBeUndefined();
    expect(limiter.calls[0]!.family).toBe("reads");
  }, 60_000);

  test("an account that never completed plan selection → 403 plan_required", async () => {
    const response = await GET(v1Request(planless, "/rounds"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "plan_required" });
  }, 60_000);

  test("an invalid limit → 422 validation_failed naming the field", async () => {
    const response = await GET(v1Request(firstParty, "/rounds?limit=0"));
    expect(response.status).toBe(422);
    const problem = (await response.json()) as {
      code: string;
      errors: { path: string }[];
    };
    expect(problem.code).toBe("validation_failed");
    expect(problem.errors.map((e) => e.path)).toContain("limit");
  }, 60_000);

  test("unknown query parameters are ignored, not rejected", async () => {
    const { response, body } = await getRounds(
      firstParty,
      "?external_id=typo&order=asc"
    );
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(3);
  }, 60_000);

  // ── Rate limiting (§3) ─────────────────────────────────────────────────
  test("budget exhausted → 429 rate_limited with Retry-After and the X-RateLimit trio", async () => {
    const reset = Date.now() + 42_000;
    limiter.state.outcome = {
      success: false,
      failedClosed: false,
      limit: 120,
      remaining: 0,
      reset,
      family: "reads",
    };

    const response = await GET(v1Request(oauth, "/rounds"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toContain(
      "application/problem+json"
    );
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("120");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil(reset / 1000))
    );
    expect(await response.json()).toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  }, 60_000);

  test("limiter unavailable → 503 service_unavailable with Retry-After: 60 and NO X-RateLimit headers", async () => {
    limiter.state.outcome = {
      success: false,
      failedClosed: true,
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60_000,
      reason: "missing-credentials",
    };

    const response = await GET(v1Request(oauth, "/rounds"));

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
    expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
    expect(response.headers.get("X-RateLimit-Reset")).toBeNull();
    expect(await response.json()).toMatchObject({
      code: "service_unavailable",
      status: 503,
    });
  }, 60_000);

  test("the limiter's internal reason reaches NEITHER the body NOR any header", async () => {
    for (const reason of [
      "disabled",
      "missing-credentials",
      "init-error",
      "runtime-error",
    ]) {
      limiter.state.outcome = {
        success: false,
        failedClosed: true,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
        reason,
      };

      const response = await GET(v1Request(firstParty, "/rounds"));
      const body = await response.text();
      const headers = JSON.stringify([...response.headers.entries()]);

      expect(body).not.toContain(reason);
      expect(headers).not.toContain(reason);
    }
  }, 60_000);
});
