/**
 * The two lookups and the body comparison that contract §2 (FROZEN) builds
 * `POST /v1/rounds`'s idempotency on. The decision PROCEDURE lives in
 * `./create-round`; this module is its vocabulary.
 *
 * ── The one rule that governs everything here ─────────────────────────────
 * **Which §2 rule fires is decided by a LOOKUP, never by the constraint
 * name.** When a submission violates BOTH keys at once — same
 * `(userId, externalId)` AND same `(userId, teeId, teeTime,
 * nine_hole_section)`, which is precisely the shape of an ordinary duplicate
 * submit — Postgres reports ONE constraint, and which one depends on index
 * OID order (the natural key is created first in `20260730120000`, so it wins
 * today; reversing the two `ALTER TABLE`s would flip it). Branching on
 * `DuplicateRoundError.key` would make a legitimate identical retry return
 * `409 duplicate_round` instead of the 200 replay.
 *
 * ── Two lookups, at two different times ───────────────────────────────────
 *   1. `findRoundByExternalId` — PRE-insert (§2 step 1), and again
 *      post-rollback on any unique violation (§2 step 3, rule 6's race).
 *   2. `findRoundIdByNaturalKey` — POST-rollback only, and only when (1)
 *      still finds nothing. It produces the `existingRoundId` that
 *      `duplicate_round` carries, because `DuplicateRoundError` carries only
 *      `key: "natural-key" | "external-id"` and never a round id.
 *
 * Both run on the app's Drizzle handle, which connects as the table owner and
 * is therefore **NOT subject to RLS**. Every predicate here is scoped
 * `eq(round.userId, userId)` and that scoping is the ONLY control keeping one
 * account's rounds out of another's replay — unlike the read route, where RLS
 * holds the same line independently. Removing it turns a guessed `externalId`
 * into a cross-user data disclosure through the 200 replay body.
 *
 * ── Ordering: the lookups must run on a CLEAN transaction ─────────────────
 * §2: inside an aborted transaction every subsequent statement raises
 * `25P02 in_failed_sql_transaction`. `submitScorecard` wraps its insert in
 * `db.transaction(...)`, and postgres-js issues the `ROLLBACK` and releases
 * the connection as the promise rejects — so by the time the handler catches
 * `DuplicateRoundError`, the failed transaction is already closed and these
 * queries run on a clean one. The both-keys integration test is what pins
 * that: a leaked `25P02` would surface as a 500 instead of the 409/200.
 */

import { and, eq, isNull, sql } from "drizzle-orm";

import { hole, round, score, teeInfo } from "@/db/schema";
import type { ScorecardDb } from "@/server/services/scorecard/submit-scorecard";
import { toUtcIsoString } from "@/app/api/v1/_lib/serializers/round";
import type { V1RoundSubmission } from "@/app/api/v1/rounds/submission-schema";

/** A stored `round` row — structurally a `V1RoundSource` for the serializer. */
export type StoredRound = typeof round.$inferSelect;

/**
 * §2's "identical body", as a comparable value.
 *
 * COMPARED (every client-controlled field that determines the stored round):
 * `teeId`, `teeTime`, `nineHoleSection` (absent ≡ 18-hole), `notes`, and per
 * hole `strokes`, `putts`, `penaltyStrokes`, `fairwayHit`.
 *
 * EXCLUDED: server-derived fields (`hcpStrokes`, `approvalStatus`, any
 * handicap output), server metadata (`id`, `createdAt`, `updated_at`,
 * `quarantined`, `submitted_via`) and `externalId` itself.
 */
export interface V1RoundComparable {
  /**
   * The tee the client ASSERTED by id, or null when it named one instead.
   * See `roundBodiesMatch` for why both forms exist.
   */
  teeId: number | null;
  /** The identity `submitScorecard` resolves a tee on: (name, gender). */
  teeName: string;
  teeGender: string;
  /** N3: the UTC instant, the same value the natural key compares. */
  teeTime: string;
  nineHoleSection: "front" | "back" | null;
  notes: string | null;
  /** N2: index = submission position, 0-based, ORDER-SENSITIVE. */
  scores: V1ScoreComparable[];
}

export interface V1ScoreComparable {
  strokes: number;
  putts: number | null;
  penaltyStrokes: number | null;
  fairwayHit: boolean | null;
}

/** N1: absent ≡ null ≡ "not tracked", for every optional per-hole field. */
function nullish<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

/**
 * N3. `round.teeTime` is `timestamp` WITHOUT time zone and the column holds
 * the UTC rendering of the instant, so `2026-07-29T16:32:00+02:00` and
 * `2026-07-29T14:32:00Z` are one round to the unique constraint AND to this
 * comparison — they cannot disagree about what a duplicate is.
 *
 * No truncation: `003-notes.md`'s "minute-precision wall clock" describes
 * what web/native clients already emit, not a server-side rounding step.
 * Truncating here but not in the constraint would make the comparison call
 * distinct rows identical and replay the wrong round.
 */
