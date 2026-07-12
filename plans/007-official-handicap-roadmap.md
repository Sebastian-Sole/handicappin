# Plan 007: Write the official-handicap roadmap doc and owner-action runbook

> **Executor instructions**: Follow this plan step by step. This plan produces
> DOCUMENTATION ONLY — you will create one doc and add one BACKLOG section. Do
> not modify application code, do not contact any external organization, and
> do not change marketing copy (plan 006 owns copy). If anything in the "STOP
> conditions" section occurs, stop and report. When done, update the status
> row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0432f5f..HEAD -- docs/ BACKLOG.md`
> New docs appearing since `0432f5f` with "handicap" or "USGA" in the name →
> read them first and reconcile instead of duplicating.

## Status

- **Priority**: P1 (strategy-unblocking; zero code risk)
- **Effort**: S–M (writing + synthesis)
- **Risk**: LOW
- **Depends on**: none (pairs with plan 006 — wording rules below assume 006 lands)
- **Category**: direction
- **Planned at**: commit `0432f5f`, 2026-07-11

## Why this matters

The owner's stated goal is an official handicap ("USGA approved"). Research (July 2026, summarized below — treat it as the source material to distill, not something to re-research) established that **no jurisdiction licenses software vendors to issue a Handicap Index**; the realistic paths run through licensed clubs/associations and their APIs. That strategy spans months of owner-side actions (applications, agreements) that must not live only in a chat log. This plan turns the research into a durable decision document with concrete next actions, so every future session (and the owner) works from the same map.

## Current state

- No doc under `docs/` covers handicap licensing/officialdom (`ls docs/` → apple-watch, billing-*, design-token-remediation, future-features, native-*, ui-consistency-remediation, web-native-parity).
- `.claude/plans/usga-round-verification.md` is a stale never-built plan for peer attestation (known decision drift, flagged in `plans/README.md`). Your doc must reference it and mark its decision point.
- `BACKLOG.md` has an established pattern of "owner action required" sections (see "## Ship the Mobile App (iOS) — owner action required" and "## Auth hardening — owner switches"). Match that structure.
- The app currently claims "USGA Compliant" (being fixed by plan 006) and its ToS already disclaims affiliation (`apps/web/components/legal/terms-content.tsx:46-49, 337-338`).
- Engine gaps relevant to any audit by a licensing body (verified 2026-07-11): PCC absent; peer attestation absent; penalty scores absent; timely-posting not enforced (`apps/web/types/scorecard-input.ts:178` has no upper bound on `teeTime`); 10–17-hole rounds rejected. Core math (best-8-of-20, NDB, 9-hole expected-score, caps, Low HI, ESR) is implemented.

## Research digest (verbatim source material — distill this into the doc)

**Governance.** WHS IP is owned jointly by the USGA and The R&A and licensed only to national/authorized associations, which issue the Handicap Index directly or through affiliated golf clubs (Rules of Handicapping, Rule 1: an authorized association holds "exclusive rights to implement and administer the World Handicap System within its jurisdiction, including the issuance of a Handicap Index"). A software vendor is not a licensee category anywhere. In the US, ~55 Allied Golf Associations (AGAs) administer WHS under USGA license; GHIN is the USGA's central computation service. In England/Scotland the national bodies run central WHS platforms (England Golf; Scottish Golf VMS). In Norway, Norges Golfforbund (NGF) administers WHS on GolfBox; official handicap requires membership in an NGF-affiliated club.

**The proven US route for an app (most feasible).** Operate or partner with USGA-licensed **"Type 3" golf clubs** under an AGA — clubs whose members are recruited from the public online, ≥10 members, bylaws + a handicap committee providing peer review, members within ~50 miles of the club's principal location. This is exactly how TheGrint and DiabloGolf offer official handicaps. Since 1 Jan 2022, apps can no longer issue GHIN numbers themselves — users pay the AGA/USGA directly (~$30–50/yr) for the GHIN ID; the app enrolls them in its licensed clubs and syncs the scoring record. Separately, the USGA runs a vendor API program branded **"GPA"** (expansion inconsistent across sources — confirm exact name/terms with the USGA): approved vendors read handicap data and, with the right access level, post scores to GHIN; there is a published "GPA Approved Vendors" list; access is application-gated, terms not public. GolfApp is a precedent for "integrate, don't issue" (syncs existing GHIN accounts via GPA).

**GB&I.** England Golf's central platform is the sole calculation hub; third-party software can become a **licensed ISV** feeding scores into it under a CONGU licence (existing ISVs: Club Systems, DotGolf, GolfBox, Golf Genius, HandicapMaster, IntelligentGolf, Nexxchange, etc.) — club-facing, contract-gated. Non-club golfers get official Indexes only via England Golf's own **iGolf** (£47/yr) or Scottish Golf's **OpenPlay** (£5.99/mo). An independent app cannot issue in GB&I; the play is companion-tracker + point users at iGolf/OpenPlay, optionally pursuing ISV/API integration.

**Norway.** NGF is sole authority; system runs on GolfBox; official handicap requires NGF-club membership. Key 2025 development: NGF decided to keep GolfBox but move to an **NGF-owned "Multivendor Union database"** explicitly to enable other administrative systems and better integrations later — the closest thing to a future third-party seam in Norway. Worth direct engagement with NGF, especially given Handicappin's Norwegian course coverage.

**Wording rules (unlicensed).** Safe: "handicap tracker", "WHS-method calculations", "unofficial handicap/estimate". Unsafe: "USGA Handicap Index®", "official handicap", unqualified "USGA compliant". Standard disclaimer: "not sponsored or endorsed by the USGA or The R&A; does not provide an official Handicap Index." (Plan 006 implements this.)

**Recommended sequence.** (c) Ship the unofficial-but-accurate posture now with clean wording → (a) pursue the US AGA-Type-3-club + GHIN/GPA route as the flagship "official" tier → (b) treat Norway/GB&I as partnership/monitoring tracks (NGF Union DB; England Golf ISV enquiry; link users to iGolf/OpenPlay meanwhile).

**Uncertainties to flag in the doc**: exact GPA program name/eligibility/pricing (USGA doesn't publish; usga.org blocked automated fetch — claims rest on search extracts + The R&A's Rule 1 text); AGA club-licensing costs/timelines (not public); whether England Golf ISV enrollment is currently open to small vendors.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docs list | `ls docs/` | see current docs; no name collision |
| Lint (unchanged app) | `pnpm lint` | exit 0 (nothing app-side changed) |

## Scope

**In scope** (the only files you may create/modify):
- `docs/official-handicap-roadmap.md` (create)
- `BACKLOG.md` (add one section)
- `plans/README.md` (status row)

**Out of scope**: all application code, marketing copy (plan 006), legal pages, `.claude/plans/usga-round-verification.md` (reference it; don't edit it), any outreach to USGA/AGA/NGF/England Golf/Scottish Golf (owner does that).

## Git workflow

- Branch: `advisor/007-official-handicap-roadmap`
- Suggested commit: `docs: official-handicap roadmap and owner runbook`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write `docs/official-handicap-roadmap.md`

Structure (use these headings):

1. **Where we stand** — unofficial WHS-method tracker; engine coverage vs gaps (use the "Current state" facts above; cite files).
2. **How official handicaps actually work** — governance summary from the digest (keep citations as URLs from the digest source where given; mark the uncertainty flags explicitly).
3. **Route A — US: AGA-licensed Type 3 clubs + GHIN/GPA integration** — mechanics, the TheGrint/DiabloGolf precedent, the post-2022 constraint (users pay USGA/AGA for the GHIN ID), what Handicappin would build (club enrollment flow, GHIN score-posting sync), and the owner actions (below).
4. **Route B — Norway & GB&I: companion + partnership** — iGolf/OpenPlay/NGF facts; NGF Union-database monitoring; England Golf ISV enquiry.
5. **Route C — stay unofficial** — what we can/can't say (point at plan 006's vocabulary); this is the default until A lands.
6. **Product prerequisites for Route A** — tested single-source engine (plan 008), score-integrity hardening (teeTime bound; attestation decision from `.claude/plans/usga-round-verification.md` — resolve: build it or close it), account for PCC/penalty-score gaps in any conversation with a licensing body.
7. **Owner action checklist** — the exact next moves: ① contact 1–2 target AGAs about Type-3 club licensing (requirements, cost, timeline); ② contact USGA about the GPA vendor program (exact name, eligibility, API access levels); ③ email England Golf about ISV/CONGU licence terms for a consumer app; ④ monitor NGF's Union-database rollout and request an intro conversation; ⑤ decide the peer-attestation question. Each with "blocked on owner" marker, mirroring BACKLOG's style.
8. **Decision checkpoints** — e.g., "if AGA licensing cost > $X/yr or GPA rejects consumer apps → double down on Route C + Norway partnership".

**Verify**: file exists; every uncertainty flag from the digest appears; no claim in the doc asserts current official status.

### Step 2: Add the BACKLOG owner section

Add `## Official handicap — owner actions` to `BACKLOG.md` (after the "Auth hardening" section), containing only the ①–⑤ checklist from the doc with a pointer: "Full context: `docs/official-handicap-roadmap.md`."

