# Black Hat review — public-contract-shape

**Verdict: MIXED.** Option A is the least-bad option relative to B and C (both of which the research correctly demolishes), but the recommendation as written understates its real scope, papers over its sharpest failure modes, and front-loads platform-grade commitments that a solo dev with one first-party consumer should not sign yet.

## 1. "Two thin adapters over one shared core" is the optimistic story, not the guaranteed one

The claim that the maintenance-doubling fear "collapses" assumes the extraction of `submitScorecard` (round.ts:303, inside a 1,117-line router) is clean and that both adapters stay behaviorally identical. But that pipeline is the money path: billing/plan gating, pending course auto-creation, transactional handicap recalculation. The realistic failure mode is not doubled typing effort — it is **silent behavioral drift**: rate limiting applied on one surface and not the other, billing gates checked in the tRPC middleware chain but forgotten in the REST handler, a bug fixed in one adapter's pre-validation and not the other's. Nothing in the recommendation names contract/parity tests between the two surfaces. Without them, "one shared core" degrades into two mediums-thick layers within a year.

Also unmentioned: the wire formats genuinely differ. tRPC + superjson serializes `Date` as Date; the REST surface serializes ISO strings. The "same zod schemas" cannot literally be shared for outputs — there will be a REST-flavored variant of every output schema, which is exactly the duplication the summary claims collapses.

## 2. The riskiest work is a refactor of the most fragile code, and it's waved through as a prerequisite

Extracting a ~700-line inline transactional pipeline is the actual project; the 4–6 handlers are the trivial part. This codebase's recent history is the warning: the shot-level-stats deploy 500'd every submission because of a phantom migration row; Ballerud shipped bad ratings that corrupted computed values. `submitScorecard` touches handicap recalculation — the product's core correctness claim. Refactoring it without a characterization-test harness first (golden-round fixtures: submit → expected handicap index) risks a regression that no type system catches, discovered by users' handicaps drifting. The research treats extraction as "pays off anyway"; Black Hat treats it as the single highest-risk step and it has no test strategy attached.

## 3. POST /rounds without idempotency is a data-corruption feature

Nowhere in the summary, options, or ops package does the word *idempotency* appear for the API itself. A fitness app on a phone will retry on timeout — and mobile networks time out constantly. Duplicate round submissions don't just create duplicate rows; they **corrupt the handicap calculation** (each round feeds the recalc). The Stripe-webhook convention in this repo already knows this (dedupe by event ID). A partner-facing POST that mutates handicap state needs an `Idempotency-Key` (or client-generated round UUID with a unique constraint) in v1, not v1.1 — retrofitting idempotency onto a published contract is itself a breaking change. This is a must-fix omission.

## 4. The ops package signs platform-grade promises before there is a platform

A written 12-month deprecation policy, append-only error codes, RFC 9745/8594 headers, hosted spec + changelog — for an API whose only consumer is the same person's other app. Two risks:

- **Premature contract freeze.** The domain is still moving fast (shot-level stats merged four days ago; course data model still being repaired). Whatever shape `POST /rounds` has today is a guess; freezing it under a 12-month deprecation promise means either breaking the promise (reputational cost when third parties do arrive) or dragging wrong shapes for a year. The `/v1` path is fine; the *public written policy* should not be published until a genuine third party is onboarding. While the only consumer is first-party, the "deprecation policy" can be a git tag.
- **Solo-dev sustainability.** Every RFC-numbered commitment is unpaid recurring work. The minimum package is described as "minimum," but it is the maximum a solo dev should even consider, and half of it (Sunset headers, changelog site) is ceremony with zero consumers who read it.

## 5. The Cloudflare bypass is a security trade, not a checkbox

The day-0 bypass rule for `/api/v1/*` **removes the bot-challenge shield from the exact endpoints that mutate billing-gated state**, on a stack where the free tier is enforced per-round. Once bypassed: credential-stuffing against bearer auth, scripted round spam to probe billing gates, scraping of `GET /courses/search`. Upstash rate limiting exists in the repo but the recommendation never requires it on the new surface. Worse, the bypass lives in a dashboard — unversioned, invisible to code review, and (per this repo's own memory) the challenge config has already broken prod clients once without anyone noticing until runtime. A dashboard rule is a single silent point of failure for the whole platform; at minimum it needs a synthetic external health check (`GET /api/v1/health` from outside, no cookies) so bypass regressions page someone instead of surfacing as a partner's "Unexpected token '<'".

## 6. Documented auth semantics are being built on an unresolved sibling decision

The contract's `Authorization` section depends on the open auth-issuance question, yet the plan ships a documented spec now. If v1 documents "send your raw Supabase access token" — a short-TTL, full-account-scope credential with a refresh-flow burden pushed onto every consumer — that becomes the thing third parties integrate against, and migrating them to API keys/OAuth later is a second breaking migration (the exact two-migrations cost the research uses to kill Option C). Either the auth decision lands first, or v1's auth section must be explicitly marked provisional.

## 7. Smaller traps

- **Spec drift**: hand-assembled OpenAPI has no forcing function keeping it truthful. Without a CI check that regenerates the spec from the handler schemas and diffs it, the docs will lie within months — worse than no docs for a partner API.
- **Error-code leakage**: shared services will throw `TRPCError`s; without one central TRPCError→problem+json mapper, internal error strings leak into the "closed append-only" code set from day one, and closing the set later is breaking.
- **`app/api/` convention erosion**: the rule "route handlers only for what tRPC can't serve" survives this addition, but v1 creates gravitational pull — every future feature will ask "tRPC, REST, or both?" Team discipline is the only guardrail, and it's a team of one.

## Bottom line

Option A over B and C: agreed — the arguments against B (contract coupled to internals, bus-factor fork at a major boundary) and C (refuted by the repo's own native-app evidence) are sound and I won't relitigate them. But the recommendation as packaged is riskier than its "confidence: high" suggests: it underweights the extraction risk, omits idempotency entirely, trades away the bot shield without compensating controls, and volunteers year-long public promises on a contract shaped before the auth model is decided. Ship the skeleton, not the platform: extract-with-characterization-tests, one or two endpoints, idempotent POST, rate-limited, provisional auth note — and keep the RFC ceremony in a drawer until a stranger integrates.
