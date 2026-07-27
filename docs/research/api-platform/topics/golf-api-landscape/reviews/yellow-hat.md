# Yellow Hat Review — golf-api-landscape

- **Perspective:** Yellow Hat (benefits and value)
- **Verdict:** Agree
- **Date:** 2026-07-20
- **Reviewed:** `docs/research/api-platform/topics/golf-api-landscape/research.md`

## Why the recommendation works — the value case for Option B + declared D

### 1. Option B is asymmetric option value at almost no premium

The cost delta over Option A is "days not weeks," and what those days buy is disproportionate: the extraction of `submitScorecard` (~700 lines welded into `apps/web/server/api/routers/round.ts:303`) plus `/api/v1` versioning, zod, and idempotency is the *entire reusable core* of every future scenario — a second partner, an NGF-certified integration, or nothing at all. Even in the "nothing at all" world the extraction pays for itself internally: a testable, transport-agnostic submission pipeline is better code for web, native, and the watch app regardless of any external consumer. This is the rare case where the speculative work is not speculative — every branch of the future consumes it.

### 2. The recommendation converts market research into saved weeks and avoided harm

The best outcome of research is not "build the thing" but "don't build the wrong thing at the right time." The survey established, from primary sources, that zero self-serve API surfaces exist in consumer golf and that every real integration is a named-partner deal. Following that evidence means:

- **Weeks of OAuth/portal/key-management work avoided** ahead of any consumer — capacity that flows straight into the fitness-app v1 and the strategy track.
- **Governance downside actively avoided:** with USGA (#151) live and NGF (#147) pending, *not* publicly productizing the unofficial index is itself a benefit — it keeps handicappin looking like a certifiable vendor rather than a parallel-system operator, precisely while certification is being negotiated. Option B is the only option that improves the negotiating posture instead of complicating it.

### 3. Option D reframes "smaller" as "industry-standard" — and that is a strength

The vetted-partner shape is not a consolation prize; it is the shape GHIN, Garmin, Arccos, and TheGrint all *chose while winning*. Manual per-partner credentials mean phase 2 can launch with a config entry and a handshake instead of a consent-screen/scopes/rotation infrastructure. And every partner conversation doubles as free market research: if manual onboarding ever becomes the bottleneck, that is the demand signal Option C needed — arriving with revenue attached instead of guesswork.

### 4. It keeps the *real* platform prize alive and clean

The genuinely valuable long-term position identified is certified-vendor status on official rails (NGF Unionsdatabase now, England Golf ISV as the template). Option B's contract hygiene is a direct down payment on that: a versioned, idempotent, zod-validated, well-factored submission API is *exactly the artifact a certification review wants to see*. When the Leverandør spec lands, handicappin shows up with the plumbing already shaped like a vendor's — while GolfBox's documented closedness (#146) makes "the developer-friendly certified vendor" a differentiation card that only gains value by being played *after* certification. Deferral here is not delay; it is sequencing the trump card.

### 5. The trigger design turns deferral into a live strategy, not a shelf

Three concrete, observable triggers (NGF certification, a named partner asking, user-graph scale) plus the proposed zero-cost demand instrumentation (interest form + PostHog event) mean the platform decision will be *re-made on data* rather than re-litigated on vibes. That is the best realistic outcome available today: v1 ships fast for the fitness app, nothing valuable is foreclosed, the officialdom negotiations stay unpolluted, and the upside scenarios each have a pre-agreed activation condition.

### 6. Second-order benefits worth naming

- **Per-consumer attribution from day one** gives usage analytics on the fitness-app seam — the first real data on cross-app scorecard demand, feeding trigger (3).
- **The internal contract doc** becomes the seed of partner docs in phase 2 — written once, at leisure, not under partner-deadline pressure.
- **The fitness app as reference consumer** means the first external partner integrates against a contract that has already survived a real client, cutting phase-2 onboarding risk.

## Value-side concerns to lock down (must-address)

1. **Don't let "defer the docs" rot the option:** the internal `/api/v1` contract doc must actually be written and kept current, or the phase-2 head start evaporates and Option B degrades into Option A with extra steps.
2. **Ship the demand instrumentation with v1, not later:** the interest-form/PostHog signal is what makes the triggers measurable; if it slips, trigger (2)/(3) becomes unfalsifiable and the deferral has no exit ramp.
3. **Confirm the extraction package boundary is certification-shaped:** the workspace package should isolate the submission pipeline from tRPC *and* from the unofficial-index calculation, so an NGF-official-handicap backend can slot in without re-extraction when the Unionsdatabase spec lands.
