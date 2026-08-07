/**
 * `POST /v1/rounds` — the pure pieces: the request schema, the server-side
 * `hcpStrokes` derivation, and §2's "identical body" comparison with its three
 * normalizations.
 *
 * The DB-backed halves of §2 (the two lookups, the decision procedure, the
 * forced-concurrency race) are in `tests/integration/v1-rounds-write.test.ts`
 * — they are only meaningful against real unique constraints.
 */
import { describe, expect, test } from "vitest";

import {
  V1_EXTERNAL_ID_MAX_LENGTH,
  V1_TEE_HOLES_FIELD_CODE,
  hasTeeHoles,
  v1RoundSubmissionSchema,
  type V1RoundSubmission,
  type V1RoundSubmissionWithHoles,
} from "@/app/api/v1/rounds/submission-schema";
import { TEE_TIME_FIELD_CODE } from "@/app/api/v1/_lib/schemas";
import {
  deriveServerHcpStrokes,
  holesForSection,
} from "@/app/api/v1/rounds/hcp-strokes";
import {
  comparableFromSubmission,
  positionForHoleNumber,
  roundBodiesMatch,
  type V1RoundComparable,
} from "@/app/api/v1/rounds/idempotency";

const USER_ID = "11111111-1111-4111-8111-111111111111";

/** Stroke indices 1–18 in a deliberately non-sequential order. */
const HCP_ORDER = [7, 1, 13, 5, 17, 3, 11, 15, 9, 8, 2, 14, 6, 18, 4, 12, 16, 10];

function holes() {
  return HCP_ORDER.map((hcp, index) => ({
    id: 1000 + index,
    holeNumber: index + 1,
    par: 4,
    hcp,
    distance: 350,
  }));
}

function tee(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: "Blue",
    gender: "mens",
    courseRating18: 71,
    slopeRating18: 113,
    courseRatingFront9: 36,
    slopeRatingFront9: 113,
    courseRatingBack9: 35,
    slopeRatingBack9: 113,
    outPar: 36,
    inPar: 36,
    totalPar: 72,
    outDistance: 3150,
    inDistance: 3150,
    totalDistance: 6300,
    distanceMeasurement: "yards",
    approvalStatus: "approved",
    holes: holes(),
    ...overrides,
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    course: {
      id: 7,
      name: "Test Links",
      approvalStatus: "approved",
      country: "Norway",
      city: "Oslo",
    },
    teePlayed: tee(),
    scores: Array.from({ length: 18 }, () => ({
      strokes: 5,
      hcpStrokes: 0,
    })),
    teeTime: "2026-07-29T14:32:00.000Z",
    approvalStatus: "approved",
    ...overrides,
  };
}

function parse(raw: unknown): V1RoundSubmission {
  const result = v1RoundSubmissionSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `fixture did not parse: ${JSON.stringify(result.error.issues)}`
    );
  }
  return result.data;
}

function parseWithHoles(raw: unknown): V1RoundSubmissionWithHoles {
  const submission = parse(raw);
  if (!hasTeeHoles(submission)) throw new Error("fixture has no holes");
  return submission;
}

function fieldCodes(raw: unknown): string[] {
  const result = v1RoundSubmissionSchema.safeParse(raw);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const params = (issue as { params?: Record<string, unknown> }).params;
    return typeof params?.v1Code === "string" ? params.v1Code : issue.code;
  });
}

