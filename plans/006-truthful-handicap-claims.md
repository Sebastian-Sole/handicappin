# Plan 006: Replace "USGA Compliant" claims with defensible wording across web + native

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0432f5f..HEAD -- apps/web/app/layout.tsx apps/web/app/opengraph-image.tsx apps/web/app/about/page.tsx apps/web/app/contact/page.tsx apps/web/components/seo/json-ld.tsx apps/web/components/round/calculation/steps/handicap-impact-step.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (compliance/positioning)
- **Planned at**: commit `0432f5f`, 2026-07-11

## Why this matters

The product asserts "USGA Compliant" flatly in its site title, OG image, About page, contact page, and JSON-LD structured data — while the Terms of Service says the opposite ("not an official USGA handicap service … not affiliated with, endorsed by, or officially connected to the USGA"). "USGA" and "Handicap Index®" are protected marks that only licensed clubs/associations running the full system may use in a compliance claim, and this engine deliberately omits WHS-mandatory elements (PCC, peer attestation, penalty scores). External research (2026) confirms unlicensed apps operate safely with "follows WHS methodology / unofficial" wording plus an explicit non-affiliation disclaimer — the SwingU/18Birdies posture. This plan removes the legal exposure and makes the product's honest strength (transparent, WHS-method math) the actual message. It is also the prerequisite posture for the official-handicap roadmap (plan 007).

## Current state

Verified claim sites (all excerpts confirmed at commit `0432f5f`):

- `apps/web/app/layout.tsx:24` — site `<title>`: `"Handicappin' - Golf Handicap Tracker & Calculator | USGA Compliant"`
- `apps/web/app/layout.tsx:28` — meta description: `"Track your golf handicap with USGA-compliant calculations. …"`
- `apps/web/app/layout.tsx:33` — keywords array contains `"USGA handicap"` (keyword targeting is fine; the claim strings are not)
- `apps/web/app/layout.tsx:60` and `:66` — OG/Twitter descriptions repeat "USGA-compliant calculations"
- `apps/web/app/opengraph-image.tsx:74` — rendered OG image text: `USGA Compliant | Free Forever`
- `apps/web/app/about/page.tsx:257-258` — `<StatTile value={<span className="text-primary">USGA</span>} label="Ruling Compliant" />`
- `apps/web/app/contact/page.tsx:39` — copy claiming calculations "match official USGA methodology"
- `apps/web/components/seo/json-ld.tsx:9,60,62` — structured data: "USGA-compliant calculations", "USGA-compliant golf handicap tracking application", feature "USGA-compliant handicap calculation"
- The ONLY disclaimers live in `apps/web/components/legal/terms-content.tsx:46-49` ("not an official USGA handicap service") and `:337-338` ("not affiliated with, endorsed by, or officially connected to the USGA"). Keep both as-is.

Native files containing "USGA" (classify each in Step 3; educational references to USGA *rules* are fine, compliance *claims* are not):
`apps/native/app/(tabs)/rounds/[id]/calculation.tsx`, `apps/native/app/rounds/live/review.tsx`, `apps/native/targets/watch/Core/WatchSessionStore.swift`, `apps/native/targets/watch/FinishView.swift`, `apps/native/components/statistics/performance-tab.tsx`, `apps/native/lib/round-session/types.ts`, `apps/native/lib/scorecard.ts`, `apps/native/lib/round-session/selectors.ts`.

Calculation walkthrough transparency gap: `apps/web/components/round/calculation/steps/handicap-impact-step.tsx` explains best-8-of-20 and shows a conditional ESR notice (the `esrAdjustment !== 0` block rendering "Exceptional Score Reduction (ESR): …" inside `tint-warning p-sm`), and links to usga.org rules (that educational link is fine, keep it). It never mentions soft/hard caps, Low Handicap Index, or that PCC is not applied — so a capped round shows an unexplained before→after number.

Repo conventions that apply:
- Web is design source of truth; the **same-slug native screen must be updated to match** any web component/screen change (`.claude/rules/web-native-parity.md`). The native sibling of the calculation walkthrough is `apps/native/app/(tabs)/rounds/[id]/calculation.tsx`.
- Native styling must come from `@handicappin/tokens` / generated NativeWind classes — no hardcoded hex/px (`pnpm parity:styles` blocks them).
- Run `pnpm parity:drift` after web component changes to see affected native routes.

## Replacement copy (use exactly this)

| Location | Old | New |
|---|---|---|
| `layout.tsx:24` title | `…\| USGA Compliant` | `Handicappin' - Golf Handicap Tracker & Calculator \| Transparent WHS-Method Math` |
| `layout.tsx:28,60,66` descriptions | "USGA-compliant calculations" | "calculations that follow the World Handicap System (WHS) method — every step shown. Unofficial: not an official handicap service." (adjust grammar per sentence; the two load-bearing elements are "follow the WHS method" and "unofficial") |
| `opengraph-image.tsx:74` | `USGA Compliant \| Free Forever` | `WHS-Method Calculations \| Free Forever` |
| `about/page.tsx:257-258` StatTile | value `USGA`, label `Ruling Compliant` | value `WHS`, label `Calculation Method` |
| `contact/page.tsx:39` | "match official USGA methodology" | "follow the World Handicap System calculation method (unofficial)" |
| `json-ld.tsx:9,60` | "USGA-compliant …" | "Golf handicap tracking with transparent WHS-method calculations (unofficial; not affiliated with the USGA or The R&A)" |
| `json-ld.tsx:62` feature | "USGA-compliant handicap calculation" | "Transparent WHS-method handicap calculation" |

Disclaimer sentence for public marketing surfaces (About page footer area and the landing page, near the features/pricing sections of `apps/web/components/homepage/landing.tsx`):

