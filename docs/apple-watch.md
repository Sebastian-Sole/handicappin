# Apple Watch companion app

The watch app lets a golfer run the entire live-round flow from the wrist:
pick course + tee + hole count, start the round, score hole by hole, and
submit the scorecard — the phone can stay in the bag. It is a **native
SwiftUI watchOS app** (React Native does not run on watchOS) that mirrors
the phone's round-session engine and talks to the phone over
WatchConnectivity. The phone remains the source of truth
(`apps/native/lib/round-session/PROTOCOL.md` is the sync contract).

## Architecture

```
┌─ watch (SwiftUI) ──────────────┐      ┌─ phone (Expo RN) ─────────────────┐
│ targets/watch/                 │      │                                   │
│  ├ Core/            Swift mirror of   │ lib/round-session/  TS engine     │
│  │   Models.swift   types.ts   │  WC  │  ├ engine.ts        (reducer)     │
│  │   Engine.swift   engine.ts ─┼──────┼─ ├ watch-protocol.ts (zod frames) │
│  │   Protocol.swift watch-protocol.ts │  └ watch-bridge.ts  (headless     │
│  │   WatchSessionStore.swift   │      │       store↔WCSession glue)       │
│  ├ PhoneLink.swift  WCSession client  │ modules/watch-bridge/ (Expo local │
│  └ *.swift          UI         │      │       module wrapping WCSession)  │
└────────────────────────────────┘      └───────────────────────────────────┘
```