// ── The request schema ───────────────────────────────────────────────────
describe("v1RoundSubmissionSchema", () => {
  test("accepts a body with no externalId — the key is optional (§2 rule 4)", () => {
    const parsed = parse(body());
    expect(parsed.externalId).toBeUndefined();
  });

  test("accepts and preserves an externalId verbatim", () => {
    // Verbatim matters: GET /v1/rounds?externalId= matches EXACTLY, so any
    // normalization here makes a written key unfindable on the read path.
    const key = "  Fitbull/Round-01  ";
    expect(parse(body({ externalId: key })).externalId).toBe(key);
  });

  test("rejects an empty externalId", () => {
    expect(v1RoundSubmissionSchema.safeParse(body({ externalId: "" })).success)
      .toBe(false);
  });

  test("rejects an externalId over the length bound", () => {
    const tooLong = "k".repeat(V1_EXTERNAL_ID_MAX_LENGTH + 1);
    expect(
      v1RoundSubmissionSchema.safeParse(body({ externalId: tooLong })).success
    ).toBe(false);
    expect(
      v1RoundSubmissionSchema.safeParse(
        body({ externalId: "k".repeat(V1_EXTERNAL_ID_MAX_LENGTH) })
      ).success
    ).toBe(true);
  });

  test("strips unknown top-level keys instead of rejecting them", () => {
    const parsed = parse(body({ notAField: "ignored" }));
    expect(parsed).not.toHaveProperty("notAField");
  });

  test("requires teePlayed.holes, with a field-level code — not a 500", () => {
    const codes = fieldCodes(body({ teePlayed: tee({ holes: undefined }) }));
    expect(codes).toContain(V1_TEE_HOLES_FIELD_CODE);
  });

  test("accepts a UTC-offset teeTime and canonicalizes it to the instant", () => {
    // Required by §2's N3 merge-blocking case. zod v4's `.datetime()` rejects
    // offsets, so without the /v1 pre-normalization this body is a 422 and
    // the replay comparison is unreachable.
    expect(parse(body({ teeTime: "2026-07-29T16:32:00+02:00" })).teeTime).toBe(
      "2026-07-29T14:32:00.000Z"
    );
    expect(parse(body({ teeTime: "2026-07-29T09:32:00-05:00" })).teeTime).toBe(
      "2026-07-29T14:32:00.000Z"
    );
  });

  test("a zone-less date-time is still rejected — never assume a zone", () => {
    expect(
      v1RoundSubmissionSchema.safeParse(body({ teeTime: "2026-07-29T16:32:00" }))
        .success
    ).toBe(false);
    expect(
      v1RoundSubmissionSchema.safeParse(body({ teeTime: "not-a-date" })).success
    ).toBe(false);
  });

  test("an offset teeTime is checked against D5's window AFTER conversion", () => {
    // 1989-12-31T20:00+02:00 is 1989-12-31T18:00Z — before the bound.
    expect(fieldCodes(body({ teeTime: "1989-12-31T20:00:00+02:00" }))).toContain(
      TEE_TIME_FIELD_CODE
    );
    // 1989-12-31T23:00-02:00 is 1990-01-01T01:00Z — INSIDE it. The window is
    // evaluated on the instant, not on the wall clock the client wrote.
    expect(fieldCodes(body({ teeTime: "1989-12-31T23:00:00-02:00" }))).toEqual(
      []
    );
  });

  test("still enforces D5's teeTime window (the refinement composes)", () => {
    expect(fieldCodes(body({ teeTime: "1989-12-31T23:59:59.000Z" }))).toContain(
      TEE_TIME_FIELD_CODE
    );
    const farFuture = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    expect(fieldCodes(body({ teeTime: farFuture }))).toContain(
      TEE_TIME_FIELD_CODE
    );
  });

  test("reports an externalId issue and a scorecard issue in ONE parse", () => {
    const codes = fieldCodes(
      body({ externalId: "", teeTime: "1970-01-01T00:00:00.000Z" })
    );
    expect(codes).toContain(TEE_TIME_FIELD_CODE);
    expect(codes.length).toBeGreaterThan(1);
  });
});