> Handicappin' is an independent app. It is not affiliated with or endorsed by the USGA or The R&A, and it does not issue an official Handicap Index®.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:unit` | all pass |
| Web↔native drift | `pnpm parity:drift` | lists affected native routes (advisory) |
| Native style gate | `pnpm parity:styles` | exit 0 |
| Claim sweep | `grep -rniE "usga.?compliant|usga compliant|official usga" apps/web apps/native --include='*.ts' --include='*.tsx' --include='*.swift' \| grep -v node_modules \| grep -v legal/` | no matches |

## Scope

**In scope** (the only files you should modify):
- `apps/web/app/layout.tsx`, `apps/web/app/opengraph-image.tsx`, `apps/web/app/about/page.tsx`, `apps/web/app/contact/page.tsx`, `apps/web/components/seo/json-ld.tsx`
- `apps/web/components/homepage/landing.tsx` (disclaimer only)
- `apps/web/components/round/calculation/steps/handicap-impact-step.tsx` (Step 4)
- `apps/web/emails/*.tsx` — ONLY if the Step 1 grep finds claim strings there
- Native siblings found in Step 3 that carry claim (not educational) strings, plus `apps/native/app/(tabs)/rounds/[id]/calculation.tsx` for the Step 4 parity change

**Out of scope** (do NOT touch):
- `apps/web/components/legal/terms-content.tsx` and `privacy-content.tsx` — the existing legal disclaimers are correct
- Any handicap math, schema, or engine file — this is a copy-only plan
- The usga.org educational links in calculation steps — keep them
- `packages/tokens/generated/*` — never hand-edit

## Git workflow

- Branch: `advisor/006-truthful-handicap-claims`
- Conventional commits (repo style, e.g. `fix: accept par-3 course ratings in scorecard + handicap validation`); suggested: `fix(compliance): replace USGA-compliant claims with WHS-method wording`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Sweep and inventory every claim string

Run the "Claim sweep" grep above plus `grep -rniE "usga" apps/web/emails`. Record every hit and classify: CLAIM (asserts compliance/official status/endorsement) vs EDUCATIONAL (references USGA rules or links to usga.org). Only CLAIM strings change.

**Verify**: inventory list written into the PR/commit description or a scratch note; every file in the "Current state" list appears in it.

### Step 2: Apply the replacement copy on web

Apply the table above verbatim. Add the disclaimer sentence to `landing.tsx` (small muted text near pricing/footer of the component, using existing typography primitives — match how the component renders small print elsewhere) and to the About page near the stat tiles. Do not change layout/structure otherwise.

**Verify**: `pnpm lint` → exit 0; claim-sweep grep → no matches in `apps/web`.

### Step 3: Fix native claim strings

For each native file in the inventory: replace CLAIM strings using the same vocabulary ("WHS-method", "unofficial"). Watch (Swift) files: string changes only, no layout changes. Leave EDUCATIONAL references intact.

**Verify**: claim-sweep grep → no matches repo-wide (excluding `legal/`); `pnpm parity:styles` → exit 0.

### Step 4: Add the missing transparency notes to the calculation walkthrough

In `handicap-impact-step.tsx`, inside the same explanatory container that holds the best-8-of-20 `Blockquote` and the conditional ESR block, add two static educational paragraphs (match the existing `<P>` styling):

1. Caps: "Your Handicap Index can also be limited by the WHS soft and hard caps: once it would rise more than 3.0 strokes above your lowest index of the last 365 days, further increases are halved, and it can never rise more than 5.0 above that low point. If a cap applied to this round, the 'after' value reflects it."
2. PCC: "Official handicap bodies also apply a daily Playing Conditions Calculation (PCC) of −1.0 to +3.0. Handicappin' does not apply PCC, so your index here can differ slightly from an official one."

Mirror the same two paragraphs in the native sibling `apps/native/app/(tabs)/rounds/[id]/calculation.tsx` (find its equivalent explanatory section; use token-based classes only).

**Verify**: `pnpm test:unit` → all pass; `pnpm parity:drift` run and its output noted; `pnpm parity:styles` → exit 0.

## Test plan

This is copy-only; no new tests required. If any existing unit/storybook snapshot asserts the old strings (`grep -rn "USGA Compliant" apps/web/tests apps/web/test apps/native/tests`), update those assertions to the new copy — do not delete tests.

## Done criteria

- [ ] Claim-sweep grep (see Commands) returns no matches outside `components/legal/`
- [ ] `pnpm lint` exits 0; `pnpm test:unit` exits 0
- [ ] `pnpm parity:styles` exits 0
- [ ] Disclaimer sentence present in `landing.tsx` and the About page
- [ ] Cap + PCC paragraphs present in both web and native calculation walkthroughs
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any in-scope excerpt in "Current state" doesn't match the live code (drift).
- You find claim strings inside the handicap engine, emails sent by edge functions (`supabase/functions/`), or App Store metadata files — report the locations; those surfaces need owner review, not silent edits.
- A snapshot/test failure can't be resolved by updating the asserted string.
- You are tempted to reword the legal disclaimers in `terms-content.tsx` — they are out of scope.

## Maintenance notes

- Plan 007 (official-handicap roadmap) defines when stronger claims become allowed (e.g., after GHIN/GPA integration). Until a licensing milestone lands, all new marketing copy must use the "WHS-method / unofficial" vocabulary from this plan.
- Reviewer should scrutinize: the OG image renders text at build time — confirm the new string fits its layout (opengraph-image.tsx uses fixed font sizes); and that JSON-LD stays valid JSON after edits.
- Deferred deliberately: computing and displaying *whether a cap actually bit* on a specific round (requires plumbing Low-HI data into the step props) — worth doing when plan 008's timeline extraction makes that data cheap to expose.
