# Implementation Plans

Two `/improve` runs live here. Each executor: read the plan fully before starting, honor its STOP conditions, and update your row when done.

- **Run 1** (2026-07-02, commit `469a53f`): plans 001–005 — all executed and since **merged to main** (via the advisor integration branches; see git log around `9b458a4`/`30635c1`/`c257c6a`/`a95b8cb`).
- **Run 2** (2026-07-11, commit `0432f5f`, `/improve next` — direction + official-handicap audit): plans 006–011 below.

Selection note (run 2): executed non-interactively, so plans were written for the top findings by leverage (the skill's default). The findings deliberately NOT planned are listed below — the operator can request plans for any of them.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Course-ingestion last mile: loader + provenance | P1 | M | — | DONE (merged to main) |
| 002 | Thin admin moderation console | P1 | M | — | DONE (merged to main) |
| 003 | Rejection loop: reason, history, path forward | P2 | L | 002 | DONE (merged to main) |
| 004 | Auth rate limiting before App Store launch | P1 | S–M | — | DONE (merged to main; owner switches tracked in BACKLOG) |
| 005 | Billing lifecycle emails at the webhook chokepoint | P2 | M | — | DONE (merged to main) |
| 006 | Replace "USGA Compliant" claims with defensible wording (web+native) | P1 | S–M | — | TODO |
| 007 | Official-handicap roadmap doc + owner runbook | P1 | S–M | — (pairs with 006) | TODO |
| 008 | Single-source handicap engine + characterization tests | P1 | M | — | TODO |
| 009 | Product analytics foundation (taxonomy + PostHog, web+native) | P1 | M | — | TODO |
| 010 | Shot-level stats v1 (putts/FIR/penalties → GIR/FIR%/putts-per-round) | P2 | L | 008 (recommended), 009 (useful) | TODO |
| 011 | Activation: starting-HI seed, CSV import, guided first-run + goal | P2 | L | 008 (recommended), 009 (useful) | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED (with one-line rationale)

## Dependency notes (run 2)

- **006 and 007 pair**: 007's roadmap assumes 006's "unofficial / WHS-method" vocabulary is live; both are independent to execute and can run in parallel.
- **008 before 010 and 011**: both later plans push new data through the scoring write path; 008's characterization tests are the proof the engine output is unperturbed. Not a hard blocker, but running 010/011 first forfeits the safety net.
- **009 is the measurement prerequisite** for the deferred strategy calls below (pricing repackaging, retention, i18n): instrument first, decide with data.
- 006, 007, 008, 009 are mutually independent — parallelizable in separate worktrees.
- 010 and 011 both touch `apps/web/types/scorecard-input.ts`-adjacent surfaces and the add-round UI area — if run concurrently, rebase whichever lands second.

## Direction findings NOT planned this run (candidates for a next run)

- **Retention engine (DIRECTION-05)**: all emails are transactional (`apps/web/emails/` — welcome/OTP/billing/round-approved…), the only cron is reconcile-stripe (`apps/web/vercel.json`), `emailPreferences.featureUpdates` is a stub with no pipeline, and native has no push (`expo-notifications` absent from `apps/native/package.json`). The streak/gap signals already exist unused (`apps/web/lib/statistics/calculations.ts:435,531,566`). Effort M. Deferred: sequence after 009 so the first loop targets measured drop-off.
- **Social layer (DIRECTION-06)**: zero multi-user surface in the schema (no friends/groups/leaderboards/shared-round tables in `apps/web/db/schema.ts`); live logging is single-player. Cheapest first slice: shareable public round/handicap card reusing the existing SEO/OG infra. Effort L, real RLS/privacy surface. Owner strategy call.
- **i18n + local pricing (DIRECTION-08)**: no i18n library anywhere; pricing hardcoded USD (`apps/web/utils/billing/pricing.ts:17,82-84` rejects non-USD) while Norway is a primary market. Effort L (NOK/GBP pricing alone is M and touches the payment-verification path). Decide after 009 shows Norwegian traffic share.
- **Premium repackaging (DIRECTION-04)**: `apps/web/components/billing/plan-features.ts` — Premium ($19/yr) adds ONLY "unlimited round logging" over free; all insights/stats/calculators require Unlimited ($29). A ~25-round free cap rarely binds in a Nordic season. Owner pricing decision; revisit once 009 measures paywall conversion and 010 gives the paid tiers something heavier to sell.
- **Course directory + SEO landing pages (D6, run-1 carryover, extended)**: still unplanned; run 2 added evidence that `app/sitemap.ts` is a static 5-URL file, so per-course pages also need a dynamic sitemap. Unblocked since run 1 (courses are loaded and approved in prod). Effort L.
- **Round-less course/tee submissions** (run-1 carryover): unchanged; builds on 003's lifecycle work. Effort M.
- **Native AI-scorecard camera flow** (run-1 carryover): unchanged; BACKLOG §D. Effort M–L.
- **Quick wins not worth a full plan** (single-conversation fixes): bound `teeTime` to not-future in `apps/web/types/scorecard-input.ts:178` (+ mirrored edge schema); decide CORRECTNESS-01 — schema rejects 10–17-hole rounds while `calculateAdjustedGrossScore`'s partial-round branch (`packages/handicap-core/src/calculations.ts:377-384`) is dead-but-tested code; constrain `teeInfo.gender` at the DB level (currently free text, enum only in zod).

## Compliance/engineering findings folded into plans

- COMPLIANCE-01 (unqualified "USGA Compliant" claims vs ToS disclaimer) → plan 006.
- TRANSPARENCY-01 (calc walkthrough omits caps/Low-HI/PCC) → plan 006 step 4.
- TEST-01 (two-pass ESR/cap orchestration in the edge function has zero tests) + ARCH-01 (engine duplicated: `packages/handicap-core` vs hand-copied `supabase/functions/handicap-shared/utils.ts`, no sync guard) + CORRECTNESS-02 investigation (ESR detected against uncapped rolling index — LOW confidence, measure only) → plan 008.
- COMPLIANCE-02 (PCC absent): treated as a scope-out, not a build — 006 discloses it; 007 records it as a licensing-conversation item. PCC is infeasible for a single-user tracker (needs all-players-per-course-per-day field data).
- COMPLIANCE-03 (no timely-posting/format/attestation gates): teeTime bound is a quick win (above); the attestation decision is 007 §6 / the stale `.claude/plans/usga-round-verification.md`.

## Decision drift to resolve (decide, don't build — one conversation each)

- **`.claude/plans/usga-round-verification.md`** (peer attestation, never built): now referenced by plan 007 §6 — resolve there (build vs close).
- **`.claude/plans/migrate-handicap-cron-to-vercel/`** (run-1 carryover, still open): pg_cron was hardened instead of migrated; close as superseded or execute.
- **`docs/future-features.md`** staleness (run-1 carryover): still worth a pruning pass; note 005 shipped the lifecycle-email items.

## Findings considered and rejected

(Run 1 list retained — do not re-audit.)

- **Geo/coordinate capture in ingestion**: rejected by owner 2026-07-03.
- **GDPR data export**: already shipped (`auth.exportUserData`, `data-export-section.tsx`).
- **Handicap-history trend view**: already shipped (`handicap-trend-chart.tsx`).
- **JWT in `monitor-queue.sh:97`**: standard public supabase-demo local token; not a credential.
- **#134 Stripe optimistic lock**: tracked as a GitHub issue; do before launch.
- **Playwright E2E scaffolding**: fully specified in `BACKLOG.md`; execute from there.
- **Native Google OAuth**: gated on owner-side OAuth client provisioning.
- **future-features.md wishlist items** (notification center, Redis caching, audit logging, usage-based billing, fraud detection, metrics dashboards): trigger conditions still don't hold.

(Run 2 additions.)

- **"Get USGA approved" as an engineering task**: rejected as infeasible in that form — no jurisdiction licenses software vendors to issue a Handicap Index; the viable routes (US AGA Type-3 clubs + GHIN/GPA; federation partnerships in Norway/GB&I) are owner/legal work with product seams, captured in plan 007. Building more engine features does not move officialdom.
- **Building PCC**: see COMPLIANCE-02 above — disclose, don't build.
- **Watch/Swift handicap-math drift**: not a risk — the watch computes no handicap math; it displays server-computed values (`apps/native/targets/watch/Core/Protocol.swift`, `Models.swift`). No sync guard needed there.
- **Wiring PostHog server-side into Stripe/RevenueCat webhooks (v1)**: deferred to keep 009 additive and low-risk; revisit as 009's v2.
