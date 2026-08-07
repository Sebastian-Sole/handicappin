/**
 * `/v1` request schemas — a REFINEMENT LAYER over the shared schemas.
 *
 * ── The rule that governs this whole file ─────────────────────────────────
 * **Do not tighten `@/types/scorecard-input`.** The web and native submit
 * paths consume it, so narrowing it changes behaviour for current users
 * mid-flight (an unrelated risk riding on an API change) — and per contract
 * §4, narrowing validation on an existing field AFTER SHIP is a breaking
 * change requiring `/v2`. D5 is explicit that the `teeTime` window is
 * "enforced at the `/v1` boundary only" and "deliberately does not tighten
 * the existing web/native path".
 *
 * So `/v1` composes: `scorecardSchema` is imported unmodified and the extra
 * invariants are added with `.superRefine`, which layers a check without
 * touching the base schema. `apps/web/types/scorecard-input.ts` is byte-
 * identical to `main` and must stay that way.
 *
 * ── The teeTime window (D5) ───────────────────────────────────────────────
 * `1990-01-01` … `now + 24h`, rejected as **422 `validation_failed`** with a
 * field-level code. Sized deliberately:
 *   - the lower bound is generous because historical backfill is a headline
 *     v1 benefit, and WIDENING later is non-breaking while TIGHTENING is a
 *     `/v2`;
 *   - the upper bound is clock-skew tolerance, and it matters because
 *     `teeTime` is a verified durable handicap-manipulation vector (rounds
 *     are ordered by it; the index derives from a 20-round sliding window).
 *
 * Because this is a day-one invariant rather than a later tightening, it is
 * part of v1's initial contract — which is exactly why the bounds are frozen
 * and are constants here, not env-tunable knobs.
 */

import { z } from "zod";

import { scorecardSchema } from "@/types/scorecard-input";

/** Inclusive lower bound of the accepted `teeTime` window (D5). */
export const TEE_TIME_MIN_ISO = "1990-01-01T00:00:00.000Z";
export const TEE_TIME_MIN_MS = Date.parse(TEE_TIME_MIN_ISO);

/** Upper bound: `now` plus this much clock-skew tolerance (D5). */
export const TEE_TIME_MAX_SKEW_MS = 24 * 60 * 60 * 1000;

/**
 * The append-only FIELD-level code carried in `errors[]` (§1). One code for
 * both edges: the two are the same invariant, the `message` distinguishes
 * them, and a client that switches on the code needs one branch. Splitting
 * it later is an append, which the field-code namespace permits.
 */
export const TEE_TIME_FIELD_CODE = "tee_time_out_of_window";

export type TeeTimeWindowVerdict = "ok" | "too-early" | "too-late" | "invalid";

/**
 * Evaluate a `teeTime` against the window.
 *
 * `now` is a parameter so tests are deterministic — a window whose upper
 * bound is "now" is otherwise untestable without freezing the clock.
 */
export function checkTeeTimeWindow(
  teeTime: string,
  now: number = Date.now()
): TeeTimeWindowVerdict {
  const instant = Date.parse(teeTime);
  if (Number.isNaN(instant)) {
    // The shared schema's `.datetime()` already rejects this; the branch
    // exists so the helper is safe to call standalone.
    return "invalid";
  }
  if (instant < TEE_TIME_MIN_MS) return "too-early";
  if (instant > now + TEE_TIME_MAX_SKEW_MS) return "too-late";
  return "ok";
}

const WINDOW_MESSAGES: Record<
  Exclude<TeeTimeWindowVerdict, "ok">,
  string
> = {
  "too-early": `teeTime must be on or after ${TEE_TIME_MIN_ISO}`,
  "too-late": "teeTime must not be more than 24 hours in the future",
  invalid: "teeTime must be an ISO 8601 date-time",
};

/**
 * The refinement itself, exported so any `/v1` schema that carries a
 * `teeTime` can layer it without duplicating the bounds.
 *
 * `params.v1Code` is how the field-level code reaches `errors[]`: the mapper
 * (`@/lib/api/problem-mapper`) reads it and falls back to zod's own issue
 * code when absent.
 */
export function addTeeTimeWindowIssue(
  ctx: z.RefinementCtx,
  verdict: Exclude<TeeTimeWindowVerdict, "ok">,
  path: PropertyKey[] = ["teeTime"]
): void {
  ctx.addIssue({
    code: "custom",
    path: [...path],
    message: WINDOW_MESSAGES[verdict],
    params: { v1Code: TEE_TIME_FIELD_CODE },
  });
}

/**
 * The `/v1` scorecard schema: the SHARED schema plus the D5 window.
 *
 * `now` is injectable for deterministic tests; the exported default reads the
 * real clock per parse (not once at module load — a long-lived serverless
 * instance would otherwise freeze the upper bound at cold-start time).
 */
export function createV1ScorecardSchema(
  options: { now?: () => number } = {}
) {
  const now = options.now ?? (() => Date.now());

  return scorecardSchema.superRefine((value, ctx) => {
    const verdict = checkTeeTimeWindow(value.teeTime, now());
    if (verdict !== "ok") {
      addTeeTimeWindowIssue(ctx, verdict);
    }
  });
}

/** The schema `/v1` write routes parse against. */
export const v1ScorecardSchema = createV1ScorecardSchema();

export type V1Scorecard = z.infer<typeof v1ScorecardSchema>;