// ── The server-side hcpStrokes derivation (§2's build dependency) ─────────
describe("deriveServerHcpStrokes", () => {
  test("OVERWRITES what the client sent", () => {
    // The manipulation vector: hcpStrokes: 0 caps every hole at par + 2.
    const submission = parseWithHoles(body());
    const derived = deriveServerHcpStrokes(submission, 18);

    expect(submission.scores.every((s) => s.hcpStrokes === 0)).toBe(true);
    expect(derived.scores.some((s) => s.hcpStrokes !== 0)).toBe(true);
  });

  test("allocates USGA Rule 6.1: one per hole plus the remainder to the lowest stroke indices", () => {
    // handicapIndex 18 on slope 113 / rating 71 / par 72 → courseHandicap 17.
    const derived = deriveServerHcpStrokes(parseWithHoles(body()), 18);
    const total = derived.scores.reduce((sum, s) => sum + s.hcpStrokes, 0);
    expect(total).toBe(17);

    // 17 strokes over 18 holes → 0 base, remainder 17 on the 17 hardest
    // holes. The one hole missing a stroke is stroke index 18.
    const withoutStroke = derived.scores
      .map((score, position) => ({ score, hcp: HCP_ORDER[position]! }))
      .filter((entry) => entry.score.hcpStrokes === 0);
    expect(withoutStroke.map((entry) => entry.hcp)).toEqual([18]);
  });

  test("a 9-hole BACK round is allocated from the back-nine holes only", () => {
    const nine = parseWithHoles(
      body({
        scores: Array.from({ length: 9 }, () => ({ strokes: 5, hcpStrokes: 9 })),
        nineHoleSection: "back",
      })
    );
    const derived = deriveServerHcpStrokes(nine, 18);

    // courseHandicap for 9 holes: round(18/2 * 113/113 + (35 - 36)) = 8.
    expect(derived.scores.reduce((sum, s) => sum + s.hcpStrokes, 0)).toBe(8);
    // The 8 strokes land on the 8 lowest stroke indices among holes 10–18.
    const backNineHcps = HCP_ORDER.slice(9);
    const unstroked = derived.scores
      .map((score, position) => ({ score, hcp: backNineHcps[position]! }))
      .filter((entry) => entry.score.hcpStrokes === 0)
      .map((entry) => entry.hcp);
    expect(unstroked).toEqual([Math.max(...backNineHcps)]);
  });

  test("returns the submission unchanged when there is no handicap index", () => {
    const submission = parseWithHoles(body());
    expect(deriveServerHcpStrokes(submission, null)).toBe(submission);
  });

  test("holesForSection reproduces the service's slice rule", () => {
    const all = Array.from({ length: 18 }, (_, i) => i);
    expect(holesForSection(all, 18, "front")).toEqual(all);
    expect(holesForSection(all, 9, "front")).toEqual(all.slice(0, 9));
    expect(holesForSection(all, 9, "back")).toEqual(all.slice(9, 18));
  });
});

