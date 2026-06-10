# Native App Implementation — Goal Handoff

> **Audience:** the autonomous agent implementing the native app end-to-end.
> **State of the world:** all infrastructure for web→native parity is built, validated, and gated. Your job is the product: port every in-scope screen, wire data/auth, and drive the repo to the Definition of Done below. This document is self-contained but links to deeper specs — read those before writing code.
>
> Written 2026-06-10/11 at the end of the bring-up session. Branches: `feat/design-system-parity` (PR #127) → `feat/monorepo-native` (PR #128, stacked). If merged, everything below is on `main`. Do your work on a new branch stacked on the latest of these.

---

## 0. Mission and Definition of Done

**Mission:** a "shippable" native app — **sim-complete + EAS-ready**. Every in-scope screen works in the iOS simulator with real data and auth; every gate is green; store submission is explicitly OUT of scope.

**Definition of Done — all of the following, machine-checkable:**

1. `INTENTIONAL.webOnly` in `scripts/parity/routes.mjs` contains EXACTLY the seven permanently web-only routes (§1 decision ledger) with a comment marking them permanent — every other route has a same-slug native screen.
2. All ported screens are wired to real data through tRPC + Supabase bearer auth (no stub data on any screen, except the RevenueCat mock specified in the ledger).
3. Green, from the repo root: `pnpm parity` · `pnpm check:tokens` · `pnpm lint` · `pnpm --filter web exec tsc --noEmit` · `pnpm --filter web test` (506+ tests) · `pnpm --filter @handicappin/tokens test` (37+) · `pnpm --filter native check-types` · `pnpm --filter native lint` · `pnpm --filter native verify:harness` (55+) · `pnpm --filter native exec expo export -p ios`.
4. Maestro flows pass on a booted simulator: the existing smoke flow, one flow per tab (Home, Rounds, Statistics, Profile), and an auth round-trip (login → home → logout).
5. Visual parity evidence exists for every ported route: `compare-screen.sh` captures, plus a recorded verdict. Judging is in-band by default — YOU are vision-capable: Read the native capture and the web reference side-by-side, evaluate against the screen's rubric (`verification/rubrics/`), and record verdict + reasoning per route in the implementation log. The scripted vision-judge harness (`harness:run`) is an optional upgrade if `ANTHROPIC_API_KEY` happens to be set (it adds an independent 2-vote quorum + verdict cache); never block on its absence.
6. EAS-ready: `ios.bundleIdentifier` set (use `com.handicappin.app`; update the Maestro flows and `verification/config.mjs` appId together — they are cross-referenced), app icon + splash regenerated from brand tokens, `eas.json` present with development/preview/production profiles, and `pnpm --filter native exec expo prebuild --no-install` succeeds. NO `eas build`/`eas submit` — those need the owner's Apple credentials.
7. Nontrivial native logic (auth/session module, billing mock, chart data shaping) has unit tests wired into `pnpm --filter native test`.
8. All work committed (per-screen or per-cluster commits; the pre-commit chain stays installed and is never bypassed with `--no-verify`) and a PR is open with a summary table: route → status → visual evidence → flows.
9. `docs/native-implementation-log.md` exists and records every decision made under the autonomy protocol (§0b), every waiver, and anything deferred.

### 0b. Autonomy protocol

You run unattended. Do not stop to ask questions. When you hit ambiguity not covered by this document: choose the safest option that preserves web-design parity, record it in `docs/native-implementation-log.md` (what, why, alternatives), and continue. Only halt for: (a) required secrets that do not exist anywhere in the repo/env (document exactly what is needed and why), (b) an action that is irreversible outside the repo (store submission, sending real emails/charges), or (c) a Definition-of-Done item that is provably impossible — in which case finish everything else first, then report.

Budget your iterations: prefer finishing a screen fully (data + gates + flow + capture) before starting the next. If the visual judge fails a screen twice on the same finding, fix forward once more, then waive with a logged rationale and move on — perfect pixel parity is not worth stalling the goal; the log makes it auditable.

## 1. Decision ledger (LOCKED — do not relitigate)

| Decision | Verdict |
|---|---|
| **Web-only routes (permanent)** | `about`, `contact`, `privacy-policy`, `terms-of-service`, `billing`, `billing/success`, `upgrade`. Native links out to the website where these are reachable (e.g. profile → legal links via `expo-web-browser`). |
| **Routes to port (16)** | `""` (home), `auth/verify-session`, `calculators`, `dashboard/[id]`, `forgot-password`, `login`, `onboarding`, `profile/[id]`, `rounds/[id]/calculation`, `rounds/add`, `signup`, `statistics`, `statistics/courses/[courseId]`, `update-password`, `verify-email`, `verify-signup`. |
| **Native `""` (home)** | The authenticated home experience, NOT web's marketing landing page (mobile apps don't ship marketing landers). Logged-out users land on `login`. Web's logged-in homepage content (hero stats, recent rounds) is the design reference. |
| **Navigation shell** | Bottom tab bar: **Home, Rounds, Statistics, Profile** (expo-router tab layout). Auth screens live in a stack outside the tabs. Calculators reachable from Home or Profile (your call — log it). Token-styled: active tint `--primary`, surfaces from tokens. |
| **Billing** | **RevenueCat-shaped mock.** Build `apps/native/lib/billing/` exposing the surface of `react-native-purchases` (configure, getOfferings, purchasePackage, getCustomerInfo, restorePurchases) backed by a mock provider that reflects the user's actual subscription state read via tRPC, and a paywall screen/sheet driven by it. Real RevenueCat integration is a later milestone — keep the seam clean so swapping the mock for the SDK is a one-module change. Subscription STATE shown in profile must be real (tRPC); only purchase/restore flows are mocked (log + optimistic no-op or clearly-labelled dev action). |
| **Charts** | **victory-native** (Skia-based). Colors/typography fed exclusively from `tokens.colors.*` / `tokens.typography` — chart code is a `parity:styles`-scanned area; use `// allow-hardcoded` only for chart-internal geometry, never colors. Visual reference: web's recharts components (`apps/web/components/charts/`). |
| **Ship target** | Sim-complete + EAS-ready (see DoD #6). No store submission. |

## 2. The architecture in one paragraph

**One design system, two component libraries.** The web app (`apps/web`, Next.js 16) is the design source of truth. Design *values* (colors, spacing, radii, shadows, typography, surface recipes) live in `apps/web/app/globals.css` + `apps/web/app/styles/utilities/{typography,surfaces}.css` and are **generated** into a native-consumable contract by `packages/tokens` — change a web token, run `pnpm generate:theme` (pre-commit does it automatically), and the native theme updates with zero native edits. Component *structure* does NOT propagate: web JSX ≠ RN JSX, so every screen is authored twice — but tooling guarantees you can't forget (route gate, drift nudges) and can't cheat (hardcoded-style gate). Architecture ported from a proven reference (the ks-digital repo); `docs/web-native-parity.md` is the full spec.

## 3. Repo layout

```
apps/web/        Next.js app (app router, tRPC, Drizzle, Supabase, Stripe, shadcn/Tailwind v4)
apps/native/     Expo SDK 56 app — YOUR WORKSPACE (expo-router, NativeWind 5 preview)
packages/
  handicap-core/ Framework-agnostic USGA handicap math + zod schemas. BOTH apps import it.
                 Never duplicate calculation logic into native.
  tokens/        The design-token generator + generated contract (committed, never hand-edited)
scripts/parity/  Route/drift/style gates (see §5)
scripts/git-hooks/  Pre-commit chain (install once per clone: bash scripts/install-hooks.sh)
supabase/        Migrations + edge functions (shared backend infra)
docs/            web-native-parity.md (spec) · design-token-remediation.md (token tracker + Platform-Specific Register)
.claude/rules/web-native-parity.md   Binding rule
.claude/skills/web-native-parity/    The port-and-verify playbook — read it
```

## 4. The token contract (what you style with)

`pnpm generate:theme` parses the web CSS and emits two artifacts:

- **`packages/tokens/generated/tokens.ts`** (`import { tokens } from "@handicappin/tokens/tokens"`):
  `colors.light/dark` (hex), `radii`, `spacing` (semantic ramp xs…5xl, px), `spacingScale` (numeric Tailwind steps), `sizes`, `breakpoints`, `tracking`, `shadows` (structured layers), `typography` (TypeSpec per `text-*` utility), `surfaces.light/dark` (resolved surface/tint/chip recipes), `fonts`.
- **`apps/native/global.css`** — the NativeWind entry. Generated. **Never hand-edit it.** It provides, under the SAME class names as web: all color utilities (`bg-primary`, `text-muted-foreground`, …, mode-switching via `:root`/`.dark` vars), the typography ramp (`text-heading-1…5`, `text-figure-*`, `text-body(-sm)`, `text-meta(-strong)`, `text-label-sm`, `text-eyebrow(-sm)`, `text-badge`, `text-lead`, `text-hero-*` — bundled Inter faces, px units), semantic spacing (`p-md`, `gap-lg`…), sizes, and the surface recipes (`surface`, `surface-muted`, `surface-raised`, `tint-*`, `chip-*`, `icon-chip-*`, `formula-box`, `marketing-elevated`).

**Styling rules (enforced by `pnpm parity:styles`, pre-commit + CI):**
- Prefer className utilities from the generated theme — they match web class names, keeping screens visually diffable against their web twins.
- Where className can't reach (animated styles, `contentContainerStyle` values, chart props), use `tokens.*` values.
- NEVER hardcode hex/rgb/px-spacing/radius/font literals. Escape hatch for genuinely token-less values: `// allow-hardcoded <reason>` on the same line — use sparingly and log each one.
- If web introduces a value with no token, ADD the token in web CSS and regenerate — don't hardcode it natively.
- Fonts: Inter static faces loaded in `apps/native/lib/fonts.ts` under exactly the names in `packages/tokens/src/font-faces.mjs` (`Inter_400Regular` … `Inter_800ExtraBold`). Don't set `fontWeight` alongside a static face.
- Out of contract (intentional): `hero-gradient`/`hero-radial` — implement with `expo-linear-gradient` when a screen needs them, deriving stops from `tokens.colors` (10%/20% alpha pattern, see `apps/web/app/styles/utilities/surfaces.css`); and everything in the Platform-Specific Register in `docs/design-token-remediation.md`.

## 5. The gates (all live, all green at handoff)

| Command | What | When |
|---|---|---|
| `pnpm parity` | theme-drift + routes + native styles in one shot | pre-commit + CI on every PR |
| `pnpm parity:routes` | Auto-discovers routes from BOTH file routers, intersects slugs. Fails on undeclared divergence. | pre-commit + CI |
| `pnpm parity:drift [ref]` | Changed web files → affected shared routes (import-graph closure); `pnpm parity:watch` is the live dev twin | advisory |
| `pnpm parity:styles` | Scans `apps/native/{app,components,lib}` for style literals | pre-commit + CI |
| `pnpm check:tokens` | Web-side token-bypass guard | pre-commit + CI |
| `pnpm check:theme-drift` | Generated contract stale vs source | pre-commit regen + CI |
| native bundle job (ci.yml) | `expo export -p ios` — the REAL native CSS path | CI |

**The burn-down list** — `INTENTIONAL.webOnly` in `scripts/parity/routes.mjs` holds the unported routes. **Porting a screen = creating the same-slug file under `apps/native/app/` AND deleting its entry from that set.** Tab-group files like `app/(tabs)/index.tsx` work — route groups `(…)` are stripped by the gate on both sides. The gate fails loudly on forgotten halves and stale entries.

## 6. Current state of `apps/native`

- Expo SDK 56, expo-router (typed routes), NativeWind `5.0.0-preview.4` + `react-native-css` 3.0.7, Tailwind v4. New architecture enabled. Scheme: `handicappin://`.
- `app/_layout.tsx` — splash held until the single `fontsReady` signal; zero-size `fonts-ready` test marker; `Stack`; `SafeAreaProvider`.
- `app/index.tsx` — a **token-gallery** bring-up screen (testID `token-gallery`), the only screen. When you port home, move the gallery to a `__gallery` route declared in `INTENTIONAL.nativeOnly` (it stays useful for harness calibration and dark-mode checks).
- **Three bundling gotchas already handled — do not undo** (commit `fix(native): make the iOS bundle actually compile…`):
  1. `apps/native/postcss.config.mjs` must exist (`@tailwindcss/postcss`) or native bundling fails with "Unknown at rule".
  2. `lightningcss` is pinned to `1.30.1` in root pnpm overrides (1.30.2 breaks react-native-css 3.0.7's AST deserialization: "expected an object-like struct named Specifier"). Don't lift the pin.
  3. The generator never emits empty `@utility` blocks (Tailwind v4 rejects them).
- Fast native-CSS validation without a simulator: `pnpm --filter native exec expo export -p ios`.
- Run: `pnpm --filter native ios` (simulator build), `pnpm dev:native` (Metro), `pnpm dev:all` (web stack + Metro + parity watcher).
- **Dark mode:** the generated `.dark`-class var strategy compiles, but the runtime toggle (system scheme → class) is UNVERIFIED on device. Validate on the gallery screen FIRST (before porting many screens). If class-based switching doesn't work under react-native-css, the sanctioned fix is changing the generator's dark emission to `@media (prefers-color-scheme: dark)` in `serializeNativeGlobalCss` (`packages/tokens/src/generate.mjs`) — keep `tokens.ts` per-mode shape unchanged, update generator tests, log the change.

## 7. Foundation work you must build first (in this order)

1. **Env config** — `apps/native/lib/env.ts` (zod-validated, fed from `app.config.ts` extra). Needs: Supabase URL + anon key (copy the public values from `apps/web/.env` — they are client-exposed by design) and the API base URL (dev: `http://localhost:3000`, reachable from the iOS simulator).
2. **Auth/session** — Supabase JS client for native with `expo-secure-store` token persistence; session provider; logged-out redirect to `login`. The web server already accepts `Authorization: Bearer <access_token>` (added in PR #125: `createTRPCContext` validates via `supabase.auth.getUser(token)`; cookie wins when both present). Google OAuth: use the web flow via `expo-web-browser`/`expo-auth-session` if straightforward; otherwise email/password first and log a deferral.
3. **tRPC client + React Query** — mirror `apps/web/trpc/` patterns; attach the bearer header from the session; superjson transformer to match the server.
4. **Tab shell** — `app/(tabs)/_layout.tsx` per the ledger; auth stack outside it.
5. **Billing mock** — `apps/native/lib/billing/` per the ledger.
6. **Charts** — add victory-native (+ its Skia peer deps); build thin wrappers (`components/charts/`) that consume `tokens` so screens never touch chart internals directly.

Then port screens. **Order:** auth cluster (`login`, `signup`, `forgot-password`, `update-password`, `verify-email`, `verify-signup`, `auth/verify-session`) → `onboarding` → home `""` → `rounds/add` → `dashboard/[id]` → `rounds/[id]/calculation` (heavy `handicap-core` reuse — import, never reimplement) → `statistics` → `statistics/courses/[courseId]` → `profile/[id]` → `calculators`.

## 8. The per-screen porting workflow

1. Read the web page (`apps/web/app/<route>/page.tsx`) and its component closure (`pnpm parity:drift` shows what reaches it). Identify the tRPC procedures it uses.
2. Build the same-slug screen under `apps/native/app/` (dynamic segments `[id].tsx` match web's `[id]/`). Compose from generated class names; mirror web's visual hierarchy, not its DOM. Reuse/extract shared native components into `apps/native/components/`.
3. Delete the route from `INTENTIONAL.webOnly`; `pnpm parity:routes` must pass.
4. `pnpm parity:styles` + `pnpm --filter native check-types` + `pnpm --filter native exec expo export -p ios` must pass.
5. Add the screen to `verification/config.mjs` (`SCREENS`/`WEB_PATHS`) + a rubric in `verification/rubrics/`; run `scripts/compare-screen.sh <route>` against running web (`pnpm dev`), then `harness:run <route>` if `ANTHROPIC_API_KEY` is set. Record evidence in the log.
6. Add/extend a Maestro flow covering the screen's core behavior (testID/accessible-name selectors only — never coordinates).
7. Commit. Move on.

## 9. The QA framework (ported, awaiting calibration)

Lives in `apps/native/verification/` (55 hermetic tests: `pnpm --filter native verify:harness`).

- **Visual judging — two modes.** (a) **In-band (default, no key needed):** Read the capture pair yourself against the screen's rubric and log the verdict — you have vision; use it. (b) **Scripted harness** (`harness:run <screen>`): sim capture vs web reference, 2-vote Claude quorum via the API (`claude-sonnet-4-6` default, `ANTHROPIC_MODEL` override) — only if `ANTHROPIC_API_KEY` is set; degrades to mode (a) otherwise. Caps: 8 iterations/screen, no-progress halt, verdict cache keyed on inputs+rubric+model. Either mode: **the rubrics are uncalibrated — tighten them on your first ported screen.**
- **Deterministic gates**: per-mode WCAG contrast against generated tokens (`verify:contrast`), a11y matrix (touch targets, labels, focus), capture hygiene, web prefilter with RN-web false-positive denylist.
- **Maestro** (`.maestro/`; CLI installed on this machine): smoke flow exists. Capture-hygiene note: screens with async data should expose a `data-settled` marker (see `verification/ios-gate/capture-hygiene.mjs`) — wire it into your query-provider loading states.
- **Known waived finding:** dark-mode `--primary-foreground` on `--primary` = **4.27:1** (< 4.5, WCAG 1.4.3) — a WEB token bug, frozen in the gate's `KNOWN_SUBTHRESHOLD` so regressions still fail. You MAY fix it web-side (adjust dark `--primary`/`--primary-foreground` in `apps/web/app/globals.css` to reach ≥4.5, regenerate, delete the waiver, log before/after hexes) — it's a small dark-theme shift the owner has been told about. If you fix it, verify web visually (dark dashboard spot-check) and keep both apps in sync via the generator.

## 10. Non-negotiables (from `.claude/rules/`)

- pnpm only. Strict TS, no `any`, no `enum`. Zod at trust boundaries.
- All handicap math through `@handicappin/handicap-core`.
- Never edit generated files (`packages/tokens/generated/`, `apps/native/global.css`).
- Never bypass gates (`--no-verify` forbidden). Waivers go in the implementation log + the relevant gate's ledger.
- WCAG 2.1 AA applies to native (the a11y gate enforces it).
- Web is design truth: if a screen looks wrong, fix web first (tokens/components), then mirror — never fork the design natively. Web changes you make (e.g. the contrast fix) must keep ALL web gates green (`pnpm lint`, web tsc, `pnpm --filter web test`, `pnpm build`).

## 11. Command cheat sheet

```bash
pnpm dev:all                        # web stack + Metro + parity watcher
pnpm --filter native ios            # simulator build (first run / native dep changes)
pnpm generate:theme                 # web CSS → token contract (pre-commit also does it)
pnpm parity                         # the gate: drift + routes + native styles
pnpm parity:drift                   # which routes does my web change affect?
pnpm --filter native exec expo export -p ios   # fast native-CSS pipeline check
pnpm --filter native verify:harness # QA framework unit tests
pnpm --filter native harness:run <screen>      # judged visual gate
maestro test apps/native/.maestro/flows/<flow>.yaml
bash scripts/install-hooks.sh       # once per clone
```

## 12. History and references

- **PR #126 (prior):** UI consistency remediation — token system graded A, compound utilities introduced.
- **2026-06-09:** full token audit; every bypass closed; `check:tokens` guard; `docs/design-token-remediation.md` tracker.
- **PR #127:** `@handicappin/tokens` generator (dual light/dark, `@utility` parsing, color-mix flattening, Inter faces; 37 tests; magenta round-trip proven); parity gates ported armed-but-dormant.
- **PR #128:** web → `apps/web` (Vercel root dir must be `apps/web` — owner task); `apps/native` scaffolded; gates armed (22-route backlog); QA framework ported (55 tests); native bundling fixed (postcss config, lightningcss pin, empty-utility fix) + `expo export -p ios` CI job; `dev:all`.
- The ks-digital reference repo is at `~/Documents/ks-digital`; its native app source lives ONLY on branch `feat/expo-app-design-system` (read via `git -C ~/Documents/ks-digital show 'feat/expo-app-design-system:apps/app/<path>'`). Useful for patterns the docs don't cover (sheets, toasts, query wiring, settled-markers).

**Read next, in order:** `docs/web-native-parity.md` → `.claude/skills/web-native-parity/SKILL.md` → `scripts/parity/README.md` → `apps/native/verification/README.md` → `packages/tokens/generated/tokens.ts` (skim the interfaces).
