# Design Token Remediation — Implementation Tracker

> **Purpose.** Close the remaining gaps between the design token system (`app/globals.css` + `app/styles/utilities/*`) and component implementations, so every visual decision in the web app is expressible as a token or a named token-composed utility. Motivation: a future native-app style generator will consume the web token contract; any styling that bypasses tokens silently breaks web→native parity.
>
> Derived from a full-token audit run 2026-06-09 (post `#126` UI-consistency remediation). Baseline at audit time: **0** raw Tailwind palette colors, **0** unexplained color literals, semantic spacing adoption 1779 vs 112 numeric (~94%).
>
> **Maintainer protocol.** Update each item's status box (`⬜ → 🟡 → ✅`) and the dashboard as you go. Gate every wave on `pnpm lint`, `pnpm tsc --noEmit`, `pnpm build` green.

## Locked decisions (2026-06-09)

- **TD-1 Token source of truth:** `app/globals.css` stays canonical. ~~JSON extraction / codegen is **deferred** until native work starts.~~ **Superseded 2026-06-10:** the ks-digital generator was ported as `@handicappin/tokens` — the typed contract (`packages/tokens/generated/`) is now *generated from* globals.css (`pnpm generate:theme`, drift-gated in pre-commit + CI). globals.css remains the only hand-edited source; see `docs/web-native-parity.md`. `utils/theme-colors.ts` (runtime CSS-var reader) still mirrors globals.css by hand.
- **TD-2 Layout sizes:** **Hybrid.** Recurring component dimensions (chart frame height, control min-heights, list max-heights) get named tokens. True layout one-offs (skeleton mirrors, viewport-relative dialog caps, table min-widths) are **platform-specific by declaration** — they stay arbitrary and are listed in the Platform-Specific Register below, not migrated.
- **TD-3 Breakpoints:** Closed vocabulary — the `--breakpoint-*` tokens only. All arbitrary `min-[NNNpx]` variants migrate to the nearest token breakpoint; minor skeleton-mirroring imprecision at in-between widths is accepted.

## Status Dashboard

| Wave | Scope | State |
|---|---|---|
| W1 | Defects + color one-offs | ✅ 2026-06-09 |
| W2 | Typography closure | ✅ 2026-06-09 |
| W3 | Spacing, breakpoints, sizes | ✅ 2026-06-09 |
| W4 | Guardrails | ✅ 2026-06-09 (`pnpm check:tokens`) |

**Composition rule (locked during W2):** components own the compound type token (`text-heading-*`, `text-figure-*`); responsive call sites may add **size-only** rungs on top (core scale `sm:text-2xl` or named size-only rungs `md:text-hero-md`). Never stack a second compound token or a size+weight compose over a tokenized component — `cn()`'s tailwind-merge is extended for semantic spacing only, so conflicting compound type utilities resolve by CSS source order, not class order. Do not extend tailwind-merge with the type scale: dropping an "overridden" compound token would silently strip its weight/tracking.

---

## Wave 1 — Defects & color one-offs

- **W1.1 ⬜ Invalid chart color syntax.** `hsl(var(--chart-1))` wraps an OKLCH token → invalid CSS. Fix to `var(--chart-1)`.
  - `components/charts/handicap-trend-chart.tsx:65`, `components/charts/score-bar-chart.tsx:74`
- **W1.2 ⬜ Overlay token.** Modal scrim is `bg-black/80` in `components/ui/dialog.tsx:24` + `components/ui/sheet.tsx:25`. Add `--overlay` (light+dark) to `globals.css`, expose as `--color-overlay`, use `bg-overlay`.
- **W1.3 ⬜ Hero radial gradient literal.** `components/homepage/home-page.tsx:116` hardcodes primary's OKLCH value inside an arbitrary `radial-gradient`. Add `hero-radial` utility (surfaces.css) referencing `var(--color-primary)` via `color-mix`.
- **W1.4 ⬜ OG image brand drift.** `app/opengraph-image.tsx` hexes don't trace to tokens. Satori can't parse `oklch()` → keep hex but use exact sRGB conversions of tokens, named constants with a keep-in-sync comment. Mapping: title gradient = `score-birdie` dark→light (`#05df72`→`#00c950`), background = dark `background-alternate`→`background` (`#041608`→`#000d02`).
- **W1.5 ⬜ Google brand exception.** `components/auth/google-sign-in-button.tsx` — add a comment marking the four hexes as Google-mandated brand colors (permanent, out of token contract).