// ── §2 "identical body" ──────────────────────────────────────────────────
describe("roundBodiesMatch", () => {
  const storedFrom = (submission: V1RoundSubmission): V1RoundComparable => {
    // What `comparableFromStoredRound` produces for a round stored from this
    // submission: a resolved (never null) teeId, and the same normalizations.
    const comparable = comparableFromSubmission(submission);
    return { ...comparable, teeId: comparable.teeId ?? 42 };
  };

  test("an identical body matches", () => {
    const submission = parse(body({ externalId: "k" }));
    expect(
      roundBodiesMatch(comparableFromSubmission(submission), storedFrom(submission))
    ).toBe(true);
  });

  test("externalId itself is EXCLUDED from the comparison", () => {
    const a = parse(body({ externalId: "one" }));
    const b = parse(body({ externalId: "two" }));
    expect(roundBodiesMatch(comparableFromSubmission(a), storedFrom(b))).toBe(
      true
    );
  });

  test("hcpStrokes is EXCLUDED — it is server-derived", () => {
    const a = parse(body());
    const b = parse(
      body({
        scores: Array.from({ length: 18 }, () => ({
          strokes: 5,
          hcpStrokes: 3,
        })),
      })
    );
    expect(roundBodiesMatch(comparableFromSubmission(a), storedFrom(b))).toBe(
      true
    );
  });

  test("N1: an OMITTED optional per-hole field equals a stored null", () => {
    const omitted = parse(body());
    const explicitNull = parse(
      body({
        scores: Array.from({ length: 18 }, () => ({
          strokes: 5,
          hcpStrokes: 0,
          putts: null,
          fairwayHit: null,
          penaltyStrokes: null,
        })),
      })
    );
    expect(
      roundBodiesMatch(
        comparableFromSubmission(omitted),
        storedFrom(explicitNull)
      )
    ).toBe(true);
  });

  test("N1 does not swallow a REAL change to an optional field", () => {
    const none = parse(body());
    const withPutts = parse(
      body({
        scores: Array.from({ length: 18 }, () => ({
          strokes: 5,
          hcpStrokes: 0,
          putts: 2,
        })),
      })
    );
    expect(
      roundBodiesMatch(comparableFromSubmission(none), storedFrom(withPutts))
    ).toBe(false);
  });

  test("N2: hole identity is POSITIONAL and order-sensitive", () => {
    const ascending = parse(
      body({
        scores: Array.from({ length: 18 }, (_, i) => ({
          strokes: 3 + (i % 3),
          hcpStrokes: 0,
        })),
      })
    );
    const reordered = parse(
      body({
        scores: [...ascending.scores].reverse().map((s) => ({ ...s })),
      })
    );
    expect(
      roundBodiesMatch(comparableFromSubmission(ascending), storedFrom(reordered))
    ).toBe(false);
  });

  test("N2: a back-nine stored round maps holeNumber - 10 to position", () => {
    expect(positionForHoleNumber(10, "back")).toBe(0);
    expect(positionForHoleNumber(18, "back")).toBe(8);
    expect(positionForHoleNumber(1, null)).toBe(0);
    expect(positionForHoleNumber(18, null)).toBe(17);
    expect(positionForHoleNumber(1, "front")).toBe(0);
  });

  test("N3: the same instant in a different offset is the same round", () => {
    const utc = parse(body({ teeTime: "2026-07-29T14:32:00.000Z" }));
    const oslo = parse(body({ teeTime: "2026-07-29T16:32:00+02:00" }));
    expect(comparableFromSubmission(oslo).teeTime).toBe(
      comparableFromSubmission(utc).teeTime
    );
    expect(roundBodiesMatch(comparableFromSubmission(oslo), storedFrom(utc))).toBe(
      true
    );
  });

  test("N3 applies NO truncation — a different minute is a different round", () => {
    const a = parse(body({ teeTime: "2026-07-29T14:32:00.000Z" }));
    const b = parse(body({ teeTime: "2026-07-29T14:33:00.000Z" }));
    expect(roundBodiesMatch(comparableFromSubmission(a), storedFrom(b))).toBe(
      false
    );
  });

  test("a changed stroke is a conflict", () => {
    const original = parse(body());
    const changed = parse(
      body({
        scores: original.scores.map((s, i) =>
          i === 5 ? { ...s, strokes: 9 } : { ...s }
        ),
      })
    );
    expect(
      roundBodiesMatch(comparableFromSubmission(original), storedFrom(changed))
    ).toBe(false);
  });

  test("notes IS compared — §2 keeps post-hoc divergence a genuine conflict", () => {
    const withNote = parse(body({ notes: "windy" }));
    const withoutNote = parse(body());
    expect(
      roundBodiesMatch(
        comparableFromSubmission(withNote),
        storedFrom(withoutNote)
      )
    ).toBe(false);
  });

  test("an asserted teeId must match the stored one", () => {
    const submitted = comparableFromSubmission(parse(body()));
    const stored = { ...submitted, teeId: 43 };
    expect(roundBodiesMatch(submitted, stored)).toBe(false);
  });

  test("a client-side TEMP tee id asserts nothing and falls back to (name, gender)", () => {
    // `useTeeManagement.generateTempId` produces negatives — not DB refs.
    const submitted = comparableFromSubmission(
      parse(body({ teePlayed: tee({ id: -1 }) }))
    );
    expect(submitted.teeId).toBeNull();
    expect(roundBodiesMatch(submitted, { ...submitted, teeId: 99 })).toBe(true);
    expect(
      roundBodiesMatch(submitted, {
        ...submitted,
        teeId: 99,
        teeName: "Yellow",
      })
    ).toBe(false);
  });

  test("a missing score position fails the match rather than replaying blindly", () => {
    const submitted = comparableFromSubmission(parse(body()));
    const holed: V1RoundComparable = {
      ...submitted,
      scores: submitted.scores.map((entry, index) =>
        index === 4 ? (undefined as never) : entry
      ),
    };
    expect(roundBodiesMatch(submitted, holed)).toBe(false);
  });
});
