# UI Consistency Remediation — Implementation Tracker

> **Purpose.** This is the living, self-contained plan for bringing Handicappin's UI to full visual + structural cohesion. It is derived from a multi-dimension audit (code analysis + 749 component screenshots + 57 page screenshots, light/dark/mobile, logged-in **and** logged-out). It embeds the *what / why / where / standard / acceptance criteria* for every change so you do **not** need the original scratch files to act on it.
>
> **Maintainer protocol.** This doc is the source of truth for the remediation effort. As you complete work, **update the status box of each item** (`⬜ → 🟡 in progress → ✅ done`), keep the **Status Dashboard** in sync, and append to the **Changelog**. Do not start a work item whose `Depends on` is unresolved — especially the six **BLOCKING decisions**, which require a human call first.

---

## Status Dashboard

| Phase | State | Notes |
|---|---|---|
| Audit | ✅ Complete | 28 findings + 1 gap finding; tokens graded A, structure C+, perception B |
| Storybook | ✅ Committed | branch `feat/storybook` (commit `27423b7`) — 142 stories + config |
| Blocking decisions | ✅ Resolved (6/6) | Locked 2026-05-28 — see Layer 1 |
| Wave A — mechanical/global | ✅ Complete (13/13) | Committed `2667cef` 2026-05-28; tsc/build green; CardTitle + rounds/add spot-checked visually |
| Wave B — structural | ⬜ Not started (0/5) | Needs Decisions #1, #2 |
| Wave C — correctness + a11y | ⬜ Not started (0/7) | Includes a real route-gating bug |
| Wave D — perceptual + storybook quality | ⬜ Not started (0/6) | Some items need a logged-out re-capture |

**Overall: remediation NOT STARTED. Audit + Storybook scaffolding complete.**

---

## How to use this doc (future agents)

1. **Check the blocking decisions first.** Six `pick-a-standard` choices (below) gate specific work items. If a decision is still `⬜ pending`, either get the human to choose or work only on items with no decision dependency (all of Wave A qualifies).
2. **Work top-down by wave.** Wave A → B → C → D is roughly dependency- and risk-ordered. Wave A is safe, mechanical, high-ROI.
3. **Each work item has acceptance criteria + a verification method.** Don't mark `✅` until the criteria pass and the gate (`pnpm tsc --noEmit`, `pnpm lint`, `pnpm build`) is green.
4. **Confidence labels matter.** `CONFIRMED` = code + screenshot agree. `CODE-ONLY` = mechanical, not visually verified (verify in Storybook/app as you fix). `VISUAL-ONLY` = seen in screenshots, trace to code before changing.
5. **Re-verify visual items** by re-running the capture script (`.claude/tmp/audit-capture.mjs`, see Evidence Index) or spot-checking in the running app.
6. **Update the dashboard + changelog** every session.

---

## Layer 1 — Strategy

**State of the union.** The token system is in excellent shape — the 7-wave design-system migration eliminated raw palette colors, off-scale spacing, and one-off radii. Color and dark mode are essentially clean; the card family is cohesive across domains; mobile reflows gracefully. **The remaining inconsistencies are structural (no shared page shell, fragmented container widths, a density split), compositional (raw type/elevation/surface recipes that bypass utilities), and a11y (keyboard-unreachable interactive elements) — not token rot.** There is also one genuine **correctness bug** (legal pages auth-gated) surfaced during capture.

### BLOCKING decisions (human must choose)

> Fill in each `DECISION:` line. Until then, dependent work items stay blocked.

**D1 — Wide-app container width.** `max-w-5xl` is the nominal plurality but only ~3 routes use it; the rest split full-width / `6xl` / `7xl`, and public marketing/auth add yet more widths. Recommended: **a shared `<PageContainer>` at `max-w-6xl`** (onboarding/upgrade/course-detail already cluster there), with `2xl/3xl` reserved for prose/legal and `sm/md` for auth/forms.
- Options: (a) `max-w-6xl` everywhere via `PageContainer` — *recommended*; (b) keep dashboard/statistics deliberately full-width, `6xl` for the rest.
- **Blocks:** B1. **DECISION: ✅ Option (a) — single `max-w-6xl` for ALL authenticated app pages via a shared `PageContainer` (no full-width exception; uniform width prioritized over per-page horizontal room).**

**D2 — Statistics card density.** Statistics overrides `CardContent` to `p-md` (38×) vs canonical `p-lg`. Is this a deliberate compact tile or drift?
- Options: (a) formalize a named `compact` Card variant (or route through `stat-tile.tsx`) — *recommended*; (b) migrate all to `p-lg`.
- **Blocks:** B2. **DECISION: ✅ Option (a) — formalize a named `compact` Card variant. Statistics density is INTENTIONAL (dense metric dashboard); make it a named choice and apply it deliberately instead of 38 silent `p-md` overrides.**

