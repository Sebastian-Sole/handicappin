# Web ↔ Native Parity — how it works (Phase 1)

How the future native app will be kept 1:1 with the web app, and what is already enforced today. Ported from the ks-digital reference architecture. Read this before changing design tokens or utility recipes.

## Mental model: one design system, two component libraries

There is **one design system** — the tokens and utility recipes defined in `apps/web/app/globals.css` + `apps/web/app/styles/utilities/{typography,surfaces}.css`. Web consumes them directly via Tailwind; the native app will consume them through the **generated contract** in `packages/tokens`.

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
- `scripts/parity/drift.mjs` (`pnpm parity:drift`) — import-graph closure (`@/` → apps/web): changed web file → affected same-slug native screens. Advisory; exits 1 on affected shared routes once native exists.
- `scripts/parity/watch.mjs` (`pnpm parity:watch`) — live dev signal.
- `scripts/parity/check-hardcoded-styles.mjs` (`pnpm parity:styles`) — native twin of `check:tokens`; HARD pre-commit gate; `// allow-hardcoded <reason>` escape hatch.
- `pnpm parity` — the one-shot gate (theme-drift + routes + native styles).
- Agent harness: `.claude/rules/web-native-parity.md` (binding rule), `.claude/skills/web-native-parity/` (playbook), `.claude/hooks/parity-web-change.sh` (PostToolUse nudge; silent while dormant).
- `pnpm-workspace.yaml` already includes `apps/*`.

## Phase 3 — native bring-up (STARTED 2026-06-10)

Done:

1. ✅ `apps/native` scaffolded: Expo SDK 56 + expo-router + NativeWind 5 preview (`react-native-css`) + `@expo-google-fonts/inter` registering exactly the `FONT_FACES` names. Single `fontsReady` splash gate with a harness-visible marker.
2. ✅ Generator targets `apps/native/global.css` (drift-checked). Validated via `expo export -p web` (Metro + NativeWind): compiled CSS contains the typography ramp with Inter faces, surface recipes with per-mode vars, and both light and dark token values. Runtime dark-mode *toggle* still needs on-device confirmation.
3. ✅ `INTENTIONAL.webOnly` seeded with the 22-route burn-down backlog; gates armed and green (`parity:routes`, `parity:styles`).
4. ✅ QA framework ported (`apps/native/verification/`, 55 hermetic tests): vision-judge quorum (default `claude-sonnet-4-6`, needs `ANTHROPIC_API_KEY`), per-mode WCAG contrast gate against the generated tokens, a11y matrix, capture hygiene, web prefilter, verdict cache, loop control. `compare-screen.sh` + Maestro onboarding (`.maestro/README.md`, smoke flow; install Maestro CLI per that README).
5. ✅ `pnpm parity` + `check:tokens` run in CI on all PRs (ci.yml `parity` job).

Remaining (screen-porting era):

6. Port screens route by route, deleting each from `INTENTIONAL.webOnly`; first sim run: `pnpm --filter native ios`, then calibrate the vision judge on real captures (`pnpm --filter native harness:run index`).
7. Set `ios.bundleIdentifier` in `apps/native/app.json` (Maestro flow + harness `appId` reference the prebuild default `com.anonymous.handicappin` until then — update together).
8. Gradients: expo-linear-gradient equivalents for `hero-gradient`/`hero-radial` when the homepage is ported.
9. **Known WCAG finding (web-side fix needed):** dark-mode `--primary-foreground` on `--primary` measures 4.27:1 (< 4.5:1, WCAG 1.4.3). The contrast gate carries a frozen waiver so regressions still fail; the real fix belongs in `apps/web/app/globals.css` dark `--primary`/`--primary-foreground`.

## Files

- `apps/web/app/globals.css` + `apps/web/app/styles/utilities/{typography,surfaces}.css` — the design-system source of truth (hand-edited).
- `packages/tokens/` — generator + generated contract (`generated/` is committed; never hand-edit).
- `packages/tokens/theme.config.json` — source paths, mode selectors, font stacks, surface contract prefixes.
- `scripts/git-hooks/pre-commit` + `scripts/install-hooks.sh` — commit-time regen + token guard.
- `.github/workflows/theme-drift.yml` — CI backstop.
- `docs/design-token-remediation.md` — token-discipline tracker + Platform-Specific Register.