export function canonicalTeeTime(value: Date | string): string {
  return toUtcIsoString(value);
}

/** The parsed submission, projected onto the comparable. */
export function comparableFromSubmission(
  submission: V1RoundSubmission
): V1RoundComparable {
  const assertedTeeId = submission.teePlayed.id;
  return {
    // A non-positive id is a CLIENT-SIDE TEMP id (`useTeeManagement`
    // generates negatives) and an absent one asserts nothing at all, so
    // neither is a tee identity claim.
    teeId:
      typeof assertedTeeId === "number" && assertedTeeId > 0
        ? assertedTeeId
        : null,
    teeName: submission.teePlayed.name,
    teeGender: submission.teePlayed.gender,
    teeTime: canonicalTeeTime(submission.teeTime),
    nineHoleSection:
      submission.scores.length === 9
        ? (submission.nineHoleSection ?? null)
        : null,
    notes: nullish(submission.notes),
    scores: submission.scores.map((entry) => ({
      strokes: entry.strokes,
      putts: nullish(entry.putts),
      penaltyStrokes: nullish(entry.penaltyStrokes),
      fairwayHit: nullish(entry.fairwayHit),
    })),
  };
}

/**
 * N2. Hole identity is by SUBMISSION POSITION, and the projection recovers it
 * from the stored row's course hole number: `holeNumber - 1` for 18-hole and
 * 9-hole front, `holeNumber - 10` for 9-hole back (stored hole numbers 10–18
 * → positions 0–8). Comparison is positional and order-sensitive — the
 * submitted array's order IS the hole assignment, so a reordered array is a
 * different round, not a retry.
 */
export function positionForHoleNumber(
  holeNumber: number,
  nineHoleSection: string | null
): number {
  return nineHoleSection === "back" ? holeNumber - 10 : holeNumber - 1;
}

/**
 * Re-derive a stored round's projection: a field-by-field comparison against
 * live state, not a stored fingerprint (003's migration deliberately has no
 * fingerprint column — rounds are re-derivable by GET, which is exactly why
 * the panel preferred replay-by-lookup over Stripe-style response snapshots).
 */
export async function comparableFromStoredRound(
  db: ScorecardDb,
  stored: StoredRound
): Promise<V1RoundComparable> {
  const [tee] = await db
    .select({ name: teeInfo.name, gender: teeInfo.gender })
    .from(teeInfo)
    .where(eq(teeInfo.id, stored.teeId))
    .limit(1);

  const rows = await db
    .select({
      holeNumber: hole.holeNumber,
      strokes: score.strokes,
      putts: score.putts,
      penaltyStrokes: score.penaltyStrokes,
      fairwayHit: score.fairwayHit,
    })
    .from(score)
    .innerJoin(hole, eq(hole.id, score.holeId))
    .where(eq(score.roundId, stored.id));

  const byPosition: V1ScoreComparable[] = [];
  for (const row of rows) {
    const position = positionForHoleNumber(
      row.holeNumber,
      stored.nineHoleSection
    );
    byPosition[position] = {
      strokes: row.strokes,
      putts: nullish(row.putts),
      penaltyStrokes: nullish(row.penaltyStrokes),
      fairwayHit: nullish(row.fairwayHit),
    };
  }

  return {
    teeId: stored.teeId,
    teeName: tee?.name ?? "",
    teeGender: tee?.gender ?? "",
    teeTime: canonicalTeeTime(stored.teeTime),
    nineHoleSection:
      stored.nineHoleSection === "front" || stored.nineHoleSection === "back"
        ? stored.nineHoleSection
        : null,
    notes: nullish(stored.notes),
    // A hole a position could not be recovered for leaves a HOLE in the array
    // (literally). `Array.from` materializes those as `undefined` rather than
    // letting `.every` skip them, so a corrupt projection fails the match and
    // yields a 409 — never a false 200 replay of a round we cannot read.
    scores: Array.from(byPosition),
  };
}

function scoresMatch(
  left: readonly V1ScoreComparable[],
  right: readonly V1ScoreComparable[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const other = right[index];
    return (
      entry !== undefined &&
      other !== undefined &&
      entry.strokes === other.strokes &&
      entry.putts === other.putts &&
      entry.penaltyStrokes === other.penaltyStrokes &&
      entry.fairwayHit === other.fairwayHit
    );
  });
}

/**
 * §2's identical-body test. Any mismatch in any compared field → rule 3
 * (`409 idempotency_conflict`).
 *
 * **The tee comparison, and the ambiguity it resolves.** §2 lists `teeId` as
 * a compared field, but the shared submission schema has no `teeId` — it has
 * `teePlayed`, whose `id` is OPTIONAL, because the same schema also carries
 * brand-new and edited tees that do not exist yet. So:
 *
 *   - the client asserted a real tee id → compare it against `round.teeId`,
 *     which is §2's rule verbatim and the only path fitbull takes (it
 *     resolves tees through `GET /v1/tees` first);
 *   - the client named a tee instead → compare `(name, gender)`, which is the
 *     identity `submitScorecard`'s own tee resolution keys on. Wildcarding
 *     the field instead would replay a DIFFERENT round back at a client that
 *     believed it stored a new one, which is the data loss §2 refuses.
 */
