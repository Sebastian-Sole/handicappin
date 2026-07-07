/**
 * Round-session domain types — the on-device model for a live round.
 *
 * This module (and engine/selectors/codec/to-scorecard) is pure TS with no
 * React or Expo imports. That purity is the Apple Watch seam: a watch
 * companion mirrors state by exchanging these exact JSON-serializable
 * snapshots and SessionEvent messages through the same reducer semantics
 * (see PROTOCOL.md).
 */
import type { Hole, Tee } from "@handicappin/handicap-core";

import type { GeoStamp } from "@/lib/round-session/geo";

export const SESSION_SCHEMA_VERSION = 1;

/** Course identity frozen at session start (shape mirrors add.tsx submit). */
export interface SessionCourse {
  id: number;
  name: string;
  city: string;
  country: string;
  website: string;
  approvalStatus: "approved" | "pending";
}

export interface HoleEntry {
  /** null = not yet scored. There is no silent default — an unscored hole
      stays null so we never fabricate data. */
  strokes: number | null;
  /** Informational only; ordering authority is RoundSession.eventSeq. */
  updatedAt: string;
  /** GPS seam — never populated today (see geo.ts). */
  location?: GeoStamp | null;
}

export type SessionStatus = "active" | "finishing" | "submitted";

export interface RoundSession {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  id: string;
  userId: string;
  status: SessionStatus;
  /** ISO; becomes the default teeTime on the review screen. */
  startedAt: string;
  lastEventAt: string;
  /** Monotonic event counter — the ordering authority (never wall clock,
      so device clock changes can't corrupt a round). */
  eventSeq: number;
  course: SessionCourse;
  /** FROZEN tee snapshot incl. all 18 holes. Submitting the snapshot means
      server-side tee edits mid-round cannot corrupt this round (the server
      backfills holeIds positionally from the submitted tee). */
  tee: Tee;
  holeCount: 9 | 18;
  /** Required iff holeCount === 9 (mirrors the server superRefine). */
  nineHoleSection?: "front" | "back";
  /** getDisplayedHoles() result frozen at start — for a 9-hole session the
      hcp values are already normalized to 1–9 (USGA 5.1b). */
  displayedHoles: Hole[];
  /** 0-based index into displayedHoles. */
  currentHoleIndex: number;
  /** length === holeCount, index-aligned with displayedHoles. */
  entries: HoleEntry[];
  notes: string;
}

export type SessionEvent =
  | {
      type: "SCORE_SET";
      holeIndex: number;
      strokes: number;
      at: string;
      location?: GeoStamp | null;
    }
  | { type: "SCORE_CLEARED"; holeIndex: number; at: string }
  | { type: "HOLE_SELECTED"; holeIndex: number; at: string }
  | { type: "NOTES_SET"; notes: string; at: string }
  | { type: "FINISH_STARTED"; at: string }
  | { type: "FINISH_CANCELLED"; at: string }
  | { type: "SUBMITTED"; at: string };