**D3 — Transition default.** `transition-all` (28) vs `transition-colors` (26) are near-tied; primitives favor `transition-colors`. Recommended: **`transition-colors` for color changes**, `transition-all`/`-transform` only when size/shadow/transform animate. *Visual-check card-lift hovers first.*
- **Blocks:** C3. **DECISION: ✅ `transition-colors` is the interactive default; `transition-all`/`-transform` only where size/shadow/transform actually animate (Tabs indicator, chevrons, card-lift hovers — verify those before demoting).**

**D4 — Hover opacity.** Canon is inconsistent (Button `/80`, destructive `/90`, Badge `/80`). Recommended: **`/80` non-destructive, `/90` destructive only.**
- **Blocks:** C4. **DECISION: ✅ `/80` for non-destructive token hovers, `/90` reserved for `destructive`; fix the 4 primary `/90` strays.**

**D5 — Empty-state primitive.** No shared component exists; 6 ad-hoc empties diverge. Recommended: **introduce `<EmptyState icon title description action>` and migrate.**
- **Blocks:** C5. **DECISION: ✅ Introduce a simple `<EmptyState>` primitive with API `{ icon, title, description, action? }` (no illustration slot for v1); migrate the 6 ad-hoc empties.**

**D6 — 12px utility overlap.** `text-meta` (size-only, 123×), `text-meta-strong` (500), `text-caption` (500+tracking, **0×**) overlap. Recommended: **standardize on `text-meta-strong` for 12px-with-weight; retire/merge `text-caption`;** keep bare `text-meta` for inherited-weight cases.
- **Blocks:** C6. **DECISION: ✅ Standardize on `text-meta-strong` for 12px-with-weight; retire/merge dead `text-caption`; keep bare `text-meta` for inherited-weight cases.**

---

## Wave A — Mechanical / global (no decisions, highest ROI)

> Objective deviations with an obvious canonical target. Safe, fast, no decision dependencies. Recommended starting point. Gate: `tsc`/`lint`/`build` green after each batch.

### A1 — `border-l-4` → `border-l-2` on verification box
- **Status:** ✅ done (2026-05-28) | **Priority:** P3 | **Confidence:** CODE-ONLY
- **What:** Change the left border width to match the `border-2` emphasis scale.
- **Why:** `border-l-4` is the only `-4` border in the app; off the emphasis scale.
- **Where:** `components/auth/verification-box.tsx:6`
- **Standard:** `border-l-2` (rubric border-emphasis = `border-2`).
- **Acceptance:** no `border-l-4` in app code; component still visually delineated.
- **Verify:** grep `border-l-4`; eyeball in Storybook `auth-verificationbox`.

### A2 — Label disabled `opacity-70` → `opacity-50`
- **Status:** ✅ done (2026-05-28) | **Priority:** P3 | **Confidence:** CODE-ONLY
- **What:** Align disabled opacity to canon.
- **Why:** Canon disabled = `opacity-50`; `opacity-70` is a one-off (also a known shadcn debt — if intentional, document instead).
- **Where:** `components/ui/label.tsx:10` (+ 2 usages)
- **Standard:** `opacity-50 pointer-events-none`.
- **Acceptance:** disabled labels match disabled inputs/buttons.
- **Verify:** grep `opacity-70`; compare disabled Label vs Input in Storybook.

### A3 — Dropdown content/sub-content same elevation
- **Status:** ✅ done (2026-05-28) | **Priority:** P3 | **Confidence:** CODE-ONLY
- **What:** Make `DropdownMenuContent` and `DropdownMenuSubContent` share one shadow tier.
- **Why:** Sub-content is `shadow-lg` while parent content is `shadow-md` — the sub-menu reads as floating *above* its parent (inverted stacking).
- **Where:** `components/ui/dropdown-menu.tsx:53,71`
- **Standard:** both `shadow-md` (popover/dropdown tier).
- **Acceptance:** open a submenu — sub and parent sit at the same visual elevation.
- **Verify:** Storybook `ui-dropdownmenu` open state.

