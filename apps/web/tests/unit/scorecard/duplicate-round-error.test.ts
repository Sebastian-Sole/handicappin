/**
 * Unit tests for the 23505 → DuplicateRoundError mapping (subplan 003).
 *
 * The natural-key constraint is exercised end-to-end through the tRPC caller
 * in `tests/integration/round-natural-key-quarantine.test.ts`. The externalId
 * constraint is NOT reachable through any live write path until subplan 005
 * starts writing `externalId`, so its mapping (and the passthrough rules) are
 * locked in here at the unit level.
 */
import { describe, it, expect } from "vitest";

import {
  DuplicateRoundError,
  mapRoundInsertError,
} from "@/server/services/scorecard";

/** Shape drizzle produces: a wrapper error with the PostgresError as cause. */
function wrappedPgError(code: string, constraint?: string): Error {
  const pg = Object.assign(new Error("db error"), {
    code,
    constraint_name: constraint,
  });
  return new Error("Failed query: insert into round ...", { cause: pg });
}

describe("mapRoundInsertError", () => {
  it("maps a natural-key 23505 to DuplicateRoundError('natural-key') with user-facing copy", () => {
    const mapped = mapRoundInsertError(
      wrappedPgError("23505", "round_userId_teeId_teeTime_nineHoleSection_key")
    );
    expect(mapped).toBeInstanceOf(DuplicateRoundError);
    expect((mapped as DuplicateRoundError).key).toBe("natural-key");
    expect((mapped as Error).message).toBe(
      "This round has already been submitted. A round with the same course, tee, and tee time already exists."
    );
    expect((mapped as Error).message).not.toContain("round_userId");
  });

  it("maps an externalId 23505 to DuplicateRoundError('external-id') with user-facing copy", () => {
    const mapped = mapRoundInsertError(
      wrappedPgError("23505", "round_userId_externalId_key")
    );
    expect(mapped).toBeInstanceOf(DuplicateRoundError);
    expect((mapped as DuplicateRoundError).key).toBe("external-id");
    expect((mapped as Error).message).toBe(
      "This round has already been submitted. A round with the same submission reference already exists."
    );
    expect((mapped as Error).message).not.toContain("externalId_key");
  });

  it("unwraps the code even when the PostgresError is the top-level error", () => {
    const bare = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint_name: "round_userId_externalId_key",
    });
    const mapped = mapRoundInsertError(bare);
    expect(mapped).toBeInstanceOf(DuplicateRoundError);
  });

  it("passes through a 23505 on an unrelated constraint untouched", () => {
    const original = wrappedPgError("23505", "some_other_unique_key");
    expect(mapRoundInsertError(original)).toBe(original);
  });

  it("passes through non-unique-violation errors untouched", () => {
    const original = wrappedPgError("23503", "round_courseId_fkey");
    expect(mapRoundInsertError(original)).toBe(original);
    const plain = new Error("network down");
    expect(mapRoundInsertError(plain)).toBe(plain);
  });
});
