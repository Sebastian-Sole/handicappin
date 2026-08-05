# Governance Fact Pattern — WHS / USGA / NGF × handicappin × fitbull

**Date:** 2026-07-29 · **Workstream:** W7 (subplan `plans/008-w7-launch-gates.md`) · **Status:** DRAFT — the pre-launch gate closes only on owner sign-off (§7)
**Binding source:** DECISIONS §Open gates ("Governance check (pre-launch)"), golf-api-landscape synthesis condition A.5.

This is a documented fact pattern and risk posture, **not a legal opinion**. Every claim below is tagged: **[verified]** (primary source, cited with retrieval date), **[inference]** (our reading, could be wrong), or **[unknown]** (cannot be determined from public sources; owner action listed in §5).

---

## 1. Bottom line

1. For the **Norwegian/primary market**, fitbull surfacing the WHS-method unofficial index is the **same fact pattern in kind** that handicappin.com already presents publicly — one more first-party surface, louder but not different — and the USGA has explicitly deferred non-US markets to the local National Association, i.e. NGF, whose position is still unknown (no reply to the 2026-07-13 enquiry recorded as of 2026-07-29).
2. For the **US market**, fitbull displaying the index to US users would directly contradict the USGA's written 2026-07-13 position ("the estimator needs to be removed from the US market") while a GPA application is being contemplated — this is the one **launch-blocking** exposure, closed by geo-gating fitbull's index display away from the US or by the owner explicitly parking the GPA track (§6, LB-1).
3. The **/v1 API itself adds no new governance surface**: it is private, first-party, OAuth-scoped, and distributes nothing to third parties — the exposure unit is fitbull's *public display* of the index, plus any WHS trademark leakage into fitbull's copy (§6, LB-2), both of which exist regardless of API privacy (which is exactly why this check moved from phase 2 to pre-launch).

---

## 2. What the governing documents actually say

### 2.1 Rules of Handicapping, Rule 1.2 (2024 edition) — [verified]

Quoted from the Rules of Handicapping 2024 PDF (R&A/USGA text, mirrored by GolfRSA; retrieved 2026-07-29 — the usga.org copy of Rule 1.2 returns 403 to automated fetch):

> "In order to use the World Handicap System, an Association must be authorized by the USGA and The R&A. Within its area of jurisdiction, an Authorized Association may:
> - Use the Rules of Handicapping and the Course Rating System.
> - Use the registered marks of the World Handicap System.
> - Issue a Handicap Index either directly or, where delegated, through a golf club.
> - Issue a Course Rating and a Slope Rating. […]
> **Any organization that is not authorized to use the World Handicap System is prohibited from using these marks or any part of the World Handicap System. This includes the Course Rating System and the handicap calculation formula**, except when the organization provides handicapping products or services to a golf club through an Authorized Association."

Source: https://www.golfrsa.com/wp-content/uploads/2024/01/WHS_Rules_of_Handicapping_2024.pdf (retrieved 2026-07-29).

### 2.2 WHS Terminology and Trademarks Usage Guide — [verified]

R&A/USGA guide (hosted by GolfRSA; retrieved 2026-07-29):

