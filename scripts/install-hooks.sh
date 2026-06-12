#!/usr/bin/env bash
# Install the repo git hooks (idempotent). Run once per clone:
#   bash scripts/install-hooks.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

HOOK_DIR="$(git rev-parse --git-path hooks)"
mkdir -p "$HOOK_DIR"

# Preserve a foreign pre-commit hook (husky, commitlint, hand-rolled): back it
# up instead of clobbering it. Our own hook is recognized by its header line.
TARGET="$HOOK_DIR/pre-commit"
if [[ -f "$TARGET" ]] && ! grep -q "Pre-commit gate" "$TARGET"; then
  mv "$TARGET" "$TARGET.backup"
  echo "Existing non-repo pre-commit hook moved to $TARGET.backup — merge it manually if still needed."
fi

cp scripts/git-hooks/pre-commit "$TARGET"
chmod +x "$TARGET"
echo "Installed pre-commit hook -> $TARGET"
