# Web ↔ Native Parity — how it works (Phase 1)

How the future native app will be kept 1:1 with the web app, and what is already enforced today. Ported from the ks-digital reference architecture. Read this before changing design tokens or utility recipes.

## Mental model: one design system, two component libraries

There is **one design system** — the tokens and utility recipes defined in `app/globals.css` + `app/styles/utilities/{typography,surfaces}.css`. Web consumes them directly via Tailwind; the native app will consume them through the **generated contract** in `packages/tokens`.

There will be **two component libraries** — web components (DOM + Tailwind + shadcn) and native components (RN primitives + NativeWind). They can't share code, so each is authored separately, but **both pull from the one token source**. Write-once frameworks were evaluated and rejected in the reference project (SSR + shadcn accessibility are not negotiable); the same trade-off holds here.

## What exists today (Phase 1 — no native app yet)

### The generator — `pnpm generate:theme`

`packages/tokens/src/generate.mjs` parses the design-system source with a real CSS AST (postcss) and emits:

- **`generated/tokens.ts`** — typed, framework-agnostic token object:
  - `colors: { light, dark }` — every `--color-*` resolved to hex per mode (OKLCH converted, `var()` chains followed, dark falls back to light)
  - `radii` (additive `calc(var(--radius) ± Npx)` resolved), `spacing` (semantic ramp xs..5xl), `spacingScale` (numeric Tailwind steps), `sizes` (`--size-*`), `breakpoints`, `tracking` (em)
  - `shadows` — structured `{offsetX, offsetY, blur, spread, color}` layers, rem-aware, hex colors
  - `typography` — every `@utility text-*` as a TypeSpec (px + rem, em letter-spacing pre-multiplied to px per entry, unitless line-heights expanded)
  - `surfaces: { light, dark }` — the `surface/tint-*/chip-*/icon-chip-*/formula-box/marketing-elevated` recipes with `color-mix(in oklab, X N%, transparent)` flattened to `X` at N% alpha per mode
  - `fonts` + `src/font-faces.mjs` — Inter face registry (`Inter_400Regular`…`Inter_800ExtraBold`) the native font loader must register
- **`generated/native-global.css`** — preview of the future `apps/native/global.css` NativeWind entry: `@theme inline` slots + `:root`/`.dark` runtime vars (hex), `@utility text-*` ramp (px + bundled faces), surface utilities under the **same class names as web**.

Deliberately **not** in the contract (skipped, printed on every run): the `max-w-*`/`min-w-*` container workarounds (web-only) and `hero-gradient`/`hero-radial` (gradients need expo-linear-gradient — Phase 2). The Platform-Specific Register in `docs/design-token-remediation.md` lists per-component out-of-contract values.

### Enforcement (defense in depth)

| Layer | Catches | Hard or soft | Where |
|---|---|---|---|
| `pnpm check:tokens` | web styling that bypasses tokens (6 violation classes) | HARD | pre-commit |
| pre-commit regen | token source changed → outputs auto-regenerated + staged | automatic | `scripts/git-hooks/pre-commit` |
| `pnpm check:theme-drift` | committed generated contract stale vs source | HARD | CI (`.github/workflows/theme-drift.yml`) + manual |
| generator unit tests (37) | parser/serializer regressions | HARD | CI + `pnpm --filter @handicappin/tokens test` |
| strict tsc on `tokens.ts` | malformed generated contract | HARD | CI |

Install the git hook once per clone: `bash scripts/install-hooks.sh`.

> Proven (2026-06-10): set `--primary` to magenta in `globals.css`, ran `generate:theme` — `tokens.colors.light.primary`, `surfaces.light['tint-primary'].backgroundColor`, and `native-global.css` all went magenta with zero manual edits. Reverted; outputs byte-identical. Editing the source *without* regenerating makes `check:theme-drift` exit non-zero.

## The honest boundary

- **Value changes propagate automatically** — a token edit + `generate:theme` (or just committing; the hook regenerates) updates the entire native contract.
- **Component/structure changes will not propagate** — when the native app exists, web component changes must be mirrored by hand. Phase 2 ports the rest of the reference tooling so you can't *forget* (route intersection, import-graph drift nudges, PostToolUse hook) and can't *cheat* (native hardcoded-style gate, visual parity judge).

## Phase 2 — when `apps/native` lands (port from ks-digital)

1. Point `theme.config.json` `outputs.nativeCss` at `apps/native/global.css`; validate against a real NativeWind build (incl. dark-mode strategy and the `@custom-variant dark` wiring).
2. Port `scripts/parity/{routes,drift,watch}.mjs` (web root here is the repo root, not `apps/web` — adjust path constants and tsconfig baseUrl resolution) and add the route gate + drift nudge to pre-commit and `.claude/hooks`.
3. Port `check-hardcoded-styles.mjs` into the native app (native twin of `check:tokens`).
4. Port `.claude/rules/web-native-parity.md` + the `web-native-parity` skill, the `parity-web-change.sh` PostToolUse hook, and `compare-screen.sh` + the vision-judge verification harness.
5. Add `apps/*` to `pnpm-workspace.yaml`; gradients (`hero-gradient`/`hero-radial`) get expo-linear-gradient equivalents generated from the same source.

## Files

- `app/globals.css` + `app/styles/utilities/{typography,surfaces}.css` — the design-system source of truth (hand-edited).
- `packages/tokens/` — generator + generated contract (`generated/` is committed; never hand-edit).
- `packages/tokens/theme.config.json` — source paths, mode selectors, font stacks, surface contract prefixes.
- `scripts/git-hooks/pre-commit` + `scripts/install-hooks.sh` — commit-time regen + token guard.
- `.github/workflows/theme-drift.yml` — CI backstop.
- `docs/design-token-remediation.md` — token-discipline tracker + Platform-Specific Register.
