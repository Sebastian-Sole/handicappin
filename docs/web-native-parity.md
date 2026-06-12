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

## Phase 2 — parity enforcement (PORTED 2026-06-10, armed-but-dormant)

All deterministic parity tooling is in place and **activates automatically the moment `apps/native/app` exists** — no rewiring:

- `scripts/parity/routes.mjs` (`pnpm parity:routes`) — route auto-discovery + intersection; HARD pre-commit gate. Deliberate divergences go in its `INTENTIONAL` sets; during native bring-up, seed `INTENTIONAL.webOnly` with not-yet-ported routes and burn it down.
- `scripts/parity/drift.mjs` (`pnpm parity:drift`) — import-graph closure (`@/` → repo root): changed web file → affected same-slug native screens. Advisory; exits 1 on affected shared routes once native exists.
- `scripts/parity/watch.mjs` (`pnpm parity:watch`) — live dev signal.
- `scripts/parity/check-hardcoded-styles.mjs` (`pnpm parity:styles`) — native twin of `check:tokens`; HARD pre-commit gate; `// allow-hardcoded <reason>` escape hatch.
- `pnpm parity` — the one-shot gate (theme-drift + routes + native styles).
- Agent harness: `.claude/rules/web-native-parity.md` (binding rule), `.claude/skills/web-native-parity/` (playbook), `.claude/hooks/parity-web-change.sh` (PostToolUse nudge; silent while dormant).
- `pnpm-workspace.yaml` already includes `apps/*`.

## Phase 3 — native bring-up (the remaining work, needs the actual app)

1. Scaffold `apps/native` (Expo + NativeWind v5 + `@expo-google-fonts/inter` registering exactly the `FONT_FACES` names from `packages/tokens/src/font-faces.mjs`).
2. Point `theme.config.json` `outputs.nativeCss` at `apps/native/global.css`; validate the generated theme against a real NativeWind build — especially the dark-mode strategy (`.dark`-scoped vars + `@custom-variant dark`) and the surface utility classes.
3. Seed `INTENTIONAL.webOnly` in `routes.mjs` with the unported route list; port screens, burning the list down.
4. Gradients: give `hero-gradient`/`hero-radial` expo-linear-gradient equivalents (generator currently skips them and prints the skip list on every run).
5. Port the visual verification layer from ks-digital once there is something to screenshot: `compare-screen.sh` (side-by-side sim/web capture) and the vision-judge harness (`apps/app/verification/` — quorum judging, iteration caps, verdict cache). Deliberately NOT ported now: it is inert without a booted simulator and a running app.
6. Add `pnpm parity` to CI on all PRs (today only `theme-drift.yml` runs, scoped to token paths).

## Files

- `app/globals.css` + `app/styles/utilities/{typography,surfaces}.css` — the design-system source of truth (hand-edited).
- `packages/tokens/` — generator + generated contract (`generated/` is committed; never hand-edit).
- `packages/tokens/theme.config.json` — source paths, mode selectors, font stacks, surface contract prefixes.
- `scripts/git-hooks/pre-commit` + `scripts/install-hooks.sh` — commit-time regen + token guard.
- `.github/workflows/theme-drift.yml` — CI backstop.
- `docs/design-token-remediation.md` — token-discipline tracker + Platform-Specific Register.
