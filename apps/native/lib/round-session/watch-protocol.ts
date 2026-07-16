/**
 * Watch ↔ phone message protocol (extends PROTOCOL.md §Model).
 *
 * Pure TS + zod, no React/Expo imports. Everything arriving FROM the watch
 * crosses a trust boundary (a different codebase wrote it), so incoming
 * frames are zod-parsed before they touch the store; malformed frames are
 * dropped, never thrown.
 *
 * Transport mapping (see the WatchConnectivity bridge):
 * - Phone → watch state: `WCSession.applicationContext` carries
 *   `ContextFrame` (last-value-wins; the snapshot is complete, so missed
 *   intermediate updates are harmless — PROTOCOL.md §Ordering).
 * - Watch → phone: `sendMessage` when reachable, `transferUserInfo` queue
 *   otherwise, carrying `WatchToPhoneFrame`. RPC-style frames (catalog,
 *   start, submit) use sendMessage's reply handler and require
 *   reachability; the event frame works over both channels.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Watch → phone frames
// ---------------------------------------------------------------------------

const isoString = z.string().min(1);

const geoStampSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  accuracyM: z.number().optional(),
  at: isoString,
});

/** Mirrors types.ts SessionEvent — the watch sends the same shapes the
 *  phone UI dispatches; the phone runs them through the same reducer. */
export const watchSessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SCORE_SET"),
    holeIndex: z.number().int(),
    strokes: z.number(),
    at: isoString,
    location: geoStampSchema.nullish(),
  }),
  z.object({
    type: z.literal("SCORE_CLEARED"),
    holeIndex: z.number().int(),
    at: isoString,
  }),
  z.object({
    // Hole-out detail patch (plan 013): PRESENT key overwrites (null
    // clears), ABSENT key leaves the field unchanged. Clamping/rounding is
    // the reducer's job — this only shape-checks.
    type: z.literal("HOLE_DETAIL_SET"),
    holeIndex: z.number().int(),
    putts: z.number().nullish(),
    fairwayHit: z.boolean().nullish(),
    penaltyStrokes: z.number().nullish(),
    at: isoString,
  }),
  z.object({
    type: z.literal("HOLE_SELECTED"),
    holeIndex: z.number().int(),
    at: isoString,
  }),
  z.object({ type: z.literal("NOTES_SET"), notes: z.string(), at: isoString }),
  z.object({ type: z.literal("FINISH_STARTED"), at: isoString }),
  z.object({ type: z.literal("FINISH_CANCELLED"), at: isoString }),
]);

/** A live-round event relayed from the watch into the phone's reducer.
 *  SUBMITTED is deliberately NOT relayable: submission must go through the
 *  phone's submit pipeline (to-scorecard + tRPC), so the watch asks for it
 *  with `submitRequest` instead of asserting it happened. */
export const watchEventFrameSchema = z.object({
  v: z.literal(1),
  kind: z.literal("event"),
  event: watchSessionEventSchema,
});

/** Watch asks for the startable-course catalog (reply: CatalogReply).
 *  Catalog = the last-played course (offline-capable, from the lastSetup
 *  slot); broader choice goes through searchRequest (watch dictation). */
export const watchCatalogRequestSchema = z.object({
  v: z.literal(1),
  kind: z.literal("catalogRequest"),
});

/** Dictated course search (reply: SearchReply). */
export const watchSearchRequestSchema = z.object({
  v: z.literal(1),
  kind: z.literal("searchRequest"),
  query: z.string().min(1).max(120),
});

/** Tee options for a picked course (reply: TeesReply). */
export const watchTeesRequestSchema = z.object({
  v: z.literal(1),
  kind: z.literal("teesRequest"),
  courseId: z.number().int(),
});

/** Course identity as the watch echoes it back on start. Every field
 *  originated from a phone reply (catalog/search) — the watch adds nothing
 *  of its own — but it still gets zod-checked like any other inbound data. */
export const watchCourseRefSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  city: z.string(),
  country: z.string(),
  website: z.string(),
  approvalStatus: z.enum(["approved", "pending"]),
});

/** Watch asks the phone to start a round (reply: StartReply). The phone
 *  resolves teeId against its own fetched/last-setup tee snapshots — the
 *  watch never supplies hole data. */
export const watchStartRequestSchema = z.object({
  v: z.literal(1),
  kind: z.literal("startRequest"),
  course: watchCourseRefSchema,
  teeId: z.number().int(),
  holeCount: z.union([z.literal(9), z.literal(18)]),
  nineHoleSection: z.enum(["front", "back"]).optional(),
});

/** Watch asks the phone to submit the finishing session (reply:
 *  SubmitReply). Phone-side this triggers the exact same path as tapping
 *  Submit on the phone: to-scorecard → round.submitScorecard (or parked
 *  offline via pending-submit). */
export const watchSubmitRequestSchema = z.object({
  v: z.literal(1),
  kind: z.literal("submitRequest"),
});

