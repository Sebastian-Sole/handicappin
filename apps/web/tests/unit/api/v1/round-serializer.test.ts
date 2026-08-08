/**
 * The `/v1` round resource serializer (T13.3) — the shape `POST /v1/rounds`
 * (T13.4) reuses for its 201 body and its 200 replay body.
 *
 * These tests pin three things the contract makes expensive to get wrong:
 *
 *   1. **The exact field set.** §4 makes removing a response field a `/v2`,
 *      so the key list is asserted literally rather than field-by-field —
 *      an accidental addition is as much a decision as a removal.
 *   2. **`status` is derived from `quarantined` and the raw boolean never
 *      ships** (§5).
 *   3. **A Drizzle row and a PostgREST row serialize IDENTICALLY.** That is
 *      the whole reuse guarantee: T13.4 feeds `submitScorecard`'s Drizzle row
 *      in, `GET /v1/rounds` feeds a PostgREST row in, and the bodies must not
 *      be distinguishable.
 */
import { describe, expect, test } from "vitest";

import {
  V1_HANDICAP_REVISION_PENDING,
  serializeV1Round,
  toUtcIsoString,
  v1RoundSourceFromTableRow,
  v1RoundStatus,
  type V1RoundSource,
  type V1RoundTableRow,
} from "@/app/api/v1/_lib/serializers/round";

/** A Drizzle `round` row, as `submitScorecard` returns it. */
function drizzleRow(overrides: Partial<V1RoundSource> = {}): V1RoundSource {
  return {
    id: 4242,
    externalId: "fitbull-round-9c3",
    quarantined: false,
    courseId: 11,
    teeId: 22,
    teeTime: new Date("2026-07-29T14:32:00.000Z"),
    nineHoleSection: null,
    notes: "windy",
    holesPlayed: 18,
    totalStrokes: 90,
    parPlayed: 71,
    adjustedGrossScore: 89,
    adjustedPlayedScore: 88,
    courseHandicap: 12,
    scoreDifferential: 16.5,
    updatedHandicapIndex: 10.4,
    courseRatingUsed: 71.2,
    slopeRatingUsed: 130,
    createdAt: new Date("2026-07-29T14:40:00.000Z"),
    updatedAt: new Date("2026-07-29T14:40:00.000Z"),
    ...overrides,
  };
}

/**
 * THE SAME ROW as PostgREST renders it: snake_case for the columns added
 * after the table's camelCase era, and strings for every timestamp — the
 * naive `timestamp` columns with NO zone designator, the `timestamptz`
 * `updated_at` with one.
 */
function postgrestRow(overrides: Partial<V1RoundTableRow> = {}): V1RoundTableRow {
  return {
    id: 4242,
    externalId: "fitbull-round-9c3",
    quarantined: false,
    courseId: 11,
    teeId: 22,
    teeTime: "2026-07-29T14:32:00",
    nine_hole_section: null,
    notes: "windy",
    holes_played: 18,
    totalStrokes: 90,
    parPlayed: 71,
    adjustedGrossScore: 89,
    adjustedPlayedScore: 88,
    courseHandicap: 12,
    scoreDifferential: 16.5,
    updatedHandicapIndex: 10.4,
    course_rating_used: 71.2,
    slope_rating_used: 130,
    createdAt: "2026-07-29T14:40:00",
    updated_at: "2026-07-29T14:40:00+00:00",
    ...overrides,
  };
}

const EXPECTED_KEYS = [
  "id",
  "externalId",
  "status",
  "handicapIndex",
  "handicapRevision",
  "courseId",
  "teeId",
  "teeTime",
  "nineHoleSection",
  "notes",
  "holesPlayed",
  "totalStrokes",
  "parPlayed",
  "adjustedGrossScore",
  "adjustedPlayedScore",
  "courseHandicap",
  "scoreDifferential",
  "courseRating",
  "slopeRating",
  "createdAt",
  "updatedAt",
].sort();

