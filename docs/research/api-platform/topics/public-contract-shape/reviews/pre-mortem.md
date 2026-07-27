# Pre-Mortem Review — public-contract-shape

**Perspective:** It is January 2027. The integration shipped in August 2026 and has badly underdelivered. This is the retrospective.

**Verdict: MIXED** — the contract shape (Option A) was the right call and is not what failed. What failed was everything the recommendation demoted to bullet points and "open questions": identity, the dashboard-state bypass, extraction scope, and an ops package sized for a platform that had one consumer.

---

## The failure narrative (Jan 2027)

### 1. The integration stalled on identity, not on contract shape — for three months

The recommendation punted auth issuance to a "sibling topic" and open question. That deferral was the single most expensive line in the document. The fitness app is a *separate app* — separate bundle, plausibly a separate Supabase project. When endpoint work finished in September, we discovered the obvious-in-hindsight problem: a fitness-app user has no handicappin identity, so there was no bearer token that meant anything to `apps/web/server/api/trpc.ts`'s `supabase.auth.getUser(token)` + RLS scoping. The beautifully-specified `/api/v1` surface with RFC 9457 errors sat unreachable while we retrofitted account linking and token issuance — the part the contract research explicitly declared out of scope. A contract whose `Authorization` header semantics are TBD is not a contract; it's a wireframe. Even in the same-Supabase-project case, nobody had decided how the fitness app *gets* a handicappin session (embedded Supabase auth? OAuth? long-lived key?), and the 1-hour access-token expiry meant the first "it worked yesterday" bug report arrived within a week of beta.

### 2. The Cloudflare bypass was dashboard state, and dashboard state reverted

The recommendation correctly flagged the challenge-mode 429 as a "day-0 blocker" — and then treated a *dashboard-side configuration* as a one-time checkbox. In November, an unrelated Cloudflare change (tightening bot rules after a scraping incident on the web app) silently dropped the `/api/v1/*` bypass. Every fitness-app submission started receiving a 429 HTML "Security Checkpoint" page — the exact failure mode already logged in memory (`vercel-challenge-mode-breaks-trpc`) — and because no synthetic cookie-less canary existed, it was discovered by the only user who complained, four days later. Config that lives outside the repo, has no versioning, no test, and no monitor is not "fixed"; it is a regression on a timer. Worse, the bypass that *was* configured initially was broad, and `POST /api/v1/rounds` spent its first weeks reachable by any bot with no Upstash limiter wired to it, because rate limiting was a web-app-endpoint habit, not a v1-surface requirement.

### 3. "Thin wrappers over one shared core" was a slogan; the extraction was the project

`round.ts` is 1,117 lines; the submission pipeline is ~700 of them, interleaving user-match checks, plan/billing gating, pending-course auto-creation, and a transactional handicap recalc. The recommendation said "must be extracted regardless" as if that were a footnote. It was six weeks. Under deadline pressure, the REST handler shipped first by *copying* the gating logic instead of waiting for the extraction — and the copies drifted: a free-tier round-limit check that the tRPC path enforced was subtly bypassed on the REST path (revenue-relevant), and a pending-course edge case produced handicap indexes that differed between a round submitted from the fitness app and the identical round submitted from web. "The maintenance-doubling fear collapses to two thin adapters" is only true *after* the extraction lands with characterization tests; the recommendation never made that sequencing a hard gate, so the failure mode it dismissed is exactly the one that occurred.

### 4. The ops package was platform cosplay; the spec drifted anyway

Twelve-month deprecation policy, RFC 9745 + RFC 8594 headers, hosted changelog, closed error-code registry — for an API with one consumer, owned by the same person. That ceremony consumed roughly two weeks of the effort budget. Meanwhile the one ops item that would have mattered — CI enforcement that the hand-assembled OpenAPI 3.1 spec matches the actual handlers — wasn't in the package at all. Because Option A's spec is "assembled from the same zod schemas" as a build-your-own step, the third endpoint added in October never made it into the spec, and the error codes in the doc diverged from the ones the handlers emitted. By January the spec was the thing partner APIs fear most: documentation that lies. The deprecation headers, on the other hand, have never been sent once, because nothing has been deprecated, because there is one consumer.

---

## Preconditions that must hold to avoid this future

1. **Auth/identity is resolved BEFORE endpoint work, not in parallel.** The sibling topic (token issuance + fitness-app→handicappin account linkage + documented Authorization semantics including expiry/refresh) must produce a working end-to-end authenticated `GET /api/v1/handicap` spike before any other endpoint is designed. If the fitness app can't mint a token the API accepts, nothing else in this recommendation matters.

2. **The extraction is a gated prerequisite with characterization tests.** PR 1 is `submitScorecard` extracted to a service function with integration tests capturing current behavior (billing gating, pending-course creation, recalc), and the tRPC procedure rewired to call it. Only after that merges does any REST handler exist. No handler may contain gating/business logic — enforce by review rule. Spec-vs-handler parity gets a CI check the day the spec exists.

3. **The Cloudflare bypass is treated as monitored infrastructure, not a setup step.** Document the exact rule in-repo, add a scheduled cookie-less synthetic check against `/api/v1/health` (and the spec URL) that alerts on 429/HTML, and wire Upstash rate limiting to every `/api/v1/*` route in the same PR that creates it.

4. *(Scope corollary)* Cut the day-1 ops package to: problem+json with a small closed code set, the spec with CI parity, and a changelog file. Write the deprecation policy the day a second consumer signs up — not before.

---

## Verdict detail

Option A itself survives the pre-mortem: hand-written `/api/v1`, path versioning, plain JSON, decoupled from tRPC internals — none of the failures above trace to that choice, and Options B (fork-dependency + contract coupled to internal procedures) and C (repo evidence already refutes it) would have failed harder and earlier. What fails is the recommendation's *weighting*: it presents the genuinely dangerous items (identity, dashboard-state bypass, extraction sequencing) as bullets and open questions while spending its confidence on RFC ceremony that a one-consumer API will not exercise in its first year.
