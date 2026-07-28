# API Platform Research Topics

Final consolidated topic list for the "expose the backend to other apps" initiative.
First consumer: the same-developer fitness app (scorecard -> handicappin profile).
Long-term ambition: a genuine third-party API platform.

Each topic is a self-contained decision question. Ordered by importance.

---

## 1. hosting-stack-decision — Can the current stack host the public API, or does it force a separate service?

**Question:** Can Next.js route handlers on Vercel (the current stack: Next.js 16 + tRPC + Drizzle + Supabase) credibly host the public API long-term — considering serverless timeout limits vs the transactional handicap-recalc write, cold starts, connection pooling to Supabase Postgres, and per-route runtime config — or should the API be a thin separate service (e.g. Hono/Fastify consuming extracted workspace packages) from day one? Where must the ~700-line `submitScorecard` pipeline (`apps/web/server/api/routers/round.ts:303`) be extracted (a workspace package like `handicap-core`/`billing-core`, vs `apps/web/server/services/`) to keep the later-split option open, and what is the concrete trigger list for "stay in Next.js until X happens"?

**Rationale:** This directly answers the owner's open question ("does this require changing the tech stack?"). The repo already migrates domain logic into workspace packages, so a later split can be a re-hosting exercise rather than a rewrite — but only if the scorecard extraction lands as a package rather than app-internal services. Research should quantify the real constraints (Vercel function limits on the current plan, Drizzle/Supabase pooling under serverless, whether the submit transaction fits the timeout envelope with margin) and produce a defensible trigger list instead of a vibes-based architecture call.

---

## 2. external-auth-model — How does another app obtain credentials for a handicappin user?

**Question:** How should the fitness app (v1, same developer) obtain a token that satisfies the existing Bearer path in `apps/web/server/api/trpc.ts` with correct RLS scoping — and which issuance model gets v1 shipped fastest without dead-ending the third-party ambition: (a) the fitness app authenticating against the SAME Supabase project so its session tokens just work, (b) Supabase's OAuth 2.1 authorization server (beta ~mid-2025 — is it production-ready as of July 2026: custom scopes, consent screen, refresh/revocation, tokens that flow through RLS like current access tokens?), or (c) a custom Drizzle-backed PAT/API-key table (optionally via Unkey or better-auth) with a token-exchange layer? What auth model do comparable activity-write APIs (Strava, Garmin Health, Whoop, Terra) treat as table stakes for third parties, and does a raw Supabase token — which grants the user's FULL RLS surface including billing and profile data — need scoping (e.g. "submit rounds only") even for v1?

**Rationale:** The single biggest design fork. The Bearer plumbing already validates Supabase access tokens and builds an RLS-scoped client, so a shared-project approach could mean near-zero auth work for v1 — but it hands any consumer the user's entire account, with no per-app scoping or revocation. Whether the future OAuth/key layer can mint tokens that preserve free RLS scoping — versus forcing a service-role client plus hand-rolled authorization — decides whether the platform path is a config change or a multi-week parallel auth build. Prior art from fitness APIs calibrates what phase 1 can get away with and what phase 2 must provide, and settles the migration path from model (a) to (b)/(c).

---

## 3. api-ingress-and-abuse — Getting past the Cloudflare/Vercel challenge wall, and what replaces it

**Question:** Given production serves a 429 "Security Checkpoint" HTML challenge to all cookie-less requests (Cloudflare orange-cloud in front of Vercel challenge mode — the documented prod gotcha), what is the reliable edge configuration that lets non-browser API clients through: Vercel challenge-mode bypass rules scoped to `/api/v1/*`, a dedicated `api.handicappin.com` hostname with its own Cloudflare/Vercel rules (or that skips proxying entirely), or something else? And what replaces the browser challenge as the abuse layer on the exempted path — Upstash per-user/per-key limits (`apps/web/lib/rate-limit.ts`), Cloudflare rate-limit/WAF rules, or both?

**Rationale:** A hard blocker, not a nice-to-have: no external client can call production today regardless of auth or contract quality, and the fix is dashboard/DNS-side, so it must be researched and decided, not discovered during implementation. The hostname choice is semi-permanent (baked into consumer configs, CORS, rate-limit key design, future docs), and a too-loose bypass reopens the bot-protection hole challenge mode was solving. If carving a clean hole in the current edge setup proves fragile, that finding feeds topic 1 as the strongest real argument for a separate API deployment — but this topic stands alone as empirical platform research on what Cloudflare/Vercel bypass primitives actually offer in 2026.

---

## 4. public-contract-shape — Versioned REST handlers vs tRPC-derived OpenAPI vs publishing the tRPC client

**Question:** What should the external contract surface be — hand-written versioned REST route handlers under `app/api/v1/` with zod schemas and an OpenAPI spec, an OpenAPI surface auto-derived from tRPC procedures (is `trpc-to-openapi`, the fork of the abandoned `trpc-openapi`, actually maintained and compatible with tRPC v11 + superjson?), or publishing a typed tRPC client package to the fitness app while both apps are the same developer? What versioning style have comparable partner APIs converged on (`/v1` path vs Stripe-style date versioning), and what minimum operational package (deprecation policy, stable error taxonomy, docs) must accompany whichever surface we pick?

**Rationale:** The tRPC layer is explicitly internal-only (superjson encoding, no versioning, monorepo-shared types) and cannot be consumed externally as-is; the coding conventions reserve `app/api/` route handlers for exactly what tRPC can't serve. Hand-maintaining a parallel REST surface doubles the contract-maintenance burden, while tRPC-to-OpenAPI generators have a history of lagging tRPC major versions. The answer determines how much of the eventual platform (docs, SDKs, versioning) comes for free vs must be built, and whether the v1 fitness-app integration and the long-term third-party API are one surface or two.