describe("serializeV1Round — the frozen field set", () => {
  test("emits exactly the contracted keys, no more and no fewer", () => {
    expect(Object.keys(serializeV1Round(drizzleRow())).sort()).toEqual(
      EXPECTED_KEYS
    );
  });

  test("never leaks the raw quarantined boolean, approvalStatus, or userId", () => {
    const body = JSON.stringify(serializeV1Round(drizzleRow()));
    expect(body).not.toContain("quarantined\"");
    expect(body).not.toContain("approvalStatus");
    expect(body).not.toContain("userId");
    expect(body).not.toContain("submittedVia");
    expect(body).not.toContain("existingHandicapIndex");
  });

  test("serializes every value of the resource", () => {
    expect(serializeV1Round(drizzleRow())).toEqual({
      id: 4242,
      externalId: "fitbull-round-9c3",
      status: "active",
      handicapIndex: 10.4,
      handicapRevision: "pending",
      courseId: 11,
      teeId: 22,
      teeTime: "2026-07-29T14:32:00.000Z",
      nineHoleSection: null,
      notes: "windy",
      holesPlayed: 18,
      totalStrokes: 90,
      parPlayed: 71,
      adjustedGrossScore: 89,
      adjustedPlayedScore: 88,
      courseHandicap: 12,
      scoreDifferential: 16.5,
      courseRating: 71.2,
      slopeRating: 130,
      createdAt: "2026-07-29T14:40:00.000Z",
      updatedAt: "2026-07-29T14:40:00.000Z",
    });
  });

  test("a null externalId and null notes survive as null, not undefined", () => {
    const resource = serializeV1Round(
      drizzleRow({ externalId: null, notes: null })
    );
    expect(resource.externalId).toBeNull();
    expect(resource.notes).toBeNull();
    expect(JSON.parse(JSON.stringify(resource))).toHaveProperty("externalId");
  });
});

describe("status — derived from `quarantined` and nothing else (§5)", () => {
  test("quarantined = true → 'quarantined'", () => {
    expect(serializeV1Round(drizzleRow({ quarantined: true })).status).toBe(
      "quarantined"
    );
  });

  test("quarantined = false → 'active'", () => {
    expect(serializeV1Round(drizzleRow({ quarantined: false })).status).toBe(
      "active"
    );
  });

  test("v1RoundStatus is a total, one-way mapping", () => {
    expect(v1RoundStatus(true)).toBe("quarantined");
    expect(v1RoundStatus(false)).toBe("active");
  });
});

describe("handicapRevision — 'pending' is the only honest value today", () => {
  test("is 'pending' for an active round", () => {
    expect(serializeV1Round(drizzleRow()).handicapRevision).toBe("pending");
  });

  test("is 'pending' for a quarantined round too", () => {
    expect(
      serializeV1Round(drizzleRow({ quarantined: true })).handicapRevision
    ).toBe("pending");
  });

  test("is 'pending' regardless of how old the round is", () => {
    // No per-round recomputation marker exists, and the one real signal
    // (`handicap_calculation_queue.status`) is per-USER and RLS-denied to
    // both /v1 principal classes. 006 owns detection; this build must not
    // invent one, so age changes nothing.
    expect(
      serializeV1Round(
        drizzleRow({
          teeTime: new Date("1998-04-01T09:00:00.000Z"),
          createdAt: new Date("1998-04-01T10:00:00.000Z"),
        })
      ).handicapRevision
    ).toBe("pending");
  });

  test("the exported constant is what ships", () => {
    expect(V1_HANDICAP_REVISION_PENDING).toBe("pending");
  });
});

