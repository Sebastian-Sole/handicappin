/**
 * THE `/v1` round resource serializer — one shape, three response bodies.
 *
 * Contract `005-phase0-contract.md` §5 (FROZEN) requires that the `201` from
 * `POST /v1/rounds`, the `200` replay of that POST (§2 rule 2) and every entry
 * in `GET /v1/rounds` are **the identical shape**. The only way three call
 * sites stay identical under maintenance is if there is exactly one function,
 * so this module is that function and the route handlers own no field mapping
 * of their own.
 *
 * ── How the three consumers reuse it ──────────────────────────────────────
 *
 *   GET  /v1/rounds  (T13.3, shipped)  — reads PostgREST rows through an
 *     RLS-scoped client, so its rows arrive in the snake_case column naming
 *     the generated Supabase types use. It calls
 *     `serializeV1Round(v1RoundSourceFromTableRow(row))`.
 *
 *   POST /v1/rounds  (T13.4)           — `submitScorecard` returns **the
 *     inserted `round` row ITSELF** (`server/services/scorecard/
 *     submit-scorecard.ts`, `return newRound.round`), not a wrapper object.
 *     It is a **Drizzle** row whose property names are already this module's
 *     camelCase `V1RoundSource` and whose timestamps are `Date`s, so it is
 *     structurally assignable and T13.4 writes:
 *
 *       const round = await submitScorecard(deps, parsed);
 *       return jsonResponse(serializeV1Round(round), 201);
 *
 *     …and the 200 replay path serializes the row its replay lookup found the
 *     same way. No adapter, no cast, no second field list.
 *
 *     An earlier revision of this comment said `submitScorecard` returns
 *     `{ round: insertedRound, … }` and prescribed
 *     `const { round } = await submitScorecard(…)`. That was wrong and does
 *     not compile — `newRound` is the service's internal wrapper and is
 *     unwrapped before returning. Corrected here because this paragraph is
 *     the instruction the next route author follows.
 *
 * `V1RoundSource` is deliberately a STRUCTURAL interface rather than an
 * import of either row type: it accepts `Date | string` timestamps and
 * `number | string` numerics, which is what lets one function take a Drizzle
 * row and a PostgREST row without either producer being coupled to it.
 *
 * ── What is deliberately NOT in the resource ──────────────────────────────
 * §4 makes **adding** a response field non-breaking and **removing** one a
 * `/v2`, so every field below is a permanent commitment and the omissions are
 * cheap to reverse. Omitted on purpose:
 *
 *   - **`scores` (per-hole detail).** §5 requires "the stored round (id, echo
 *     of client fields), server-derived values, handicapIndex,
 *     handicapRevision, status" — a minimum, not a maximum. Including the
 *     per-hole array would force `GET /v1/rounds` to join `score` for every
 *     row in the page (the list exists for write reconciliation, not
 *     display), and it can be added to all three bodies later in this one
 *     module without breaking anyone. Adding it now and discovering the join
 *     cost later could not be undone.
 *   - **`approvalStatus`** (course-data moderation) and **`submittedVia`**
 *     (analytics attribution) — internal axes the contract never names.
 *     `status` is the one round-state axis §5 froze, and it is about
 *     quarantine.
 *   - **`quarantined`** itself — §5 rejects a raw boolean explicitly: the
 *     enum keeps the axis extensible and keeps the DB column name out of the
 *     contract.
 *   - **`userId`** — every round in every one of these bodies belongs to the
 *     authenticated principal by construction.
 *   - **`existingHandicapIndex`** and **`exceptionalScoreAdjustment`** —
 *     derived values with no stated consumer. Additive later.
 */

/** §5: `"active" | "quarantined"`, EXTENSIBLE — unknown means "not active". */
export type V1RoundStatus = "active" | "quarantined";

/** §5: `"pending" | "current" | "failed"`, EXTENSIBLE — unknown means "not current". */
export type V1HandicapRevision = "pending" | "current" | "failed";

/**
 * The only `handicapRevision` this build can HONESTLY emit — and the reason.
 *
 * §5 reserves three values but explicitly leaves **detection and storage** of
 * `current` / `failed` to 006 ("The contract reserves the value; 006 wires
 * it"). This module does not invent a detection mechanism, so it emits
 * `"pending"` unconditionally. That is not a placeholder — it is the only
 * claim the data supports:
 *
 *   - There is **no per-round marker**. `round` carries no recomputation
 *     column; `process-handicap-queue` rewrites `updatedHandicapIndex` on
 *     every affected round and leaves nothing behind that says it ran.
 *   - The one real signal — `handicap_calculation_queue.status`
 *     (`'pending' | 'failed'`) — is **per USER, not per round**, and is
 *     unreadable by either `/v1` principal class:
 *     `20260502095010_lock_handicap_queue.sql` enables RLS with no policies
 *     AND revokes all privileges from `authenticated`/`anon`. An RLS-scoped
 *     `/v1` read cannot see it, by design.
 *   - Comparing this round's `updatedHandicapIndex` against the profile's
 *     current index WOULD be a detection mechanism — an invented one, with
 *     false "current" readings whenever a later round leaves the index
 *     numerically unchanged. Exactly what §5 reserves for 006.
 *
 * `"pending"` is also the safe direction under the extensible-enum rule:
 * §5's own prose tells clients that anything other than `"current"` means the
 * index is not authoritative, so emitting `"pending"` never asserts more than
 * we know. Emitting `"current"` on a guess would tell a client a stale index
 * is final.
 *
 * **006's job when it lands:** change this one constant into a derivation and
 * all three response bodies move together.
 */
