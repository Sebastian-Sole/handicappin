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

## What the watch build will actually need (future work)

1. A watchOS target in the Xcode project (Expo config plugin or prebuild).
2. A Swift mirror of the ~100-line reducer in `engine.ts` (this file + the
   TS source are the spec; the unit tests in
   `tests/unit/round-session-engine.test.ts` define the semantics).
3. `WatchConnectivity` bridge module on the RN side that (a) publishes the
   snapshot after each store change and (b) feeds received watch events
   into the same `store.dispatch`.
4. An App Group (`group.com.handicappin.app`) ONLY if the watch must read
   the persisted session while the phone app is dead; otherwise
   applicationContext's last-value semantics suffice.

## GPS seam (same philosophy)

`geo.ts` defines `DistanceProvider` (`nullDistanceProvider` today) and the
optional `location` slot on `SCORE_SET` / `HoleEntry`. When course geo data
exists: implement a provider with expo-location, swap it where the null
provider is injected (`DistanceToHole` component), and start stamping
events. No schema or engine changes required.
