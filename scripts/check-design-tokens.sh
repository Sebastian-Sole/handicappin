#!/usr/bin/env bash
# Design-token regression guard.
#
# Fails when component code reintroduces styling that bypasses the design
# token system (apps/web/app/globals.css + apps/web/app/styles/utilities/*).
# Each check mirrors a violation class closed by
# docs/design-token-remediation.md — keep the two in sync when adding checks
# or exceptions.
#
# Usage: pnpm check:tokens
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

SCAN_DIRS=(apps/web/app apps/web/components apps/web/hooks apps/web/contexts apps/web/lib)
fail=0

# grep wrapper: $1 = check name, $2 = extended regex, $3 = exclusion regex
# applied to matching lines (file-path based allowlist; always excludes
# storybook files, which are dev-only and out of the token contract).
check() {
  local name="$1" pattern="$2" allow="${3:-__none__}"
  local hits
  hits=$(grep -rEn "$pattern" "${SCAN_DIRS[@]}" --include='*.tsx' --include='*.ts' 2>/dev/null |
    grep -v '\.stories\.' | grep -v '\.d\.ts:' | grep -vE "$allow" || true)
  if [[ -n "$hits" ]]; then
    echo "FAIL: $name"
    echo "$hits" | head -20
    echo
    fail=1
  fi
}

# 1. Raw Tailwind palette colors — use semantic color tokens instead.
check "raw palette colors (bg-blue-500 etc.)" \
  '(bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(/[0-9]+)?'

# 2. Color literals in class strings — tokens only.
#    Allowed: chart.tsx (recharts attribute selectors targeting vendor
#    defaults like [stroke='#ccc'], not paint we apply).
check "color literals in className (hex/oklch/rgb/hsl)" \
  'className=[^=]*(#[0-9a-fA-F]{3,8}|oklch\(|rgba?\(|hsla?\()' \
  'components/ui/chart\.tsx'

# 3. hsl(var(--…)) wrapping — tokens are OKLCH; this produces invalid CSS.
check "hsl(var(--…)) wrapper (invalid around OKLCH tokens)" 'hsla?\(var\('

# 4. Arbitrary breakpoints — the --breakpoint-* vocabulary is closed (TD-3).
check "arbitrary breakpoint variants (min-[NNNpx]:)" \
  '(min|max)-\[[0-9]+px\]:'

# 5. Hardcoded scrims — use the --overlay token (bg-overlay).
check "raw black/white scrim (bg-black/NN)" \
  'bg-(black|white)/[0-9]+'

# 6. Size+weight type composes — use the named type scale
#    (text-heading-*, text-figure-*, text-badge, text-meta-strong, …).
#    Allowed: badge.tsx and typography.tsx carry documented
#    "Intentional compose … by design" exceptions from #126.
check "raw size+weight compose (text-lg font-semibold etc.)" \
  'text-(xs|sm|base|lg|xl|[2-7]xl) font-(medium|semibold|bold|extrabold)|font-(medium|semibold|bold|extrabold) text-(xs|sm|base|lg|xl|[2-7]xl)' \
  'components/ui/(badge|typography)\.tsx'

if [[ "$fail" -ne 0 ]]; then
  echo "Design-token check failed. Use tokens from apps/web/app/globals.css /"
  echo "apps/web/app/styles/utilities/, or register a documented exception in"
  echo "docs/design-token-remediation.md and this script."
  exit 1
fi
echo "check:tokens OK — no token bypasses detected."
