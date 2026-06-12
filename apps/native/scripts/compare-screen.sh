#!/usr/bin/env bash
# compare-screen.sh — capture a screen on native (iOS sim) + web side-by-side
# for parity review. Ported from the ks-digital reference and adapted to
# handicappin (web on :3000, Supabase cookie auth, handicappin:// scheme).
#
# Usage:  apps/native/scripts/compare-screen.sh <native-route> [web-path]
#   e.g.  apps/native/scripts/compare-screen.sh index /
#         apps/native/scripts/compare-screen.sh rounds            # → web /rounds
#         apps/native/scripts/compare-screen.sh "rounds/SOME_ID" "/rounds/SOME_ID"
#
# Prereqs:
#   - iOS sim booted with the app installed, Metro running
#   - web (apps/web Next.js) on :3000 (`pnpm dev`)
#   - agent-browser on PATH
#
# AUTH: handicappin's web app uses Supabase COOKIE auth — there is no
# localStorage fixture to inject (the ks repo's `bob-auth` trick does not
# apply). For authed routes the operator must either be logged in in the
# agent-browser profile beforehand, or compare logged-out routes only.
#
# Env overrides: WEB_BASE (default http://localhost:3000), SETTLE (native render wait, default 4)
set -uo pipefail

ROUTE="${1:?usage: compare-screen.sh <native-route> [web-path]}"
# Route slugs are [a-z0-9/_-] by construction; reject anything else so the
# slug can't escape the output dir (a bare "..") or smuggle URL syntax into
# the deep link.
if [[ ! "$ROUTE" =~ ^[a-zA-Z0-9][a-zA-Z0-9/_-]*$ ]]; then
  echo "error: route contains invalid characters: $ROUTE" >&2
  exit 1
fi
# Native route `index` is the root screen → web `/`; otherwise mirror the slug.
if [ "$ROUTE" = "index" ]; then DEFAULT_WEBPATH="/"; else DEFAULT_WEBPATH="/$ROUTE"; fi
WEBPATH="${2:-$DEFAULT_WEBPATH}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"
if [[ ! "$WEB_BASE" =~ ^https?:// ]]; then
  echo "error: WEB_BASE must be an http(s) URL: $WEB_BASE" >&2
  exit 1
fi
SETTLE="${SETTLE:-4}"
OUT="/tmp/handicappin-compare/${ROUTE//\//_}"
mkdir -p "$OUT"

# Deep link: the root screen is the bare scheme; other routes append the slug.
if [ "$ROUTE" = "index" ]; then DEEPLINK="handicappin://"; else DEEPLINK="handicappin://$ROUTE"; fi

echo "→ native: $DEEPLINK"
xcrun simctl openurl booted "$DEEPLINK" >/dev/null 2>&1 || echo "  (deep link failed — is the sim booted + app installed?)"
sleep "$SETTLE"
xcrun simctl io booted screenshot "$OUT/native.png" >/dev/null 2>&1 && echo "  ✓ $OUT/native.png" || echo "  ✗ native capture failed"

echo "→ web: $WEB_BASE$WEBPATH (phone viewport — log in first for authed routes)"
agent-browser set viewport 402 874 >/dev/null 2>&1
agent-browser open "$WEB_BASE$WEBPATH" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser eval "window.scrollTo(0,0)" >/dev/null 2>&1
sleep 1
agent-browser screenshot "$OUT/web.png" >/dev/null 2>&1 && echo "  ✓ $OUT/web.png (viewport)"
agent-browser screenshot "$OUT/web-full.png" --full >/dev/null 2>&1 && echo "  ✓ $OUT/web-full.png (full page)"

# Side-by-side (viewport shots, normalized height) for quick visual diff.
if command -v magick >/dev/null 2>&1; then
  magick montage "$OUT/web.png" "$OUT/native.png" -tile 2x1 -geometry +8+8 \
    -background '#dddddd' -resize x1500 "$OUT/compare.png" >/dev/null 2>&1 \
    && echo "  ✓ $OUT/compare.png (side-by-side)"
fi
echo "DONE: $OUT"
