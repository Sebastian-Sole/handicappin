# Round-Session Sync Protocol (Apple Watch seam)

This directory's engine (`types.ts`, `engine.ts`, `selectors.ts`) is pure TS
with no React/Expo imports, by design: it is the contract a future watchOS
companion implements. Nothing here is built for the watch yet — this file
records what the seam guarantees so the watch work needs no refactor.

## Model

- **Snapshot** = the `RoundSession` object. It is 100% JSON-serializable
  (strings, numbers, plain objects/arrays only) and small (~2–4 KB). It maps
  directly onto `WCSession.applicationContext` — the phone publishes the
  latest snapshot after every accepted event.
- **Events** = the `SessionEvent` union, sent as WatchConnectivity messages
  (`sendMessage` when reachable, `transferUserInfo` queue otherwise). The
  watch sends the same event shapes the phone UI dispatches; the phone runs
  them through the identical `applyEvent` reducer.
- **Phone is source of truth.** The watch renders the last snapshot it saw
  and optimistically applies its own events locally; the authoritative state
  is whatever the phone's reducer produced.

## Shot-level detail (plan 013)

- `RoundSession.detailed` (optional bool, absent = false) marks a round as
  detail-tracking; it is chosen at start (D3) and frozen for the round.
  Pre-013 snapshots without the key decode unchanged.
- `HoleEntry` carries optional `putts` / `fairwayHit` / `penaltyStrokes`
  (absent/null = not recorded — never zero-filled).
- New event `HOLE_DETAIL_SET { holeIndex, putts?, fairwayHit?,
  penaltyStrokes?, at }` with PATCH semantics: a PRESENT key overwrites the
  field (null clears it); an ABSENT key leaves it unchanged. The reducer
  clamps putts to 0–20 and penalties to 0–10 and ignores non-finite values.
- **Detail consistency rule** (both reducers, mirrored in `Engine.swift`):
  on a SCORED hole, `putts + penaltyStrokes ≤ strokes − 1` (a putt is a
  stroke, a penalty counts toward the score, and at least one non-putt
  swing always exists). `HOLE_DETAIL_SET` re-fits incoming detail against
  the entry's strokes; `SCORE_SET` re-fits existing detail against the new
  score, putts keeping priority (score 5 with 4 putts re-scored to 4 → 3
  putts). Unscored holes are unbounded — detail can land before the score.
  Because of this, the watch's hole-out commit sends `SCORE_SET` BEFORE
  `HOLE_DETAIL_SET` (both carry an explicit `holeIndex`).
- `SCORE_SET` preserves an entry's detail fields (re-scoring never wipes
  captured detail); `SCORE_CLEARED` clears the whole entry, detail included.
- Submission (`to-scorecard.ts`): detail rides along only when
  `session.detailed` — penalties default to 0 for entered holes, unrecorded
  putts/fairway keys are omitted. Non-detailed rounds submit byte-identical
  payloads to pre-013 rounds.

## Ordering & conflicts

- `eventSeq` is a monotonic counter bumped on every ACCEPTED event; it is
  the ordering authority (wall-clock `at` fields are informational only, so
  device clock changes are harmless).
- The watch compares its last-known `eventSeq` with the snapshot's; a gap
  means missed updates → re-render from snapshot (no event replay needed —
  snapshots are complete).
- Conflict rule: per-hole last-writer-wins in phone-side application order.
  Identical `SCORE_SET`s are idempotent (the reducer returns the same
  reference), so duplicate delivery is safe.

## The watch build (implemented 2026-07 — docs/apple-watch.md)

1. watchOS target: `targets/watch/` via @bacons/apple-targets (regenerated
   into the Xcode project on prebuild).
2. Swift mirror of the reducer: `targets/watch/Core/Engine.swift` (+
   Models/Protocol/WatchSessionStore). The TS source + unit tests remain
   the spec; the SwiftPM package `watch-core/` runs the mirrored suite
   with `swift test`.
3. WatchConnectivity bridge: `modules/watch-bridge/` (native, dumb pipe) +
   `lib/round-session/watch-bridge.ts` (publishes snapshots on store
   change, zod-validates watch frames, feeds events into `store.dispatch`,
   answers catalog/search/tees/start/submit RPCs). Wire shapes:
   `watch-protocol.ts` ↔ `targets/watch/Core/Protocol.swift`.
4. No App Group yet — applicationContext last-value semantics carry the
   snapshot; revisit only if the watch must read state while the phone
   app is dead.
5. Home-screen stats ride the same `ContextFrame` as an optional `stats`
   key (`WatchStats`): index, last round, season counters — computed
   phone-side from the same tRPC procedures the phone home uses. The
   `recalculating` flag covers the server's handicap queue delay (~1 min
   pg_cron sweep after a submit): the phone flips it on when any owned
   session reaches `submitted`, polls its profile, and republishes when
   the index settles. `SubmitReply` additionally carries the
   synchronously-computed `differential` so the watch's post-round summary
   never has to guess. Omit-optional-keys (never null) applies to every
   nested key — NSNull poisons the whole frame.

## GPS seam (same philosophy)

`geo.ts` defines `DistanceProvider` (`nullDistanceProvider` today) and the
optional `location` slot on `SCORE_SET` / `HoleEntry`. When course geo data
exists: implement a provider with expo-location, swap it where the null
provider is injected (`DistanceToHole` component), and start stamping
events. No schema or engine changes required.
