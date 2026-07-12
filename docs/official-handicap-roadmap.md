# Official Handicap Roadmap & Owner-Action Runbook

**Status**: Decision record — living document. Update this file (not chat logs) whenever an owner action resolves.
**Live tracker**: [Issue #144](https://github.com/Sebastian-Sole/handicappin/issues/144) (wayfinder map) with child tickets #145–#154.
**Related**: Issue #143 (this doc). Plan 006 (`plans/006-truthful-handicap-claims.md`) owns the marketing-copy fix. Plan 008 (`plans/008-handicap-engine-single-source.md`) owns the single-source engine work referenced in §6.

---

## 1. Where we stand

Handicappin' is, today, an **unofficial WHS-method handicap tracker**. It implements the World Handicap System's public calculation method but is not a licensed issuer of an official Handicap Index, and no jurisdiction has a licensing category that would let a software vendor become one directly (see §2).

The app currently markets itself with unqualified claims — "USGA Compliant" in `apps/web/app/layout.tsx:24,28,60`, `apps/web/app/opengraph-image.tsx:74`, `apps/web/app/about/page.tsx:56,190,209`, `apps/web/components/homepage/landing.tsx:210`, `apps/web/components/seo/json-ld.tsx:9,60,62`, and the transactional emails `apps/web/emails/round-approved.tsx:300` / `round-rejected.tsx:182` — while the Terms of Service already carry the correct disclaimer (`apps/web/components/legal/terms-content.tsx:46-49` and `:337-338`: "not an official USGA handicap service... not affiliated with, endorsed by, or officially connected to the USGA"). This inconsistency between marketing copy and legal copy is exactly what plan 006 fixes; this doc does not touch copy.

**Engine coverage vs. gaps** (verified 2026-07-11, current as of this writing):

Implemented and correct:
- Best-8-of-20 handicap index calculation
- Net Double Bogey (NDB) per-hole capping
- 9-hole expected-score conversion
- Handicap Index caps (soft/hard)
- Low Handicap Index (Low HI) tracking
- Exceptional Score Reduction (ESR)

Gaps that matter for any conversation with a licensing body:
- **PCC (Playing Conditions Calculation)** — absent entirely.
- **Peer attestation** — absent; see §6 and the stale plan this supersedes.
- **Penalty scores** (Committee-assigned scores under Rule 5.3, e.g. for rounds not completed per Rules of Golf) — absent.
- **Timely posting** is not enforced — `apps/web/types/scorecard-input.ts:178` validates `teeTime` as `z.string().datetime()` with no upper bound, so scores can be posted for tee times arbitrarily in the future or with no real-world proximity check.
- **10–17-hole rounds are rejected** — the scorecard schema only accepts exactly 9 or 18 scores (`apps/web/types/scorecard-input.ts:184-189`), where WHS actually defines expected-score fill-in rules for any hole count down to 7.

None of this is disqualifying for an "unofficial, WHS-method" positioning. All of it is relevant homework before pitching a licensing body for anything closer to "official."

---

## 2. How official handicaps actually work

**Governance.** The World Handicap System's intellectual property is owned jointly by the USGA and The R&A and licensed *only* to national and regional golf associations. Rule 1 of the Rules of Handicapping grants each authorized association "exclusive rights to implement and administer the World Handicap System within its jurisdiction, including the issuance of a Handicap Index," which it does directly or through its affiliated golf clubs. **There is no licensee category, in any jurisdiction, for a software vendor to issue a Handicap Index on its own.** Every credible path for an app runs through an existing licensed club or association, not around it.

- **United States**: ~55 Allied Golf Associations (AGAs) administer WHS under USGA license. GHIN is the USGA's central computation service.
- **England / Scotland**: The national bodies (England Golf, Scottish Golf) run central WHS platforms directly — England Golf's platform, Scottish Golf's VMS.
- **Norway**: Norges Golfforbund (NGF) administers WHS on GolfBox. An official handicap requires membership in an NGF-affiliated club.

**Uncertainty flags** (do not treat as settled — confirm with the org before acting):
- The USGA's vendor integration program is referred to in available sources as "GPA" ("GHIN Partner Access" or similar — the exact name, terms, and eligibility criteria are not published and could not be confirmed via automated fetch; usga.org blocked automated retrieval during the July 2026 research pass that produced this doc). Treat "GPA" as a working label, not a confirmed program name.
- AGA Type-3-club licensing costs and timelines are not publicly documented; they will vary by AGA and must be obtained by direct inquiry (owner action ①, §7).
- Whether England Golf's ISV/CONGU licensing is currently open to a new, small, consumer-facing vendor is unconfirmed (owner action ③, §7).
- The claims in this section rest on the Rules of Handicapping's published Rule 1 text plus search-derived summaries of USGA/England Golf/Scottish Golf/NGF program pages — not on direct confirmation from those organizations. Owner actions in §7 exist specifically to convert these into confirmed facts.

---

## 3. Route A — US: AGA-licensed Type 3 clubs + GHIN/GPA integration

This is the most feasible path to a genuinely "official" tier, and it has direct precedent: **TheGrint** and **DiabloGolf** both offer official handicaps this way today.

**Mechanics**:
1. An AGA (under USGA license) can charter a **"Type 3" golf club** — one recruited from the public online, requiring ≥10 members, governing bylaws, and a handicap committee that performs peer review of scores, with members generally within ~50 miles of the club's principal location.
2. Handicappin' would need to operate or partner with one or more such clubs, one per AGA territory it wants to serve.
3. **Since 1 January 2022, apps can no longer issue GHIN numbers themselves.** Users must pay the AGA/USGA directly (roughly $30–50/yr, unconfirmed exact figure) for their own GHIN ID. Handicappin's role becomes: enroll the user in one of its licensed clubs, and sync their scoring record to/from GHIN.
4. Separately, the USGA runs a vendor API access program (working label "GPA" — see uncertainty flag above) under which approved vendors can read handicap data and, at the right access tier, post scores into GHIN on the user's behalf. There is a published "GPA Approved Vendors" list, but the application process and terms are not public. **GolfApp** is the precedent for "integrate, don't issue" — it syncs existing GHIN accounts via this program rather than issuing handicaps itself.

**What Handicappin' would build** (not planned yet — depends entirely on the owner actions in §7 unlocking API access):
- A club-enrollment flow: user selects/joins a Handicappin'-affiliated Type 3 club, pays their AGA/GHIN fee externally, links their GHIN ID.
- A GHIN score-posting sync: rounds entered in Handicappin' post to GHIN (or pull from GHIN) via the vendor API, once access is granted.

**Owner actions this route depends on**: ① and ② in §7.

---

## 4. Route B — Norway & GB&I: companion + partnership

**Great Britain & Ireland.** England Golf's central platform is the sole WHS calculation hub for England; third-party software can become a **licensed ISV** (existing ISVs include Club Systems, DotGolf, GolfBox, Golf Genius, HandicapMaster, IntelligentGolf, Nexxchange) feeding scores into it, but that licence is club-facing and contract-gated — it is not a route for an independent consumer app to issue handicaps directly. Golfers without a club-affiliated route can get an official Index via England Golf's own **iGolf** (£47/yr) or Scottish Golf's **OpenPlay** (£5.99/mo). For now, Handicappin's GB&I play is: remain a companion tracker, and point users without another route at iGolf/OpenPlay, while separately pursuing an ISV/CONGU enquiry with England Golf (owner action ③) to see if that door is open to a small vendor.

**Norway.** NGF is the sole authority; the system runs on GolfBox; an official handicap requires membership in an NGF-affiliated club. The notable 2025 development: NGF decided to keep GolfBox as its operational system but build an **NGF-owned "Multivendor Union database"**, explicitly to enable choosing other administrative systems in the future. This is the closest thing to a future third-party seam in Norway, and worth direct engagement given Handicappin's existing Norwegian course coverage.

### B-long: the NGF/GolfBox endgame

The owner's long-term goal is to pitch NGF on Handicappin' **replacing GolfBox** as Norway's administrative system. This needs to be framed honestly: **GolfBox is a full club-administration platform** — memberships, tee-time booking, tournament management, the national handicap/course database, club finance — not just a handicap calculator. Replacing it means becoming a club-facing administrative system, which is a fundamentally different product tier from a consumer handicap tracker. This is not a near-term engineering project; it is a multi-year relationship and product-surface investment.

The 2025 NGF decision to build a Union database "to enable choosing other administrative systems in the future" is precisely the door this goal needs — it is the first time NGF has architected for third-party systems at all. The realistic staged path:

1. **Consumer credibility + a flawless WHS engine** (where Handicappin' is investing right now — §6's prerequisites).
2. **Official integrations elsewhere** (Route A landing in the US) — this is what proves Handicappin' is a legitimate, audited handicap system to a body like NGF, not just an app with numbers on a screen.
3. **Pilot club-facing features with 1–2 friendly Norwegian clubs** — small, concrete proof that Handicappin' can do club-level administration, not just individual tracking (owner action ⑥, §7).
4. **A formal NGF conversation once the Union database rollout opens** the third-party seam it was built to enable.

Every step before step 4 is a relationship and product-surface investment, not a near-term engineering commitment — do not schedule engineering work against this route until NGF's Union database is live and a conversation has actually happened.

---

## 5. Route C — stay unofficial (the default until Route A lands)

Until Route A produces an actual licensed integration, Handicappin' should describe itself using unlicensed-safe language:

- Safe: "handicap tracker", "WHS-method calculations", "unofficial handicap" / "handicap estimate".
- Unsafe: "USGA Handicap Index®", "official handicap", unqualified "USGA compliant".
- Standard disclaimer (already partially present in the ToS, per §1): *"Not sponsored or endorsed by the USGA or The R&A; does not provide an official Handicap Index."*

The exact copy changes to enforce this vocabulary are owned by **plan 006** (`plans/006-truthful-handicap-claims.md`), not this doc. Route C is not a fallback to be embarrassed about — it is the correct, honest default posture for every day between now and whenever Route A produces a real integration.

---

## 6. Product prerequisites for Route A

Before Handicappin' can credibly walk into an AGA/USGA/NGF/England Golf conversation, or pass any audit a licensing body would run, it needs:

1. **A tested, single-source-of-truth handicap engine** — tracked as plan 008 (`plans/008-handicap-engine-single-source.md`) / issue #138. Any licensing body will want to see one authoritative, tested calculation path, not calculation logic duplicated across client/server/edge function.
2. **Score-integrity hardening**:
   - Bound `teeTime` in `apps/web/types/scorecard-input.ts:178` so scores can't be posted for arbitrary past/future tee times (timely-posting enforcement) — currently unbounded `z.string().datetime()`.
   - **Resolve the peer-attestation question.** `.claude/plans/usga-round-verification.md` is a detailed, never-built plan for scorecard peer attestation (a second player confirming a score, per Rules of Handicapping Rule 5.1a-style peer review). It was superseded in practice by the **admin/data-quality approval workflow** that did ship (`.claude/plans/tee-course-approval-workflow.md` — the `submissions` table, course/tee/round `approvalStatus` cascade, admin-reviewed via Supabase dashboard). That shipped system validates *course and tee data quality*; it does **not** implement *peer attestation of an individual scorecard*, which is what Rule 5.1a-style peer review actually requires. This is an open decision, not a resolved one: either (a) build peer attestation as originally scoped in `usga-round-verification.md`, or (b) formally close that plan and document why data-quality approval is considered sufficient. Owner action ⑤ in §7.
3. **Account for the PCC and penalty-score gaps** (§1) explicitly in any conversation with a licensing body — do not let them discover these gaps themselves during an audit.

---

## 7. Owner action checklist

**Live tracker: [Issue #144](https://github.com/Sebastian-Sole/handicappin/issues/144)** (wayfinder map). Each action below is a GitHub ticket except ⑤, which has no ticket yet — see its line for why.

1. **[blocked on owner]** [#150](https://github.com/Sebastian-Sole/handicappin/issues/150) — Contact 1–2 target AGAs about Type-3 club licensing (requirements, cost, timeline). (Route A, §3)
2. **[blocked on owner]** [#151](https://github.com/Sebastian-Sole/handicappin/issues/151) — Contact the USGA about the vendor integration program (working label "GPA"); confirm the exact program name, eligibility, and API access levels. (Route A, §3)
3. **[blocked on owner]** [#154](https://github.com/Sebastian-Sole/handicappin/issues/154) — Email England Golf about ISV/CONGU licence terms for a consumer-facing app; is enrollment currently open to a small vendor? (Route B, §4)
4. **[blocked on owner]** [#147](https://github.com/Sebastian-Sole/handicappin/issues/147) — Monitor NGF's Union-database rollout and request an introductory conversation once it's live (blocked by the research ticket [#145](https://github.com/Sebastian-Sole/handicappin/issues/145)). This is also the first move of the B-long endgame (§4) — treat the NGF relationship as strategic, not transactional; don't rush it toward a pitch before there's something concrete to show.
5. **[blocked on owner]** *(no ticket yet)* Decide the peer-attestation question (§6): build `.claude/plans/usga-round-verification.md` as scoped, or formally close it in favor of the shipped admin-approval workflow.
6. **[blocked on owner]** [#149](https://github.com/Sebastian-Sole/handicappin/issues/149) — Identify 1–2 friendly Norwegian clubs as future pilot candidates for club-facing features; groundwork for the B-long endgame (§4), not a near-term build.

---

## 8. Decision checkpoints

Revisit this doc's recommended sequencing if any of these trip:

- If AGA Type-3-club licensing cost or timeline (owner action ①) comes back prohibitive (e.g., per-club annual cost that doesn't scale with a consumer app's economics, or a multi-year exclusivity/geography constraint) → **double down on Route C (accurate unofficial tracker) + the Norway partnership track**, and shelve Route A rather than forcing it.
- If the USGA's vendor program (owner action ②) turns out not to accept consumer apps at Handicappin's stage, or gates access behind an existing AGA relationship Handicappin' doesn't have yet → same fallback; Route A becomes contingent on action ① succeeding first.
- If England Golf confirms ISV licensing is closed to new small vendors (owner action ③) → Route B stays companion-only in GB&I; keep pointing users at iGolf/OpenPlay.
- If NGF's Union database rollout stalls or is scoped to exclude third parties → the B-long endgame timeline moves out accordingly; do not schedule product investment against it until that's resolved.
- Any licensing milestone landing loosens plan 006's vocabulary rules for the relevant jurisdiction only — re-evaluate marketing copy per-market, not globally, since "official" in the US does not mean "official" in Norway or GB&I.

---

## Maintenance notes

- This doc is the decision record for handicap-officialdom strategy. When the owner gets real answers from an AGA, the USGA, NGF, or England Golf, **update this doc**, not just a chat log, and re-evaluate any plan that references it.
- The GHIN/GPA integration itself is deliberately **not planned yet** — it depends on API access that only the owner actions in §7 can unlock. Do not scope engineering work for it until access is confirmed.
