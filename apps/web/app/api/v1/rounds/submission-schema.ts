/**
 * The `POST /v1/rounds` request schema — `v1ScorecardSchema` plus the two
 * things the shared schema cannot carry.
 *
 * ── The rule this file obeys ──────────────────────────────────────────────
 * `apps/web/types/scorecard-input.ts` is byte-identical to `main` and stays
 * that way. The web and native submit paths consume it, so narrowing it
 * changes behaviour for current users mid-flight; and per contract §4,
 * narrowing validation on an existing field AFTER SHIP is a breaking change
 * requiring `/v2`. Everything here is therefore COMPOSED on top:
 * `_lib/schemas.ts` already layers D5's `teeTime` window with `.superRefine`,
 * and this module intersects that with the two `/v1`-only additions below.
 *
 * ── (1) `externalId` — the idempotency key (§2) ───────────────────────────
 * Optional, client-supplied, opaque. fitbull sends its own round UUID. It is
 * NOT part of the shared scorecard because no first-party path has one, and
 * because a client role cannot set the column through PostgREST at all (003's
 * INSERT grant excludes `externalId`, closing the deterministic-key squat).
 *
 * Format is deliberately barely constrained — §2 leaves it open and
 * `GET /v1/rounds?externalId=` (T13.3) matches on it EXACTLY, so any
 * normalization here (trimming, case-folding) would make a key that
 * round-trips through the write path unfindable through the read path. The
 * only constraints are the two that protect the server: non-empty (an empty
 * key is indistinguishable from "no key" and would make `NULLS DISTINCT`
 * semantics incoherent) and bounded length.
 *
 * ── (2) `teePlayed.holes` is REQUIRED on `/v1` ────────────────────────────
 * The shared schema allows `holes: undefined` (the web form fills them in
 * from course selection). `submitScorecard` throws a plain `Error("Tee played
 * has no holes")` for that input, which the central mapper turns into a
 * **500 `internal_error`** — telling a client its own malformed body was a
 * server fault, and burning a Sentry alert on it. `/v1` refines it to a 422
 * with a field-level code instead.
 *
 * This is not a "tightening" in §4's sense: it is a day-one API-side invariant
 * of v1's initial contract, exactly like the `teeTime` window, and it is
 * enforced at the `/v1` boundary only. The server-side `hcpStrokes` derivation
 * (`./hcp-strokes`) also needs the holes' stroke indices, so without this the
 * derivation would have no input.
 *
 * ── (3) `teeTime` accepts a UTC OFFSET, not only a trailing `Z` ───────────
 * The shared schema's `z.string().datetime()` is zod v4's, whose pattern ends
 * `(?:Z)$` — it rejects `2026-07-29T16:32:00+02:00` outright. That is fine
 * for the web and native forms (both emit `toISOString()`), but it collides
 * head-on with contract §2, which states that
 * `2026-07-29T16:32:00+02:00` and `2026-07-29T14:32:00Z` "are one round to
 * both the constraint and the replay comparison" and makes
 * *retry-of-the-same-instant-with-a-different-timezone-offset* a
 * MERGE-BLOCKING test that must return the 200 replay. Without this,
 * that case can never reach the comparison — it 422s at the schema.
 *
 * So the `/v1` boundary PRE-NORMALIZES an offset-bearing `teeTime` to its UTC
 * rendering before the shared schema sees it. Note the direction: this
 * LOOSENS what `/v1` accepts, which §4 classes as additive and non-breaking,
 * and it still touches nothing in the shared schema. It is a pure change of
 * representation — `new Date(x).toISOString()` is the same instant, and N3
 * canonicalizes to exactly that value anyway.
 */

import { z } from "zod";

import { v1ScorecardSchema } from "@/app/api/v1/_lib";

/** Upper bound on an idempotency key. `round.externalId` is `text`. */
export const V1_EXTERNAL_ID_MAX_LENGTH = 255;

/** Append-only field-level codes (§1) this schema can emit in `errors[]`. */
export const V1_EXTERNAL_ID_FIELD_CODE = "external_id_invalid";
export const V1_TEE_HOLES_FIELD_CODE = "tee_holes_required";

export const v1ExternalIdSchema = z
  .string()
  .min(1, "externalId must not be empty")
  .max(
    V1_EXTERNAL_ID_MAX_LENGTH,
    `externalId must be at most ${V1_EXTERNAL_ID_MAX_LENGTH} characters`
  );

/**
 * An ISO-8601 date-time ending in a `±HH:MM` / `±HHMM` UTC offset — the form
 * zod v4's `.datetime()` rejects and §2 requires `/v1` to accept.
 */
const OFFSET_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?[+-]\d{2}:?\d{2}$/;

/**
 * Rewrite an offset-bearing `teeTime` to its UTC rendering; pass everything
 * else through UNCHANGED so the shared schema's own error still fires for
 * genuinely malformed input. Never invents a zone: a date-time with no
 * designator at all is ambiguous and is left alone to be rejected.
 */
export function canonicalizeTeeTimeOffset(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  const teeTime = record.teeTime;
  if (typeof teeTime !== "string") return value;

  const trimmed = teeTime.trim();
  if (!OFFSET_DATE_TIME.test(trimmed)) return value;

  const parsed = new Date(trimmed.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value;

  return { ...record, teeTime: parsed.toISOString() };
}

/**
 * The `/v1` write body.
 *
 * `.and()` rather than `.extend()` because `v1ScorecardSchema` is a
 * `ZodEffects` (the shared schema's `.superRefine` plus D5's), which has no
 * `.extend`. The intersection parses BOTH sides and merges, so unknown keys
 * are still stripped and issues from both halves land in one `errors[]`.
 */
export const v1RoundSubmissionSchema = z
  .preprocess(
    canonicalizeTeeTimeOffset,
    v1ScorecardSchema.and(
      z.object({
        externalId: v1ExternalIdSchema.optional(),
      })
    )
  )
  .superRefine((value, ctx) => {
    if (!value.teePlayed.holes || value.teePlayed.holes.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["teePlayed", "holes"],
        message:
          "teePlayed.holes is required: all 18 holes with par, hcp and distance",
        params: { v1Code: V1_TEE_HOLES_FIELD_CODE },
      });
    }
  });

export type V1RoundSubmission = z.infer<typeof v1RoundSubmissionSchema>;

/**
 * The submission narrowed to "holes are present".
 *
 * The refinement above guarantees it at runtime but cannot narrow the type —
 * `superRefine` never changes the inferred output. This alias is what the
 * derivation and comparison code takes so neither has to re-assert it.
 */
export type V1RoundSubmissionWithHoles = V1RoundSubmission & {
  teePlayed: V1RoundSubmission["teePlayed"] & {
    holes: NonNullable<V1RoundSubmission["teePlayed"]["holes"]>;
  };
};

/** Runtime narrowing to `V1RoundSubmissionWithHoles`, post-parse. */
export function hasTeeHoles(
  submission: V1RoundSubmission
): submission is V1RoundSubmissionWithHoles {
  return (
    Array.isArray(submission.teePlayed.holes) &&
    submission.teePlayed.holes.length > 0
  );
}
