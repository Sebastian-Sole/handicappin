# Native App Implementation — Handoff

> **Audience:** the agent implementing all screens and functionality in `apps/native`.
> **State of the world:** all infrastructure for web→native parity is built, validated, and gated. Your job is the product: port every screen, wire data/auth, and keep the gates green. This document is self-contained but links to the deeper specs — read those before writing code.
>
> Written 2026-06-10 at the end of the bring-up session. Branches: `feat/design-system-parity` (PR #127) → `feat/monorepo-native` (PR #128, stacked). If these are merged, everything below is on `main`.

---

## 1. The architecture in one paragraph

**One design system, two component libraries.** The web app (`apps/web`, Next.js 16) is the design source of truth. Design *values* (colors, spacing, radii, shadows, typography, surface recipes) live in `apps/web/app/globals.css` + `apps/web/app/styles/utilities/{typography,surfaces}.css` and are **generated** into a native-consumable contract by `packages/tokens` — change a web token, run `pnpm generate:theme` (pre-commit does it automatically), and the native theme updates with zero native edits. Component *structure* does NOT propagate: web JSX ≠ RN JSX, so every screen is authored twice — but tooling guarantees you can't forget (route gate, drift nudges) and can't cheat (hardcoded-style gate). This architecture is ported from a proven reference implementation (the ks-digital repo); `docs/web-native-parity.md` is the full spec.

## 2. Repo layout

```
apps/web/        Next.js app (app router, tRPC, Drizzle, Supabase, Stripe, shadcn/Tailwind v4)
apps/native/     Expo SDK 56 app — YOUR WORKSPACE (expo-router, NativeWind 5 preview)
packages/
  handicap-core/ Framework-agnostic USGA handicap math + zod schemas. BOTH apps import it.
                 Never duplicate calculation logic into native.
  tokens/        The design-token generator + generated contract (committed, never hand-edited)
scripts/parity/  Route/drift/style gates (see §4)
scripts/git-hooks/  Pre-commit chain (install once per clone: bash scripts/install-hooks.sh)
supabase/        Migrations + edge functions (shared backend infra)
docs/            web-native-parity.md (spec) · design-token-remediation.md (token tracker + Platform-Specific Register)
.claude/rules/web-native-parity.md   Binding rule (loaded into agent context)
.claude/skills/web-native-parity/    The port-and-verify playbook — read it
```

## 3. The token contract (what you style with)

`pnpm generate:theme` parses the web CSS and emits two artifacts:

- **`packages/tokens/generated/tokens.ts`** (`import { tokens } from "@handicappin/tokens/tokens"`):
  `colors.light/dark` (hex), `radii`, `spacing` (semantic ramp xs…5xl, px), `spacingScale` (numeric Tailwind steps), `sizes`, `breakpoints`, `tracking`, `shadows` (structured layers), `typography` (TypeSpec per `text-*` utility), `surfaces.light/dark` (resolved surface/tint/chip recipes), `fonts`.
- **`apps/native/global.css`** — the NativeWind entry. Generated. **Never hand-edit it.** It provides, under the SAME class names as web: all color utilities (`bg-primary`, `text-muted-foreground`, …, mode-switching via `:root`/`.dark` vars), the typography ramp (`text-heading-1…5`, `text-figure-*`, `text-body(-sm)`, `text-meta(-strong)`, `text-label-sm`, `text-eyebrow(-sm)`, `text-badge`, `text-lead`, `text-hero-*` — with bundled Inter face names and px units), semantic spacing (`p-md`, `gap-lg`…), sizes, and the surface recipes (`surface`, `surface-muted`, `surface-raised`, `tint-*`, `chip-*`, `icon-chip-*`, `formula-box`, `marketing-elevated`).

**Styling rules (enforced by `pnpm parity:styles`, pre-commit + CI):**
- Prefer className utilities from the generated theme — they match web class names, which keeps screens visually diffable against their web twins.
- Where className can't reach (animated styles, `contentContainerStyle` values, chart fills), use `tokens.*` values.
- NEVER hardcode hex/rgb/px-spacing/radius/font literals. Escape hatch for genuinely token-less values: `// allow-hardcoded <reason>` on the same line — use sparingly.
- If web introduces a value with no token, the fix is to ADD the token in web CSS and regenerate — not to hardcode it natively.
- Fonts: Inter static faces loaded in `apps/native/lib/fonts.ts` under exactly the names in `packages/tokens/src/font-faces.mjs` (`Inter_400Regular` … `Inter_800ExtraBold`). Don't set `fontWeight` alongside a static face.
- Out of contract (intentional): `hero-gradient`/`hero-radial` (need expo-linear-gradient — implement when porting the homepage and consider generating stops from tokens), and everything in the Platform-Specific Register in `docs/design-token-remediation.md`.

## 4. The gates (all live, all green right now)

| Command | What | When |
|---|---|---|
| `pnpm parity` | theme-drift + routes + native styles in one shot | pre-commit + CI on every PR |
| `pnpm parity:routes` | Auto-discovers routes from BOTH file routers, intersects slugs. Fails on undeclared divergence. | pre-commit + CI |
| `pnpm parity:drift [ref]` | Changed web files → affected shared routes (import-graph closure). A PostToolUse hook nudges agents on web UI edits; `pnpm parity:watch` is the live dev twin. | advisory |
| `pnpm parity:styles` | Scans `apps/native/{app,components,lib}` for style literals | pre-commit + CI |
| `pnpm check:tokens` | Web-side token-bypass guard | pre-commit + CI |
| `pnpm check:theme-drift` | Generated contract stale vs source | pre-commit regen + CI |
| native bundle job (ci.yml) | `expo export -p ios` — the REAL native CSS path | CI |

**The burn-down list** — `INTENTIONAL.webOnly` in `scripts/parity/routes.mjs` holds all 22 unported web routes. **Porting a screen = creating the same-slug file under `apps/native/app/` AND deleting its entry from that set.** The set must shrink to only genuinely web-only routes. The routes gate fails loudly if you forget either half, and also fails on stale entries.

## 5. Current state of `apps/native`

- Expo SDK 56, expo-router (typed routes), NativeWind `5.0.0-preview.4` + `react-native-css` 3.0.7, Tailwind v4. New architecture enabled. Scheme: `handicappin://`.
- `app/_layout.tsx` — splash held until the single `fontsReady` signal; zero-size `fonts-ready` test marker for the harness; `Stack` with headers hidden; `SafeAreaProvider`.
- `app/index.tsx` — a **token-gallery** bring-up screen (testID `token-gallery`). It is the only screen. Replace it with the real home screen when you port route `""` (and keep a gallery somewhere if useful for harness calibration — e.g. move it to a `__gallery` route declared in `INTENTIONAL.nativeOnly`).
- **Three bundling gotchas already handled — do not undo them** (details in the memory/commit `fix(native): make the iOS bundle actually compile…`):
  1. `apps/native/postcss.config.mjs` must exist (`@tailwindcss/postcss`) or native bundling fails with "Unknown at rule".
  2. `lightningcss` is pinned to `1.30.1` in root pnpm overrides (1.30.2 breaks react-native-css's AST deserialization). Don't lift the pin casually.
  3. The generator never emits empty `@utility` blocks (Tailwind v4 rejects them).
- Fast native-CSS validation without a simulator: `pnpm --filter native exec expo export -p ios`.
- Run: `pnpm --filter native ios` (simulator build), `pnpm dev:native` (Metro only), `pnpm dev:all` (web stack + Metro + parity watcher).

## 6. What is NOT built yet (your backlog beyond screens)

- **tRPC client + React Query wiring in native.** The web server already accepts `Authorization: Bearer <token>` as an auth fallback (added in PR #125 precisely for this) — `createTRPCContext` validates it via `supabase.auth.getUser(token)`. You need: a Supabase JS client for native auth (token storage via expo-secure-store), a tRPC client pointing at the web app's API URL with the bearer header, and React Query provider setup. Mirror web's query patterns (`apps/web/trpc/`).
- **Environment config** for the native app (API base URL per environment). Web uses `apps/web/env.ts` (t3-env); pick an Expo-appropriate equivalent (`app.config.ts` extra + zod validation) — do not scatter `process.env`.
- **Navigation shell** — web's authenticated pages share a navbar/PageContainer; decide the native equivalent (tab bar / drawer) with the user before porting authenticated screens. This is a product decision, not a parity decision.
- **`ios.bundleIdentifier`** in `app.json` — currently unset; Maestro flow + harness reference the prebuild default `com.anonymous.handicappin` (marked in `verification/config.mjs` and `.maestro/`). Set all three together.
- **Gradients** (`hero-gradient`/`hero-radial`) via expo-linear-gradient when the homepage is ported.
- **Dark-mode runtime validation** — the generated `.dark` var strategy compiles, but the runtime toggle (system scheme → NativeWind colorScheme) has not been confirmed on device. Validate early, on the gallery screen, before porting many screens.
- **EAS / store config** — entirely out of scope so far.

## 7. The QA framework (ported, awaiting calibration)

Everything lives in `apps/native/verification/` (55 hermetic tests: `pnpm --filter native verify:harness`).

- **Vision-judge harness** (`harness:run <screen>`): captures the iOS sim, compares against the web reference, judged by a 2-vote quorum of Claude (`claude-sonnet-4-6` default, `ANTHROPIC_MODEL` override; needs `ANTHROPIC_API_KEY`, degrades to human sign-off without it). Loop caps: 8 iterations/screen, no-progress halt, verdict cache keyed on inputs+rubric+model. Screens are configured in `verification/config.mjs` (`SCREENS`/`WEB_PATHS`) — **add each route as you port it**; rubrics live in `verification/rubrics/<screen>.yaml`. The judge prompt has NOT been calibrated on real captures yet — do that on the first ported screen.
- **Deterministic gates**: per-mode WCAG contrast against the generated tokens (`verify:contrast`), a11y matrix, capture hygiene, web prefilter with a denylist of known RN-web false positives.
- **Maestro** (`.maestro/` — CLI already installed on the dev machine): one smoke flow exists (`flows/smoke-token-gallery.yaml`). Convention: testID/accessible-name selectors only, never coordinates. Add a flow per ported screen's core behavior.
- **`scripts/compare-screen.sh <route>`** — manual side-by-side sim/web screenshots into `/tmp/`. Web side needs `pnpm dev` running on :3000; Supabase cookie auth means the browser profile must be logged in for authenticated routes (the ks localStorage fixture was removed — see the script header).

**Known waived finding:** dark-mode `--primary-foreground` on `--primary` = **4.27:1**, below WCAG 1.4.3's 4.5:1 — a WEB token bug. The contrast gate carries an exact-match frozen waiver (`KNOWN_SUBTHRESHOLD`) so any further regression still fails. The proper fix is adjusting dark `--primary`/`--primary-foreground` in `apps/web/app/globals.css` (then regenerate + delete the waiver). Raise it with the user before fixing — it changes the web's dark theme.

## 8. The per-screen porting workflow

For each route in the burn-down list:

1. Read the web page (`apps/web/app/<route>/page.tsx`) and its component closure (`pnpm parity:drift` shows what reaches it). Understand data needs (tRPC procedures used).
2. Build the same-slug screen under `apps/native/app/` (expo-router conventions; dynamic segments `[id].tsx` match web's `[id]/`). Compose from generated class names; structure mirrors web's visual hierarchy, not its DOM.
3. Delete the route from `INTENTIONAL.webOnly`; `pnpm parity:routes` must pass.
4. `pnpm parity:styles` + `pnpm --filter native check-types` + `expo export -p ios` must pass.
5. Add the screen to `verification/config.mjs` + a rubric; run `compare-screen.sh <route>` against running web, then `harness:run <route>` for the judged gate. Add/extend a Maestro flow for its behavior.
6. Commit (pre-commit chain enforces most of this). Keep commits per-screen or per-cluster.

**Recommended order:** confirm with the user which routes are genuinely web-only first (likely candidates: `about`, `contact`, `privacy-policy`, `terms-of-service` — legal/marketing pages; if so they move to a documented permanent `INTENTIONAL.webOnly` core). Then: auth foundation (`login`, `signup`, `forgot-password`, `update-password`, `verify-*`) since everything else needs a session → `onboarding` → home `""` (replaces the gallery) → `dashboard/[id]` + `rounds/add` + `rounds/[id]/calculation` (core loop, heavy `handicap-core` reuse) → `statistics` + `statistics/courses/[courseId]` (charts: recharts has no RN equivalent — expect a charting decision, e.g. victory-native; discuss with user) → `profile/[id]`, `calculators`, `billing`/`upgrade` (Stripe on native is a product/policy decision — ask before building IAP vs web-redirect).

## 9. Non-negotiables (from `.claude/rules/`)

- pnpm only. Strict TS, no `any`, no `enum`. Zod at trust boundaries.
- All handicap math through `@handicappin/handicap-core`.
- Never edit generated files (`packages/tokens/generated/`, `apps/native/global.css`).
- Never bypass gates with `--no-verify` / set-aside waivers without documenting in the tracker.
- WCAG 2.1 AA applies to native too (the a11y gate enforces touch targets, contrast, labels).
- Web is design truth: if a screen looks wrong, fix web first (tokens/components), then mirror — never fork the design natively.

## 10. Command cheat sheet

```bash
pnpm dev:all                        # web stack + Metro + parity watcher
pnpm --filter native ios            # simulator build (first run / native changes)
pnpm generate:theme                 # web CSS → token contract (pre-commit also does it)
pnpm parity                         # the gate: drift + routes + native styles
pnpm parity:drift                   # which routes does my web change affect?
pnpm --filter native exec expo export -p ios   # fast native-CSS pipeline check
pnpm --filter native verify:harness # QA framework unit tests
pnpm --filter native harness:run index         # judged visual gate for a screen
maestro test apps/native/.maestro/flows/<flow>.yaml
bash scripts/install-hooks.sh       # once per clone
```

## 11. Session history (context for the curious)

- **PR #126 (prior):** UI consistency remediation — token system graded A, compound utilities introduced.
- **2026-06-09:** full token audit; every bypass closed; `text-heading-5`/`text-hero-*` added; `--overlay`/`--size-*` tokens; `check:tokens` guard; `docs/design-token-remediation.md` tracker.
- **PR #127:** `@handicappin/tokens` generator ported from ks-digital (dual light/dark, `@utility` parsing, color-mix flattening, additive radius calc, em→px letter-spacing, Inter faces); 37 unit tests; magenta round-trip proven; pre-commit + `theme-drift.yml`; all parity gates ported armed-but-dormant.
- **PR #128:** web → `apps/web` (Vercel root dir must be `apps/web`); `apps/native` scaffolded; gates armed (1 shared route, 22-route backlog); QA framework ported (55 tests); native bundling fixed (postcss config, lightningcss pin, empty-utility fix) with an `expo export -p ios` CI job; `dev:all` orchestrates everything.
- The ks-digital reference repo is at `~/Documents/ks-digital`; its native app source lives ONLY on its branch `feat/expo-app-design-system` (read via `git -C ~/Documents/ks-digital show 'feat/expo-app-design-system:apps/app/<path>'`). Useful when porting patterns the docs don't cover (sheets, toasts, query wiring).

**Read next, in order:** `docs/web-native-parity.md` → `.claude/skills/web-native-parity/SKILL.md` → `scripts/parity/README.md` → `apps/native/verification/README.md` → `packages/tokens/generated/tokens.ts` (skim the interfaces).
