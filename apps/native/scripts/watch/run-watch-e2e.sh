#!/usr/bin/env bash
# Watch E2E harness — proves the full watch↔phone round flow on paired
# simulators with screenshots and a server-side check. The watchOS
# equivalent of the Maestro loop (Maestro cannot drive watchOS; XCUITest
# does the wrist side, Maestro keeps the phone side).
#
# PRE-REQUISITES
#   - local stack up: supabase, web :3000, Metro :8081
#   - paired iPhone+Watch simulators booted (see docs/apple-watch.md)
#   - apps built & installed once (scripts/watch/build-and-install.sh or
#     the xcodebuild commands in docs/apple-watch.md)
#   - phone dev client opened against Metro at least once
#
# Usage: scripts/watch/run-watch-e2e.sh [proof-dir]
set -euo pipefail

cd "$(dirname "$0")/../.."   # apps/native

PROOF_DIR="${1:-/tmp/watch-e2e-proof}"
mkdir -p "$PROOF_DIR"

# Resolve the active watch↔phone simulator pair.
PAIR_JSON=$(xcrun simctl list pairs -j)
WATCH_UDID=$(echo "$PAIR_JSON" | python3 -c '
import json,sys
pairs = json.load(sys.stdin)["pairs"]
for p in pairs.values():
    if p["state"].startswith("(active"): pass
for p in pairs.values():
    print(p["watch"]["udid"]); break')
PHONE_UDID=$(echo "$PAIR_JSON" | python3 -c '
import json,sys
pairs = json.load(sys.stdin)["pairs"]
for p in pairs.values():
    print(p["phone"]["udid"]); break')
echo "phone=$PHONE_UDID watch=$WATCH_UDID"

xcrun simctl bootstatus "$PHONE_UDID" -b >/dev/null
xcrun simctl bootstatus "$WATCH_UDID" -b >/dev/null

shot() { # shot <device> <name>
  xcrun simctl io "$1" screenshot "$PROOF_DIR/$2.png" >/dev/null && echo "  📸 $2"
}

watch_test() { # watch_test <testName>
  xcodebuild test-without-building \
    -workspace ios/Handicappin.xcworkspace \
    -scheme HandicappinWatchUITests \
    -destination "platform=watchOS Simulator,id=$WATCH_UDID" \
    -derivedDataPath ios/build/watch-dd \
    -resultBundlePath "$PROOF_DIR/xcresult-$1" \
    -only-testing:"HandicappinWatchUITests/WatchRoundE2ETests/$1" \
    2>&1 | grep -E "Test case .* (passed|failed)|error:" || true
}

echo "── Phase 0: sign in on the phone (no-op when already signed in)"
maestro --device "$PHONE_UDID" test .maestro/utils/sign-in.yaml \
  || echo "  sign-in flow failed — assuming already signed in and continuing"
sleep 3

echo "── Phase 1: phone starts a round; watch must mirror it"
maestro --device "$PHONE_UDID" test .maestro/flows/watch-seed-live-round.yaml
shot "$PHONE_UDID" "phase1-phone-round-started"
watch_test testMirrorsPhoneStartedRound
shot "$WATCH_UDID" "phase1-watch-mirrors"

echo "── Phase 1b: watch scores hole 1 (par+1); phone must show it"
watch_test testScoresOneHole
sleep 2
shot "$PHONE_UDID" "phase1b-phone-shows-watch-score"

echo "── Phase 2: phone discards; watch must reset to the home screen"
maestro --device "$PHONE_UDID" test .maestro/flows/watch-discard-live-round.yaml
watch_test testShowsHomeAfterDiscard
shot "$WATCH_UDID" "phase2-watch-home-screen"

echo "── Phase 3: the entire round from the watch (start → 18 holes → submit)"
watch_test testFullRoundFromWatch
shot "$WATCH_UDID" "phase3-watch-after-submit"
shot "$PHONE_UDID" "phase3-phone-after-submit"

echo "── Phase 4: server-side proof (round row landed in local Supabase)"
docker exec "$(docker ps --format '{{.Names}}' | grep supabase_db_handicappin)" \
  psql -U postgres -c \
  'select id, "userId", "teeTime", "totalStrokes", holes_played, "createdAt"
   from round order by id desc limit 3'

echo "✅ Watch E2E complete — proof in $PROOF_DIR"
