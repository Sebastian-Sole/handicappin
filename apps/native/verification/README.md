# Verification harness

The **local-first, two-speed, multi-modal** loop that decides whether a native
screen is equivalent to its web reference, per a frozen rubric. Ported from the
ks-digital reference harness (`apps/app/verification` on
`feat/expo-app-design-system`) and adapted to handicappin. Everything runs on
the Mac; the only metered cost is the optional vision-judge calls.

> It verifies **behavior, not just pixels**, and it has a **bounded, finite
> stop criterion**.

## The two surfaces are NOT equals

| Surface | Role | Verdict? |
|---|---|---|
| **Expo web static export** (`expo export -p web` → `dist/`) | cheap pre-filter: crash? glyphs? tree roughly right? | **Never** — denylist-gated |
| **iOS simulator** | sole equivalence truth | **Yes** — 3 stacked checks must all pass |

The web build catches gross errors fast and free but **never overrules iOS**.
Components using denylisted CSS (`backdrop-blur`, multi-layer `box-shadow`,
CSS grid, `position: sticky`) **skip the web verdict** (false-PASS sources);
the RNW `#1604` `flex:0`-collapse is a known **false-FAIL** and is never "fixed".

## Stacked iOS gate — all three must pass

1. **Vision judge** — Claude (`config.JUDGE.MODEL`, default
   `claude-sonnet-4-6`, override with `ANTHROPIC_MODEL`) scores the frozen
   `rubrics/<screen>.yaml` with the web reference **in-prompt every iteration**,
   2-judgment quorum. Reads `ANTHROPIC_API_KEY` from the env and **degrades
   honestly** when absent: clear message, quorum skipped, screen pauses on
   `PENDING_HUMAN_SIGN_OFF`. Verdict mode = **human-in-the-loop**: the loop
   proposes and **pauses**; a human makes the final call.
2. **Maestro behavioral** — `../.maestro/flows/` (today:
   `smoke-token-gallery.yaml`). Accessible-name/testID selectors only.
3. **a11y / glyph** — token-contrast gate (per colour mode), accessibility-tree
   asserts, glyph/no-tofu, dynamic type, reduce-motion, scripted VoiceOver.
   (`gates/a11y-checks.mjs` is the recorded registry.)

## handicappin-specific adaptations (vs the ks reference)

- **Per-mode tokens.** `@handicappin/tokens` resolves colours per mode
  (`tokens.colors.light` / `tokens.colors.dark`, same for `surfaces`), plus
  semantic `spacing` (xs..5xl) and the Tailwind `spacingScale`. The contrast
  gate therefore runs **once per mode**; `lib/tokens.mjs` exposes
  `colorModes()`.
- **One screen today.** `config.SCREENS = ['index']` — the token-gallery
  bring-up screen (`app/index.tsx`, testID `token-gallery`; the root layout
  exposes the zero-size `fonts-ready` marker). The shared-route source of
  truth for adding screens is `scripts/parity/routes.mjs` →
  `computeParity().shared`.
- **Known contrast waiver.** Dark-mode `text-on-primary` measures **4.27:1**
  (< 4.5) in the *web* tokens; parity comes first, so the gate reports it as
  `waived` instead of failing the port (`gates/contrast-gate.mjs`
  `KNOWN_SUBTHRESHOLD`). Fix belongs in `apps/web/app/globals.css`; delete the
  waiver when the regenerated contract passes.
- **`data-settled` not emitted yet.** The capture-hygiene gate requires the
  marker, the token gallery is static, so live captures honestly report
  `data-not-settled` until the first data screen wires it. Do not relax the
  predicate.
- **Web auth.** The web reference (apps/web, `pnpm dev`, :3000) uses Supabase
  cookie auth — no localStorage fixture exists; see `scripts/compare-screen.sh`.

## Layout

```
config.mjs                 screens, caps, denylist, paths, cost, judge model
lib/color.mjs              WCAG luminance + contrast ratio (pure)
lib/tokens.mjs             loads @handicappin/tokens (Node TS type-strip, no build)
gates/contrast-gate.mjs    deterministic per-mode token-contrast gate + waiver ledger
gates/a11y-checks.mjs      the a11y/glyph matrix + sheet focus checklist
prefilter/denylist.mjs     CSS denylist + RNW#1604 false-FAIL guard
prefilter/web-prefilter.mjs static-export drive + yield gate + demotion fallback
ios-gate/capture-hygiene.mjs font-ready + data-settled gating, bad-frame discard
ios-gate/warm-sim.mjs      simctl warm-sim boot + capture + ImageMagick normalize
judge/build-prompt.mjs     fills the frozen judge prompt (rubric + accept ledger)
judge/vision-judge.mjs     Anthropic judge stage (graceful no-key degradation)
judge/quorum.mjs           2-judgment quorum + verdict mode + sign-off gate
judge/verdict-cache.mjs    cache keyed on hash(iOS + web + rubric_version + judge model)
loop/loop-control.mjs      iteration/budget/total-pass caps, no-progress, verified_ gating
rubrics/<screen>.yaml      frozen per-screen scoring targets
run-harness.mjs            end-to-end orchestrator for one screen
*.test.mjs                 node --test (hermetic: no RN runtime, no sim, no API key)
```

## Run it

```sh
# Deterministic tiers + loop logic + dry-run proofs (no sim, no API key needed):
pnpm --filter native verify:harness     # node --test

# End-to-end pipeline on one screen (degrades honestly if the sim isn't wired;
# wires the Anthropic judge iff ANTHROPIC_API_KEY is set):
pnpm --filter native harness:run index

# Behavioral tier (PRE-REQUISITE: dev server + sim already running):
maestro test apps/native/.maestro/flows/

# Side-by-side native/web capture for eyeballing:
apps/native/scripts/compare-screen.sh index /
```

The orchestrator writes an iteration log to `artifacts/run-<screen>.json` and
the verdict cache to `artifacts/verdict-cache/` (both git-ignored, reproducible).

## Wiring the live stages

`run-harness.mjs` injects the three expensive/live stages so the pipeline is
runnable and testable now, with one native screen, and degrades honestly
(`iOS gate unavailable`, `judge disabled`) instead of faking green:

- `probe(screen)` → web pre-filter facts (agent-browser + Playwright over the
  static export, `pnpm --filter native export:web`).
- `capture(screen)` → `{ treeSnapshot, iosBytes, webBytes }` from the warm sim
  (`ios-gate/warm-sim.mjs`). The frame is only judged once `isCaptureReady`
  is true.
- `judge(prompt, images, pass)` → one `Judgment`
  (`judge/vision-judge.mjs`). Two passes form the quorum.

## Caps + cost (seeds from the ks calibration — refine on the first converged screen)

| Knob | Value | Source |
|---|---|---|
| iteration cap / screen | 8 | `config.CAPS` |
| quorum | 2 | `config.CAPS` |
| vision calls / screen | 16 (= 8 × 2) | derived |
| no-progress halt | 3 identical delta-sets | `config.CAPS` |
| total-pass ceiling | 6 | `config.CAPS` |
| $/iteration | $0.05 (Sonnet) – $0.24 (Opus) | ks spike-notes |
| screens/hour (warm sim) | 90–130 | ks spike-notes |

`loop-control` records actual spend + the no-progress history so the caps can
be re-set from data, not a guess.

## Felt-quality human sign-off (named, or it won't happen)

Springs/gestures/timing are invisible to vision and Maestro. The supervised iOS
gate includes a **named human felt-quality sign-off** for sheets/scroll/push —
record it in the run log per screen, or the screen with green
visual+behavioral+a11y rows is **still not done**.