export const V1_HANDICAP_REVISION_PENDING: V1HandicapRevision = "pending";

/**
 * The frozen `/v1` round resource. Field-by-field, this is what T13.4's 201
 * body, its 200 replay body, and each `GET /v1/rounds` entry contain.
 */
export interface V1RoundResource {
  /** Server-assigned round id. Stable, the resource's identity. */
  id: number;
  /** The client-supplied idempotency key (§2), or null if none was sent. */
  externalId: string | null;
  /**
   * §5. `"quarantined"` = stored but excluded from the handicap and from the
   * free-tier count until the account upgrades. EXTENSIBLE: treat an
   * unrecognized value as "not active".
   */
  status: V1RoundStatus;
  /**
   * The handicap index as of this round — **provisional** (§5). The
   * authoritative recomputation runs asynchronously after the write commits.
   */
  handicapIndex: number;
  /** §5. EXTENSIBLE: treat an unrecognized value as "not current". */
  handicapRevision: V1HandicapRevision;

  // ── echo of client-supplied fields ──────────────────────────────────────
  courseId: number;
  teeId: number;
  /** ISO-8601 UTC instant (`…Z`). See `toUtcIsoString` for why this matters. */
  teeTime: string;
  /** `"front" | "back"` for a 9-hole round; null for 18 holes. */
  nineHoleSection: "front" | "back" | null;
  notes: string | null;

  // ── server-derived values ───────────────────────────────────────────────
  holesPlayed: number;
  totalStrokes: number;
  parPlayed: number;
  adjustedGrossScore: number;
  adjustedPlayedScore: number;
  courseHandicap: number;
  scoreDifferential: number;
  /** Course rating LOCKED AT PLAY TIME — may differ from the tee's today. */
  courseRating: number;
  /** Slope rating locked at play time. Same caveat. */
  slopeRating: number;

  // ── server metadata ─────────────────────────────────────────────────────
  /** ISO-8601 UTC instant. */
  createdAt: string;
  /** ISO-8601 UTC instant. */
  updatedAt: string;
}

/**
 * What the serializer accepts — the intersection of a Drizzle `round` row and
 * a PostgREST `round` row, widened where the two disagree about JS types.
 *
 * Timestamps: Drizzle hands back `Date`; PostgREST hands back a string.
 * Numerics: both currently hand back `number`, but `numeric` columns are the
 * classic place a driver starts returning strings, and a silent `NaN` in a
 * handicap field is worse than a tolerant parse.
 */
