/**
 * `GET /v1/rounds`'s query contract.
 *
 * `007-w6-fitbull-integration-notes.md` §10.3 leaves this route's filtering,
 * ordering and pagination undecided; T13.3 decides them, and §4 makes the
 * decision one-way — adding a parameter later is non-breaking, narrowing or
 * removing one is a `/v2`. These tests are therefore the frozen record of
 * what was chosen, not just a parser check.
 */
import { describe, expect, test } from "vitest";

import { zodIssuesToFieldErrors } from "@/lib/api/problem-mapper";
import {
  V1_ROUNDS_DEFAULT_LIMIT,
  V1_ROUNDS_MAX_LIMIT,
  readV1RoundsQuery,
  v1RoundsQuerySchema,
} from "@/app/api/v1/rounds/list-rounds";

function parse(queryString: string) {
  return v1RoundsQuerySchema.safeParse(
    readV1RoundsQuery(new URL(`https://api.handicappin.com/api/v1/rounds${queryString}`))
  );
}

function paths(queryString: string): string[] {
  const result = parse(queryString);
  if (result.success) throw new Error("expected a parse failure");
  return zodIssuesToFieldErrors(result.error).map((issue) => issue.path);
}

describe("defaults", () => {
  test("no query string → 50 rounds from offset 0, unfiltered", () => {
    const result = parse("");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      limit: V1_ROUNDS_DEFAULT_LIMIT,
      offset: 0,
      externalId: undefined,
    });
  });

  test("the frozen numbers are 50 and 100", () => {
    // Documented so a change reads as the contract decision it would be:
    // raising the max is free, lowering it is a /v2.
    expect(V1_ROUNDS_DEFAULT_LIMIT).toBe(50);
    expect(V1_ROUNDS_MAX_LIMIT).toBe(100);
  });
});

describe("limit", () => {
  test("accepts 1 through the maximum", () => {
    // Bind ONCE and narrow that binding: `parse(…).success && parse(…).data`
    // calls the parser twice, so `.success` narrows the first result while
    // `.data` is read off a second, unnarrowed one — TS2532 under `strict`.
    const atMin = parse("?limit=1");
    expect(atMin.success && atMin.data.limit).toBe(1);
    const atMax = parse(`?limit=${V1_ROUNDS_MAX_LIMIT}`);
    expect(atMax.success && atMax.data.limit).toBe(V1_ROUNDS_MAX_LIMIT);
  });

  test("rejects 0, the maximum + 1, negatives, decimals and words", () => {
    for (const value of ["0", String(V1_ROUNDS_MAX_LIMIT + 1), "-1", "1.5", "ten", ""]) {
      expect(parse(`?limit=${value}`).success).toBe(false);
    }
  });

  test("the field-level error names the parameter", () => {
    expect(paths("?limit=0")).toEqual(["limit"]);
  });
});

describe("offset", () => {
  test("accepts 0 and large values", () => {
    const zero = parse("?offset=0");
    expect(zero.success && zero.data.offset).toBe(0);
    const deep = parse("?offset=100000");
    expect(deep.success && deep.data.offset).toBe(100000);
  });

  test("rejects negatives and non-integers", () => {
    expect(parse("?offset=-1").success).toBe(false);
    expect(parse("?offset=1e3").success).toBe(false);
  });
});

describe("externalId — the reconciliation filter (§10.3)", () => {
  test("accepts an opaque key", () => {
    const result = parse("?externalId=fitbull-9c3");
    expect(result.success && result.data.externalId).toBe("fitbull-9c3");
  });

  test("is NOT length-bounded — a read filter stricter than the write path would make a stored round unqueryable", () => {
    const long = "x".repeat(2048);
    const result = parse(`?externalId=${long}`);
    expect(result.success && result.data.externalId).toBe(long);
  });

  test("rejects an empty value", () => {
    expect(parse("?externalId=").success).toBe(false);
  });
});

describe("repeated parameters", () => {
  test("a parameter sent twice is rejected rather than silently resolved", () => {
    expect(parse("?limit=10&limit=20").success).toBe(false);
    expect(parse("?offset=0&offset=5").success).toBe(false);
    expect(parse("?externalId=a&externalId=b").success).toBe(false);
  });

  test("the error names the repeated parameter", () => {
    expect(paths("?externalId=a&externalId=b")).toEqual(["externalId"]);
  });
});

describe("unknown parameters", () => {
  test("are ignored, not rejected", () => {
    // Deliberate: a hard failure on an unrecognized parameter is brittle for
    // a server-to-server client, and the failure mode of ignoring is benign
    // — a mistyped filter returns a superset, and every entry carries
    // `externalId` so the client can still reconcile.
    const result = parse("?external_id=typo&order=asc&utm_source=x&limit=5");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      limit: 5,
      offset: 0,
      externalId: undefined,
    });
  });
});

describe("readV1RoundsQuery", () => {
  test("surfaces duplicates instead of collapsing them", () => {
    expect(
      readV1RoundsQuery(
        new URL("https://api.handicappin.com/api/v1/rounds?limit=1&limit=2")
      )
    ).toEqual({ externalId: [], limit: ["1", "2"], offset: [] });
  });
});