### A4 — Chart legend swatches → `rounded-sm`
- **Status:** ✅ done (2026-05-28) | **Priority:** P3 | **Confidence:** UNVERIFIED (story blank)
- **What:** Replace arbitrary `rounded-[2px]` with the token radius used by the other swatches.
- **Why:** Same swatch element uses `rounded-sm` in `score-legend.tsx`/`course-hole-tabs.tsx` but `rounded-[2px]` in 4 chart spots — two ways for one thing.
- **Where:** `components/charts/score-bar-chart.tsx:111`, `components/charts/handicap-trend-chart.tsx:117`, `components/ui/chart.tsx:222,315`
- **Standard:** `rounded-sm`.
- **Acceptance:** no `rounded-[2px]` in chart code; swatches consistent.
- **Verify:** grep; eyeball charts in app.

### A5 — `statBox` achievement figure → token color
- **Status:** ✅ done — already correct (`text-foreground`); stale pre-migration finding | **Priority:** P3 | **Confidence:** VISUAL-ONLY
- **What:** Resolve the figure color to a token that keeps contrast in dark mode.
- **Why:** The "82" achievement figure washes out against the green tint in dark mode.
- **Where:** `components/homepage/statBox.tsx` (figure render)
- **Standard:** `foreground` or the appropriate `*-foreground` token.
- **Acceptance:** figure legible in both themes.
- **Verify:** Storybook `homepage-statbox--achievement` dark.

### A6 — Card-tier surfaces over-elevated → `shadow-xs`
- **Status:** ✅ done (2026-05-28) | **Priority:** P2 | **Confidence:** CODE-ONLY
- **What:** Bring resting card surfaces to the canonical card shadow tier.
- **Why:** `usage-limit-alert.tsx` uses `shadow-sm` and `dashboardSkeleton.tsx` uses `shadow-lg` where resting cards want `shadow-xs`; the skeleton doesn't even match live `dashboard.tsx` (no shadow).
- **Where:** `components/scorecard/usage-limit-alert.tsx:63`, `components/dashboard/dashboardSkeleton.tsx:5`
- **Standard:** card resting = `shadow-xs`.
- **Acceptance:** skeleton matches live dashboard elevation; alert matches peer cards.
- **Verify:** compare skeleton vs live dashboard in app.

### A7 — Numeric stats → `text-figure-*`
- **Status:** ✅ done (2026-05-28) — partial: 5 `text-lg font-bold` (1.125rem) stat values left as TODO (no 1.125rem figure rung exists — see token-gap note) | **Priority:** P2 | **Confidence:** CODE-ONLY
- **What:** Render metric values with the figure type ramp instead of raw sizes.
- **Why:** ~8 stat values use raw `text-{size} font-bold` instead of `text-figure-*` (the dedicated number ramp).
- **Where:** `components/scorecard/scorecard-table.tsx`, `components/statistics/activity/activity-section.tsx`, `components/charts/handicap-trend-chart-display.tsx` (per finding 01)
- **Standard:** `text-figure-sm..5xl` for numeric values.
- **Acceptance:** stat numbers use figure utilities; visual size unchanged.
- **Verify:** grep raw sizes near `{value}`/`toFixed`; eyeball.

### A8 — Hand-rolled skeletons → `<Skeleton>`
- **Status:** ✅ done (2026-05-28) — settings-tab migrated; decorative status pulses (billing-success emoji, verify-session dots) correctly left | **Priority:** P2 | **Confidence:** CODE-ONLY
- **What:** Replace bespoke `animate-pulse` blocks with the `<Skeleton>` primitive.
- **Why:** 6 hand-rolled loaders bypass `<Skeleton>` → inconsistent shape/size for similar content.
- **Where:** `components/profile/tabs/settings-tab.tsx`, `app/billing/success/page.tsx`, `components/auth/verify-session/verify-session-content.tsx`
- **Standard:** compose `<Skeleton>` (`animate-pulse rounded-md bg-muted`).
- **Acceptance:** no hand-rolled `animate-pulse` divs in those files.
- **Verify:** grep `animate-pulse`; loading states in app.

### A9 — Raw error text → `<FormFeedback>`
- **Status:** ✅ done (2026-05-28) — scorecard-image-upload, personal-info, verify-session migrated; status-icon/inline uses left | **Priority:** P2 | **Confidence:** CODE-ONLY
- **What:** Route user-facing errors through the `<FormFeedback>` primitive.
- **Why:** 4 files render raw `text-destructive` for errors while 14 use `<FormFeedback>`.
- **Where:** `components/scorecard/scorecard-image-upload.tsx`, `components/auth/verify-session/verify-session-content.tsx`, `components/profile/tabs/personal-information-tab.tsx`
- **Standard:** `<FormFeedback>` with status tokens + `role="alert"`.
- **Acceptance:** user-facing errors use the primitive; SR-announced.
- **Verify:** trigger error states; check markup.

