# Golf API Landscape — does the third-party-platform ambition survive contact with the market?

- **Topic:** 8 (golf-api-landscape) of the api-platform research series (`docs/research/api-platform/TOPICS.md`)
- **Date:** 2026-07-20
- **Researcher:** background research agent
- **Decision question:** Which incumbents offer partner/public APIs and on what terms, and does the gap validate a genuine third-party platform play versus keeping this a private first-party seam?

---

## Method and source quality

External claims below are from official developer portals, vendor posts, and — uniquely for this repo — **verbatim first-party correspondence with the USGA** and primary-source Norwegian federation documents already captured in the strategy-track GitHub issues (#144–#154, researched 2026-07-11 → 07-13). Where a claim comes from an issue, the issue's own primary sources are linked. All web checks re-run 2026-07-20.

Internal anchors verified in the repo today: `apps/web/server/api/trpc.ts` (Bearer-token auth path, `extractBearerToken` at line 31) and `apps/web/server/api/routers/round.ts:303` (`submitScorecard`).

---

## 1. The landscape, layer by layer

### 1a. Governing-body rails (the *official* handicap data)

**USGA / GHIN — closed, paid, and hostile to alternative handicaps.**
The only sanctioned third-party path to GHIN data is the **Golfer Product Access (GPA) program** ("USGA Authorized Handicap Data Affiliates"). Terms confirmed by primary sources and by direct USGA email (issue #151, browser-fetched from usga.org + USGA reply of 2026-07-13):

- **$6,000/year** flat fee (stated on the application form), **US and territories only**, approval-based (JotForm application → agreements → they ask for iOS *and* Android store listings and customer counts).
- Integration points: Handicap Index retrieval, scoring-record retrieval, Course/Slope Rating retrieval, **score posting**.
- **The clause that shapes the whole market:** a GPA provider *"may not provide an alternative handicap system, calculate an alternative handicap value … or provide a handicap value to indicate a player's demonstrated ability."* USGA's John Romeo and Fran Nee confirmed by email (2026-07-13, verbatim in #151): the estimator must be removed **from the US market**; WHS terminology is off-limits unless in GPA **or authorized by another National Association**.
- ~26 approved vendors including **Arccos, TheGrint, Golf Pad, Golf Genius, Loop Golf, MyTaylorMade+** — i.e., every US consumer app that "has handicaps" is a licensed affiliate displaying GHIN's number, not computing its own.
- Sources: [GPA Program Overview](https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Program-Overview.html), [GPA Approved Vendors](https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Approved-Vendors.html), issue #151 (USGA replies verbatim). Demand-signal footnote: an [unofficial `ghin` npm wrapper](https://socket.dev/npm/package/ghin) and [forum threads](https://thesandtrap.com/forums/topic/112075-usga-ghin-api/) exist because the official API is closed — developers do want this data.

**USGA + R&A jointly — federation-level interoperability, not developer access.**
The [WHS Software Accreditation and Interoperability Programme](https://www.whs.com/articles/2024/2024-interoperability.html) (launched with the 2024 WHS revisions; [Interoperability Standard v1.0 PDF](https://www.whs.com/content/dam/whs/documents/World%20Handicap%20System%20Interoperability%20Standard%20v1.0_.pdf), PDF 403s to automated fetch) standardizes *cross-border score return and Handicap Index retrieval between national associations' systems*. It is plumbing between accredited handicap-computation platforms (GolfBox, DotGolf, GHIN…), *not* a public API surface. Its existence confirms the direction of travel: officialdom is consolidating onto accredited rails, and accreditation is the price of entry.

**England Golf / DotGolf — a real, documented ISV API, but club-scoped.**
The [DotGolf ISV API](https://isvapi.whsplatform.englandgolf.org/index.html) ([auth docs](https://isvapi.whsplatform.englandgolf.org/v1documentation)) is the most open federation API found: public Swagger docs, JWT (HS256) auth, endpoints for Club Members, Courses, **Scores**, Visitors, 300 req/min rate limit. But credentials are issued **per club** — it exists so club-management software vendors (HandicapMaster etc.) can act on behalf of affiliated clubs, not so a consumer app can post a user's casual round. Enrollment/accreditation is handled off-docs, through England Golf's ISV scheme. (Fetched 2026-07-20.)

**NGF / GolfBox — the home-market seam, gated by a certification program that does not exist yet.**
From issue #145 (primary sources: NGF board decision 18 June 2025, [Sluttrapport PDF](https://www.golfforbundet.no/files/documents/utredning-av-golfbox-som-admin-system-for-golf-norge-sluttrapport.pdf), [Golfting 2025 saksdokumenter](https://www.golfforbundet.no/files/documents/golftinget-2025-saksliste-og-saksdokumenter.pdf)): NGF is building an NGF-owned **Unionsdatabase** with **two-way standardized APIs** for certified "Leverandører"; go-live target was 1 May 2026 and has **slipped** — as of mid-July 2026 no vendor is certified and external testing "starts summer 2026" (issue #145 resolution; window open now). Historically GolfBox's federation APIs were one-way/read-only and the [GCAE critique](https://gcae.no/nyheter/10/hvorfor-skal-golfforbundet-bestemme-klubbenes-it-losninger) alleges deliberate stalling — GolfBox lock-in pain (payments, downtime, closed integrations) is documented in NGF's own utredning (issue #146). [GolfBox](https://golfbox.net/golfbox-golf-federations) serves the DK/NO/SE/IS/EE/LV/LT federations; there is no public GolfBox developer portal.

### 1b. Consumer golf apps (the closest analogues to handicappin)

| App | Public/partner API? | Terms | Source (date) |
|---|---|---|---|
| **TheGrint** | **TheGrint Connect** — partner API | **Read-only**, opt-in user data, explicitly "*not an Open API*", partnerships individually vetted, no published pricing; examples: Calcutta (wagering), Swingman rangefinder | [TheGrint Connect post](https://thegrint.com/range/post/thegrint-connect-unlock-new-opportunities-through-our-api) (Jan 24, 2025; fetched 07-20) |
| **Golfshot** | No developer API found | Integrations are bespoke B2B (e.g. [Golf Genius tournament scoring](https://golfshot.com/blog/golfshot-and-golf-genius-team-up-for-a-game-changing-integration)) | searched 07-20 |
| **Hole19 / 18Birdies / SwingU** | None found | No developer portals; SwingU/TheGrint handicaps in the US are GPA-affiliate GHIN displays | searched 07-20 |
| **Garmin Golf** | **Golf Premium API** — select partners | Apply + "inquire about pricing"; consented-user scorecard/on-course/range data; **Clippd was the first partner** (Mar 2025 press) | [developer.garmin.com/golf-api](https://developer.garmin.com/golf-api/), [Garmin×Clippd press](https://www.garmin.com/en-US/newsroom/press-release/outdoor/garmin-announces-integration-with-clippd-to-help-golfers-improve-their-game/) |
| **Arccos** | **On-Course Data API** — partner-level | First consumer integration: Clippd; no self-serve signup | [Arccos×Clippd post](https://www.arccosgolf.com/blogs/community/clippd-to-become-first-platform-to-seamlessly-integrate-arccos-on-course-data) |
| **Clippd** | Consumer of the above, not a provider of an open API | Positions itself as the aggregation layer for golf *performance* data | [clippd.com](https://www.clippd.com/) |

Pattern: **every integration that exists in consumer golf is a one-off, vetted partner deal between two named companies.** Zero self-serve "create an API key, read the docs, ship" surfaces exist anywhere in the category.

### 1c. Horizontal health/fitness aggregators — golf scorecards are a blind spot

- **Terra** ([tryterra.co](https://tryterra.co/), [integrations](https://tryterra.co/integrations), checked 07-20): 500+ wearable/app integrations; data models cover activity, sleep, nutrition, HR/HRV, glucose, body. **No golf scorecard model.** Golf shows up only as a generic activity if a source device logs it.
- **Apple HealthKit**: golf is `HKWorkoutActivityType.golf` — a workout type with duration/energy/HR. **No stroke/hole/scorecard schema**; apps that want scores in Health resort to stuffing them into workout *metadata* (e.g. [Golf Strokes Scorecard](https://apps.apple.com/us/app/golf-strokes-scorecard/id1492642824) does exactly this). [HealthKit data types](https://developer.apple.com/documentation/healthkit/data-types).
- **Google Health Connect**: same shape — `EXERCISE_TYPE_GOLF` session type, no scorecard semantics.

This matters both ways: (a) there is no aggregator rail the fitness app could ride instead of a direct integration — a direct API to handicappin is genuinely the only way to get a *scorecard* (not a workout) across; (b) the absence also signals that horizontal players sized the golf-scorecard exchange market and passed.

### 1d. The only genuinely open layer: course *data*

Open/commercial course-database APIs are abundant — [golfcourseapi.com](https://golfcourseapi.com/) (free, ~30k courses), [golfapi.io](https://www.golfapi.io/) (42k courses, scorecards/tees/CR/slope), [golfapi.uk](https://www.golfapi.uk/) (GB, 14k tee sets), [Golf Intelligence](https://golfintelligence.com/api-pricing/) (credit-based GPS/scorecard vectors), [iGolf](https://igolf.com/developers-igolf/) (licensing). This is the commodity layer. **Nobody — anywhere — offers an open *user-scorecard-write* or *handicap-read* API.** The open market stops exactly where user identity and handicap officialdom begin.

---

## 2. Gap analysis — is the gap an opportunity or a warning?

**The gap is real.** A developer who wants "POST a scorecard for user X, GET their handicap trend" today has: GHIN GPA ($6k/yr, US-only, must not compute alternative handicaps), TheGrint Connect (read-only, invitation), federation ISV APIs (club-scoped, accreditation-gated), or nothing. An open, self-serve scorecard/handicap API does not exist. handicappin could ship one; nothing in this landscape technically blocks it outside the US.

**But the gap is not unexplained white space — it is structurally caused, three times over:**

1. **The valuable number is governed IP.** The handicap people actually want via API is the *official* one, and the bodies that own it (USGA/R&A, national associations) monetize/gate access and contractually suppress alternatives (the GPA "no alternative handicap value" clause; Fran Nee's global WHS-terminology claim, #151). An open handicappin API can only ever serve the **unofficial** index — exactly the feature the USGA requires removed from the US market and whose Norwegian legitimacy hangs on NGF Leverandør authorization (#147, reply pending). A *platform* built on the unofficial index enlarges the surface of the thing the officialdom strategy is negotiating about.
2. **Demonstrated demand is B2B-partner-shaped, not platform-shaped.** The integrations that actually happened (Clippd↔Garmin, Clippd↔Arccos, Calcutta↔TheGrint, Golfshot↔Golf Genius) are all named-partner deals against large installed bases. API value here scales with the *user graph*, not with endpoint quality — TheGrint Connect works because partners want TheGrint's millions of golfers. handicappin's current user base cannot anchor that demand yet; a developer portal with no users behind it is inventory without a market.
3. **The horizontal aggregators passed.** Terra covers 500+ integrations and skipped golf scorecards; Apple/Google model golf as a calorie burn. If the exchange market were large, the aggregator whose whole business is exchange would have modeled it.

**What the gap *does* validate:** the strategy track already found the real opening — **federation seams are opening right now** (NGF Unionsdatabase two-way APIs with zero certified vendors; England Golf's ISV rail as the proven pattern). The credible platform story for handicappin is *becoming a certified vendor on official rails and being the developer-friendly one*, not standing up an unofficial parallel platform. GolfBox's documented lock-in pain (#146) is the differentiation wedge, and NGF certification (#147) is the gate. An open API is a strong *later* differentiator against GolfBox precisely because GolfBox's closedness is the community's chief complaint — but that card is worth playing after certification, not before.

---

## 3. Options

### Option A — Private first-party seam only
Ship the fitness-app integration on the existing Bearer path (`apps/web/server/api/trpc.ts`) with the minimum REST wrapper; no versioning discipline, no extraction, no platform artifacts.
- **Pros:** fastest to v1; zero speculative work; no governance exposure (no third party ever touches the unofficial index).
- **Cons:** ~700-line `submitScorecard` stays welded into the tRPC router, so *any* future consumer restarts from extraction; an unversioned private contract calcifies into a de-facto API anyway; forfeits cheap option value on the NGF/vendor track.

### Option B — Deliberately minimal v1 with platform-shaped seams (recommended)
Ship for the fitness app only, but: extract the submission pipeline into a workspace package (topic 1), version the REST surface (`/api/v1`) with zod + idempotency (topics 4–5), keep the contract documented internally. **Explicitly defer** OAuth server, API keys, developer portal, public docs, SDKs until an external trigger fires (NGF certification lands, a named partner asks, or the user base can anchor a TheGrint-Connect-style program).
- **Pros:** matches everything the market evidence says (integrations are partner deals; platforms need user graphs); costs days not weeks over Option A; preserves both futures — partner API *and* NGF-certified vendor; avoids publicly productizing the unofficial index while #147/#151 negotiations are live.
- **Cons:** some discipline (versioning, idempotency) is spent before any second consumer exists; requires resisting the temptation to "just publish the docs."

### Option C — Build platform-grade now (OAuth, portal, key management, public docs)
Bet that the open gap is a first-mover opportunity.
- **Pros:** genuinely nobody offers this; if third-party demand materialized, handicappin would own the category default; developer-experience halo.
- **Cons:** market evidence says demand at this scale doesn't exist (every real integration is a vetted deal against big user bases; aggregators passed); weeks of investment ahead of any consumer; actively risky for the officialdom strategy — a public API distributing unofficial WHS-method handicaps enlarges exactly the surface USGA already objected to and NGF has yet to bless; the platform, if it comes, plausibly belongs on *official* rails post-certification, which would obsolete a pre-built unofficial one.

### Option D — Plan phase 2 as a *vetted partner* API, not a self-serve platform
Not exclusive with B — this is the shape phase 2 should take. When a second consumer appears, onboard it the way the entire industry does: named partner, manual credential issuance (per-consumer key/token, TheGrint-Connect/DotGolf-ISV style), contract + scope agreed per partner. Self-serve OAuth/portal only if partner count ever makes manual onboarding the bottleneck — a good problem that GHIN, Garmin, Arccos, and TheGrint have all managed to avoid solving.
- **Pros:** matches observed market mechanics; per-partner scoping sidesteps building general consent/scopes early; keeps governance control over who redistributes the unofficial index.
- **Cons:** doesn't scale to long-tail developers (which the evidence says don't exist in this category); "platform" ambition becomes a partner program — emotionally smaller, empirically right.

---

## 4. Recommendation

**Option B now, with Option D as the declared shape of phase 2. Do not build platform-grade infrastructure (OAuth server, developer portal, self-serve keys, public docs) in this cycle.**

The market answer to the decision question is nuanced: the ecosystem *does* lack an open scorecard/handicap API — but the gap is enforced by handicap-officialdom IP, partner-deal economics, and thin long-tail demand, not overlooked by incumbents. The differentiation opportunity that actually checks out is the one the strategy track is already pursuing: certified-vendor status on the opening federation rails (NGF Unionsdatabase; England Golf ISV as the pattern), where being the *developer-friendly, open-API* vendor contrasts with GolfBox's documented closedness. That prize is won through #147/#151, and a prematurely public unofficial-handicap API would complicate, not advance, it.

Practically, this calibrates the other topics: take the **contract-hygiene** parts of their platform-grade answers (extraction into a workspace package, `/api/v1` versioning, idempotency, zod at the boundary, per-consumer attribution) and **reject the distribution parts** (OAuth issuance for arbitrary third parties, portal, self-serve keys) until a trigger fires: (1) NGF Leverandør certification granted, (2) a named partner with users asks, or (3) handicappin's own user base is large enough that a TheGrint-Connect-style program has something to offer partners.

**Confidence: medium-high.** The landscape facts are high-confidence (primary sources, including direct USGA correspondence and NGF board documents). The demand inference — that long-tail third-party demand is thin — is medium: it's an argument from absence, and the NGF window timing could change the calculus within months.

---

## 5. Open questions

1. **NGF Unionsdatabase API spec + certification terms** — still unpublished (Fase 1–2 deliverables); does a consumer companion app even qualify as a "Leverandør"? Owned by issue #147 (NGF reply pending; Gmail follow-up due ~07-20).
2. **Does redistributing the unofficial index via API to third parties violate anything?** USGA's stated position ("no part of the WHS in your estimator… regardless of where") is about the estimator itself, but a *platform* distributing it is a louder version of the same fact pattern. Worth asking NGF (not USGA) once the Leverandør conversation is live.
3. **England Golf ISV enrollment terms** (cost, accreditation bar) — undocumented publicly; relevant only if GB&I stops being parked (#154).
4. **Will Terra/HealthKit/Health Connect ever model golf scorecards?** No signal today; if one does, it becomes the cheap rail for the fitness-app use case and changes topic 7 (two-way sync).
5. **What demand signal to instrument now?** A zero-cost option: an "API access" interest form/email + PostHog event, so trigger (2)/(3) above is measured rather than guessed.

---

## Source register

**Internal (primary-source-backed issue research, 2026-07-11 → 07-13):** GitHub issues #145 (NGF Unionsdatabase; NGF Sluttrapport + Golfting 2025 PDFs), #146 (GolfBox inventory/pain; NGF utredning, GCAE), #150 (US AGA route), #151 (USGA GPA terms + verbatim USGA email replies, 2026-07-13). Codebase: `apps/web/server/api/trpc.ts`, `apps/web/server/api/routers/round.ts:303`.

**External (checked 2026-07-20):**
[USGA GPA Overview](https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Program-Overview.html) · [GPA Approved Vendors](https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Approved-Vendors.html) · [WHS Interoperability announcement](https://www.whs.com/articles/2024/2024-interoperability.html) · [WHS Interoperability Standard v1.0](https://www.whs.com/content/dam/whs/documents/World%20Handicap%20System%20Interoperability%20Standard%20v1.0_.pdf) · [DotGolf ISV API](https://isvapi.whsplatform.englandgolf.org/index.html) + [auth docs](https://isvapi.whsplatform.englandgolf.org/v1documentation) · [GolfBox federations](https://golfbox.net/golfbox-golf-federations) · [TheGrint Connect](https://thegrint.com/range/post/thegrint-connect-unlock-new-opportunities-through-our-api) · [Golfshot×Golf Genius](https://golfshot.com/blog/golfshot-and-golf-genius-team-up-for-a-game-changing-integration) · [Garmin Golf Premium API](https://developer.garmin.com/golf-api/) · [Garmin×Clippd press](https://www.garmin.com/en-US/newsroom/press-release/outdoor/garmin-announces-integration-with-clippd-to-help-golfers-improve-their-game/) · [Arccos×Clippd](https://www.arccosgolf.com/blogs/community/clippd-to-become-first-platform-to-seamlessly-integrate-arccos-on-course-data) · [Terra](https://tryterra.co/) + [integrations](https://tryterra.co/integrations) · [HealthKit data types](https://developer.apple.com/documentation/healthkit/data-types) · [golfcourseapi.com](https://golfcourseapi.com/) · [golfapi.io](https://www.golfapi.io/) · [golfapi.uk](https://www.golfapi.uk/) · [Golf Intelligence pricing](https://golfintelligence.com/api-pricing/) · [iGolf developers](https://igolf.com/developers-igolf/) · [unofficial ghin npm](https://socket.dev/npm/package/ghin) · [SandTrap GHIN API thread](https://thesandtrap.com/forums/topic/112075-usga-ghin-api/)