- **Snapshots (phone → watch):** after every accepted event the phone
  publishes the full `RoundSession` JSON (2–4 KB) via
  `updateApplicationContext` (last-value survives relaunches) plus a live
  `sendMessage` when reachable. The watch re-renders from the snapshot;
  `eventSeq` decides staleness (a snapshot older than the watch's local
  optimistic state is ignored — the phone overtakes after applying the
  watch's events).
- **Events (watch → phone):** the watch applies events through its own
  Swift mirror of the reducer (optimistic), then relays the identical JSON
  event; the phone runs it through `store.dispatch` — same reducer, same
  persistence, same UI subscription as a phone tap. Duplicate delivery is
  safe (the reducer no-ops idempotent events).
- **RPCs (watch → phone):** course catalog (last-played, from the
  `lastSetup` slot), dictated course search (`course.searchCourses`), tee
  options (`tee.fetchTees`), start round (`startRoundSession`), submit
  (same path as the review screen: `toScorecardInput` →
  `round.submitScorecard`, transport failures park in `pendingSubmit`).
  Everything crossing from the watch is zod-validated
  (`watch-protocol.ts`); the watch echoes back only data the phone gave it.
- **Ownership:** the bridge applies the `useOwnedRoundSession` rule — a
  session belonging to another account is invisible to the watch, and
  watch events are dropped while signed out.
- **Home screen (no active round):** a vertical pager of three pages —
  index hero, last round, season — fed by a `stats` payload
  (`WatchStats`) that rides the same `ContextFrame` as the session
  snapshot. The phone computes it from the exact procedures the phone
  home uses (`auth.getProfileFromUserId`, `round.getAllByUserId`,
  `round.getCountByUserId`) and refreshes it on bridge start,
  reachability, and `syncRequest`. Rounds are normally started on the
  iPhone; the watch start flow survives as a "New round" sheet behind
  the season page (`targets/watch/HomeView.swift`).
- **Post-submit summary:** submitting holds a ~6 s summary card (tap to
  skip) built from the final snapshot — score, to-par, and the
  differential carried on `SubmitReply` (server-computed synchronously)
  — then settles on Home. The handicap index is deliberately NOT on the
  card: the server recalculates it via a queue (~1-min pg_cron sweep),
  so the phone flags `stats.recalculating` after any owned session
  reaches `submitted`, polls its profile (~2.5 min window), and
  republishes; the watch renders the flag as an "Updating…" chip that
  settles into the fresh index when the queue lands.
- **GPS seam:** `RoundModel.distanceProvider` mirrors `geo.ts`
  (`NullDistanceProvider` today). When hole geometry exists, implement a
  CoreLocation-backed provider on the watch (the watch has its own GPS) and
  the hole screen's distance slot lights up; `SCORE_SET.location` stamps
  ride the existing protocol. Nothing else moves.

## Repo layout

| Path | What |
|---|---|
| `apps/native/targets/watch/` | The watch app (SwiftUI). `expo-target.config.js` = target definition (@bacons/apple-targets); regenerated into the Xcode project on every prebuild. |
| `apps/native/targets/watch/Core/` | Pure-logic Swift mirror of the round-session engine + wire protocol. No UI imports. |
| `apps/native/watch-core/` | SwiftPM package wrapping `Core/` (via symlink) so `swift test` runs the engine/store suites headlessly on macOS. |
| `apps/native/targets/watch-ui-tests/` | XCUITest suite driving the watch app in the simulator. |
| `apps/native/modules/watch-bridge/` | Expo local module (iOS): WCSession on the phone side. |
| `apps/native/lib/round-session/watch-protocol.ts` | Frame schemas (zod) — single source for wire shapes; keep `Core/Protocol.swift` in sync. |
| `apps/native/lib/round-session/watch-bridge.ts` | Headless phone-side bridge (store subscribe/dispatch + RPC handlers). Mounted by `components/watch-bridge-host.tsx`. |
| `apps/native/scripts/watch/` | Harness: UI-test target injection + E2E runner. |

## Dev workflow

One-time / after `expo prebuild --clean`:

```sh
cd apps/native
npx expo prebuild -p ios                     # regenerates ios/ incl. watch target
GEM_HOME=/opt/homebrew/Cellar/cocoapods/1.16.2_2/libexec \
  /opt/homebrew/opt/ruby/bin/ruby scripts/watch/add-watch-ui-tests-target.rb  # test target (optional, for E2E)
```

Create + boot a paired simulator duo (once):

```sh
WATCH=$(xcrun simctl create "Watch S11 (handicappin)" \
  "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-11-46mm" \
  "com.apple.CoreSimulator.SimRuntime.watchOS-26-2")
xcrun simctl pair "$WATCH" <IPHONE_UDID>
xcrun simctl boot <IPHONE_UDID>; xcrun simctl boot "$WATCH"
```

Build & install both apps:

```sh
cd apps/native/ios
xcodebuild -workspace Handicappin.xcworkspace -scheme Handicappin \
  -configuration Debug -destination "platform=iOS Simulator,id=<IPHONE_UDID>" \
  -derivedDataPath build/watch-dd build
xcrun simctl install <IPHONE_UDID> build/watch-dd/Build/Products/Debug-iphonesimulator/Handicappin.app
xcrun simctl install <WATCH_UDID>  build/watch-dd/Build/Products/Debug-iphonesimulator/Handicappin.app/Watch/HandicappinWatch.app
```

(Watch-only Swift iteration is much faster: build the `HandicappinWatch`
scheme with a watchOS Simulator destination and install just that app.)

Run: start the local stack (supabase, web, Metro), open the phone dev
client against Metro, sign in, then launch “Handicappin'” on the watch sim.
The watch talks to the phone app — **the phone app must be installed and
running** (foreground or background) for RPCs; scoring events queue via
`transferUserInfo` when it isn't reachable.

### Environment gotchas (learned the hard way)

- **Signing:** don't build with `CODE_SIGNING_ALLOWED=NO` — expo-secure-store
  (auth tokens) needs the simulator keychain, which requires ad-hoc signing.
  Default `xcodebuild` settings are correct.
- **Ports:** the app's API base URL is baked into the dev-client binary at
  BUILD time (`Constants.expoConfig` = embedded config) — Metro manifest
  changes alone don't reach `lib/env.ts`. Override with
  `apps/native/.env.local` (`EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:<port>`)
  and REBUILD the phone app. Use `127.0.0.1`, never `localhost` — other
  projects' dev servers squatting `::1:3000` have hijacked requests before.
- WatchConnectivity between *paired simulators* worked in our verified runs
  (`sendMessage` RPCs, `applicationContext` snapshots, live event relay),
  but the ecosystem consensus is that sim WC is flaky — `isReachable` /
  `isWatchAppInstalled` can read false, `sendMessage` can silently drop,
  and `transferUserInfo` delivery timing is unreliable. If sims misbehave,
  restart both apps (activation re-publishes the last context); prove
  queued-delivery + reachability semantics on physical devices before
  shipping. If sim flakiness ever blocks development, the known-reliable
  fallback channel is an App Group + shared UserDefaults.
- **Local handicap recalculation needs the edge runtime.** The pg_cron job
  posts to `functions/v1/process-handicap-queue` every minute, but the
  local stack doesn't run edge functions by default — queue rows sit
  `pending` forever and the index never updates (the watch's "Updating…"
  chip then clears by poll-window timeout, by design). To make it real:
  `supabase functions serve --no-verify-jwt --env-file <file with
  HANDICAP_CRON_SECRET=...>` and create the matching vault secret once:
  `select vault.create_secret('<same value>', 'handicap_cron_secret')`.
- **Drizzle numeric columns return strings.** `round.submitScorecard`
  returns the drizzle-inserted row; `numeric` columns (e.g.
  `scoreDifferential`) arrive as strings, unlike PostgREST reads which
  emit numbers. Parse with `z.coerce.number()` on that boundary.
- **PostgREST timestamps have no timezone suffix** ("2026-07-07T19:33:00")
  — `ISO8601DateFormatter` rejects them; keep the plain-format fallback in
  `HomeView.shortDate`.
- **SwiftUI container accessibility identifiers swallow children's.** An
  `.accessibilityIdentifier` on a VStack overrides every child identifier
  in the XCUITest tree (this hid `start-from-watch` behind `home-season`).
  Identify leaf elements, not containers, when tests must reach inside.

## Testing

Three layers, all agent-drivable with proof:

1. **Engine/store unit tests (fast, no simulator):**
   `cd apps/native/watch-core && swift test` — mirrors
   `tests/unit/round-session-engine.test.ts` plus snapshot-reconciliation
   and wire-format tests (JSON fixtures copied from the phone's codec).
2. **Watch UI E2E (paired sims):** `scripts/watch/run-watch-e2e.sh [proof-dir]`
   orchestrates Maestro (phone side) + XCUITest (watch side):
   phone starts round → watch mirrors; watch scores → phone shows it;
   phone discards → watch resets; **entire round driven from the watch**
   (start → 18 holes → finish → submit) → row lands in local Supabase.
   Screenshots land in the proof dir; XCTest attachments in the xcresult
   bundles. Maestro itself cannot drive watchOS (its driver is an
   iOS-simulator XCTest runner; idb and simctl can't inject watch taps
   either) — XCUITest is the only tool that can, so it's the watch layer
   here.

   Flakiness levers (from testing research): keep the sim pair pre-booted
   and warm (first launch after boot is the #1 flake source); use
   `waitForExistence` with generous timeouts (watch renders slower than
   iPhone); auto-retry the E2E layer (`-retry-tests-on-failure`). The E2E
   suite deliberately exercises the LIVE WCSession bridge — that's what
   it proves — so expect occasional sim-WC flakes and rerun; for
   deterministic UI-only tests, inject fixture state via launch args
   instead of waiting on a sync round-trip. Crown automation exists
   (`XCUIDevice.shared.rotateDigitalCrown(delta:)`) if a test ever needs
   it; complications/WidgetKit surfaces are not drivable.
3. **Manual:** see below.

## Manual test drive (Sebastian)

1. Local stack up (supabase, web, Metro), phone app signed in.
2. Open “Handicappin'” on the watch simulator (or a real paired watch with
   a dev build).
3. No active round → the start screen offers the last-played course
   ("Recent") and dictation search. Pick course → tee → 18 holes / front 9 /
   back 9.
4. Hole screen: crown or +/- picks the strokes (defaults to par, colored by
   score-to-par), big green button saves and auto-advances to the next
   unscored hole. Swipe up: totals + Finish. Swipe up again: full scorecard
   (tap a hole to jump; long-press to clear).
5. Start a round on the phone instead — the watch picks it up within a
   second or two; score on either device and watch them converge.
6. Finish round → Submit scorecard → the round appears in the phone app and
   on the web dashboard like any other submitted round.

## Shipping notes (untested — next steps)

- The target ships inside the iOS app; EAS Build picks it up via the config
  plugin. Set `ios.appleTeamId` in app.json before a device/store build
  (prebuild warns until then).
- Watch app bundle id is `com.handicappin.app.watchkitapp` (companion-app
  convention). **Known blocker:** EAS Build does not provision watch
  targets cleanly ("No profiles for '…watchkitapp'", eas-cli issue #2578,
  unresolved as of early 2026) — build numbers must match across targets
  and manual archive/signing is the workaround. Budget for this before any
  TestFlight/App Store submission.
- **HKWorkoutSession is the top pre-TestFlight item.** Without a session,
  watchOS suspends the app wrist-down; every serious golf watch app
  (Golfshot, Hole19, Arccos, 18Birdies) runs the round inside a workout
  session to stay resumable for 4+ hours and wake on wrist-raise (sessions
  support ~12h). Deliberately NOT in the prototype (needs the HealthKit
  entitlement + permission UX); start it on round start, end it on submit.
  Score-only (no GPS) keeps battery cheap — Hole19 publishes ~60–70%
  battery per 18 holes *with* GPS, which is the main cost to defer.
- UX follow-ups from market research: make save-auto-advance a setting
  (Golfshot ships it as a default-on toggle; ours mirrors the phone UI's
  auto-advance for now), complication/Smart Stack Live Activity for
  one-tap re-entry to the active round.
- `pnpm generate:theme` does not emit Swift yet — `targets/watch/Theme.swift`
  mirrors the dark-mode token values by hand (annotated `allow-hardcoded`).
  Emitting a Swift tokens file from the generator deletes that file.
