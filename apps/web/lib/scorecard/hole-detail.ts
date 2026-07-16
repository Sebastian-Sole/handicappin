/**
 * Pure logic for the Putts / Fairway / Penalties detail trio (plan 013 D7).
 * Consumed by the trio component in its editable (phone logging) and static
 * (read-only viewer) modes. Mirrored at apps/native/lib/hole-detail.ts —
 * keep the two byte-equivalent in behaviour.
 */

export const MAX_PUTTS = 20;
export const MAX_PENALTIES = 10;

/** One hole's shot-level detail (the plans/010 nullable fields). */
export interface HoleDetailValue {
  putts?: number | null;
  fairwayHit?: boolean | null;
  penaltyStrokes?: number | null;
}

/**
 * Step an optional counter with a stepper button.
 *
 * "Not recorded" (null/undefined) and 0 are distinct, reachable states:
 * from unset, "+" starts at 1; stepping below 0 returns to unset. So a
 * golfer can record a genuine 0 (holed from off the green) or clear the
 * field entirely without a separate control.
 */
export function stepDetailCount(
  current: number | null | undefined,
  delta: 1 | -1,
  max: number
): number | undefined {
  if (current == null) {
    return delta === 1 ? 1 : undefined;
  }
  const next = current + delta;
  if (next < 0) return undefined;
  return Math.min(next, max);
}

/**
 * Detail consistency rule: a putt is a stroke and a penalty counts toward
 * the score, but at least one non-putt swing (the tee shot) always exists —
 * so putts + penaltyStrokes ≤ strokes − 1. An unset/zero score doesn't
 * constrain anything (detail can be logged before the score in live play).
 */
const detailBudget = (strokes: number | null | undefined): number | null =>
  strokes == null || strokes <= 0 ? null : Math.max(0, strokes - 1);

/** Stepper cap for putts given the hole's score and recorded penalties. */
export function maxPuttsForStrokes(
  strokes: number | null | undefined,
  penaltyStrokes: number | null | undefined
): number {
  const budget = detailBudget(strokes);
  if (budget === null) return MAX_PUTTS;
  return Math.min(MAX_PUTTS, Math.max(0, budget - (penaltyStrokes ?? 0)));
}

/** Stepper cap for penalties given the hole's score and recorded putts. */
export function maxPenaltiesForStrokes(
  strokes: number | null | undefined,
  putts: number | null | undefined
): number {
  const budget = detailBudget(strokes);
  if (budget === null) return MAX_PENALTIES;
  return Math.min(MAX_PENALTIES, Math.max(0, budget - (putts ?? 0)));
}

/**
 * Re-fit recorded detail to a (new) score: putts clamp to strokes − 1,
 * penalties to whatever budget remains (putts keep priority — they're the
 * directly observed stat). Score 5 with 4 putts edited down to 4 → 3 putts.
 * Unset fields stay unset; an unset score changes nothing.
 */
export function clampDetailToStrokes(
  detail: HoleDetailValue,
  strokes: number | null | undefined
): HoleDetailValue {
  const budget = detailBudget(strokes);
  if (budget === null) return detail;
  const next: HoleDetailValue = { ...detail };
  if (next.putts != null) next.putts = Math.min(next.putts, budget);
  if (next.penaltyStrokes != null) {
    next.penaltyStrokes = Math.min(
      next.penaltyStrokes,
      budget - (next.putts ?? 0)
    );
  }
  return next;
}

/**
 * Segmented fairway tap: choosing a side selects it; tapping the already
 * selected side clears back to "not recorded" (tri-state without a third
 * button).
 */
export function toggleFairway(
  current: boolean | null | undefined,
  tapped: "hit" | "miss"
): boolean | undefined {
  const target = tapped === "hit";
  return current === target ? undefined : target;
}

/** Display glyph for a fairway value; par-3 holes have no fairway. */
export function fairwayGlyph(
  value: boolean | null | undefined,
  isPar3: boolean
): string {
  if (isPar3) return "N/A";
  if (value === true) return "✓";
  if (value === false) return "✗";
  return "–";
}

/** Accessible state label for a fairway value. */
export function fairwayLabel(
  value: boolean | null | undefined,
  isPar3: boolean
): string {
  if (isPar3) return "not applicable (par 3)";
  if (value === true) return "hit";
  if (value === false) return "missed";
  return "not set";
}

/** Score-vs-par result label ("Par", "Birdie", "+2", …) for the viewer. */
export function scoreResultLabel(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff <= -3) return `${diff}`;
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  return `+${diff}`;
}

/**
 * Whether a hole captured any shot-level detail. The viewer only renders
 * (and only expands to) the stat chips when this is true — a score-only
 * round never shows empty chips (plan 013 D2).
 */
export function holeHasDetail(detail: HoleDetailValue): boolean {
  return (
    detail.putts != null ||
    detail.fairwayHit != null ||
    detail.penaltyStrokes != null
  );
}
