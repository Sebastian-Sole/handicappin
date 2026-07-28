# Black Hat Review — golf-api-landscape

- **Reviewer perspective:** Black Hat (caution and risk)
- **Date:** 2026-07-20
- **Verdict:** MIXED — the rejection of Option C is correct and well-evidenced, but Option B's risks are underpriced and several of its "cheap" moves are not cheap, are governance-exposed, or commit the project in ways the research does not acknowledge.

---

## Where I agree (briefly, then back to the knives)

Killing Option C is right. The evidence that no self-serve golf API exists because the valuable number is governed IP, not because incumbents are asleep, is the strongest part of the research. Building a public unofficial-handicap platform mid-negotiation with the USGA and NGF would be self-harm. No dispute.

The dispute is that Option B is presented as "days not weeks, preserves both futures, no downside beyond spent discipline." Every clause of that sentence hides a risk.

## Risk 1 — The governance exposure does NOT start at "public docs." It starts at the Cloudflare bypass.

The recommendation's safety story is "we avoid *publicly* productizing the unofficial index by not publishing docs." But the known prod gotcha means the fitness app cannot talk to prod until a Cloudflare/Vercel challenge-mode bypass rule is punched for `/api/v1/*`. The moment that rule exists:

- `/api/v1` is a **publicly reachable, unauthenticated-probe-able REST surface** on the open internet. No docs needed — `/api/v1/rounds` is guessable in one try. Undocumented is not private.
- The USGA's stated position (#151) is about the estimator "regardless of where." A discoverable REST endpoint that accepts scorecards and returns a WHS-method index is a *worse* fact pattern than the app alone if it surfaces during the #147/#151 negotiations — it looks like distribution infrastructure, whatever the intent. Open question #2 in the research ("does redistributing the unofficial index via API violate anything?") is deferred to phase 2, but the exposure begins at v1 ship. That sequencing is wrong.
- The bypass also removes bot protection from those routes: credential stuffing against Bearer auth, scorecard-submission abuse against the billing-gated free tier, and enumeration all become possible. Upstash rate limiting on these routes is a ship-blocker, not hygiene.

**Mitigation floor:** scope the bypass as narrowly as the dashboard allows, require auth before any body parsing, rate-limit per-token and per-IP, alert on 401/429 volume, and get an answer to open question #2 *before* prod exposure — not "once the Leverandør conversation is live."

## Risk 2 — Bearer tokens are full-user-privilege; "per-consumer attribution" is cosmetic without scoping.

The existing Bearer path was built for handicappin's own native app — a first-party client holding a Supabase session with the user's **entire** RLS scope. Reusing it for the fitness app means:

- The fitness app (a separate codebase, separate attack surface, same developer *today*) holds tokens that can do anything the user can do in handicappin: read billing state, delete rounds, change profile. There is no scope-down mechanism. A compromise of the fitness app is a full compromise of every shared user's handicappin account.
- This only works at all if both apps share one Supabase project (same JWT issuer). If they do, the two products are now **welded at the identity layer** — a lock-in the research never names. Migrating either app off the shared auth later means breaking the integration. If they don't share a project, the "existing Bearer path" premise is false and the auth work is unscoped.
- "Per-consumer attribution" via a header or client-id claim is trivially spoofable by anything holding a valid user token. It's telemetry, not a security boundary. Fine — but then don't let phase-2 planning treat it as one.

## Risk 3 — Extracting the 700-line pipeline with N=1 consumers is speculative refactoring of the money path.

`submitScorecard` is the revenue-adjacent, correctness-critical core: billing gating, pending-course auto-creation, transactional handicap recalculation. The research budgets its extraction as contract hygiene costing "days." Black-hat reading:

- Extraction with a single consumer means the package boundary is guessed, not discovered. The classic outcome: the seam lands in the wrong place, the second consumer (if it ever arrives — see Risk 5) needs a different shape, and you refactor twice while now maintaining a workspace-package API *and* the tRPC wrapper. Option A's con ("any future consumer restarts from extraction") is real but symmetric: a wrong extraction also restarts, plus you paid up front.
- The extraction itself risks regressions in exactly the code where the project has already had prod incidents (phantom migration 500s, PR #161 memory). This refactor needs the full integration-test net around billing gating and recalculation before it ships, or Option B is strictly riskier than Option A for the only consumer that exists.

## Risk 4 — `/api/v1` before any external consumer is a premature commitment, not free discipline.

Versioning is a promise. Stamping `v1` on a contract shaped around one internal consumer creates two failure modes: (a) the contract calcifies and the first real partner needs `v2` immediately — so the discipline bought nothing; or (b) the team treats it as changeable anyway — so it wasn't a version, just a path prefix with a misleading name. If it ships, it must be explicitly labeled internal/unstable (and return headers saying so) until a second consumer exists. Otherwise Option B recreates Option A's "de-facto API calcifies" con with extra ceremony.

## Risk 5 — The triggers are unfalsifiable and the option value may be imaginary.

- "A named partner with users asks" has no threshold, no owner, no evaluation criteria. Under enthusiasm, one inbound email becomes a trigger. The research itself admits Option B "requires resisting the temptation" — a stated temptation with no control is a predicted failure.
- The NGF trigger's value depends on facts nobody has: the Unionsdatabase go-live already slipped, zero vendors are certified, the API spec is unpublished, and it is unknown whether a consumer companion app even *qualifies* as a Leverandør (open question #1). If NGF answers "no" or the program slips another year, the "preserves the NGF-certified future" pro of Option B evaporates — and note that a post-certification platform on official rails would plausibly require a *different* contract anyway (WHS Interoperability-shaped, not handicappin-shaped), so today's seams may not transfer even in the success case. The research makes this exact argument against Option C ("would obsolete a pre-built unofficial one") and then exempts Option B's seams from it without justification.
- Source-independence caveat: the landscape research leans heavily on the repo's own strategy issues (#145–#151), i.e., the owner's negotiation narrative. The facts look solid, but the *framing* — that NGF certification is the real prize and everything should be shaped to protect it — is the strategy track grading its own homework. If the NGF track dies, Option B was calibrated against a ghost.

## Risk 6 — Second write path into billing-gated state.

Two clients (web/native + fitness app) submitting rounds for the same user means concurrent submissions racing the free-tier round limit and the handicap recalculation transaction. Idempotency keys handle retries, not cross-client races. The extraction must keep the limit check inside the same transaction as the insert, or the fitness app becomes a paywall bypass and a data-corruption vector.

## Worst realistic outcome

The Cloudflare bypass ships, a golf-forum user finds `/api/v1` within weeks (the research itself documents this community reverse-engineers closed APIs — the unofficial `ghin` npm package is Exhibit A), posts "handicappin has a hidden API," and the USGA or NGF encounters "handicappin distributes WHS-method handicaps over an API" while #147/#151 are live. Simultaneously the fitness app's token handling has a leak, and full-scope user tokens are exposed. None of this requires bad luck — only the defaults in the current plan.

## Verdict detail

- **Agree:** no OAuth/portal/self-serve/public docs now; phase 2 as vetted-partner (Option D) matches the market evidence.
- **Disagree:** that Option B as specified is low-risk. Its governance exposure begins at prod reachability (not docs), its auth reuse is unscoped full-privilege access, its extraction is speculative refactoring of the money path, and its triggers are unenforceable as written.
- **Amendment that would move me to agree:** Option B with (1) rate-limited, minimally-scoped Cloudflare bypass + abuse monitoring as ship-blockers; (2) the identity-layer question (shared Supabase project? token scoping?) answered before the auth design is frozen; (3) `/api/v1` explicitly marked internal/unstable; (4) open question #2 asked before v1 ships to prod, not in phase 2; (5) written trigger thresholds with an owner; (6) integration tests around billing gating and recalculation as an extraction precondition.
