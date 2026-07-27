# Yellow Hat review — public-contract-shape

**Perspective:** Benefits and value. **Verdict: agree** (with the recommendation for Option A: hand-written `/api/v1` REST handlers + shared zod + generated OpenAPI 3.1).

## Why this recommendation creates value beyond the immediate ask

### 1. It answers the owner's core question in the cheapest possible way: no stack change

The single most valuable finding here is what *doesn't* need to happen. Bearer auth with RLS scoping already exists (`apps/web/server/api/trpc.ts`), zod is already at every boundary, `app/api/` is already the sanctioned home for non-tRPC surfaces, and zod 4 already ships `z.toJSONSchema()`. Option A is not a platform build — it is 4–6 thin files plus a refactor the codebase wanted anyway. The avoided cost of a stack migration, a gateway product, or a separate API service is the biggest number in this whole decision, and Option A banks it.

### 2. The service extraction is a forcing function with compounding returns

Extracting `submitScorecard` (round.ts:303, ~700 lines inline) is framed as a prerequisite, but it's really the hidden prize:

- The most business-critical pipeline in the product (billing gating, pending-course creation, transactional handicap recalc) becomes **unit-testable in isolation** for the first time.
- Every future entry point — webhooks, idempotent retries, watch-app sync, batch imports, an admin backfill script — calls the same service. The "two adapters" con inverts into the architecture the repo was drifting toward anyway (the native app already treats the API as an external service).
- Once one router is decomposed this way, there's a proven pattern for the other 10 routers as they need it. The API project pays for a refactor with standalone value.

### 3. One surface, built once — the fitness app is partner zero

The best realistic outcome: the fitness integration and the third-party platform are the **same artifact**. The fitness app dogfoods the real contract — real bearer auth, real problem+json errors, real OpenAPI docs — so by the time a genuine third party shows up, the surface has months of production traffic, the docs have been debugged against a real consumer, and onboarding partner #2 is a credentials problem, not an engineering project. Options B and C both defer or entangle that; A front-loads it at nearly the same cost.

### 4. Boring at exactly the layer that must stay boring

Zero new runtime dependencies means the public contract's stability is entirely under the owner's control for years. A partner contract is the one layer where "single-maintainer fork that died at the last major boundary once already" is disqualifying and "hand-written thin handlers" is a feature. Internal tRPC can be refactored, upgraded to v12, or even replaced without a partner ever noticing — that decoupling is the option value Option B sells away.

### 5. The minimum ops package is cheap professional signaling — and agent-ready

At 4–6 endpoints, RFC 9457 errors + `/v1` + a written deprecation policy + a hosted OpenAPI 3.1 spec is maybe a day or two of work, yet it's precisely what makes a solo-dev API read as trustworthy to a prospective integrator. Second-order bonus for 2026: a clean OpenAPI 3.1 spec with plain JSON and standard errors is exactly what LLM agents and codegen tooling consume best — the spec doubles as machine-readable onboarding, and because it's generated from the *same* zod schemas the handlers parse with, docs can never silently drift from behavior.

### 6. The prior art removes versioning risk for free

WHOOP/Oura/Strava converging on path versioning means `/v1` isn't a bet — it's the domain norm the eventual partners (fitness apps!) already know how to consume. Choosing the boring convergent answer here eliminates a whole class of future migration pain at zero cost.

## Why the cost is worth it

The honest cost is "two thin layers per endpoint" and a small hand-rolled spec-assembly step. Against that: a testable core pipeline, a partner-proof contract, zero dependency risk, a reusable platform surface, and no stack change. On a 4–6 endpoint surface the sync burden is trivial and the shared zod schemas make drift loud. This is one of the rare cases where the safest option is also nearly the cheapest.

## What it unlocks later

- Third-party platform launch = auth issuance + rate-limit tiers on an already-proven surface.
- Official `@trpc/openapi` (alpha) can later document the *internal* RPC surface for the native app — the two tools end up complementary, not competing.
- The service layer is the seam where idempotency keys, audit logging, and usage metering attach when the platform gets real.

## Enablers that must land for the value to materialize

1. **Cloudflare/Vercel challenge bypass for `/api/v1/*` on day 0** — every benefit above is worth zero while prod 429s cookie-less clients. This is the one true blocker.
2. Confirm the fitness app's launch endpoint list (write-only vs read+write) so v1 ships complete enough to dogfood the read paths too.
3. The auth-issuance sibling topic must resolve before the spec's `Authorization` section can be written — don't let the docs ship with "TBD" auth semantics.
