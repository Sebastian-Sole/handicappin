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