/** Watch asks the phone to re-publish the current context (used on watch
 *  app launch, before the first applicationContext delivery lands). */
export const watchSyncRequestSchema = z.object({
  v: z.literal(1),
  kind: z.literal("syncRequest"),
});

export const watchToPhoneFrameSchema = z.discriminatedUnion("kind", [
  watchEventFrameSchema,
  watchCatalogRequestSchema,
  watchSearchRequestSchema,
  watchTeesRequestSchema,
  watchStartRequestSchema,
  watchSubmitRequestSchema,
  watchSyncRequestSchema,
]);

export type WatchToPhoneFrame = z.infer<typeof watchToPhoneFrameSchema>;
export type WatchSessionEvent = z.infer<typeof watchSessionEventSchema>;
export type WatchCourseRef = z.infer<typeof watchCourseRefSchema>;

/** Parse an incoming watch frame; null = drop (malformed/unknown). */
export function decodeWatchFrame(raw: unknown): WatchToPhoneFrame | null {
  const parsed = watchToPhoneFrameSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Phone → watch frames (constructed here, decoded in Swift — keep shapes in
// sync with watch-core/Sources/WatchRoundCore/Protocol.swift)
// ---------------------------------------------------------------------------

export interface WatchTeeOption {
  id: number;
  name: string;
  gender: string;
  totalPar: number;
  totalDistance: number;
  distanceMeasurement: string;
}

/** One startable course option. `tees` is present when the phone already
 *  holds tee snapshots (lastSetup); otherwise the watch follows up with a
 *  teesRequest. Holes stay phone-side (the watch gets them via the session
 *  snapshot after start). */
export interface WatchCourseOption extends WatchCourseRef {
  tees?: WatchTeeOption[];
}

/** The signed-in golfer's most recent submitted round, as the watch home
 *  screen presents it. All numbers were computed synchronously at submit
 *  time (differential included) — nothing here waits on the handicap
 *  queue. */
export interface WatchLastRound {
  courseName: string;
  totalStrokes: number;
  /** totalStrokes - parPlayed (signed; 0 = level). */
  toPar: number;
  differential: number;
  /** Round teeTime, ISO. */
  playedAt: string;
  holesPlayed: number;
  nineHoleSection?: "front" | "back";
}

/** Home-screen stats, computed phone-side from the same tRPC procedures
 *  the phone home screen uses. Optional keys are OMITTED when unknown —
 *  never null (see ContextFrame's NSNull note; it applies to every nested
 *  key of the frame dict). */
export interface WatchStats {
  handicapIndex: number;
  initialHandicapIndex: number;
  /** True from a round submit until the server's handicap queue has had
   *  time to rework the index (~1 min cron). The watch renders this as the
   *  "Updating…" chip; the old index stays visible. */
  recalculating: boolean;
  lastRound?: WatchLastRound;
  /** Rounds with a teeTime in the current calendar year. */
  seasonRounds: number;
  seasonBestDifferential?: number;
  totalRounds: number;
  generatedAt: string;
}

/** applicationContext payload. `session` is the codec.ts-encoded JSON
 *  string (encodeSession); the key is OMITTED (never null) when no owned
 *  session exists — WCSession payloads must be property-list types, and an
 *  NSNull makes updateApplicationContext/sendMessage silently drop the
 *  frame, so a null would mean session-cleared states never reach the
 *  watch. `seq` echoes eventSeq so the watch can cheap-compare. */
export interface ContextFrame {
  v: 1;
  kind: "context";
  session?: string;
  /** Home-screen stats; omitted until the phone has fetched them (the
   *  watch keeps showing its last-received values meanwhile). */
  stats?: WatchStats;
  seq: number;
  /** Bumped every publish so identical-looking contexts still deliver
   *  (WCSession drops byte-identical applicationContext updates). */
  publishedAt: string;
}

export interface CatalogReply {
  v: 1;
  kind: "catalog";
  courses: WatchCourseOption[];
}

export interface SearchReply {
  v: 1;
  kind: "searchResult";
  courses: WatchCourseOption[];
  error?: string;
}

export interface TeesReply {
  v: 1;
  kind: "teesResult";
  tees: WatchTeeOption[];
  error?: string;
}

export interface StartReply {
  v: 1;
  kind: "startResult";
  ok: boolean;
  error?: string;
}

export interface SubmitReply {
  v: 1;
  kind: "submitResult";
  /** "submitted" reached the server; "parked" is stored for offline retry
   *  (both are success from the watch's point of view). */
  outcome: "submitted" | "parked" | "error";
  /** Server-computed score differential for the just-submitted round —
   *  known synchronously (unlike the index, which the handicap queue
   *  reworks ~1 min later). Present only on outcome "submitted"; the watch
   *  builds the rest of its summary card from its own final snapshot. */
  differential?: number;
  error?: string;
}

export interface EventAck {
  v: 1;
  kind: "eventAck";
  /** eventSeq after applying (or unchanged if the reducer no-opped). */
  seq: number;
}