## Wave 2 — Typography closure

New utilities (in `app/styles/utilities/typography.css`):

- **W2.1 ⬜ `text-heading-5`** — 1.125rem / 1.75rem / 600 / -0.005em. Fills the gap below `text-heading-4`; replaces raw `text-lg font-semibold` / `text-lg font-medium` titles.
- **W2.2 ⬜ `text-hero-sm` (2.25rem / 2.5rem) + `text-hero-md` (3rem / 1)** — size-only rungs completing the marketing hero ladder (`hero-xl`/`hero-2xl` exist).

Call-site migrations:

- **W2.3 ⬜ Empty states → `<EmptyState>`** (primitive exists, fully tokenized): `app/statistics/courses/[courseId]/page.tsx:86-87`, `components/statistics/activity/activity-section.tsx:45-47`, `components/statistics/courses/courses-section.tsx:37`, `components/statistics/frivolities/frivolities-section.tsx:41-43`.
- **W2.4 ⬜ DialogTitle** `components/ui/dialog.tsx:91` → `text-heading-5 leading-none` (keep local leading override).
- **W2.5 ⬜ Misc combos:** `components/profile/tabs/billing-tab.tsx:39` → `text-heading-5`; `components/calculators/strokes-received-calculator.tsx:57,73` → `text-badge` (drop responsive size bump; 700→600 weight accepted).
- **W2.6 ⬜ Marketing hero ladders** (`app/about/page.tsx:83,165`, `app/contact/page.tsx:73`, `app/privacy-policy/page.tsx:29`, `app/terms-of-service/page.tsx:29`): `sm:text-4xl`→`sm:text-hero-sm`, `md:text-5xl`→`md:text-hero-md`; drop redundant base `text-3xl` on H2 (heading-2 is already 1.875rem).
- **W2.7 ⬜ Raw display sizes → figure scale.** Emoji glyphs and numeric display text using `text-2xl…7xl` migrate: `2xl`→`text-figure`, `3xl`→`text-figure-lg`, `4xl`→`text-figure-xl`, `6xl`→`text-figure-3xl`, `7xl`→`text-figure-4xl` (weight is moot for emoji; for real text the 700 figure weight is the intended data-display style). Files: `statistics/hero/player-identity-card.tsx`, `statistics/fun-facts/*`, `statistics/frivolities/*`, `statistics/activity/activity-section.tsx`, `statistics/patterns/best-time-insight.tsx`, `statistics/round-insights/round-insights-section.tsx`, `statistics/overview/overview-section.tsx`, `app/billing/success/page.tsx`, `app/(auth)/auth/verify-session/verify-session-content.tsx`, `components/404-page.tsx`.

Accepted exceptions (do not migrate — documented in code):

- `components/ui/badge.tsx:6` — "Intentional compose" comment from #126; badge recipe stays `text-xs font-semibold`.
- `components/ui/typography.tsx` `Large` — same.

## Wave 3 — Spacing, breakpoints, sizes

