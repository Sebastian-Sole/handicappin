#!/bin/bash
# PostToolUse hook: Run ESLint jsx-a11y rules on modified TSX/JSX files.
# Feeds violations back to Claude as context (non-blocking).

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if no file path.
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only React component files.
case "$FILE_PATH" in
  *.tsx|*.jsx) ;;
  *) exit 0 ;;
esac

# Skip if file was deleted.
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Require pnpm + an ESLint install at the project root.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ ! -x "$PROJECT_DIR/node_modules/.bin/eslint" ]; then
  exit 0
fi

# Run ESLint on the single file, then filter for jsx-a11y rule IDs.
# eslint-config-next already pulls in eslint-plugin-jsx-a11y, so we don't
# need a separate config -- just use the project's flat config.
cd "$PROJECT_DIR" || exit 0
RESULT=$(./node_modules/.bin/eslint --format compact "$FILE_PATH" 2>&1)
A11Y_LINES=$(echo "$RESULT" | grep -E "jsx-a11y/|[[:space:]]a11y/" || true)

if [ -n "$A11Y_LINES" ]; then
  COUNT=$(echo "$A11Y_LINES" | wc -l | tr -d ' ')
  echo ""
  echo "--- A11Y CHECK: $COUNT violation(s) in $(basename "$FILE_PATH") ---"
  echo "$A11Y_LINES"
  echo "---"
  echo "Fix these WCAG 2.1 AA violations before continuing."
fi

exit 0
