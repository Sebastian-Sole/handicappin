/**
 * Serialize/deserialize RoundSession for the kv-store. The persistence KEY
 * suffix (.v1) never changes; versioning lives INSIDE the payload as
 * `schemaVersion`, migrated forward through MIGRATIONS on load.
 *
 * Validation here is deliberately STRUCTURAL, not domain-strict: the tee
 * snapshot already passed server validation when it was fetched, and a
 * too-strict decode would destroy a user's in-progress round over a rule
 * tweak. Corrupt or future-version payloads decode to null (caller clears
 * the key) — a documented, acceptable data-loss tradeoff for a single
 * active session.
 */
import { z } from "zod";

import type { RoundSession } from "@/lib/round-session/types";
import { SESSION_SCHEMA_VERSION } from "@/lib/round-session/types";

const geoStampSchema = z
  .object({
    lat: z.number(),
    lon: z.number(),
    accuracyM: z.number().optional(),
    at: z.string(),
  })
  .nullable();

const holeEntrySchema = z.object({
  strokes: z.number().nullable(),
  updatedAt: z.string(),
  location: geoStampSchema.optional(),
  // Hole-out detail (plan 013) — optional so pre-013 payloads decode.
  putts: z.number().nullish(),
  fairwayHit: z.boolean().nullish(),
  penaltyStrokes: z.number().nullish(),
});

/** Loose hole/tee shapes: required keys checked, extra keys passed through. */
const looseHoleSchema = z
  .object({
    holeNumber: z.number(),
    par: z.number(),
    hcp: z.number(),
    distance: z.number(),
  })
  .passthrough();

const looseTeeSchema = z
  .object({
    name: z.string(),
    holes: z.array(looseHoleSchema).optional(),
  })
  .passthrough();

const sessionCourseSchema = z.object({
  id: z.number(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  website: z.string(),
  approvalStatus: z.enum(["approved", "pending"]),
});

const sessionV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  userId: z.string().min(1),
  status: z.enum(["active", "finishing", "submitted"]),
  startedAt: z.string(),
  lastEventAt: z.string(),
  eventSeq: z.number().int().min(0),
  course: sessionCourseSchema,
  tee: looseTeeSchema,
  holeCount: z.literal(9).or(z.literal(18)),
  nineHoleSection: z.enum(["front", "back"]).optional(),
  // Detail tracking flag (plan 013 D3) — optional, pre-013 payloads decode.
  detailed: z.boolean().optional(),
  displayedHoles: z.array(looseHoleSchema),
  currentHoleIndex: z.number().int().min(0),
  entries: z.array(holeEntrySchema),
  notes: z.string(),
});

/** vN → vN+1 payload transforms, run in order on load. Empty at v1. */
const MIGRATIONS: Record<number, (data: unknown) => unknown> = {};

export function encodeSession(session: RoundSession): string {
  return JSON.stringify(session);
}

export function decodeSession(raw: string | null): RoundSession | null {
  if (raw == null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  let version = (data as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number" || version > SESSION_SCHEMA_VERSION) {
    return null;
  }
  while (version < SESSION_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return null;
    data = migrate(data);
    version += 1;
  }

  const parsed = sessionV1Schema.safeParse(data);
  if (!parsed.success) return null;
  const session = parsed.data;
  // Cross-field sanity: entries/displayedHoles must match holeCount, and the
  // cursor must be in range — otherwise the UI would index out of bounds.
  if (
    session.entries.length !== session.holeCount ||
    session.displayedHoles.length !== session.holeCount ||
    session.currentHoleIndex >= session.holeCount ||
    (session.holeCount === 9 && session.nineHoleSection === undefined)
  ) {
    return null;
  }
  return session as RoundSession;
}