describe("timestamps — the naive-column trap (contract §2 N3)", () => {
  test("a PostgREST string with NO zone designator is read as UTC, not local", () => {
    // `new Date("2026-07-29T14:32:00")` is LOCAL time by spec. Reading the
    // naive column that way shifts every teeTime by the server's offset —
    // invisible in a UTC CI box, wrong in Oslo, on the field the natural key
    // and §2's replay comparison both key on.
    expect(toUtcIsoString("2026-07-29T14:32:00")).toBe(
      "2026-07-29T14:32:00.000Z"
    );
  });

  test("a string WITH an offset is honoured, not double-shifted", () => {
    expect(toUtcIsoString("2026-07-29T16:32:00+02:00")).toBe(
      "2026-07-29T14:32:00.000Z"
    );
    expect(toUtcIsoString("2026-07-29T14:32:00Z")).toBe(
      "2026-07-29T14:32:00.000Z"
    );
    expect(toUtcIsoString("2026-07-29T14:32:00+0000")).toBe(
      "2026-07-29T14:32:00.000Z"
    );
  });

  test("a space-separated rendering is accepted", () => {
    expect(toUtcIsoString("2026-07-29 14:32:00")).toBe(
      "2026-07-29T14:32:00.000Z"
    );
  });

  test("a Date passes through as its UTC instant", () => {
    expect(toUtcIsoString(new Date("2026-07-29T14:32:00.000Z"))).toBe(
      "2026-07-29T14:32:00.000Z"
    );
  });

  test("an unparseable timestamp throws rather than shipping 'Invalid Date'", () => {
    expect(() => toUtcIsoString("not-a-timestamp")).toThrow(TypeError);
    expect(() =>
      serializeV1Round(drizzleRow({ teeTime: "not-a-timestamp" }))
    ).toThrow(TypeError);
  });
});

describe("numerics", () => {
  test("string numerics from a numeric column are coerced", () => {
    const resource = serializeV1Round(
      drizzleRow({
        scoreDifferential: "16.5",
        updatedHandicapIndex: "10.4",
        courseRatingUsed: "71.2",
        slopeRatingUsed: "130",
      })
    );
    expect(resource.scoreDifferential).toBe(16.5);
    expect(resource.handicapIndex).toBe(10.4);
    expect(resource.courseRating).toBe(71.2);
    expect(resource.slopeRating).toBe(130);
  });

  test("a non-numeric numeric throws rather than shipping NaN", () => {
    expect(() =>
      serializeV1Round(drizzleRow({ scoreDifferential: "n/a" }))
    ).toThrow(TypeError);
  });
});

describe("nineHoleSection", () => {
  test("front and back survive", () => {
    expect(
      serializeV1Round(drizzleRow({ nineHoleSection: "front" })).nineHoleSection
    ).toBe("front");
    expect(
      serializeV1Round(drizzleRow({ nineHoleSection: "back" })).nineHoleSection
    ).toBe("back");
  });

  test("null (18 holes) stays null, and any other text narrows to null", () => {
    expect(
      serializeV1Round(drizzleRow({ nineHoleSection: null })).nineHoleSection
    ).toBeNull();
    expect(
      serializeV1Round(drizzleRow({ nineHoleSection: "middle" }))
        .nineHoleSection
    ).toBeNull();
  });
});

describe("the reuse guarantee — one shape from two row shapes", () => {
  test("a Drizzle row and the SAME PostgREST row serialize identically", () => {
    // This is what makes `POST /v1/rounds` (Drizzle row from
    // `submitScorecard`) and `GET /v1/rounds` (PostgREST row) return
    // indistinguishable bodies, as §2 rule 2 and §5 require.
    expect(serializeV1Round(v1RoundSourceFromTableRow(postgrestRow()))).toEqual(
      serializeV1Round(drizzleRow())
    );
  });

  test("…and identically for a quarantined, 9-hole, key-less round", () => {
    const shared = {
      quarantined: true,
      externalId: null,
      notes: null,
      holesPlayed: 9,
    } as const;
    expect(
      serializeV1Round(
        v1RoundSourceFromTableRow(
          postgrestRow({
            ...shared,
            nine_hole_section: "back",
            holes_played: 9,
          })
        )
      )
    ).toEqual(
      serializeV1Round(drizzleRow({ ...shared, nineHoleSection: "back" }))
    );
  });

  test("v1RoundSourceFromTableRow renames without coercing", () => {
    const source = v1RoundSourceFromTableRow(postgrestRow());
    expect(source.holesPlayed).toBe(18);
    expect(source.courseRatingUsed).toBe(71.2);
    expect(source.slopeRatingUsed).toBe(130);
    expect(source.nineHoleSection).toBeNull();
    // Still the raw PostgREST strings — canonicalization is the serializer's.
    expect(source.teeTime).toBe("2026-07-29T14:32:00");
    expect(source.updatedAt).toBe("2026-07-29T14:40:00+00:00");
  });
});