- Authorization to use the WHS "is granted **exclusively to a Multi-National/National Association** within a geographic territory as determined by, and through an agreement with, the World Handicap Authority (WHA)." Associations may delegate to affiliated entities within their jurisdiction.
- Claimed marks: World Handicap System™, WHS™, Handicap Index®, Score Differential™, Low Handicap Index™, Course Handicap™, Playing Handicap™, Course Rating™, Course Rating System™, SLOPE®, Bogey Rating™, Slope Rating™.
- > "Any provider or organization that is not authorized to use the World Handicap System is prohibited from using these marks **or any part of the World Handicap System. This includes the Course Rating System and the handicap calculation formula**, except when the provider is assisting an Authorized Association or its member clubs with its handicap computation service or products."
- "The Course Rating and Slope Rating **must not be used for any other purpose without authorization**." (Number References section — note: handicappin's computation consumes CR/Slope values.)
- "No other calculated value may be referred to as an Index."

Source: https://www.golfrsa.com/wp-content/uploads/2023/03/WHS-Handicap-Terminology-and-Trademark-Usage.pdf (retrieved 2026-07-29).

**[inference]** The *trademark* claims (registered marks) sit on solid legal footing. The claim over "the handicap calculation formula" is a method/IP assertion whose enforceability is far less clear — calculation methods and formulas are generally weak subject matter for copyright/trademark. We deliberately do **not** litigate this distinction: the official-handicap strategy (#144) runs on goodwill with exactly these bodies, so the *stated* position is the operative constraint regardless of its legal reach. This framing was already adopted in issue #151's analysis and stands.

### 2.3 USGA GPA program terms — [verified as of 2026-07-13]

From the GPA Program Overview and application (browser-captured 2026-07-13 in issue #151; re-fetch attempt 2026-07-29 returned 403 to automated fetch, so the 07-13 capture is the freshest record):

> "A GPA provider may not provide an alternative handicap system, calculate an alternative handicap value (use of value for play/compete), or provide a handicap value to indicate a player's demonstrated ability. Any GPA product or service that may cause confusion with the WHS and/or a Handicap Index, including use of terminology or works, is prohibited."

$6,000/yr, US-and-territories only, application-gated. Sources: USGA GPA Program Overview + Approved Vendors pages (URLs in the source register, §9).

### 2.4 USGA direct correspondence, 2026-07-13 — [verified, first-party]

Recorded verbatim in issue #151 (emails from the USGA Handicap Department in reply to the owner's pre-application questions):

- **John Romeo:** "When partnering with the USGA Handicap data, we do not permit applications to provide handicap estimates. This feature would need to be removed in order to move forward with the program."
- **Fran Nee:** "The estimator needs to be removed **from the US market**. Outside of the US you would need to confer with the local authorized National Association […] You are not permitted to use any part of the WHS in your estimator/calculator regardless of where you or the golfer are located. […] you would not be permitted to use any of the WHS terminology if you are not part of the GPA program **or authorized by another National Association**."

Read together (per #151's analysis, which we adopt): the enforcement ask is **US-market-scoped**; outside the US the USGA defers to the National Association; the "any part of the WHS… regardless of where" sentence is the USGA's maximal stated position, held in tension with their own market-scoped remedy. NGF authorization (Leverandør, #147) would legitimize WHS-method language for Norway per Fran Nee's own carve-out.

### 2.5 NGF state of play — [verified], reply status [unknown]

- Unionsdatabase: partially delivered; external-actor testing "starter i sommer" (summer 2026); named contact Martin Dølerud. Source: NGF, "Status for unionsdatabasen: testing starter i sommer" (2026-06-26; re-fetched 2026-07-29).
- No certified Leverandør exists; the cooperation/data-sharing framework is still being developed (NGF styremøte 4/2026 summary, 2026-07-03; per issue #147's deep-dive of 2026-07-12).
- **No public NGF position on unofficial handicap estimates was found** in any NGF document reviewed (Sluttrapport, Golfting 2025 saksdokumenter, digitaliseringsprosjektet pages, news items). This is a genuine gap, not an implied permission — [unknown].
- The owner's A-scoped Leverandør enquiry was sent 2026-07-13 (to Rasmus Nybø, cc Martin Dølerud). **No reply is recorded in issue #147 as of 2026-07-29**; the planned ~07-20 courtesy follow-up from Gmail is prepared but its send status is not recorded in the repo — owner to confirm (§5, U1).

---

## 3. What handicappin does today

- Computes and displays an **unofficial WHS-method handicap index to the account owner only** (no official Handicap Index issuance, no claim of affiliation). Post-PR-#155 claims wording (live, `apps/web/components/homepage/landing.tsx`): "Handicappin' follows the World Handicap System (WHS) calculation method — … Handicappin' is independent and unofficial: we are not affiliated with or endorsed by the USGA or The R&A, and we do not issue an official Handicap Index®."
- Uses WHS terminology **descriptively/nominatively** with explicit disclaimers — the held position from #151 (option (a): hold, low enforcement risk, NGF authorization may moot it; the de-marking decision belongs to the #148 grilling, not here).
- Primary market Norway; not a GPA affiliate; GPA application deliberately **not** submitted (pre-application questions answered 2026-07-13; next step is owner's call).
- The index is already **public-facing** in the sense that matters: any golfer can sign up and see a WHS-method estimate. The governing bodies' stated concern is the estimate's existence in a market, not its transport.

## 4. What changes at v1 + fitbull

**The API (facts):** private first-party REST `/v1` on `api.handicappin.com`; OAuth 2.1 (Supabase) with explicit user consent ("Connect handicappin"); fitbull holds tokens server-side in Convex; no third-party issuance, no public docs, no self-serve keys (DECISIONS §8). Writes return a provisional index; fitbull polls reads (DECISIONS §7 — "write-only-by-default" is third-party-only). Surface marked internal/unstable.

**fitbull (the actual exposure):** a separate, public consumer app by the same owner that — per the working premise of plan 008 — will surface the connected user's WHS-method unofficial index. That premise has two unconfirmed parameters that materially move the risk (§5, U2/U3): whether fitbull is distributed in the **US** market, and whether it **displays the index** at all versus using rounds/sync silently.

> **AMENDMENT (owner, 2026-08-05 — U2/U3 answered; `DECISIONS.md` D8).** **The working premise above is false.** fitbull ships to the US **and does not display the index at all** — it writes rounds into handicappin and shows fitness data back, never rendering a handicap number. Read the three aggravations below with that correction applied:
> - **(1) Distribution across a product boundary** — survives unchanged. The index still crosses from one product to another over the API, even though the receiving product never renders it. AM-3 (third-party scope creep) remains the live control.
> - **(2) US-market contradiction** — **largely evaporates.** There is no index display to US users, in fitbull or anywhere else, because there is no index display at all. What remains is narrower and non-obvious: fitbull must not *advertise handicap features* into the US market while the GPA track is open (store listing, screenshots, marketing copy). The exposure moved from the product surface to the **marketing** surface.
> - **(3) Terminology propagation** — survives, and is now easier to satisfy: with no index screen there is no natural place for a WHS mark to appear, but store copy and marketing still must carry none (LB-2).
>
> The §4 conclusion below therefore holds *a fortiori* for the display question and should be ratified with that reading: the private API transport changes nothing, and the US fact pattern is no longer changed by index display because no such display exists.

The three aggravations relative to today's fact pattern — [inference]:

1. **Distribution across a product boundary.** The index now flows from one product to another. For a *first-party* pair under one owner with per-user OAuth consent, this is organizationally the same actor and does not create the "providing a handicap value [as a service to others]" pattern the GPA clause targets — but it is a step in that direction, and it is exactly the surface that must not extend to third parties without revisiting this document (§6, AM-3).
2. **US-market contradiction.** handicappin's own US posture is already an open question (#148 ladder); fitbull adds a second app that would need the same geo-gating discipline. Shipping index display to US users while the GPA thread with John Romeo is live converts a negotiation into a demonstrated defiance of their written condition. This is the launch blocker (LB-1).
3. **Terminology propagation.** fitbull's UI, store listings, and marketing are new places WHS marks could appear. fitbull has even less claim to nominative use than handicappin (it doesn't compute anything; it displays a number from another product). Keep the marks out entirely (LB-2).

**Documented conclusion required by condition A.5** — does a first-party app trip the boundary? Our position, for owner ratification (§7):

> A first-party companion app surfacing the unofficial index **does not change the Norwegian fact pattern in kind** — the index is already publicly offered by handicappin; NGF's (unknown) position governs both surfaces equally, and the pending Leverandør conversation is the venue to resolve it. It **does change the US fact pattern**: index display to US users in any first-party app while GPA is pursued contradicts the USGA's written condition and must be geo-gated (or GPA explicitly parked) before launch. The private API transport changes nothing in either direction.

---

## 5. Verified / inference / unknown ledger

| # | Claim | Status |
|---|---|---|
| V1 | Only WHA-authorized National Associations may use the WHS, its marks, and (per the stated position) "the handicap calculation formula" | [verified] §2.1–2.2 |
| V2 | GPA affiliates may not provide alternative handicap values; USGA requires estimator removal **from the US market** to join | [verified] §2.3–2.4 |
| V3 | Outside the US, USGA defers to the local National Association; NA authorization legitimizes WHS terminology | [verified] §2.4 (USGA's own words) |
| V4 | NGF has no operating Leverandør certification yet; framework in draft; testing window opening summer 2026 | [verified] §2.5 |
| I1 | The formula-IP claim is legally weak but strategically binding (goodwill strategy) | [inference] §2.2 |
| I2 | First-party fitbull display ≈ same Norwegian fact pattern as handicappin.com itself | [inference] §4 |
| I3 | Private first-party API transport is governance-neutral | [inference] §4 |
| U1 | Has NGF replied to the 2026-07-13 enquiry? Was the ~07-20 Gmail follow-up sent? | [unknown] — **owner: check inbox + #147, record status** |
| U2 | Will fitbull be distributed to US users (store regions, web availability)? | **ANSWERED 2026-08-05 — YES.** fitbull ships to the US market. |
| U3 | Will fitbull display the index, or consume rounds/sync without showing the number? | **ANSWERED 2026-08-05 — NO DISPLAY.** fitbull consumes rounds and never renders a handicap number. The design lever was taken: most of §4 evaporates. |
| U4 | NGF's actual position on unofficial WHS-method estimates in Norwegian apps | [unknown] — only NGF can answer; draft question in §8 |
| U5 | Legal enforceability of the "calculation formula" claim | [unknown] — deliberately not pursued |

---

## 6. Risk posture: launch-blocking gates vs accept-and-monitor

### Launch-blocking (v1 does not ship to a *publicly released* fitbull until closed)

- **LB-1 — US index display. DISPLAY HALF CLOSED BY CONSTRUCTION (owner, 2026-08-05 — U3/D8).** fitbull will not display the handicap index **in any market**, so there is no index display to geo-gate and closure route (a) is moot. The originally-envisaged geo-gating work is **not required**.
  - **What survives:** the parenthetical clause — fitbull must not **advertise handicap features** to US-market users while the GPA track is open. This binds fitbull's App Store listing, screenshots, and marketing copy in US-available regions (U2 = yes, fitbull ships to the US). Silent round-syncing is fine; a store screenshot captioned "track your handicap" is not.
  - **Owner:** fitbull-repo release checklist, at public availability. Shipping /v1 into a private fitbull dev/TestFlight build remains **not** blocked.
  - Route (b) — parking/abandoning GPA — remains available and would close the advertise-clause too, but is no longer needed to close the display exposure.
- **LB-2 — Trademark audit of fitbull surfaces.** Before fitbull's public release: zero WHS marks (list in §2.2) in fitbull UI, store listings, or marketing. Use descriptive language ("handicap estimate (unofficial), calculated by handicappin from your rounds"), mirroring handicappin's disclaimer posture. One-pass audit, checklist kept with fitbull's release notes.
- **LB-3 — Owner sign-off on this document** (§7), including the negotiation-posture call (raise fitbull proactively in the live threads, or not — §7.3). The A.5 condition requires the conclusion *documented*; it is the sign-off that makes it so.

### Accept-and-monitor (do not block launch; each has a trigger that reopens this doc)

- **AM-1 — USGA's maximal global claim** ("any part of the WHS… regardless of where"). Accepted for the Norwegian market on the strength of USGA's own market-scoped remedy and NA deferral (V3). **Trigger:** any further USGA correspondence naming the estimator or fitbull outside the US → owner + reopen.
- **AM-2 — NGF replies unfavorably** (or attaches conditions to unofficial estimates). **Trigger:** any NGF reply touching estimate legitimacy → fold into #147, update §2.5 and the conclusion; if adverse, LB-1-style gating extends to Norway and the launch decision returns to the owner.
- **AM-3 — Scope creep to third parties.** The governance-neutrality of the API (I3) holds **only** while consumers are first-party. **Trigger:** any non-owned consumer request (measured via `api_access_interest_submitted` — see `DEMAND_INSTRUMENTATION.md`) that the owner wants to serve → this document must be revised *before* credentials are issued (matches DECISIONS §8 vetted-partner phase-2 gate).
- **AM-4 — Claims-wording drift.** handicappin's descriptive-WHS wording is a held position, not a settled right. **Trigger:** the #148 grilling decision, or any change to landing/about/terms WHS wording → re-run the terminology audit across **both** products.

---

## 7. Owner sign-off checklist (closes the pre-launch gate)

1. [ ] Ratify the §4 conclusion (or amend it) — this is the "documented conclusion that a first-party app does or does not trip the boundary" required by condition A.5. **Note: §4's working premise ("fitbull will surface the index") is now false per U3 — read the amendment note under §4 before ratifying.**
2. [x] **Answer U1–U3 (§5) and record them here.** U2/U3 answered 2026-08-05 (see ledger). **U1 still open** — owner to check whether the ~07-20 NGF Gmail follow-up actually sent.
3. [x] **Negotiation-posture call — DECIDED 2026-08-05: do not proactively disclose fitbull to the USGA *or* to NGF.** Owner's reasoning: they are two separate applications, and neither body needs to be told about the second. Consistent with I2 (no change in kind to the Norwegian fact pattern ⇒ no new fact to report). This goes **further than the recommendation offered**, which was to disclose to NGF once a real conversation existed. **Consequences:** §8's draft question is superseded and rewritten below; if either body asks directly, answer honestly — the decision is about not volunteering, not about withholding under question. Recorded in `DECISIONS.md` D7.
4. [x] **Confirm LB-1/LB-2 closure plan.** LB-1 display half closed by construction (U3); LB-1 advertise-clause + LB-2 marks audit are fitbull-repo release-checklist items, owner-executed at fitbull's public release.
5. [ ] Ratify the ADR trigger thresholds (`ADR-2026-07-29-launch-gates.md`) and put the two review dates in a calendar. **Note: per `DECISIONS.md` D9 the demand instrumentation was descoped, so the 2026-10-15 review has no interest data to weigh — ratify it as a "still first-party only" default rather than a data review.**

## 8. The NGF question (REWRITTEN 2026-08-05 per D7 — fitbull is not disclosed)

**Supersession notice.** The prior draft of this section disclosed fitbull explicitly ("Vi bygger også en treningsapp fra samme utvikler…"). Owner decision D7 (2026-08-05) is **not to proactively disclose fitbull to NGF or the USGA**. That draft must not be sent. The question below is rewritten to cover handicappin only — which is truthful and complete as a question about handicappin, and volunteers nothing about a second product.

Context: the live thread is the A-scoped Leverandør enquiry to Rasmus Nybø (cc Martin Dølerud), sent 2026-07-13. Recommendation unchanged: do **not** bundle this into a courtesy nudge; ask once a real conversation exists (their reply, or a call). Keep it A-scoped — guidance-seeking, not permission-seeking.

Norwegian (primary):

> Et lite tilleggsspørsmål mens vi venter på sertifiseringsløpet: Handicappin' viser i dag et **uoffisielt** handicap-estimat til den enkelte brukeren (tydelig merket som uoffisielt, med full utregning synlig, og uten at vi utsteder noe offisielt handicap). Har NGF retningslinjer for hvordan uoffisielle handicap-estimater bør merkes eller presenteres i norske apper i påvente av en eventuell Leverandør-sertifisering? Vi vil gjerne legge oss så tett på forbundets forventninger som mulig allerede nå.

English (for the record):

> A small additional question while the certification track is pending: Handicappin' today shows an **unofficial** handicap estimate to the individual user (clearly labelled unofficial, with the full calculation visible, and without us issuing any official handicap). Does NGF have guidelines for how unofficial handicap estimates should be labelled or presented in Norwegian apps pending any Leverandør certification? We'd like to align with the federation's expectations as closely as possible already now.

Why this shape: it asks for *labelling guidance* (an answerable, low-stakes question) rather than a yes/no permission (which invites a reflexive "no" from a federation mid-procurement), and reinforces the good-citizen posture the whole #144 strategy depends on.

**What changed and the trade being accepted.** The prior draft's stated virtue was "no ambush risk later." D7 accepts that residual knowingly: if NGF certifies handicappin as Leverandør and subsequently notices fitbull, it is discovered rather than disclosed. The answer at that point is I2 — a first-party companion app that does not display the index does not change the Norwegian fact pattern in kind. If NGF asks directly about companion apps or data sharing at any point, **answer honestly and fully**; D7 governs volunteering, not candour under question.

## 9. Review dates

- This document is re-reviewed at the ADR calendar review (**2026-10-15**) and at any AM trigger firing.
- Hard re-decide (with the platform-deferral ADR) by **2027-03-31**.
- Freshness note: NGF facts are as-of 2026-07-29; the pending #147 reply is the built-in freshness mechanism (whichever lands first — reply or October review — refreshes §2.5).

---

## Source register

Primary, retrieved 2026-07-29 unless noted:

- Rules of Handicapping 2024, Rule 1.2 — https://www.golfrsa.com/wp-content/uploads/2024/01/WHS_Rules_of_Handicapping_2024.pdf (usga.org RoH page 403s to automated fetch; content identical R&A/USGA text)
- WHS Terminology and Trademarks Usage Guide — https://www.golfrsa.com/wp-content/uploads/2023/03/WHS-Handicap-Terminology-and-Trademark-Usage.pdf
- USGA GPA Program Overview — https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Program-Overview.html (403 to automated fetch 2026-07-29; browser-captured 2026-07-13 in issue #151)
- USGA GPA Approved Vendors — https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Approved-Vendors.html (same capture)
- USGA email correspondence (John Romeo, Fran Nee), 2026-07-13 — verbatim in GitHub issue #151
- NGF, "Status for unionsdatabasen: testing starter i sommer" (2026-06-26) — https://www.golfforbundet.no/ngf-nytt/status-for-unionsdatabasen-testing-starter-i-sommer
- NGF styremøte 4/2026 summary (2026-07-03) + Golfting 2025 saksdokumenter — via issue #147 deep-dive (2026-07-12), URLs therein
- Repo: `topics/golf-api-landscape/research.md` + `synthesis.md` (2026-07-20), `DECISIONS.md`, issues #144/#147/#148/#151

Internal: current claims wording `apps/web/components/homepage/landing.tsx:95`; fitbull integration shape `plans/007-w6-fitbull-integration-notes.md`; contract source of truth `plans/005-phase0-contract.md` (owned by the 005 Phase 0 work — referenced, not duplicated here).
