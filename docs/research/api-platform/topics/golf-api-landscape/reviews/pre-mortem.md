# Pre-mortem review — golf-api-landscape

- **Perspective:** Pre-mortem (it is January 2027; the integration effort failed or badly underdelivered)
- **Reviewing:** Recommendation = Option B now (minimal v1 with platform-shaped seams), Option D declared as phase 2
- **Verdict:** MIXED — the strategic direction (B+D, defer distribution) survives the pre-mortem, but three of the four failure narratives below run straight through gaps the recommendation glosses over. As written, it fails; with the preconditions locked, it holds.

---

## January 2027: what actually went wrong

### Failure narrative 1 — the seam shipped but never worked in production (most likely)

The fitness app integrated against `/api/v1` in staging, everything green. In production, every cookie-less request hit the Cloudflare/Vercel "Security Checkpoint" 429 HTML challenge — the exact gotcha already documented in memory (`vercel-challenge-mode-breaks-trpc`). The recommendation *mentions the ecosystem* at length and never once assigns ownership of this known, dashboard-side, non-code blocker. Because it's "not code," no engineering task tracked it; the fix required Vercel dashboard bypass rules plus Cloudflare WAF exceptions, got done half-right, and regressed silently when challenge mode was re-tightened after a bot wave in October. The fitness app's scorecard saves failed intermittently for weeks with `Unexpected token '<'` errors. The developer (also the owner) lost faith in the seam and reverted to manual entry. The entire landscape research was moot: the integration died on infrastructure the research already knew about.

### Failure narrative 2 — "days not weeks" was fiction; extraction became the project

Option B's cost estimate rests on extracting a ~700-line `submitScorecard` (`apps/web/server/api/routers/round.ts:303`) that entangles user-match checks, Stripe plan gating, auto-created pending courses/tees, and a transactional handicap recalculation. The extraction into a workspace package touched billing, RLS assumptions baked into the Supabase client construction, and the native app's call path. It took five weeks, not days. Halfway through, an urgent NGF deadline (the actual strategic prize, per this very research) pulled attention away, leaving the codebase with THREE submission paths: the old tRPC inline one (still live for web), a half-extracted package (used by REST), and drift between them. In December a handicap discrepancy between the fitness app and the web app surfaced — same round, different index — because a putts/penalty validation rule was fixed in one path only. Worst outcome available: the contract-hygiene work *created* the bug class it was meant to prevent.

### Failure narrative 3 — the triggers were unfalsifiable, so the option value rotted

The three phase-2 triggers ("NGF certification granted", "a named partner with users asks", "user base can anchor a partner program") all failed to fire — predictably. NGF had already slipped once by decision time and slipped again (the research itself flags the spec as unpublished and whether a consumer app even qualifies as a Leverandør as an OPEN question). No named partner asked because the API's existence was deliberately unpublicized — a Catch-22 the recommendation builds in: partners can't ask for what they can't see, and the demand-instrumentation idea (interest form + PostHog event) was left in "open questions" rather than made a requirement. The third trigger has no number attached, so it never evaluates true. Result: the versioning, idempotency keys, and package boundary sat unexercised by any second consumer for a year, decayed into "that API nobody uses," and when NGF certification finally landed in Q2 2027, the official-rails integration needed federation-shaped semantics (official score submission, WHS interop records) that the unofficial-index-shaped `/api/v1` didn't anticipate. The "preserved option value" was largely the wrong option.

### Failure narrative 4 — the "private seam has no governance exposure" assumption cracked

Option A/B's claimed pro — "no governance exposure, no third party ever touches the unofficial index" — quietly conflates *API privacy* with *market invisibility*. The fitness app is a separate, publicly listed app that now displays a WHS-method handicap number sourced from handicappin. In the middle of the live USGA correspondence (#151, which already demanded the estimator's removal from the US market), the USGA's next email noted the *second* app surfacing the index. The private seam didn't enlarge the API surface, but it enlarged the *product* surface of exactly the fact pattern under negotiation — and nobody had checked whether the fitness app would ship in the US App Store before wiring it up.

---

## What the research got right (why this isn't a "disagree")

The landscape analysis itself is the strongest part and survives the pre-mortem untouched: the gap really is structurally caused (governed IP + partner-deal economics + aggregator pass), Option C really would have been the catastrophic branch (weeks of OAuth/portal work, zero consumers, and a self-inflicted wound to the #147/#151 negotiations), and D is genuinely how the whole industry works. The failure modes above are not "the market read was wrong" — they are "the recommendation stops at strategy and hand-waves execution and falsifiability."

---

## Preconditions that must hold to avoid this future

1. **The Cloudflare/Vercel challenge bypass is a named launch blocker with a production smoke test.** Before any fitness-app code is written: bypass rule configured for `/api/v1/*` (or a dedicated hostname), verified by an automated cookie-less request from outside the browser context, and monitored (Sentry alert on 429-HTML responses) so a dashboard-side regression is caught in hours, not weeks. Non-code does not mean non-owned.
2. **The extraction is timeboxed with a declared fallback, and dual paths are forbidden.** Set a hard budget (e.g., one week). If `submitScorecard` extraction exceeds it, ship Option A's thin wrapper *calling the tRPC procedure server-side* and document the seam — do not leave two live submission code paths. Whatever ships, web, native, and REST must converge on ONE pipeline before the fitness app goes live, with an integration test asserting identical handicap output across entry points.
3. **Triggers get dates, numbers, and instrumentation — or they're not triggers.** Promote the "API access interest form + PostHog event" from open-question to requirement of this cycle. Attach a review date (e.g., end of Q1 2027) at which the deferred platform work is explicitly re-funded, reshaped for the NGF official-rails contract, or killed. An undated "defer until trigger" is a decision to never decide.
4. **Clear the fitness app's own governance exposure before launch, not after.** One explicit check: does the fitness app surface the unofficial index in the US market, and does that change the #151 posture? Ask in the existing USGA/NGF threads if ambiguous. Ten minutes of email beats re-litigating the estimator fight with a second app on the board.

---

## Sharpest points

- The known prod 429/Cloudflare challenge is the single most probable cause of integration failure and the recommendation never assigns it an owner — the landscape research answers a strategy question while the integration dies on plumbing.
- "Days not weeks" is asserted, not estimated; a 700-line extraction entangled with billing, RLS, and transactions is exactly the kind of work that becomes the project, and a half-done extraction (two live submission paths) is worse than no extraction.
- All three phase-2 triggers are currently unfalsifiable: one has already slipped, one can't fire because the API is unpublicized by design, one has no threshold. Without dates/numbers/instrumentation, "defer until trigger" means "never."
- "Private seam = no governance exposure" conflates API privacy with market invisibility; the fitness app publicly surfacing the unofficial index is a louder version of the #151 fact pattern regardless of how private the API is.
