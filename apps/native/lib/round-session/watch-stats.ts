/**
 * Pure shaping of the watch home-screen stats out of PostgREST-fed round
 * rows. Extracted from watch-bridge.ts so it is unit-testable — the bridge
 * itself imports expo-crypto and the WatchBridge native module, which fail
 * at import time under the node test harness.
 *
 * `RoundRow.teeTime` arrives zone-less (naive `timestamp` column, UTC
 * rendering — see lib/parse-db-timestamp.ts), so every read here goes
 * through `parseDbTimestamp`.
 */
import type { RoundRow } from "@/lib/api/schemas/round";
import { parseDbTimestamp } from "@/lib/parse-db-timestamp";
import type { WatchLastRound } from "@/lib/round-session/watch-protocol";

/** Wire shape for the watch's "last round" card. `playedAt` is sent as the
    canonical Z-suffixed UTC instant so the watch's primary ISO8601 parse
    succeeds — the raw zone-less string would fall back to a device-local
    DateFormatter parse and shift the date in non-UTC zones. */
export function toWatchLastRound(
  latest: RoundRow,
  courseName: string,
): WatchLastRound {
  return {
    courseName,
    totalStrokes: latest.totalStrokes,
    toPar: latest.totalStrokes - latest.parPlayed,
    differential: latest.scoreDifferential,
    playedAt: parseDbTimestamp(latest.teeTime).toISOString(),
    holesPlayed: latest.holes_played,
    ...(latest.nine_hole_section === "front" ||
    latest.nine_hole_section === "back"
      ? { nineHoleSection: latest.nine_hole_section }
      : {}),
  };
}

/** Rounds whose tee instant falls in `year` of the device-local calendar. */
export function seasonRounds(rounds: RoundRow[], year: number): RoundRow[] {
  return rounds.filter(
    (r) => parseDbTimestamp(r.teeTime).getFullYear() === year,
  );
}
