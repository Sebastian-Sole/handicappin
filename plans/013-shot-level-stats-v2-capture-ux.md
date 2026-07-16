# Plan 013: Shot-level stats v2 — one logging UI, read-only viewer, and live + watch capture

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7388ae1..HEAD -- apps/web/components/scorecard/ apps/native/components/scorecard/ apps/native/app/rounds/ apps/native/lib/round-session/ apps/native/targets/watch/ apps/web/lib/statistics/ apps/native/lib/statistics/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Visual spec (source of truth for layout/behaviour)**: the interactive
> mockups at `claude.ai/code/artifact/f44a7e86-543c-486a-9c78-06df94268f72`
> (v3). This plan is the written form of those decisions; where a pixel-level
> question arises, the mockups win.

## Status

- **Priority**: P2
- **Effort**: XL (phase it — see "Build order"; each phase is independently shippable)
- **Risk**: MED (touches the scoring write path and the native live/watch offline protocol; mitigated: score-only fields are unchanged, all detail fields already optional/nullable since plan 010, engine proven untouched by plan 008)
- **Depends on**: plan 010 (DONE — the three nullable columns, the write path, and v1 stats already exist; this plan is a UX/architecture redesign on top of them). Plan 009 useful (measures toggle adoption).
- **Category**: direction (product depth — makes the shot-level data people actually capture and read back)
- **Planned at**: commit `7388ae1`, 2026-07-15
- **Issue**: none yet (follow-up to #140 / plan 010)

## Why this matters

Plan 010 added the three per-hole fields (`putts`, `fairwayHit`, `penaltyStrokes`) and headline stats, but entered them by **stacking an inline putts/fairway/penalty strip under every hole** on the existing mobile scorecard. In practice that made an 18-hole round one long, cramped scroll — the owner's words: "the scorecard on mobile now looks horrible." Two deeper problems surfaced in review:

1. **Wrong surface.** Detailed stats are only reliably captured *during* a round, hole by hole, while you remember them — not typed in afterward. But plan 010 explicitly scoped the **native live flow and the watch out**, so today detail can only be added in the post-round form, which is exactly where people *don't* have the numbers.
2. **The "skewed stats" fear.** A real adoption blocker: a golfer who never logged putts feels that starting now — or missing one round — will corrupt their averages, so they never start.

v2 fixes the shape and the surface: **one logging UI** for live and post-round, a calm **read-only viewer**, detail capture **at hole-out** on phone and watch, and stats that are **honest about their sample** so starting today never feels lossy.

## Current state

- **Web mobile scorecard** `apps/web/components/scorecard/scorecard-table.tsx` — renders a desktop grid and a phone layout; in detailed mode each hole gets an inline Putts / Fairway / Penalty sub-row (the cramped layout being replaced). Shared compact-cell input + a `PenaltyControl` (reveal-on-`+`, clearable) live here.
- **Web add-round** `apps/web/components/scorecard/golf-scorecard.tsx` — hosts the `detailedScoring` `useState` toggle (off every visit, no persistence, no DB column — per plan 010 decision 2) and the `<ScorecardTable>`; `onSubmit` defaults `penaltyStrokes ?? 0` for entered holes when detailed, strips all three when not.
- **Native manual add** `apps/native/app/rounds/add.tsx` + `apps/native/components/scorecard/scorecard-table.tsx` — same-slug mirror; `detailed-scoring-toggle`, `course-picker-trigger`, `score-input-*`, `putts-input-*`, `penalty-add-*` testIDs; mirrors web's `PenaltyControl` behaviour.
- **Native live flow** `apps/native/app/rounds/live/*` + `apps/native/lib/round-session/*` — local-first `RoundSession` reducer (pure, synchronous SQLite write per event); **score-only per hole today**. Offline/watch contract in `apps/native/lib/round-session/PROTOCOL.md`. This is where hole-out detail capture must be added.
- **Watch** `apps/native/targets/watch/*.swift` (`ScorecardView.swift`, `HoleView.swift`, `RoundModel.swift`, `PhoneLink.swift`) + `apps/native/watch-core/` — SwiftUI companion, **score-only**, synced via WCSession through the same reducer. Home shows Handicap Index + last round.
- **Write path** `apps/web/server/api/routers/round.ts` `submitScorecard` — already persists `putts/fairwayHit/penaltyStrokes`; shared by web + native tRPC. (Note: the negative-temp-id tee guard at block 3b `teePlayed.id > 0` landed in `7388ae1`.)
- **Schema** `apps/web/db/schema.ts` — `score.putts int NULL`, `score.fairwayHit boolean NULL`, `score.penaltyStrokes int NULL`. No migration needed.
- **Stats** `apps/web/lib/statistics/calculations.ts` + mirror `apps/native/lib/statistics/calculations.ts` — putts/round, GIR%, FIR%, penalties/round; **already compute over the subset with data and return a `sampleSize`** (see `apps/native/tests/unit/shot-level-stats.test.ts` — "sampleSize 0", "skips partial rounds"). The display surfaces do not yet show sample size prominently.
- **Types mirror** `apps/web/types/scorecard-input.ts` ↔ `apps/native/lib/api/schemas/scorecard.ts` ↔ `supabase/functions/handicap-shared/shared-schemas.ts`, guarded by `pnpm check:schema-sync`.
- Web is design source of truth; same-slug native must match (`.claude/rules/web-native-parity.md`); native styling via tokens only (`pnpm parity:styles`).

## Design decisions (implement, don't relitigate)

These are the owner's settled calls from the v2/v3 design review. The mockups show each.

### D1 — One phone logging UI (live == post-round)
- A single **full-screen, one-hole-at-a-time** entry component is the *only* way to log a scorecard. Replaces the inline per-hole detail strip.
- Per hole: hole meta (Par · distance · SI), a prominent **Score** stepper, then the shared detail trio (Putts stepper · Fairway segmented · Penalties stepper) — shown only when the round is "detailed" (D3).
- **Post-round**: same component with Prev / Next paging over all holes.
- **Live**: same component + a **Play** face for distance (D5) reachable by swipe/toggle; Score face is the identical logging UI.
- Web + native both implement (parity). The old grid/inline detail layout is removed from the mobile entry path.

### D2 — Read-only round viewer (accordion, not the entry screen)
- Viewing a saved round uses **separated hole cards** (accordion), **not** the per-hole entry screen and **not** a drawer.
- **Display-only** — no inputs. Header per hole shows **Par · Stroke Index · Distance** (distance is new here — pull from the tee's stored hole data). Expanding shows read-only **Putts / Fairway (✓/✗/–) / Penalties** chips.
- Rounds logged without detail show **score only** — no empty stat chips.

### D3 — Opt-in: Settings default + per-round override
- A **"Detailed logging"** default in **Settings** (default for new rounds). Persist this preference (this supersedes plan 010's "no persistence" stance — a real setting now, client-stored or a lightweight profile pref; do **not** block on a schema change if a client store suffices).
- At **round start**, a choice — **Track detailed stats** / **Scores only** — pre-selected from the default, with "remember my choice".
- Optional/deferred: let users track only *some* fields (e.g. putts only). Not in this plan.

### D4 — Capture at hole-out (not per stroke)
- During the hole: heads-down (distance/score visible, nothing required to tap). At **hole-out**, log score + putts + fairway + penalty in one moment, then advance. One interaction point per hole.
- **Not** per-stroke logging (rejected — pulls the player out of the round). A hybrid "+1 stroke" quick-tally is **deferred** (maybe later).

### D5 — Watch
- **Two full-screen faces, no tabs — swipe** between them.
- **Face 1 — Distance**: shows the hole's **total distance** now (data we already store per hole). Reserved to become **distance-to-pin** later when GPS / course-map data exists. Default view = total distance.
- **Face 2 — Score grid**: a **2×2, fixed order (not configurable in this plan)** — **Score ↖, Putts ↗, Penalties ↙, Fairway ↘**.
  - Numeric tiles (Score / Putts / Penalties): **tap to focus**, then the **Digital Crown** adjusts the focused tile, with a **haptic tick per detent**.
  - **Fairway**: **tap toggle** (Hit ✓ / Miss ✗ / n-a –; par 3 → n/a). No focus.
  - **Next** button under the grid → saves the hole, advances, and **swipes back to the Distance face** for the new hole.
- **Scores-only mode** (detail off): the grid **collapses to a single large Score face** (crown to change) + Next.
- Sync the three fields through the existing WCSession/RoundSession event contract (`PROTOCOL.md`).

### D6 — Honest, sample-size-aware stats (kills the skew fear)
- Every detailed stat (putts/round, FIR%, GIR%, penalties/round) is averaged **only over rounds/holes that have that field**, and the UI **shows the sample size** ("Based on N of M rounds"). Unavailable (—) when N = 0. **Never zero-fill** missing rounds.
- Copy near the stats: handicap uses **every** round; detailed stats only use rounds you logged them in; skipping a round never counts against you.
- Backend already computes this way (returns `sampleSize`) — this is largely a **display** change surfacing it.

### D7 — One shared detail component
- Build the **Putts / Fairway / Penalty** trio once and reuse it in three modes: **editable** (phone logging), **static** (read-only viewer), **crown-driven** (watch grid). Web + native each get their own implementation of the same three-mode component, kept in parity.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Local stack | `supabase start` (if available) | local DB up |
| Schema zod sync (only if schema/types touched) | `pnpm check:schema-sync` | exit 0 |
| Web unit/integration | `pnpm test:unit` / `pnpm test:integration` | all pass |
| Native unit | `cd apps/native && pnpm test` | all pass |
| Lint | `pnpm lint` | exit 0 |
| Native bundle | `cd apps/native && npx expo export -p ios` | bundles |
| Native run (sim) | `cd apps/native && pnpm exec expo run:ios` | builds + installs (see gotchas below) |
| Parity | `pnpm parity:styles` && `pnpm parity:routes` && `pnpm parity:drift` | styles/routes exit 0; drift noted |

**Native build gotchas** (verified 2026-07-15): first `expo run:ios` needs `pnpm exec install-skia` before pods will resolve (Skia prebuilt binaries). The watch target builds with the iOS app; it installs to the paired watch only when that watch sim is booted (else `simctl install <watch-udid> <DerivedData>/…/Debug-watchsimulator/HandicappinWatch.app`). Use pnpm 10.33.0 (not 11 — strips the react-native-css patch).

## Build order (phase it — each phase ships on its own)

1. **Shared detail component (D7)** — web + native: the Putts/Fairway/Penalty trio with `editable | static | crown` modes. Unit-test the value/clamp/toggle logic. No behaviour change yet.
2. **Phone logging UI (D1)** — refactor the mobile scorecard entry to the one-hole-at-a-time component using the trio from step 1; wire it in `golf-scorecard.tsx` (web) and `apps/native/app/rounds/add.tsx` (native). Remove the inline detail strip from the entry path. Post-round paging first (no live changes yet).
3. **Read-only viewer (D2)** — accordion round viewer, display-only, with distance in the header. New surface; does not touch entry.
4. **Opt-in placement + honest stats (D3, D6)** — Settings "Detailed logging" default + persisted preference; round-start choice; surface `sampleSize` in the stats display with the reassurance copy.
5. **Live-round capture (D1 live + D4)** — extend `RoundSession` + the live hole screen to capture the trio at hole-out; add a **Play** face (total distance now). Update `PROTOCOL.md` for the new event fields.
6. **Watch (D5)** — distance face + 2×2 crown grid + haptics + Next→swipe-back + scores-only collapse; carry the three fields through the WCSession contract.

## Scope

**IN**: the six phases above (phone logging redesign, read-only viewer, opt-in relocation, sample-size stats display, native live + watch detail capture, shared component).

**OUT** (explicit non-goals): distance-to-pin / GPS / course maps (the Play face is a reserved slot only); per-stroke logging and the hybrid quick-tally; watch tile configurability; new headline stats beyond plan 010's four; any handicap-engine change (`penaltyStrokes` stays informational).

## Verification

- Per-phase: the commands above green; `pnpm parity:styles` clean on native; `pnpm parity:drift` reviewed for each changed web component.
- D1: a round logged post-round and a live round produce byte-identical `submitScorecard` payloads for the same inputs (the unified UI must not change the write shape). Extend `apps/web/tests/integration/shot-detail-persistence.test.ts`.
- D6: a stats fixture with a mix of detailed and score-only rounds returns the correct `sampleSize` and the UI shows "N of M" (unit-test the display formatting).
- Watch: `expo export -p ios` bundles; manual sim pass — swipe between faces, focus a tile + crown adjusts, fairway toggles, Next advances and returns to the distance face; scores-only collapses to one Score face.
- Full-round manual pass on web + native sim before calling any phase done.

## STOP conditions

- Drift check shows in-scope files changed since `7388ae1` and the "Current state" no longer matches — reconcile before proceeding.
- Any change would alter the `submitScorecard` payload for score-only rounds, or feed `penaltyStrokes` into an engine input — stop (that breaks the plan-008 characterization guarantee).
- `pnpm check:schema-sync` or `pnpm parity:styles` fails and the fix isn't obvious — stop and report.
- A phase requires a DB migration for the opt-in preference (D3) — stop and confirm with the owner before adding a column (a client-side/profile store is preferred).