### A10 — Raw `text-{size} font-{weight}` compounds → utilities
- **Status:** ✅ done (2026-05-28) — clean matches migrated (→ text-meta-strong, text-figure, etc.); no-clean-match sites carry `// TODO(ui-consistency A10)` (token gaps) | **Priority:** P1 | **Confidence:** CODE-ONLY
- **What:** Map ~30 compound type lines to the semantic typography utilities.
- **Why:** Roles that map directly to `text-body/lead/label-sm/figure/meta-strong/eyebrow` are spelled as raw compounds (a `courses-section.tsx` TODO admits they were "left raw").
- **Where:** ~39 files; concentrated in `components/statistics/**`, `components/scorecard/**`, marketing pages. Start at `components/statistics/courses/courses-section.tsx` (has the TODO).
- **Standard:** the typography utilities in `app/styles/utilities/typography.css`.
- **Acceptance:** compounds replaced where a utility matches; no visual regression (utilities were built to match).
- **Verify:** grep `text-(lg|base|xl|2xl) font-`; spot-check rendered text.

### A11 — Re-map `CardTitle` → `text-heading-4`; delete overrides
- **Status:** ✅ done (2026-05-28) — primitive changed; 22 overrides removed across 12 files; 4 responsive cases kept; visually spot-checked on statistics page | **Priority:** P1 | **Confidence:** CODE-ONLY (story blank — verify visually)
- **What:** Change the `CardTitle` primitive to the correct title role, then remove the 20 inline `text-base` shrink-overrides callers add.
- **Why:** `CardTitle` ships `text-2xl font-semibold tracking-tight` — too large, so 20 call-sites across 8 files re-shrink it. Title size is decided per-call.
- **Where:** primitive `components/ui/card.tsx` (CardTitle); overrides across 8 files (grep `CardTitle className="text-base`).
- **Standard:** `CardTitle` → `text-heading-4` (rubric "card-ish title").
- **Acceptance:** CardTitle default looks right WITHOUT overrides; overrides removed; no card relies on the old `text-2xl`.
- **Verify:** **CRITICAL — visually check several cards** (statistics, billing, dashboard) since the supporting stories captured blank.

### A12 — Replace bare `text-2xl/4xl` H1 overrides with heading utilities
- **Status:** ✅ done (2026-05-28) — billing-success, contact, verify-session, scorecard cleaned; hero ladders + intentional compact card H3s kept | **Priority:** P1 | **Confidence:** CONFIRMED (via billing-success)
- **What:** Use `text-heading-*` (or the sanctioned hero ladder) instead of raw size overrides on `<H1>`/`<H2>`.
- **Why:** `<H1>`/`<H2>` already apply heading utilities; bare `text-2xl`/`text-4xl` overrides re-decide the title scale per page (billing-success hero sits off the in-app scale).
- **Where:** ~9 files; `app/billing/success/page.tsx`, `components/auth/verify-session/...`, about/contact.
- **Standard:** `text-heading-1/2/3`; marketing hero ladder `xl:text-hero-xl 2xl:text-hero-2xl` is allowed.
- **Acceptance:** no bare `text-2xl/4xl` on H1/H2; titles consistent across pages.
- **Verify:** grep; compare page titles.

### A13 — Remove brand-green from `rounds/add` H1
- **Status:** ✅ done (2026-05-28) — now `<H1>` foreground; verified in before/after screenshots | **Priority:** P1 | **Confidence:** VISUAL-ONLY
- **What:** Render the "Add Round" page title in foreground, not primary green.
- **Why:** Only page whose title uses the action color; competes with the green Add-Round button, feels like a different design.
- **Where:** `app/rounds/add/page.tsx`
- **Standard:** foreground `text-heading-1`; green reserved for actions/links.
- **Acceptance:** title is foreground in both themes.
- **Verify:** app `/rounds/add`.

---

## Wave B — Structural (needs D1, D2)

> The highest-leverage cohesion work. Establishes the page-level grammar.

