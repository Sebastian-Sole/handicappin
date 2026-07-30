# Public contract shape: versioned REST vs tRPC-derived OpenAPI vs published tRPC client

**Topic:** `public-contract-shape` · **Date:** 2026-07-20 · **Researcher:** Claude (subagent)

**Decision question:** What should the external contract surface be for exposing handicappin's backend to other apps (first consumer: the developer's own fitness app; long-term: a genuine third-party API)?

---

## 1. Ground truth from the codebase

All paths relative to the repo root.

- **tRPC v11.10.0** (`@trpc/client`/`react-query`/`server` all pinned `11.10.0`), **superjson ^2.2.6** as the wire transformer (`apps/web/server/api/trpc.ts:194`), **zod ^4.3.6**, Next 16.1.6 (`apps/web/package.json`).
- **Bearer auth already works**: `apps/web/server/api/trpc.ts` extracts `Authorization: Bearer <supabase access token>`, validates via `supabase.auth.getUser(token)`, and builds an RLS-scoped Supabase client (`createBearerTokenSupabaseClient`, line 108). Cookie auth takes precedence (line 153). Built for the native app; reusable by any server-side contract surface.
- **11 routers, ~3,474 lines** (`apps/web/server/api/routers/`). `round.ts` is 1,117 lines; `submitScorecard` (line 303) is the full submission pipeline (user-match, billing gating, pending course/tee auto-creation, transactional handicap recalc) written inline in the router — not yet callable from a non-tRPC handler.
- **zod input schemas are already exported from routers** (e.g. `getAllByUserIdInputSchema`, `round.ts:168`) — reusable by REST handlers or by `.meta({openapi})` annotation with little duplication.
- **`app/api/` today**: `ai, auth, billing, cron, legal, notifications, stripe, trpc, webhooks` — exactly the "what tRPC can't serve" set the conventions prescribe. A public REST surface qualifies under the same rule (`.claude/rules/coding-conventions.md`).
- **The decisive in-repo precedent** — `apps/native/lib/api/client.ts` header comment: the native app **could not consume the typed `AppRouter` even inside the same monorepo** ("colliding `@/*` path aliases and strictly-isolated dependency graphs (pnpm default linker)"). It uses `createTRPCUntypedClient<AnyRouter>` + superjson and re-validates every response with zod, explicitly treating the API "as what it is from this side: an external service." The type-sharing benefit that motivates publishing a tRPC client already failed once, in the *easiest possible* configuration.
- **Prod gotcha (all options)**: Cloudflare-fronted Vercel challenge mode serves a 429 HTML checkpoint to cookie-less clients (memory: `vercel-challenge-mode-breaks-trpc`). Any external contract surface needs a dashboard-side bypass rule for its path prefix before a single request succeeds. This is an ops prerequisite, not a differentiator between options.

## 2. External evidence (checked July 2026)

### trpc-to-openapi (community fork of abandoned trpc-openapi)

- **Maintained and current**: v3.3.0 published **2026-05-22** (npm registry); recent cadence 3.1.0 (2025-10) → 3.2.0 (2026-03) → 3.3.0 (2026-05). **~239k downloads/week** (npmjs API, week of 2026-07-13). Repo `mcampa/trpc-to-openapi`, last push 2026-05-22, 287 stars.
- **Compatible with this repo**: peer deps `@trpc/server ^11.1.0`, `zod ^3.25.0 || ^4.0.0` — matches tRPC 11.10.0 + zod 4.3.6. Ships a **Next.js App Router fetch adapter** (`createOpenApiFetchHandler`) with a worked `app/` example.
- **superjson**: "Data transformers (such as superjson) are **ignored**" on the OpenAPI surface (README) — i.e. the REST endpoints emit plain JSON regardless of the tRPC transformer. Good for external clients; means Date-bearing outputs serialize as ISO strings and output schemas must say so.
- **Per-procedure cost is real**: every exposed procedure must add `.meta({openapi: {method, path}})` **and a zod `.output()` parser**; GET inputs restricted to flat primitive objects (README "Requirements"). Exposing existing procedures is not free — you write the public contract schemas either way.
- Bus-factor caveat: it is a single-maintainer fork of a package that was **abandoned exactly at a tRPC major boundary** (trpc/trpc-openapi archived, README redirects to this fork). History can repeat at tRPC v12.

