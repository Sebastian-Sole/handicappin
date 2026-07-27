# White Hat Review — golf-api-landscape

Perspective: facts and information only. What does the evidence actually establish, which claims are verified vs assumed, and what data is still obtainable.

Verdict: **agree** (the verified facts support Option B + D; the unverified parts are inferences the recommendation leans on only for *deferral*, which is reversible and trigger-gated).

## Claims verified in this review (re-checked 2026-07-20)

- **Internal code anchors are accurate.** `extractBearerToken` exists in `apps/web/server/api/trpc.ts` (RFC 6750 Bearer parsing, falls through to unauthenticated); `submitScorecard` is at `apps/web/server/api/routers/round.ts:303`.
- **USGA correspondence claims match the primary record.** Issue #151 contains, verbatim: the $6,000/yr fee ("Annual fees $6,000" on the application form); the GPA clause "may not provide an alternative handicap system, calculate an alternative handicap value … or provide a handicap value to indicate a player's demonstrated ability"; Fran Nee's reply "The estimator needs to be removed from the US market… You are not permitted to use any part of the WHS in your estimator/calculator regardless of where you or the golfer are located." The research summary reproduces these accurately, including the US-market scoping of estimator removal and the global WHS-method claim being the USGA's *stated position* (its legal reach is explicitly not established — #151 says so itself).
- **Issue states match.** #151 OPEN (USGA GPA), #147 OPEN (NGF relationship, reply pending — consistent with the "Gmail follow-up due ~07-20" open question), #145 CLOSED (NGF Unionsdatabase resolved mid-July with the slipped 1-May-2026 go-live and zero certified vendors). The NGF timeline data is therefore **as of ~07-13**, not 07-20; the pending #147 reply is the freshness mechanism.

## Claims sourced but not independently re-fetched here

The external landscape table (GPA pages, DotGolf ISV Swagger, TheGrint Connect post, Garmin Golf Premium API, Arccos×Clippd, Terra integrations, HealthKit/Health Connect activity types, course-data APIs) cites live URLs and states re-check date 2026-07-20. Citation quality is high (official portals/vendor posts). This review did not re-fetch them; nothing in them is load-bearing beyond what the verified USGA/NGF material already establishes.

## Claims that are inference, not established fact

1. **"Aggregators evaluated the space and passed."** The evidence establishes only that Terra/HealthKit/Health Connect *lack* golf scorecard models — not that anyone sized the market and declined. The summary states the evaluation as fact; the research file ("sized… and passed") makes the same leap. Should read: *no aggregator models golf scorecards; no signal why*.
2. **"Zero self-serve API surfaces exist anywhere in consumer golf."** A universal negative from a finite search ("no developer API found", searched 07-20). Reasonable, but it is a dated snapshot — it needs a re-check trigger, not permanent-truth status.
3. **"API value scales with the user graph, not endpoint quality."** A mechanism inferred from ~5 partner deals (Clippd↔Garmin/Arccos, Calcutta↔TheGrint, Golfshot↔Golf Genius). Plausible and consistent, but n is small and "TheGrint's millions of golfers" is unsourced.
4. **"Thin long-tail demand."** Argument from absence, and the research correctly self-rates it medium. Note the only concrete consumer in hand (the fitness app) wants *scorecard write*, not the official handicap — a data point mildly against "the number people want via API is the OFFICIAL handicap" as a universal, though it is first-party and so evidences nothing about third-party demand.
5. **WHS Interoperability Standard characterized as "federation-to-federation plumbing" from the announcement page only** — the PDF 403'd to automated fetch and was not read.

## Missing data still obtainable (cheap)

- Read the WHS Interoperability Standard v1.0 PDF manually (browser fetch works per #151's method).
- England Golf ISV enrollment terms: one email; research defers this correctly (parked with #154).
- TheGrint Connect partner terms: an inquiry would convert "individually vetted, no published pricing" from vendor-blog claim to first-party fact — only worth it if trigger (2) nears.
- The proposed demand instrumentation (interest form + PostHog event) is the right move: it converts the weakest inference (thin demand) into a measured quantity at ~zero cost.
- Whether redistributing the unofficial index via API changes the USGA/NGF posture: not answerable from existing evidence; correctly routed to the live NGF conversation (#147).

## Consistency check against the decision

The recommendation's load-bearing facts are all in the verified tier: official rails are closed/paid/certification-gated; the only sanctioned US path contractually forbids the alternative index; NGF certification is the live strategic play; no self-serve precedent exists in the category *as of the search date*. Option B spends only contract hygiene against those facts and defers everything that depends on the inferential tier behind three observable triggers. That is an evidence-proportionate structure. The one factual hygiene item: downgrade "aggregators passed" to "aggregators absent" wherever the conclusion is restated, so later readers don't inherit an unsupported motive claim.