### B1 — Shared `PageContainer` + container-width standardization
- **Status:** ⬜ | **Priority:** P0 | **Confidence:** CONFIRMED | **Depends on:** **D1**
- **What:** Create a `PageContainer` component (width + horizontal padding + page-level `py-3xl`) and route authenticated app pages through it; constrain or remove per-route `max-w-*`.
- **Why:** The single biggest visual break. `app/layout.tsx:109` sets no max-width, so every route hand-rolls one → **9 distinct widths across ~23 routes** (statistics full-bleed, profile/billing `7xl`, upgrade narrow, calculators mid). The frame resizes on every navigation. Also folds in the section-rhythm split (`py-xl` vs `py-2xl` vs `py-3xl`).
- **Where:** new `components/layout/page-container.tsx`; `app/layout.tsx:109`; every `app/**/page.tsx` that sets `max-w-*`.
- **Standard:** per D1 (recommended `max-w-6xl`); prose/legal `2xl/3xl`; auth/forms `sm/md`; vertical rhythm `py-3xl` baked into the container.
- **Acceptance:** authenticated pages share one width; navigating between them does not reflow the content frame; section spacing consistent.
- **Verify:** re-capture pages logged-in; compare container widths across routes (should be uniform).

### B2 — Statistics card density resolution
- **Status:** ⬜ | **Priority:** P1 | **Confidence:** CONFIRMED | **Depends on:** **D2**
- **What:** Either add a named `compact` Card variant (and apply it intentionally) or migrate the 38 `p-md` overrides to `p-lg`.
- **Why:** Statistics runs its own card density (`p-md`, 64×) vs canonical `p-lg` — a silent density step against every other domain's cards.
- **Where:** `components/ui/card.tsx` (if adding variant); `components/statistics/**` (38 `CardContent` overrides); consider `components/ui/stat-tile.tsx`.
- **Standard:** per D2.
- **Acceptance:** density is a named/intentional choice, not 38 silent overrides.
- **Verify:** Storybook card variants; statistics pages.

### B3 — `pricing-card.tsx` elevation + padding normalization
- **Status:** ⬜ | **Priority:** P2 | **Confidence:** CODE-ONLY (story blank — verify visually)
- **What:** Resting `shadow-xs`, a single hover-elevation tier, move `p-xl` into `CardContent p-lg`, drop redundant `rounded-lg`.
- **Why:** Pricing cards force `shadow-md`/`shadow-lg` + `hover:shadow-xl` on top of `<Card>`, floating them into the dialog tier; also a third card padding (`p-xl` directly on `<Card>`).
- **Where:** `components/billing/pricing-card.tsx:46,104-110,197`
- **Standard:** card resting `shadow-xs`; one hover tier; padding via `CardContent p-lg`.
- **Acceptance:** pricing cards sit at card elevation; padding consistent with other cards.
- **Verify:** **visually** (story blank) — `/upgrade` or pricing surface in app.

### B4 — Adopt `surface`/`surface-raised` utilities
- **Status:** ⬜ | **Priority:** P2 | **Confidence:** CONFIRMED (dark consequence)
- **What:** Replace hand-rolled `bg-card`/`bg-background/50 rounded-lg border` recipes with the `surface`/`surface-raised` utilities.
- **Why:** ~8 sites hand-roll the surface recipe; `bg-background/50` tiles nearly vanish in dark mode (only a hairline border remains).
- **Where:** `components/statistics/hero/player-identity-card.tsx:69,88,97` + ~5 others (grep `bg-background/50`, `bg-card rounded-lg border`).
- **Standard:** `surface` / `surface-raised` (`app/styles/utilities/surfaces.css`); raw only for table frames.
- **Acceptance:** no hand-rolled surface recipes; tiles visible in dark mode.
- **Verify:** dark-mode statistics hero in app.

### B5 — Normalize status surfaces
- **Status:** ⬜ | **Priority:** P1 | **Confidence:** CONFIRMED
- **What:** Route all status/callouts through `FormFeedback`/`tint-*` at a single 20% border opacity; align or retire the outline-only `Alert`.
- **Why:** Status surfaces done multiple ways (tint vs hand-rolled `bg-{tone}/N border-{tone}/N`); border opacity inconsistent (`/30` success vs `/20` error — visible weight difference); `FormFeedback` (filled) vs `Alert` (outline) are two status languages.
- **Where:** `components/ui/form-feedback.tsx:28-32`, `components/homepage/statBox.tsx`, `components/homepage/quick-actions.tsx`, `components/ui/alert.tsx`.
- **Standard:** `tint-*` at 20% border for all status surfaces.
- **Acceptance:** one status-surface language; uniform border opacity.
- **Verify:** Storybook `ui-formfeedback`, `ui-alert`; compare side by side.

---

## Wave C — Correctness + a11y

> Includes a real bug and WCAG 2.1 AA failures against the project's own a11y rules.