export function roundBodiesMatch(
  submitted: V1RoundComparable,
  stored: V1RoundComparable
): boolean {
  const teeMatches =
    submitted.teeId !== null
      ? submitted.teeId === stored.teeId
      : submitted.teeName === stored.teeName &&
        submitted.teeGender === stored.teeGender;

  return (
    teeMatches &&
    submitted.teeTime === stored.teeTime &&
    submitted.nineHoleSection === stored.nineHoleSection &&
    submitted.notes === stored.notes &&
    scoresMatch(submitted.scores, stored.scores)
  );
}

/**
 * §2 step 1 — THE REPLAY LOOKUP. `SELECT … WHERE "userId" = $1 AND
 * "externalId" = $2`.
 *
 * `eq(round.userId, userId)` is load-bearing: this handle bypasses RLS, and a
 * matched row is returned to the caller as a 200 replay BODY. Without the
 * predicate, guessing another account's `externalId` reads their round.
 */
export async function findRoundByExternalId(
  db: ScorecardDb,
  userId: string,
  externalId: string
): Promise<StoredRound | null> {
  const [row] = await db
    .select()
    .from(round)
    .where(and(eq(round.userId, userId), eq(round.externalId, externalId)))
    .limit(1);
  return row ?? null;
}

/**
 * §2 rules 4/5 — THE NATURAL-KEY LOOKUP, producing `existingRoundId`.
 *
 * `IS NOT DISTINCT FROM` on `nine_hole_section` is not a style choice: the
 * constraint is `UNIQUE NULLS NOT DISTINCT`, an 18-hole round stores NULL
 * there, and a plain `= NULL` is never true — so `eq()` would silently find
 * nothing and DEGRADE the 409 into a 500 for every 18-hole duplicate. It
 * still discriminates front from back.
 */
export async function findRoundIdByNaturalKey(
  db: ScorecardDb,
  userId: string,
  teeId: number,
  teeTime: Date,
  nineHoleSection: "front" | "back" | null
): Promise<number | null> {
  const [row] = await db
    .select({ id: round.id })
    .from(round)
    .where(
      and(
        eq(round.userId, userId),
        eq(round.teeId, teeId),
        eq(round.teeTime, teeTime),
        nineHoleSection === null
          ? isNull(round.nineHoleSection)
          : sql`${round.nineHoleSection} IS NOT DISTINCT FROM ${nineHoleSection}`
      )
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * The natural-key lookup when the client did NOT assert a tee id, so the
 * `teeId` leg of the key is unknown to the handler (the service resolved it).
 *
 * Falls back to `(userId, teeTime, nine_hole_section)`, which the key's own
 * uniqueness makes unambiguous **only when exactly one row matches** — the
 * same user may legitimately hold two rounds at the same instant on different
 * tees. Two or more matches, or none, yields null, and §2's "the violation
 * was not one of these two keys" branch takes over: the error passes through
 * unmapped to `500 internal_error` + Sentry rather than naming a round we are
 * not certain about.
 *
 * **That 500 is REACHABLE — calling it unreachable was wrong.** The path is: a
 * round on tee A at T, a round on tee B at T, then a re-submit on tee A at T
 * with NO asserted `teeId`. Two rows match the fallback key, the lookup returns
 * null, the error is rethrown, and the client gets `500` where `409
 * duplicate_round` is the correct answer. It has been driven end to end.
 *
 * What is actually true is narrower: reaching it needs a client that NAMES tees
 * instead of resolving them through the catalog, and fitbull always sends an
 * id — so no traffic we know of takes this branch today. That is a claim about
 * one consumer's behaviour, not about the mechanism, and it stops holding the
 * moment a second consumer submits by tee name.
 *
 * Left as-is deliberately: the alternative is naming a round we are not
 * certain about on the product's core artifact, which is worse than a 500.
 */
export async function findRoundIdByNaturalKeyWithoutTee(
  db: ScorecardDb,
  userId: string,
  teeTime: Date,
  nineHoleSection: "front" | "back" | null
): Promise<number | null> {
  const rows = await db
    .select({ id: round.id })
    .from(round)
    .where(
      and(
        eq(round.userId, userId),
        eq(round.teeTime, teeTime),
        nineHoleSection === null
          ? isNull(round.nineHoleSection)
          : sql`${round.nineHoleSection} IS NOT DISTINCT FROM ${nineHoleSection}`
      )
    )
    .limit(2);
  return rows.length === 1 ? rows[0]!.id : null;
}
