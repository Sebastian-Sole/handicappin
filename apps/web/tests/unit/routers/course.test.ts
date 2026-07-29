/**
 * Course Router — getRecentCourses (PR #163 follow-up)
 *
 * Review finding: "No test coverage for the new `getRecentCourses` query"
 * (the most SQL-complex procedure in course.ts: inner join, groupBy,
 * two-key orderBy with aggregates, limit).
 *
 * These tests mock `@/db` with a chainable query builder that captures the
 * clauses Drizzle is invoked with, then call the procedure through a real
 * tRPC caller. They pin down:
 *   - auth gating (UNAUTHORIZED without a user)
 *   - user scoping (`where eq(round.userId, ctx.user.id)`)
 *   - ordering keys (most recent teeTime first, round-count tiebreak)
 *   - the limit(5) cap
 *   - result normalization (website null -> undefined, non-approved
 *     approvalStatus coerced to "pending" — pending courses are included
 *     by design)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq, desc, max, count } from "drizzle-orm";

interface CapturedQuery {
  rows: unknown[];
  where: unknown;
  groupByArgs: unknown[];
  orderByArgs: unknown[];
  limit: number | undefined;
}

const dbState = vi.hoisted((): CapturedQuery => ({
  rows: [],
  where: undefined,
  groupByArgs: [],
  orderByArgs: [],
  limit: undefined,
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: (condition: unknown) => {
            dbState.where = condition;
            return {
              groupBy: (...groupByArgs: unknown[]) => {
                dbState.groupByArgs = groupByArgs;
                return {
                  orderBy: (...orderByArgs: unknown[]) => {
                    dbState.orderByArgs = orderByArgs;
                    return {
                      limit: (n: number) => {
                        dbState.limit = n;
                        return Promise.resolve(dbState.rows);
                      },
                    };
                  },
                };
              },
            };
          },
        }),
      }),
    }),
  },
}));

import { courseRouter } from "@/server/api/routers/course";
import { createCallerFactory } from "@/server/api/trpc";
import { course, round } from "@/db/schema";

const createCaller = createCallerFactory(courseRouter);

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

function buildCtx(user: { id: string } | null = { id: USER_ID }) {
  return {
    user,
    supabase: {},
    headers: new Headers(),
  } as unknown as Parameters<typeof createCaller>[0];
}

interface RecentCourseRow {
  id: number;
  name: string;
  approvalStatus: "approved" | "pending" | "rejected";
  country: string;
  city: string;
  website: string | null;
}

const approvedRow: RecentCourseRow = {
  id: 1,
  name: "Ballerud Golfklubb",
  approvalStatus: "approved",
  country: "Norway",
  city: "Bekkestua",
  website: "https://ballerud.no",
};

const pendingRow: RecentCourseRow = {
  id: 2,
  name: "Pending Links",
  approvalStatus: "pending",
  country: "Scotland",
  city: "Leith",
  website: null,
};

describe("courseRouter.getRecentCourses", () => {
  beforeEach(() => {
    dbState.rows = [];
    dbState.where = undefined;
    dbState.groupByArgs = [];
    dbState.orderByArgs = [];
    dbState.limit = undefined;
  });

  it("rejects unauthenticated callers with UNAUTHORIZED", async () => {
    const caller = createCaller(buildCtx(null));
    await expect(caller.getRecentCourses()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("scopes the query to the signed-in user's rounds", async () => {
    const caller = createCaller(buildCtx());
    await caller.getRecentCourses();
    expect(dbState.where).toEqual(eq(round.userId, USER_ID));
  });

  it("orders by most recent teeTime, then round count, and caps at 5", async () => {
    const caller = createCaller(buildCtx());
    await caller.getRecentCourses();
    expect(dbState.orderByArgs).toEqual([
      desc(max(round.teeTime)),
      desc(count(round.id)),
    ]);
    expect(dbState.groupByArgs).toEqual([course.id]);
    expect(dbState.limit).toBe(5);
  });

  it("returns rows in query order with website null normalized to undefined", async () => {
    dbState.rows = [approvedRow, pendingRow];
    const caller = createCaller(buildCtx());
    const result = await caller.getRecentCourses();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ...approvedRow, website: "https://ballerud.no" });
    expect(result[1]).toEqual({ ...pendingRow, website: undefined });
  });

  it("keeps pending courses and narrows approvalStatus to approved | pending", async () => {
    dbState.rows = [pendingRow, { ...approvedRow, id: 3 }];
    const caller = createCaller(buildCtx());
    const result = await caller.getRecentCourses();
    expect(result.map((c) => c.approvalStatus)).toEqual([
      "pending",
      "approved",
    ]);
  });

  it("coerces any non-approved status to \"pending\"", async () => {
    dbState.rows = [{ ...pendingRow, approvalStatus: "rejected" }];
    const caller = createCaller(buildCtx());
    const result = await caller.getRecentCourses();
    expect(result[0]?.approvalStatus).toBe("pending");
  });

  it("returns an empty list when the user has no rounds", async () => {
    const caller = createCaller(buildCtx());
    const result = await caller.getRecentCourses();
    expect(result).toEqual([]);
  });
});