export interface V1RoundSource {
  id: number;
  externalId: string | null;
  quarantined: boolean;
  courseId: number;
  teeId: number;
  teeTime: Date | string;
  nineHoleSection: string | null;
  notes: string | null;
  holesPlayed: number;
  totalStrokes: number;
  parPlayed: number;
  adjustedGrossScore: number;
  adjustedPlayedScore: number;
  courseHandicap: number;
  scoreDifferential: number | string;
  updatedHandicapIndex: number | string;
  courseRatingUsed: number | string;
  slopeRatingUsed: number | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * A `round` row as PostgREST names it — the five columns added after the
 * table's camelCase era are snake_case in the database and therefore in the
 * generated Supabase types.
 *
 * Declared structurally so this module imports nothing from
 * `@/types/supabase`; a `Tables<"round">` satisfies it and may carry extra
 * properties.
 */
export interface V1RoundTableRow {
  id: number;
  externalId: string | null;
  quarantined: boolean;
  courseId: number;
  teeId: number;
  teeTime: string;
  nine_hole_section: string | null;
  notes: string | null;
  holes_played: number;
  totalStrokes: number;
  parPlayed: number;
  adjustedGrossScore: number;
  adjustedPlayedScore: number;
  courseHandicap: number;
  scoreDifferential: number | string;
  updatedHandicapIndex: number | string;
  course_rating_used: number | string;
  slope_rating_used: number | string;
  createdAt: string;
  updated_at: string;
}

/** PostgREST row → the serializer's input. Pure renaming, no coercion. */
export function v1RoundSourceFromTableRow(row: V1RoundTableRow): V1RoundSource {
  return {
    id: row.id,
    externalId: row.externalId,
    quarantined: row.quarantined,
    courseId: row.courseId,
    teeId: row.teeId,
    teeTime: row.teeTime,
    nineHoleSection: row.nine_hole_section,
    notes: row.notes,
    holesPlayed: row.holes_played,
    totalStrokes: row.totalStrokes,
    parPlayed: row.parPlayed,
    adjustedGrossScore: row.adjustedGrossScore,
    adjustedPlayedScore: row.adjustedPlayedScore,
    courseHandicap: row.courseHandicap,
    scoreDifferential: row.scoreDifferential,
    updatedHandicapIndex: row.updatedHandicapIndex,
    courseRatingUsed: row.course_rating_used,
    slopeRatingUsed: row.slope_rating_used,
    createdAt: row.createdAt,
    updatedAt: row.updated_at,
  };
}

/** Matches a trailing `Z` or a `±HH:MM` / `±HHMM` UTC offset. */
const HAS_TIMEZONE_DESIGNATOR = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Canonicalize a timestamp to an ISO-8601 **UTC instant**.
 *
 * The subtle half: `round.teeTime` and `round.createdAt` are `timestamp`
 * **without** time zone. Contract §2 (N3) pins what that means — the column
 * holds the *UTC rendering* of the instant, because Drizzle writes
 * `value.toISOString()` and Postgres discards the trailing `Z` on insert into
 * a naive column. PostgREST then reads it back as `"2026-08-07T10:00:00"`,
 * with **no zone designator**, and `new Date()` on an ISO date-time without
 * an offset is defined to be **local time**. Parsing it naively would shift
 * every `teeTime` by the server's UTC offset — silently correct in CI (UTC)
 * and silently wrong in Oslo, on the field the natural-key constraint and
 * §2's replay comparison both key on.
 *
 * So: a string with no designator is read as UTC. Drizzle's `Date` and
 * PostgREST's `timestamptz` (which does carry an offset) need no such help.
 */
export function toUtcIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const trimmed = value.trim();
  // PostgREST uses `T`; a raw libpq/psql rendering uses a space. Normalize so
  // the designator test and `Date.parse` see the same ISO form either way.
  const isoish = trimmed.replace(" ", "T");
  const withZone = HAS_TIMEZONE_DESIGNATOR.test(isoish) ? isoish : `${isoish}Z`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) {
    // Unparseable timestamps are a server-side data fault, not a client
    // error. Throwing routes it through the central mapper to
    // `500 internal_error` + Sentry rather than putting `"Invalid Date"` on
    // the wire as if it were a contract value.
    throw new TypeError(`Unparseable round timestamp: ${value}`);
  }
  return parsed.toISOString();
}

/** `numeric` columns may arrive as strings; a NaN must never reach the wire. */
function toNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Unparseable round numeric: ${String(value)}`);
  }
  return parsed;
}

/**
 * §5 derives `status` from the `quarantined` column — and from nothing else.
 *
 * The mapping is total and one-way: `true → "quarantined"`, `false →
 * "active"`. Note what this is NOT: `approvalStatus` (course-data moderation)
 * is a separate axis and never contributes, so a round awaiting course
 * approval still reports `"active"`.
 *
 * Quarantined rounds are NOT hidden. D4 and `server/api/routers/round.ts`'s
 * `getAllByUserId` encode the same rule: a round the API accepted with a 201
 * stays visible, badged rather than suppressed. Hiding it would reintroduce
 * at the read layer the rejection the billing gate refused.
 */
export function v1RoundStatus(quarantined: boolean): V1RoundStatus {
  return quarantined ? "quarantined" : "active";
}

/** Narrow the free-text column to the two values any write path produces. */
function toNineHoleSection(value: string | null): "front" | "back" | null {
  return value === "front" || value === "back" ? value : null;
}

/**
 * Round row → the frozen `/v1` round resource.
 *
 * The single mapping. Change a field here and the 201, the 200 replay and the
 * list entry all change together — which is the contract requirement, stated
 * as a code property instead of a review checklist.
 */
export function serializeV1Round(source: V1RoundSource): V1RoundResource {
  return {
    id: source.id,
    externalId: source.externalId,
    status: v1RoundStatus(source.quarantined),
    // `updatedHandicapIndex` is the index AS OF this round — the provisional
    // value §5 promises. `existingHandicapIndex` (the index before it) is
    // deliberately not exposed.
    handicapIndex: toNumber(source.updatedHandicapIndex),
    handicapRevision: V1_HANDICAP_REVISION_PENDING,

    courseId: source.courseId,
    teeId: source.teeId,
    teeTime: toUtcIsoString(source.teeTime),
    nineHoleSection: toNineHoleSection(source.nineHoleSection),
    notes: source.notes,

    holesPlayed: source.holesPlayed,
    totalStrokes: source.totalStrokes,
    parPlayed: source.parPlayed,
    adjustedGrossScore: source.adjustedGrossScore,
    adjustedPlayedScore: source.adjustedPlayedScore,
    courseHandicap: source.courseHandicap,
    scoreDifferential: toNumber(source.scoreDifferential),
    courseRating: toNumber(source.courseRatingUsed),
    slopeRating: toNumber(source.slopeRatingUsed),

    createdAt: toUtcIsoString(source.createdAt),
    updatedAt: toUtcIsoString(source.updatedAt),
  };
}
