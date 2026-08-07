/** Unit tests — lib/parse-db-timestamp.ts (naive DB timestamp → UTC instant). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseDbTimestamp } from "../../lib/parse-db-timestamp";

const osloClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const osloDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

describe("parseDbTimestamp", () => {
  it("parses a zone-less PostgREST timestamp as UTC (Norwegian summer)", () => {
    const parsed = parseDbTimestamp("2026-07-15T21:30:00");
    assert.equal(parsed.toISOString(), "2026-07-15T21:30:00.000Z");
    assert.equal(osloClock.format(parsed), "23:30");
    assert.equal(osloDate.format(parsed), "15/07/2026");
  });

  it("does not shift a late-evening round onto the previous date", () => {
    const parsed = parseDbTimestamp("2026-07-15T22:30:00");
    assert.equal(osloDate.format(parsed), "16/07/2026");
    assert.equal(osloClock.format(parsed), "00:30");
  });

  it("passes through values that already carry Z or an offset", () => {
    assert.equal(
      parseDbTimestamp("2026-07-15T21:30:00.000Z").toISOString(),
      "2026-07-15T21:30:00.000Z",
    );
    assert.equal(
      parseDbTimestamp("2026-07-15T23:30:00+02:00").getTime(),
      Date.UTC(2026, 6, 15, 21, 30, 0),
    );
  });

  it("returns null for null and undefined", () => {
    assert.equal(parseDbTimestamp(null), null);
    assert.equal(parseDbTimestamp(undefined), null);
  });
});
