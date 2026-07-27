# Synthesis — golf-api-landscape

**Topic:** Does the golf-platform API landscape gap validate a genuine third-party platform play versus keeping this a private first-party seam?

**Panel:** 7 perspectives (White, Red, Black, Yellow, Green, Blue hats + pre-mortem)
**Verdicts:** 4 agree, 3 mixed. Weighed on argument substance: **CONSENSUS**, with binding conditions absorbed from the critical reviews.

---

## Verdict: CONSENSUS

All seven perspectives converge on the same strategic decision:

1. **Do not build platform distribution this cycle.** No OAuth issuance, no developer portal, no self-serve keys, no public docs. The ecosystem gap is real but is enforced by handicap-officialdom IP, partner-deal economics, and (inferred) thin long-tail demand — not overlooked by incumbents. Option C (public platform now) was rejected by every perspective; nobody defended it.
2. **Keep the seam private and first-party for the fitness app (Option B posture).** Do the contract-hygiene work whose value is consumed by every future branch: extract the `submitScorecard` pipeline into a transport-agnostic package, zod at the boundary, idempotency, per-consumer attribution.
3. **Declare vetted-partner (Option D) as the shape of phase 2**, gated behind observable triggers — not a public platform. This matches the shape every winning incumbent chose (GHIN, Garmin, Arccos, TheGrint Connect).
4. **The genuine platform prize remains NGF Leverandør certification** (issues #147/#151), which a prematurely public unofficial-handicap API would complicate rather than advance. Option B is the only option that *improves* the negotiating posture (Yellow), and quiet hands during live USGA/NGF threads is instinctively and analytically right (Red, Black, pre-mortem).

The three "mixed" verdicts (Black, Green, pre-mortem) do not oppose this decision — they attack execution risk, trigger falsifiability, and the default v1 transport shape. All are absorbable as conditions. Blue Hat's structural note stands: the panel converged partly on **decision asymmetry** — Option B loses only recoverable weeks if demand is secretly large, while Option C's governance downside during live negotiations is partially irreversible. B dominates under both demand states; the decision record should say so explicitly.

---

## The decision, with conditions

**Adopt the research recommendation (Option B now, Option D declared as phase 2), subject to the following conditions.** These are binding parts of the decision, not suggestions.

### A. Ship-blockers for the fitness-app v1 (before prod)

1. **Cloudflare/Vercel 429 challenge bypass is a named launch blocker** (Red, Black, Green, pre-mortem — the single most-repeated item). Scope the bypass rule minimally to the API path; verify with an automated cookie-less prod smoke test; add a Sentry alert on 429-HTML responses so dashboard-side regressions surface in hours, not at integration time.
2. **Per-token and per-IP Upstash rate limiting plus 401/429 abuse alerting** ship with the surface (Black). An unchallenged, undocumented endpoint is publicly probe-able — undocumented is not private.
3. **Round-limit/billing gating stays inside the insert transaction** (Black). Idempotency keys cover retries, not races; a second write path must not become a paywall bypass across web/native/fitness clients.
4. **Integration-test coverage of billing gating and transactional recalculation is a precondition of the extraction**, plus a cross-entry-point handicap-equivalence test. No dual live submission paths: web, native, and the new consumer converge on one pipeline before the fitness app ships (Black, pre-mortem).
5. **Governance check before launch, not phase 2** (Black, Blue, pre-mortem): answer research open question 2 — does a public fitness app surfacing the WHS-method unofficial index (especially US market) change the live USGA #151 / NGF #147 fact pattern? Ask in the existing threads if ambiguous, and document the conclusion that a first-party app does or does not trip the boundary. The exposure begins at v1 ship, not at public docs.

### B. Design decisions to make deliberately, not by default

6. **Evaluate the null-surface v1 before locking REST** (Green — strongest surviving alternative). The first consumer is the same developer; a private workspace package over the existing Bearer tRPC path (the apps/native pattern), or even deep-link/share-sheet handoff, may serve consumer #1 with less surface and no Cloudflare dependency. If REST /api/v1 is chosen, choose it with reasons recorded — "REST for an audience of one" must not happen by inertia.
7. **Write-only-by-default as a stated API design principle** (Green): scorecard-in, never handicap-out. This collapses most of the USGA/NGF governance surface for v1 and for future phase-2 partners.
8. **Resolve the identity-layer design before freezing auth** (Black): do the two apps share one Supabase project, and can fitness-app tokens be scoped below full user privilege? If not, document the accepted blast radius explicitly rather than inheriting it silently.
9. **Mark the surface internal/unstable** (docs + response header) until a second consumer exists (Black) — the version stamp must not be a false promise or a premature freeze.
10. **Extraction is timeboxed (~1 week) with a declared fallback** — a thin wrapper over the existing tRPC procedure (pre-mortem, Red). "Days not weeks" is asserted, not estimated; budget it as a real refactor. Boundary must be certification-shaped: isolate the submission pipeline from tRPC *and* from the unofficial-index calculation so an NGF-official-handicap backend can slot in without re-extraction (Yellow). The durable asset is the package, not the REST contract (pre-mortem).
11. **Verify Supabase OAuth 2.1 server maturity (~1 hour)** so the phase-2 cost assumptions behind deferral are fact-based (Green). Keep phase-2 language shape-agnostic ("vetted-partner credentials"), not hard-coded to REST/portal — an MCP server over the same extracted package is a plausible cheap phase-2 surface.

### C. Making the deferral falsifiable (unanimous among critical reviews)

12. **Ship demand instrumentation WITH v1, not later**: the "API access" interest form + PostHog event is promoted from open question to committed scope (Red, Yellow, Green, Blue, pre-mortem — the panel's most unanimous single item). Without it, triggers (2) and (3) are unfalsifiable and the deferral has no measured exit ramp. Two of the three triggers are passive and will never fire on their own — partners don't ask products with no graph for a deliberately unpublicized API (Red, pre-mortem).
13. **Write concrete trigger thresholds with an owner** (Black): what specifically counts as "a named partner with users asks" and what user-base level anchors trigger (3).
14. **Record the decision + triggers in a dated ADR / strategy-issue comment, with a calendar review (~2026-10, and a hard re-decide by end Q1 2027)** at which deferred platform work is re-funded, reshaped for NGF official rails, or killed (Blue, pre-mortem). "Defer until trigger" must not silently become "never."
15. **The internal /api/v1 contract doc must actually be written and maintained** (Yellow) — if "defer public docs" becomes "no docs," the phase-2 head start evaporates and Option B degrades into Option A with extra steps.

### D. Corrections to the research record (before it propagates)

16. Downgrade "aggregators evaluated the space and passed" to "no aggregator models golf scorecards; no signal why" wherever restated — the motive claim is unsupported (White, Blue).
17. Date-stamp the universal negative ("zero self-serve surfaces in consumer golf, *as searched 2026-07-20*") and attach a re-check trigger (White).
18. Reconcile confidence labels: landscape facts = high, demand inference = medium (research file said medium-high, summary said medium) (Red, Blue). Note NGF issue-state facts are as-of ~07-13; the pending #147 reply is the freshness mechanism (White).
19. Cheap data still worth collecting: manually read the WHS Interoperability Standard PDF (403s to bots; its characterization currently rests on secondary text) (White, Blue).
20. Independence caveat goes in the decision record: the heaviest evidence and the conclusion both come from the repo's own strategy-track issues (#144–#154). Acceptable because the recommendation is cheap and reversible — but if the NGF track dies, the Option B calibration should be revisited rather than assumed (Black, Blue).

---

## Strongest surviving dissent

**Green Hat's null-surface challenge, reinforced by Black Hat's exposure timeline.** The option set never priced a v1 with *no* new server surface: the fitness app as a second first-party client over the existing Bearer tRPC path (exactly how apps/native integrates), or a zero-backend deep-link/share-sheet handoff. The market evidence — every observed integration is a bespoke named-partner deal — arguably supports that shape *more* than a REST /api/v1, and it sidesteps the Cloudflare challenge and the publicly-probe-able-surface exposure Black Hat identifies as starting at v1, not at public docs. This dissent does not contest the strategic decision (defer distribution, Option D phase 2 — Green explicitly concedes deferral wins on demand grounds); it contests the default v1 transport. It is absorbed as condition B.6: the REST shape must be chosen deliberately against the null-surface alternative, not inherited from the recommendation text.

Secondary dissent (pre-mortem): "private seam = no governance exposure" conflates API privacy with market invisibility — the fitness app is itself a public app surfacing the unofficial WHS-method index, a louder version of the #151 fact pattern regardless of API privacy. Absorbed as condition A.5 (governance check moved from phase 2 to pre-launch).

---

## What the human owner should still eyeball

Consensus stands, but three absorbed conditions involve owner-level judgment rather than engineering:

- The A.5 governance check (whether to proactively raise the fitness app in the USGA/NGF threads, and how) is a negotiation-posture call only the owner can make.
- The B.6 transport choice (REST /api/v1 vs. private package vs. deep-link) trades a few days of work against optionality; reasonable people land differently.
- The C.13 trigger thresholds require owner commitment to be meaningful.

None of these reopen the strategic verdict.