### Official tRPC OpenAPI support (`@trpc/openapi`) — new since the prior assessment

- tRPC shipped **native OpenAPI 3.1 spec generation** in core: introduced ~v11.13.2, hardened in v11.16.0 (release notes; official docs page `trpc.io/docs/openapi`). Status: **alpha** ("APIs may change without notice").
- **It is spec-only and documents the RPC-shaped surface**: it generates a spec for the *existing* `/api/trpc/*` endpoints — GET inputs as `?input=<JSON>`, transformer (superjson) envelope preserved, clients expected to configure the same transformer. It does **not** produce clean REST paths or handlers.
- Verdict: excellent for documenting the internal RPC surface or generating internal clients (could one day replace native's untyped-client workaround); **unsuitable as a partner-facing contract** — partners would have to speak superjson and tRPC URL conventions, and the repo would need a tRPC upgrade from 11.10.0 first.

### Versioning prior art

- **Fitness-domain partner APIs have converged on path versioning**: WHOOP v1→v2 (path-versioned; v1 webhooks removed 2025, formal migration guide — developer.whoop.com), Oura API v2 (path), Strava API v3 (path, `/v3/` for over a decade). Garmin Health, Polar AccessLink: path-versioned.
- **Stripe-style date versioning** (account-pinned `Stripe-Version` header, backward version-transform modules — stripe.com/blog/api-versioning) is acknowledged best-in-class *for Stripe's scale*: it requires per-account version pinning, a version-transform pipeline, and SDK release machinery. Practitioner consensus (2025–26 surveys, e.g. digitalapplied.com engineering matrix, apisyouwonthate.com) is that URL-path versioning is "the safest default for public REST APIs" (CDN-cacheable, visible in logs) and date versioning only pays off with dedicated platform tooling. GitHub and Shopify use date versions; nearly everyone else at indie/partner scale uses `/v1`.
- Conclusion: for a solo-developer partner API, `/v1` path versioning + additive-only changes within a major is the defensible norm. Date versioning is over-engineering here.

### Standards for the minimum operational package

- **Errors**: RFC 9457 *Problem Details for HTTP APIs* (`application/problem+json`, obsoletes RFC 7807) — the current standard error envelope; add a stable machine-readable `code` extension member per error type.
- **Deprecation**: RFC 9745 *Deprecation HTTP header* (published **March 2025**) + RFC 8594 *Sunset* header + `Link rel="deprecation"` — the now-standard trio for signaling endpoint retirement.
- **Docs**: OpenAPI 3.1 spec as the artifact; zod 4 has native `z.toJSONSchema()`, and `zod-openapi` (already a trpc-to-openapi peer) covers the rest — a spec can be assembled from the same zod schemas the handlers validate with, no second schema language.

## 3. Options

### Option A — Hand-written versioned REST handlers (`app/api/v1/*`) + shared zod schemas + generated OpenAPI 3.1

Thin route handlers under `apps/web/app/api/v1/`, each: bearer-token auth (reusing `extractBearerToken`/`getUserFromBearerToken`/`createBearerTokenSupabaseClient` from `server/api/trpc.ts`), zod-parse the body, call an extracted service function (e.g. `submitScorecard` moved from `round.ts` into `@/server/services/`), return plain JSON; errors as RFC 9457 problem+json. OpenAPI 3.1 spec generated from the same zod schemas via `z.toJSONSchema()`/`zod-openapi`; tRPC procedures become thin wrappers over the same services.

**Pros**
- Public contract fully decoupled from internal procedure shapes — internal tRPC refactors can never break partners; the contract is exactly what you commit to, nothing more.
- Zero new runtime dependencies; zero exposure to the trpc-to-openapi bus factor or tRPC major-version transitions.
- Matches repo convention (`app/api/` = what tRPC can't serve) and every partner-API norm (plain JSON, `/v1`, problem+json).
- Forces the `submitScorecard` service extraction, which the router needs anyway for testability; the ~700-line pipeline becomes callable from both surfaces.
- One surface serves both the fitness app now and third parties later — v1 integration and platform are the same artifact.

**Cons**
- Two thin layers to keep in sync per endpoint (tRPC wrapper + REST handler) — mitigated by shared zod schemas and shared service functions, and by the tiny v1 surface (~4–6 endpoints), but it is honest ongoing cost.
- OpenAPI spec assembly is a small build-your-own step (schema registry + paths object) rather than one generator call.
- Slightly more upfront code than Option B for the same endpoints.

### Option B — tRPC-derived OpenAPI via `trpc-to-openapi` (mount `createOpenApiFetchHandler` at `app/api/v1/[[...path]]/route.ts`)

Annotate the to-be-public procedures with `.meta({openapi: {method, path: '/rounds', protect: true}})` + `.output()` schemas; the fork renders them as REST endpoints (superjson ignored → plain JSON) and generates the OpenAPI doc from the same router.

**Pros**
- Single source of truth: procedure = contract = spec; no parallel handler layer.
- Actively maintained *today* (3.3.0, 2026-05-22; 239k dl/wk) and compatible with the repo's exact tRPC 11 + zod 4 versions; App Router adapter exists.
- Fastest route to a working, documented v1 for the 4–6 needed endpoints.

**Cons**
- **Couples the public contract to internal procedure shapes**: renaming an input field or refactoring a router becomes a partner-breaking change unless you fork the procedure anyway — at which point you've rebuilt Option A inside tRPC metadata.
- Bus factor: single-maintainer fork of a package that died at the last tRPC major boundary; a tRPC v12 lag would freeze either the upgrade or the public API.
- The "free" part is small: `.output()` schemas and REST path design must be written by hand regardless; `submitScorecard` extraction is still needed for anything (idempotency, webhooks) that isn't a tRPC call.
- Error format is tRPC-shaped (its own error JSON), not problem+json, unless post-processed; versioning story (`/v1` → `/v2`) means duplicating procedures with new meta paths — same duplication as Option A but tangled into the internal router.
- Note: the official `@trpc/openapi` (alpha, spec-only, RPC-shaped paths, superjson on the wire) is **not** a substitute for a partner surface — evaluated and rejected above.

### Option C — Publish a typed tRPC client package to the fitness app (defer any public surface)

Private package (GitHub Packages) exporting `AppRouter` type + a configured superjson client; the fitness app talks to `/api/trpc` with a Supabase bearer token, exactly like the native app.

**Pros**
- Near-zero server-side work now (bearer auth + `/api/trpc` already exist; only the Cloudflare bypass rule is needed).
- End-to-end types if it worked; same developer controls both ends so breakage is "only" his own problem.

**Cons**
- **The repo already proved the typed-client premise false**: `apps/native/lib/api/client.ts` documents that `AppRouter` could not be type-imported even within the monorepo (alias collisions, isolated dep graphs) — the native app fell back to an untyped client + zod. A separately-versioned fitness repo is strictly harder; the published package would need to compile web's entire server type graph.
- Cements the internal-only contract as an external dependency: superjson wire format, no versioning, breakage discovered at fitness-app build time (or worse, runtime).
- Zero progress toward the third-party platform — that work is merely deferred, and the fitness integration would need to be redone on the real surface later (two migrations instead of one).
- Locks every future consumer into TypeScript + the tRPC client.

## 4. Recommendation

**Option A — hand-written `/api/v1` REST handlers with shared zod schemas, an extracted service layer, and a generated OpenAPI 3.1 spec. Confidence: high.**

Reasoning in one line: the only part of Option B that is genuinely free (handler rendering) is the cheap part, while the parts that are expensive either way (public schema design, `.output()` contracts, service extraction, versioning discipline) are *harder* to do well when tangled into internal routers — and Option B adds a bus-factor dependency at exactly the layer that must remain stable for years. Option C is refuted by the repo's own native-app experience.

Scope it ruthlessly: v1 = `POST /api/v1/rounds` (scorecard submission), `GET /api/v1/rounds`, `GET /api/v1/handicap` (current index), maybe `GET /api/v1/courses/search`. Prerequisite work: extract `submitScorecard` from `round.ts:303` into `@/server/services/round-submission.ts` (pays off for testing and future webhooks/idempotency regardless of contract choice).

**Versioning style**: URL path `/v1`, additive-only within the major — the convergent norm for fitness-domain partner APIs (WHOOP v2, Oura v2, Strava v3). Stripe-style date versioning requires account-pinning + version-transform infrastructure that is not justified at this scale.

**Minimum operational package to ship with v1:**
1. **Error taxonomy**: RFC 9457 `application/problem+json` with a small closed set of stable `code` values (e.g. `validation_failed`, `round_limit_reached`, `course_not_found`, `unauthorized`, `rate_limited`) — document that codes are append-only.
2. **Deprecation policy**: written commitment (e.g. 12 months notice for breaking changes; announced via changelog + RFC 9745 `Deprecation` and RFC 8594 `Sunset` headers on affected endpoints).
3. **Docs**: OpenAPI 3.1 spec generated from the handler zod schemas (zod 4 `z.toJSONSchema()` / `zod-openapi`), served at a stable URL with a rendered reference page and a changelog.
4. **Ops prerequisite (day 0)**: Cloudflare/Vercel challenge-mode bypass rule for `/api/v1/*` — without it no external client gets past the 429 HTML checkpoint.

## 5. Open questions

1. **Auth issuance** (sibling topic): the contract is auth-agnostic, but whether the fitness app sends raw Supabase access tokens vs API keys vs Supabase's OAuth 2.1 server (beta status still unverified as of this research) determines the `Authorization` semantics documented in the spec.
2. Does the official `@trpc/openapi` roadmap include clean-REST path mapping post-alpha? If it ever does, the internal-docs/external-contract calculus could be revisited — worth a check at tRPC v12.
3. Exact v1 endpoint list: does the fitness app need read endpoints (handicap index, round history) at launch, or only scorecard submission?
4. How far to take the service extraction in the first PR — full `round.ts` decomposition vs extracting only the submission pipeline.
5. Where the OpenAPI spec is served/rendered (e.g. `/api/v1/openapi.json` + a docs page) and whether the Cloudflare bypass covers it.

## Sources

- Repo: `apps/web/server/api/trpc.ts`, `apps/web/server/api/routers/round.ts`, `apps/web/package.json`, `apps/native/lib/api/client.ts`, `.claude/rules/coding-conventions.md`
- [trpc-to-openapi on GitHub (mcampa)](https://github.com/mcampa/trpc-to-openapi) — README requirements, adapters, transformer note; repo metadata via `gh api` (2026-07-20)
- npm registry `trpc-to-openapi` — v3.3.0, 2026-05-22; downloads via api.npmjs.org (239,173/week, 2026-07-13..19)
- [tRPC official OpenAPI docs (alpha)](https://trpc.io/docs/openapi) · [tRPC releases](https://github.com/trpc/trpc/releases) (v11.13.2 introduced, v11.16.0 hardened) · [archived trpc/trpc-openapi](https://github.com/trpc/trpc-openapi)
- [Stripe API versioning reference](https://docs.stripe.com/api/versioning) · [Stripe blog: APIs as infrastructure](https://stripe.com/blog/api-versioning) · [API versioning strategies 2026 matrix](https://www.digitalapplied.com/blog/api-versioning-strategies-2026-engineering-decision-matrix) · [APIs You Won't Hate: no right way](https://apisyouwonthate.com/blog/api-versioning-has-no-right-way/)
- [WHOOP v1→v2 migration guide](https://developer.whoop.com/docs/developing/v1-v2-migration/) · [WHOOP API changelog](https://developer.whoop.com/docs/api-changelog/)
- [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457) · [RFC 9745 Deprecation header](https://datatracker.ietf.org/doc/rfc9745/) (published March 2025) · RFC 8594 Sunset header