### C1 — Legal pages auth-gated (BUG)
- **Status:** ⬜ | **Priority:** P0 (correctness) | **Confidence:** CONFIRMED
- **What:** Make `/privacy-policy` and `/terms-of-service` publicly accessible.
- **Why:** Logged-out visitors hitting these routes are redirected to `/login`. The footer (every page) **and the signup consent checkbox** link to them — so users **cannot read the terms they're agreeing to**. Almost certainly an unintended route-group/middleware gating mistake.
- **Where:** investigate the route group for `app/privacy-policy/` and `app/terms-of-service/` (a misplaced `(protected)` group?) and the middleware matcher (`proxy.ts`/middleware). Compare with `app/about/` which is correctly public.
- **Standard:** legal + marketing routes are public.
- **Acceptance:** logged-out user can load both pages and see their content (not the login form).
- **Verify:** logged-out capture of `/privacy-policy` + `/terms-of-service` shows real content; signup consent links resolve.

### C2 — Focus rings + keyboard operability on interactive elements
- **Status:** ⬜ | **Priority:** P1 (a11y) | **Confidence:** CODE-ONLY
- **What:** Make ~13 interactive elements keyboard-operable with visible focus.
- **Why:** WCAG 2.1 AA failures: 6 sortable `<TableHead onClick>` (mouse-only, no role, SR-invisible), a `<div onClick>` that logs the user out (destructive, unreachable), 4 hand-rolled `<button>`/`<a>` with no focus ring.
- **Where:** `components/dashboard/roundsTable.tsx` (sortable headers), `components/auth/logoutButton.tsx:19`, `components/auth/verify-session/verify-session-content.tsx` (4 elements).
- **Standard:** prefer `<Button>`; else `role="button" tabIndex={0} onKeyDown` + `focus-visible:ring-2 focus-visible:ring-ring`. For sortable headers, use a `<button>` inside `<th>` with `aria-sort`.
- **Acceptance:** all interactive elements reachable + operable by keyboard; visible focus; axe/jsx-a11y clean.
- **Verify:** keyboard-tab through dashboard + auth flows; run a11y check.

### C3 — `transition-colors` default
- **Status:** ⬜ | **Priority:** P2 | **Confidence:** CODE-ONLY | **Depends on:** **D3**
- **What:** Make `transition-colors` the interactive default; demote non-essential `transition-all`.
- **Why:** `transition-all` (28) vs `transition-colors` (26) split; `transition-all` can animate unintended properties.
- **Where:** grep `transition-all`; keep it only where size/shadow/transform animates.
- **Standard:** per D3.
- **Acceptance:** color-only interactions use `transition-colors`.
- **Verify:** hover behavior unchanged; card-lift hovers still smooth.

### C4 — Fix hover-opacity strays
- **Status:** ⬜ | **Priority:** P2 | **Confidence:** CODE-ONLY | **Depends on:** **D4**
- **What:** Change the 4 primary `/90` hover strays to `/80`.
- **Why:** Canon non-destructive hover is `/80`; 4 sites use `/90`.
- **Where:** `components/profile/tabs/billing-tab.tsx:65`, `components/scorecard/usage-limit-alert.tsx:40`, `components/auth/verify-session/verify-session-content.tsx:239,268`.
- **Standard:** per D4 (`/80` non-destructive, `/90` destructive).
- **Acceptance:** no primary `/90` hovers remain.
- **Verify:** grep `/90`; hover in app.

### C5 — `<EmptyState>` primitive + migration
- **Status:** ⬜ | **Priority:** P2 | **Confidence:** CODE-ONLY | **Depends on:** **D5**
- **What:** Build `<EmptyState icon title description action>`; migrate the 6 ad-hoc empties.
- **Why:** No shared empty-state primitive → divergent phrasing/markup across data components.
- **Where:** new `components/ui/empty-state.tsx`; migrate `roundsTable.tsx`, `activity-feed.tsx`, `quick-stats.tsx`, two charts, `overview-section.tsx`.
- **Standard:** per D5.
- **Acceptance:** all list/data empties use the primitive.
- **Verify:** Storybook `ui-emptystate`; empty data states in app.

### C6 — Consolidate 12px utilities
- **Status:** ⬜ | **Priority:** P2 | **Confidence:** CODE-ONLY | **Depends on:** **D6**
- **What:** Standardize on `text-meta-strong` for 12px-with-weight; retire/merge dead `text-caption`.
- **Why:** Three overlapping 12px utilities; `text-caption` has 0 uses, `text-meta` 123.
- **Where:** `app/styles/utilities/typography.css`; call sites using `text-meta` where weight is intended.
- **Standard:** per D6.
- **Acceptance:** `text-caption` removed/merged; 12px roles use one utility.
- **Verify:** grep; build.