- **W3.1 ⬜ Numeric → semantic spacing** (112 instances). Exact-map: `1→xs 2→sm 4→md 6→lg 8→xl 12→2xl 16→3xl 24→4xl 32→5xl`. Off-ramp values (`1.5, 3, 5, 10, …`) round to nearest rung unless visually load-bearing. Top files: `homepage/landing.tsx` (13), `scorecard/tee-form-content.tsx` (7), `app/contact/page.tsx` (6), `app/about/page.tsx` (6), `statistics/shared/statistics-section.tsx` (5), `loading/about-skeleton.tsx` (5), long tail 1–4/file.
- **W3.2 ⬜ Arbitrary breakpoints → token breakpoints** (TD-3): `components/dashboard/dashboardSkeleton.tsx` (18), `components/homepage/statBox.tsx` (2), `components/charts/handicap-trend-chart-display.tsx` (3). `min-[345px]/[378px]/[400px]/[423px]`→`xs` or `sm` (nearest), `min-[2000px]`→`3xl`.
- **W3.3 ⬜ Component-size tokens** (TD-2 hybrid). Add to `@theme`: `--size-chart-frame: 18.75rem` (300px chart frames + lazy skeletons), `--size-control-min: 5rem` (textarea 80px), `--size-list-max: 18.75rem` (command/select list caps). Expose via small `@utility` entries or `h-(--size-…)` arbitrary-property refs at call sites.
- **W3.4 ✅ Platform-Specific Register.** Declared out-of-contract set (leave as-is): skeleton mirror heights (`add-round-skeleton.tsx`, `dashboardSkeleton.tsx`), viewport caps (`max-h-[90vh]`, `min-h-[60vh]`, `calc(100vw-…)`), scorecard table widths (`min/max-w-[1225px]/[1600px]`) + table column widths (`w-[100px]`, `min-w-[40-120px]`), `whats-this.tsx max-w-[15em]`, calendar `ring-[3px]`/`text-[0.8rem]` (vendored shadcn, commented in-file), `chart.tsx border-[1.5px]`, `typography.tsx` InlineCode padding, `dashboardGraphDisplay.tsx xl:min-h-[450px]` (no 450px token; revisit if a second 450px frame appears), `country-combobox.tsx max-h-[200px]` (intentionally tighter than `--size-list-max`), `contact-form.tsx min-h-[150px]` message field, negative margins (`-mx-1`), zero-resets (`p-0`/`m-0` — zero has no rung by design), tailwindcss-animate distances (`slide-in-from-top-2`), transform utilities (`translate-y-4`).

## Wave 4 — Guardrails

- **W4.1 ⬜ `pnpm check:tokens`** — script (`scripts/check-design-tokens.sh`) that greps the violation classes (raw palette colors, hex/oklch literals in TSX outside the documented exception files, arbitrary `min-[NNNpx]` breakpoints, `hsl(var(`) and fails on regressions.
- **W4.2 ⬜ theme-colors sync note** — header comment in `utils/theme-colors.ts` stating it must mirror `globals.css` until TD-1 extraction happens.
- **W4.3 ⬜ Contract doc** — short section in this file (or README pointer) defining what IS the token contract (globals.css `@theme` + `:root`/`.dark`, typography.css, surfaces.css) vs. platform-specific register.

## Changelog

- 2026-06-09 — Tracker created from token audit; decisions TD-1..TD-3 locked.
- 2026-06-10 — Web→native Phase 1 landed (supersedes TD-1's deferral): `@handicappin/tokens` generator ported from ks-digital (dual light/dark resolution, `@utility` typography parsing, color-mix surface flattening, semantic spacing/sizes/breakpoints/tracking, additive radius calc, rem-aware shadows, Inter face registry). 37 unit tests; byte-stable; magenta round-trip proven. Gates: pre-commit auto-regen + `check:tokens` (`scripts/git-hooks/pre-commit`, install via `scripts/install-hooks.sh`), CI `theme-drift.yml`. Spec: `docs/web-native-parity.md`.
- 2026-06-09 — All waves executed. W1: chart `hsl(var(--chart-1))` bug fixed, `--overlay` token added (dialog/sheet scrims), `hero-radial` utility replaces hardcoded homepage gradient, OG image colors re-derived from tokens (score-birdie + dark background pairs), Google-brand exception documented in-code. W2: `text-heading-5` + `text-hero-sm/md` added; DialogTitle, billing-tab, strokes-received migrated; 4 ad-hoc empty states → `<EmptyState>`; all raw `text-2xl…7xl` display sizes → figure scale (statistics, billing/success, verify-session, 404); marketing hero ladders fully on hero rungs; redundant base sizes dropped (landing H2s, chart CardTitles). W3: all 23 arbitrary breakpoints → token breakpoints; `--size-chart-frame`/`--size-control-min`/`--size-list-max` tokens added and applied (chart frames, lazy skeletons, textarea, command); numeric-spacing sweep confirmed the remaining numerics are zero-resets/animation utilities (already-clean — register updated). W4: `pnpm check:tokens` guard (6 violation classes), theme-colors.ts sync note. Known behavior deltas (accepted): `min-[2000px]→3xl:` hides dashboard skeleton bars from 1400px; statBox/chart-title swaps move 400/423px→480px; billing-tab plan name 500→600 weight; strokes chips lose responsive bump (700→600); EmptyState chips replace free-floating emoji in 4 empty blocks.
