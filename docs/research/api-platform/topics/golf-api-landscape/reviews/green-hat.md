# Green Hat Review — golf-api-landscape

- **Reviewer perspective:** Green hat (creativity & alternatives)
- **Date:** 2026-07-20
- **Verdict:** MIXED — the deferral logic (no OAuth/portal/public docs; phase 2 as vetted-partner) is right and well-evidenced, but the option set skips at least two cheaper shapes for v1, and one reframe that shrinks the governance problem the whole recommendation is organized around.

## What the option set never considered

### 1. The null-surface option: no new HTTP API at all

Every option A–D assumes the fitness app talks to a REST wrapper. But the "first consumer" is the **same developer**. That makes the fitness app a *second first-party client*, exactly like `apps/native` — and the native app already integrates through the existing tRPC Bearer path with zero REST surface. The genuinely minimal v1 is:

- Publish the tRPC contract (or just a typed client for the 2–3 procedures needed) as a private workspace/npm package the fitness app consumes.
- No `/api/v1`, no REST translation layer, no superjson-compatibility worries for outsiders — because there are no outsiders.

The research's own market evidence *supports* this harder than it supports Option B: if every real integration in golf is a named-partner deal and the first named partner is yourself, the industry-standard move is a private bespoke integration, not a versioned REST contract with no second consumer. The contract-hygiene spend (extraction of the 700-line `submitScorecard` into a workspace package) is still worth doing — that's refactoring debt regardless — but `/api/v1` + REST + idempotency headers for an audience of one is Option C thinking wearing Option B clothes. Option B may still win, but it should have to beat this option explicitly, and the research never put it on the table.

### 2. The zero-backend rail: app-to-app handoff

For the concrete use case stated ("user fills out a scorecard in the fitness app, it saves to their handicappin profile"), there is a rail that needs **no server surface at all**: deep link / App Intents / share-sheet handoff. The fitness app serializes the scorecard into a universal link or shared payload; the handicappin app (web or native) opens it and submits through the user's *own already-authenticated session*.

- Sidesteps the prod Cloudflare 429 challenge entirely (the known blocker for any non-browser client — still unfixed, dashboard-side).
- Sidesteps token sharing between apps, consent modeling, and per-consumer attribution — the user is present and acting in handicappin.
- Costs roughly a URL schema and a prefill screen.

Downside: not silent/background sync, requires handicappin installed. But the research should have priced this before pricing a REST layer — for a v1 same-developer flow it may be 80% of the value at 5% of the cost, and it produces zero new governance surface.

### 3. The governance-shrinking reframe: score-in, never handicap-out

The entire risk analysis ("an open API can only serve the unofficial index, enlarging the surface USGA objected to") assumes the API distributes the handicap. **The stated use case only needs to WRITE scorecards.** A raw score is the user's own fact — not WHS IP, not an "alternative handicap value." An asymmetric API (scorecard-ingest in; nothing but an ack out; the index stays inside handicappin's own UI) barely touches the fact pattern in #151 at all. If phase 2's vetted-partner API is *also* scoped write-only by default, the "louder version of the same fact pattern" open question mostly dissolves. This reframe should be stated as a design principle now, because it changes what "avoid productizing the unofficial index" costs: nearly nothing.

### 4. Cheap option-value checks left on the floor

- **Supabase OAuth 2.1 server (beta)** is flagged as "maturity unverified" in the prior assessment and then never verified. If it matures, phase-2 credential issuance is nearly free config, which weakens the "OAuth is weeks of work" cost claim behind deferral — the deferral is still right on demand grounds, but the trigger threshold should be re-priced. One hour of verification, do it.
- **MCP as the eventual long-tail shape.** By the time any trigger fires (2027+?), the long tail of "developers" may be agents, and the cheap platform surface may be an MCP server over the same extracted package — not REST keys + portal. Phase-2 planning language should say "vetted partner *credentials*" without hard-coding REST/portal assumptions. (Also a fits-the-wedge point: "the developer-friendly vendor" in 2027 plausibly means "the one with an MCP server," which nobody in golf will have.)
- **The demand-instrumentation open question is the best idea in the file** — promote it from open question to committed action. A PostHog-tracked "API access" interest form is the only thing in this whole topic that converts argument-from-absence into data.

## Where I agree

- Deferring OAuth issuance, portal, self-serve keys, and public docs is correct; the three-trigger framing is good.
- Option D (vetted-partner, manual credentials) as the declared phase-2 shape matches the observed market exactly.
- The federation-rails play (NGF Leverandør) as the real platform prize is the right strategic center of gravity; nothing above disturbs it.

## Must address before locking

1. Explicitly evaluate the null-surface v1 (shared private package over the existing Bearer tRPC path, native-app style) against Option B — decide REST-for-one deliberately, not by default.
2. Adopt write-only-by-default (score-in, no handicap-out) as a stated API design principle; it collapses most of the governance exposure the recommendation is hedging against.
3. Verify Supabase OAuth 2.1 server maturity (one hour) so the phase-2 cost side of the deferral is priced on facts.
4. Price the deep-link/share-sheet handoff for the fitness-app use case before committing to any server-side v1 — it may make the whole question moot for consumer #1, and it dodges the unresolved Cloudflare challenge blocker.
