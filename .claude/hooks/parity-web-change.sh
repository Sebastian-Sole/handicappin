#!/bin/bash
# PostToolUse hook: web↔native component parity nudge.
# Fires only when a web UI source file (app/, components/, lib/, hooks/,
# contexts/) is edited AND the native app exists. Computes which routes the
# change affects (import graph) and reminds the agent to update the SAME-SLUG
# native screen + run the parity gate.
# Non-blocking: feeds the affected-route list back to the model as context.
# Silent while apps/native is absent (Phase-1 dormancy).

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE_PATH" ] && exit 0
[ -z "$CLAUDE_PROJECT_DIR" ] && exit 0
[ -d "$CLAUDE_PROJECT_DIR/apps/native" ] || exit 0

case "$FILE_PATH" in
  */apps/*) exit 0 ;; # the native app itself
  */components/*.tsx | */components/*.ts | \
  */app/*.tsx | */app/*.ts | \
  */lib/*.tsx | */lib/*.ts | \
  */hooks/*.tsx | */hooks/*.ts | \
  */contexts/*.tsx | */contexts/*.ts) ;;
  *) exit 0 ;;
esac

# Skip files with no visual surface.
case "$FILE_PATH" in
  *.test.tsx | *.test.ts | *.stories.tsx | *.d.ts | */app/api/*) exit 0 ;;
esac

RESULT=$(node "$CLAUDE_PROJECT_DIR/scripts/parity/drift.mjs" HEAD 2>&1)

# Only nudge when the change actually reaches a shared route.
if echo "$RESULT" | grep -q "need a web↔native parity re-check"; then
  echo ""
  echo "--- WEB↔NATIVE PARITY: you edited a web UI file ---"
  echo "$RESULT" | sed -n '/need a web↔native parity re-check/,$p'
  echo "---"
  echo "The web app is the design source of truth, but native components are a SEPARATE"
  echo "implementation. For each affected route above, update the SAME-SLUG native screen"
  echo "in apps/native/ to match, then run: pnpm parity"
  echo "Design TOKENS auto-propagate via 'pnpm generate:theme'; component STRUCTURE does not."
fi

exit 0