### C7 — Gate the dev Debug panel (security)
- **Status:** ⬜ | **Priority:** P1 (security) | **Confidence:** CONFIRMED
- **What:** Ensure the `verify-session` "Debug Info" panel (State / Attempts / Return To / **User ID**) never renders in production.
- **Why:** It leaks a user UUID in the captured UI.
- **Where:** `components/auth/verify-session/verify-session-content.tsx`
- **Standard:** gate behind `process.env.NODE_ENV !== "production"` (via `env.ts`).
- **Acceptance:** panel absent in a production build.
- **Verify:** prod build of the verify-session page.

---

## Wave D — Perceptual polish + Storybook quality

> Some items need a logged-out re-capture to fully confirm.

### D1w — Unify auth/recovery shell
- **Status:** ⬜ | **Priority:** P1 | **Confidence:** VISUAL-ONLY
- **What:** One centered-card auth shell at one narrow width, with minimal chrome (logo + theme toggle), for login/signup/forgot-password/update-password/verify-*.
- **Why:** 3+ presentations across one auth journey (centered cards vs left-aligned bare forms); logged-in chrome (Add Round, avatar, full nav + footer) bleeds onto recovery pages, stranding small forms in a large canvas. `components/auth/auth-form-shell.tsx` exists and is partially used — extend it.
- **Where:** `components/auth/auth-form-shell.tsx`; login/signup/forgot-password/update-password pages; verify-* ; the auth route-group layout (chrome).
- **Standard:** centered card, `max-w-sm/md`, minimal chrome.
- **Acceptance:** all auth/recovery pages share one shell + chrome.
- **Verify:** logged-out re-capture of auth routes.

### D2w — Consolidate loaders + name marketing shadow variant
- **Status:** ⬜ | **Priority:** P3 | **Confidence:** CODE-ONLY
- **What:** Route pulse-dot loaders through `<Skeleton>`; name the marketing card / `theme-image` `shadow-2xl` as a variant rather than inline.
- **Where:** `verify-session-content.tsx` (loaders); `components/homepage/theme-image.tsx`, `statBox`/`landing` (marketing shadow).
- **Standard:** `<Skeleton>` for loaders; named variant for the elevated marketing shadow.
- **Acceptance:** no inline pulse-dot loaders; marketing shadow is a documented variant.
- **Verify:** loading states; marketing surfaces.

### D3w — Dashboard mobile title wrapping (optional)
- **Status:** ⬜ | **Priority:** P3 | **Confidence:** VISUAL-ONLY
- **What:** Shorten dashboard metric-card labels or single-column at the smallest width to avoid 2-line title wrap.
- **Where:** dashboard metric cards.
- **Acceptance:** titles don't awkwardly wrap at 390px.
- **Verify:** mobile capture.

### D4w — De-blank primitive Storybook stories
- **Status:** ⬜ | **Priority:** P2 (Storybook quality) | **Confidence:** CONFIRMED (root cause)
- **What:** Give primitive `Default` stories meaningful sample content (children) so they render visibly; optionally add a canvas decorator with min-height/background.
- **Why:** ~600 of 750 story screenshots render near-empty because `args`-only primitive stories supply no children (an empty `<Card>`/`<Badge>`/`<Input default>` renders nothing meaningful). Makes Storybook far less useful for design review and blocked visual confirmation of F7/B3/A8/A4.
- **Where:** `components/ui/*.stories.tsx` (card, badge, input, checkbox, select, etc.); optionally `.storybook/preview.tsx` (canvas decorator).
- **Standard:** every primitive story renders representative content by default.
- **Acceptance:** re-capture shows non-blank primitive stories; A11/B3/A8/A4 become visually verifiable.
- **Verify:** re-run capture script `storybook` target; check PNG sizes > ~4KB.

### D5w — Logged-out re-capture for ongoing verification
- **Status:** ⬜ | **Priority:** P2 | **Confidence:** n/a (tooling)
- **What:** Keep a logged-out capture pass available to verify C1 (legal pages) and D1w (auth shell) as they're fixed.
- **Where:** `.claude/tmp/audit-capture.mjs` — `CAPTURE_TARGET=pages OUTPUT_SUBDIR=pages-public` (no auth env).
- **Acceptance:** legal pages show content; auth pages share shell.
- **Verify:** screenshots.

### D6w — Re-run dimensional checks after Waves A–C
- **Status:** ⬜ | **Priority:** P3 | **Confidence:** n/a
- **What:** After mechanical/structural fixes land, re-grep the deviation signals to confirm counts dropped to ~0 and nothing regressed.
- **Acceptance:** raw type compounds, off-tier shadows, hand-rolled surfaces, focus-gaps all near zero.
- **Verify:** the greps in the original findings (see Evidence Index).