---

## 5. scorecard-write-semantics — Idempotency, validation strictness, and integrity for externally submitted scorecards

**Question:** What semantics does the public round-submission endpoint commit to: (a) idempotency — Stripe-style `Idempotency-Key` header with a persisted key table vs natural-key dedupe on user+course+teeTime, and which state store (Postgres table inside the existing transaction boundary vs Upstash), given external clients retry over flaky mobile networks and the pipeline currently has zero dedupe; (b) sync vs 202-accepted async processing for the transactional handicap recalc; (c) validation strictness relative to the trusted web client — should API consumers be allowed to trigger auto-creation of pending courses/tees, which WHS invariants (hole counts, stroke-index sanity, putts+penalties ≤ strokes−1, CR/slope plausibility) are enforced server-side, and do bad submissions get rejected, quarantined as "unverified rounds" excluded from the handicap calc, or accepted with flagging? How do Strava/Garmin/Terra-style upload endpoints handle the same three problems?

**Rationale:** Handicap correctness is the product promise. A duplicated round or one garbage submission from a buggy external client silently corrupts a user's index via the transactional recalculation — a correctness hazard, not a UX wart. The web UI's invariants (quick-picks, the putts rule from PR #161) are UX-level and bypassed entirely by an API caller, and the auto-create-pending-course path lets an external app pollute a courses table that was just painstakingly cleaned (207 validated courses). These are contract-level promises consumers build against, far cheaper to get right before the first consumer ships.

---

## 6. billing-and-metering — Plan gating and attribution for API-submitted rounds

**Question:** How should plan gating apply to API-submitted rounds: do they count against `FREE_TIER_ROUND_LIMIT` identically to web/native rounds; what happens to fitness-app users who never completed handicappin onboarding (`submitScorecard` currently throws "Please select a plan", `round.ts:334-341`) and who would see a FORBIDDEN error inside a different product with no upgrade path; and do we need per-consumer attribution (which app submitted the round — a source/app_id column) for future API pricing or abuse forensics?

**Rationale:** The current pipeline assumes every submitter went through handicappin onboarding and sees upgrade prompts in handicappin's UI — an API consumer breaks both assumptions. Deciding whether API rounds are metered per-user (status quo), per-consumer-app, or become a paid API tier changes the schema, the error contract, and whether the free-tier race-rollback logic needs touching. Getting this wrong either leaks free product through the side door or bricks the first integration on day one.

---

## 7. two-way-sync — Does v1 need eventing, and what is the cheapest credible path?

**Question:** For the fitness app to reflect state changes originating in handicappin (handicap index updated after recalc, pending course approved, round edited/deleted on web), is polling a "changes since cursor" REST endpoint sufficient for v1, or is push needed — and if push, do we build outbound webhook delivery (signing, retries, dead-lettering — via QStash/Svix or hand-rolled) or lean on Supabase Realtime subscriptions while v1 shares the Supabase project?

**Rationale:** The integration is framed one-way ("fill out scorecard, saves to handicappin"), but submission triggers a handicap recalculation whose result the fitness app almost certainly wants to display, and rounds can later be edited in handicappin. The repo has inbound webhook precedent (RevenueCat) but zero outbound delivery infrastructure, and reliable webhook delivery is the kind of scope that silently doubles a project. Research settles the freshness the fitness-app UX actually needs, Realtime's cross-app viability under the chosen auth model, Svix/QStash fit and pricing, and whether "polling now, webhooks when third parties arrive" is the honest v1 answer.

---

## 8. golf-api-landscape — Does the third-party-platform ambition survive contact with the market?

**Question:** What does the current golf-platform API landscape look like — which incumbents offer partner/public APIs and on what terms (GHIN's closed partner program, GolfBox federation lock-in, TheGrint, Golfshot, whether aggregators like Terra cover golf) — and does the gap validate a genuine third-party platform play versus keeping this a private first-party seam?

**Rationale:** The long-term ambition only justifies platform-grade investment (OAuth, developer portal, key management, docs) if the ecosystem actually lacks an open scorecard/handicap API and plausible demand exists. If incumbents are closed and aggregators skip golf, that is a differentiation opportunity worth building toward; if not, phase 1 should be deliberately minimal. This topic calibrates how much of every other topic's "platform-grade" answer to actually implement — it changes investment level, not the v1 design, so it sits last.

---

## Consolidation notes

- Merged `external-auth-token-issuance` + `auth-model-prior-art` + `supabase-oauth-server-maturity` + `auth-credential-model-and-scope` into topic 2 (same fork viewed through four lenses: issuance mechanics, prior art, Supabase maturity, scoping).
- Merged `public-api-contract-shape` + `contract-style-and-trpc-openapi-bridge` + `api-contract-and-commitment-level` into topic 4; moved its idempotency clause into topic 5 where the write-contract design lives.
- Merged `scorecard-service-seam-idempotency` + `scorecard-write-semantics` + `whs-integrity-external-scorecards` into topic 5; the seam-placement sub-question (workspace package vs `server/services/`) moved into topic 1 because placement is what keeps the later service split cheap.
- Merged `api-ingress-cloudflare-vercel` + `edge-access-and-abuse-controls` + `api-edge-topology` into topic 3; the "does this justify a separate deployment" tail feeds topic 1 but the edge research stands alone.
- Kept `billing-attribution-api-rounds`, `webhooks-two-way-sync`, and `golf-api-landscape-gap` as distinct topics — no meaningful overlap with others.
- Dropped nothing outright; every candidate's substance survives in a merged topic.