**Verify**: `grep -n "official-handicap-roadmap" BACKLOG.md` → 1+ match.

### Step 3: Cross-link the stale attestation plan

In the roadmap doc's §6, explicitly reference `.claude/plans/usga-round-verification.md` as the open decision (build peer attestation vs close the plan), and note the admin-approval workflow that shipped instead.

**Verify**: `grep -n "usga-round-verification" docs/official-handicap-roadmap.md` → 1+ match.

## Test plan

None (docs only). `pnpm lint` must still exit 0 to prove no app code was touched.

## Done criteria

- [ ] `docs/official-handicap-roadmap.md` exists with all 8 sections
- [ ] BACKLOG section added with the 5 owner actions
- [ ] `git status` shows only the three in-scope files modified/created
- [ ] `plans/README.md` status row updated

## STOP conditions

- A doc already covering this exists under `docs/` (drift) — reconcile, don't duplicate.
- You find yourself wanting to change app code or copy — that's plans 006/008, stop.
- You cannot faithfully represent an uncertainty (e.g., tempted to state GPA pricing as fact) — keep the uncertainty flag instead.

## Maintenance notes

- This doc is the decision record; when the owner gets real answers from an AGA/USGA/NGF, update the doc (not just chat) and re-evaluate plans referencing it.
- When any licensing milestone lands, plan 006's vocabulary rules loosen — revisit marketing copy then.
- The GHIN/GPA integration itself (OAuth-style linking, score push) is deliberately NOT planned yet: it depends on API access that only the owner actions can unlock.