---

## Appendix

### Token-system hygiene (low-priority cleanups)
- **Shadow self-reference** (`app/globals.css:116-123`): the `@theme inline` block declares `--shadow-xs: var(--shadow-xs)` etc. — each alias points at its own name. It only resolves because the real values live in `:root` (`globals.css:259-266`). Not a runtime bug, but confusing dead code (deleting the `:root` block would silently blank all shadows). Either delete the self-referential `@theme` block or move the real values into `@theme` as a single source.
- **`text-caption` dead** (0 uses) — see C6/D6.
- **Figure vs heading size collisions:** `text-figure-xl` (2.25rem/700) == `text-heading-1` size; `text-figure-2xl` (3rem) == `text-display`. Intentional (data vs hierarchy, distinguished by weight) but a misuse vector — reinforces A7 (use the figure ramp for numbers).
- **`tint-*` border opacity** is 20% but `form-feedback.tsx` hand-rolls 30% — root of B5.

### Token gaps discovered during Wave A (candidate additions for a future token wave)
Wave A left `// TODO(ui-consistency A7/A10)` markers wherever a raw compound had **no matching utility**. The gaps, by frequency:
- **`text-lg` (1.125rem) figure rung is missing** — blocks ~5 stat values (`scorecard-table` OUT/IN/TOTAL, `activity-section`, `fun-facts-section`) from A7. Highest-value addition: a `text-figure-xs` at 1.125rem/700.
- **`text-lg`/500 and `text-lg`/600** — no utility (`text-lead` is 1.125rem/400). Affects `billing-tab`, `typography.tsx` `Large`, and the 3 statistics empty-state messages.
- **`text-xs`/600** (`badge.tsx`) — `text-meta-strong` is /500, `text-badge` is 0.875rem.
- **`text-xs`/400 explicit** (`signup` consent) — `text-meta` is inherited-weight.
- **`text-sm`/500 uppercase+tracking eyebrow** (`handicap-display`) — `text-eyebrow` is `text-xs`.
- **Responsive figure** (`strokes-received-calculator`) — no responsive figure utility.
Recommend a small token-addition decision (like the `min-w-*` additions in the design-system work) before or alongside Wave C's typography items.

### Evidence Index (for re-verification)
- **Audit + findings (scratch, may be deleted):** `.claude/tmp/ui-consistency-audit.md`, `.claude/tmp/consistency-rubric.md`, `.claude/tmp/audit-findings/01..07-*.md`.
- **Screenshots:** `.claude/tmp/audit-screens/stories/` (component stories, light/dark), `.claude/tmp/audit-screens/pages/` (authenticated, light/dark/mobile), `.claude/tmp/audit-screens/pages-public/` (logged-out).
- **Capture script (re-runnable):** `.claude/tmp/audit-capture.mjs`. Commands:
  - Stories: `CAPTURE_TARGET=storybook node .claude/tmp/audit-capture.mjs` (Storybook on :6006)
  - Authed pages: `CAPTURE_TARGET=pages AUTH_EMAIL=<email> AUTH_PASSWORD=<pw> node .claude/tmp/audit-capture.mjs` (app on :3000)
  - Public pages: `CAPTURE_TARGET=pages OUTPUT_SUBDIR=pages-public node .claude/tmp/audit-capture.mjs`
- **Canonical standards:** `app/globals.css`, `app/styles/utilities/typography.css`, `app/styles/utilities/surfaces.css`, and the `components/ui/` primitives.

### Confidence recap
- **CONFIRMED:** B1, B4, B5, C1, C7, A12 (+ container/density/status from both code & screenshots).
- **CODE-ONLY (verify as you fix):** A2, A3, A6–A11, B2, B3, C2–C6.
- **VISUAL-ONLY (trace to code first):** A5, A13, D1w, D3w.
- **UNVERIFIED (story blank — needs D4w re-capture):** A4, and the visual halves of A11/B3/A8.

---

## Changelog

_Append one line per completed item/session: date — item ID(s) — what landed — branch/commit._

- 2026-05-28 — D1–D6 — all six blocking decisions resolved (D1: max-w-6xl uniform; D2: compact Card variant; D3: transition-colors; D4: /80·/90; D5: EmptyState; D6: text-meta-strong). Waves B/C/D now unblocked.
- 2026-05-28 — Wave A (A1–A13) — all 13 mechanical items landed (`2667cef`, 37 files). tsc + build green; CardTitle/rounds-add visually spot-checked. A5 was already correct. Residual TODOs are token gaps (see appendix). A11 also committed earlier with the primitive change.
