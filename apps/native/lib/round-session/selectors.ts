/** Pure derived views over a RoundSession (no React/Expo imports). */
import type { RoundSession } from "@/lib/round-session/types";

export const STALE_SESSION_MS = 24 * 60 * 60 * 1000;
export const AUTO_RESUME_MS = 12 * 60 * 60 * 1000;

export function scoredCount(s: RoundSession): number {
  return s.entries.filter((e) => e.strokes !== null).length;
}

export function totalStrokes(s: RoundSession): number {
  return s.entries.reduce((sum, e) => sum + (e.strokes ?? 0), 0);
}

/** Strokes vs par over SCORED holes only (0 when nothing is scored). */
export function vsPar(s: RoundSession): number {
  return s.entries.reduce((diff, e, i) => {
    if (e.strokes === null) return diff;
    return diff + e.strokes - (s.displayedHoles[i]?.par ?? 0);
  }, 0);
}

export function isComplete(s: RoundSession): boolean {
  return s.entries.every((e) => e.strokes !== null);
}

export interface FinishEligibility {
  /** All 18 holes of an 18-hole session are scored. */
  as18: boolean;
  /** The complete nine this session can be submitted as (USGA 9-or-18 rule):
      a complete 9-hole session, or an 18-hole session with exactly its
      front or back nine fully scored. null when neither nine is complete. */
  asNine: "front" | "back" | null;
  /** 0-based indices of unscored holes (UI maps to hole numbers). */
  missing: number[];
}

export function finishEligibility(s: RoundSession): FinishEligibility {
  const missing = s.entries
    .map((e, i) => (e.strokes === null ? i : -1))
    .filter((i) => i >= 0);

  if (s.holeCount === 9) {
    return {
      as18: false,
      asNine: missing.length === 0 ? (s.nineHoleSection ?? "front") : null,
      missing,
    };
  }

  const frontComplete = s.entries
    .slice(0, 9)
    .every((e) => e.strokes !== null);
  const backComplete = s.entries.slice(9).every((e) => e.strokes !== null);
  return {
    as18: missing.length === 0,
    asNine: frontComplete ? "front" : backComplete ? "back" : null,
    missing,
  };
}

const ageMs = (s: RoundSession, nowIso: string): number =>
  new Date(nowIso).getTime() - new Date(s.lastEventAt).getTime();

/** Older than 24h: never auto-prompt; Home card swaps to "unfinished" copy. */
export function isStale(s: RoundSession, nowIso: string): boolean {
  return ageMs(s, nowIso) > STALE_SESSION_MS;
}

/** Fresh active sessions (<12h) get the one-shot auto-prompt on launch. */
export function isAutoResumable(s: RoundSession, nowIso: string): boolean {
  return s.status !== "submitted" && ageMs(s, nowIso) < AUTO_RESUME_MS;
}
