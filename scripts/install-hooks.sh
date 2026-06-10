#!/usr/bin/env bash
# Install the repo git hooks (idempotent). Run once per clone:
#   bash scripts/install-hooks.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

HOOK_DIR="$(git rev-parse --git-path hooks)"
mkdir -p "$HOOK_DIR"
cp scripts/git-hooks/pre-commit "$HOOK_DIR/pre-commit"
chmod +x "$HOOK_DIR/pre-commit"
echo "Installed pre-commit hook -> $HOOK_DIR/pre-commit"
