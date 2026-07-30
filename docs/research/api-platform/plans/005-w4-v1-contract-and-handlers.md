# 005 — W4: `/v1` contract-design gate + route handlers

**Workstream:** W4 (includes Checkpoint A as Phase 0) · **Status:** PENDING · **Billing-gated:** No longer blocked — the gate is CLOSED; the billing error contract now reflects **quarantine** semantics.
**Depends on:** 001 (W0 host), 002 (W1 service), 003 (W3 schema), 004 (W2 auth + `client_id` principal).
**Blocks:** 006 (W5 sync — needs the read endpoints), 007 (W6 fitbull notes), 008 (W7 launch gates).

---

## Goal

Build the hand-written REST `/v1` surface under `apps/web/app/api/v1/`: shared zod schemas, OpenAPI 3.1 generated from them with a CI diff gate, an RFC 9457 problem+json error mapper with a closed append-only code set, and Upstash per-**principal** rate limiting per route. Each route ships **with** its rate limit, error mapping, spec parity, and canary coverage. **Phase 0 is the contract-design gate (Checkpoint A)** — the least-reversible decision in the whole plan; freeze it before writing any handler.

## Background

The contract is **hand-written REST /v1** (DECISIONS #5): shared zod schemas, OpenAPI 3.1 generated from those schemas, a CI regen-and-diff gate, RFC 9457 problem+json with a closed append-only code set, URL-path versioning. `trpc-to-openapi` (single-maintainer fork, died at the last tRPC major) and a published-tRPC-client (the repo's own native app couldn't type-import `AppRouter`) were both rejected. The surface is marked **internal/unstable** (docs + response header) until a second consumer exists; deprecation/Sunset-header machinery is deferred until a non-owned consumer exists. Route handlers carry only what tRPC can't serve (the external contract); tRPC stays the app's CRUD transport, and no business logic lives in a handler — each `POST` calls the 002 service.

Two tooling facts constrain the build. **No OpenAPI generator is installed** and zod is pinned at 4.3.6, so the spec is generated with zod 4's **native** `z.toJSONSchema` (not `@asteasolutions/zod-to-openapi`, which historically targets zod 3). Its known caveat: **refinements do not serialize** — `putts+penalties ≤ strokes-1` and similar cross-field rules won't appear in the JSON Schema, so they must be documented explicitly in the spec's prose and backed by a CI parity gate that regenerates from the schemas and fails on diff. Second, the RLS insert side door is real: a raw Bearer token can `INSERT` into `round` directly via PostgREST, skipping the service-layer gate entirely — so the API's authorization posture rests on 004's `client_id` deny-policies (external tokens) and/or a DB-level trigger, not on the handler.

The billing gate is **CLOSED**: over-limit rounds are **accepted and quarantined** (a 201 with a distinguishable status), **not** rejected with a 403. This is the single biggest change from the pre-gate master plan (which held the billing error contract and over-limit route behavior as blocked). The billing error taxonomy now distinguishes real errors (`plan_required` when the account isn't provisioned) from the non-error quarantine outcome (a successful 201 whose body marks the round excluded-until-upgrade). `round_limit_reached` is **not** a 403 for over-limit rounds — it is expressed as the quarantined status on a 201. Cross-product pricing is deferred, so no bundle/entitlement fields appear.

## Phase 0 — Contract-design gate (Checkpoint A), before any handler

Hold one design gate and commit a short frozen contract doc under `docs/` (this also satisfies golf-landscape C.15 "the internal contract doc must actually be written"). Freeze:
- **URL-path versioning** (`/api/v1/...`).
- **RFC 9457 error envelope + closed append-only code set** (internal errors cannot leak into the public taxonomy).
- **Idempotency semantics** — externalId-primary (DECISIONS #6): `UNIQUE(userId, externalId)`, replay-by-lookup; identical-body duplicate returns 200-with-existing-round (per 003's decision), 409 reserved for same-key-different-body.
- **Per-principal rate-limit keys** — `client_id` (from 004), **not** per-IP.
- **Eventual-consistency statement** — `POST` returns a provisional index + `handicapRevision:"pending"`; the returned index is provisional until the async recompute fires.
- **Quarantine status contract** — a quarantined round is a **201 with a distinguishable status field**, not an error.

## Scope (files/areas)

New tree `apps/web/app/api/v1/` (siblings of the existing `app/api/{ai,auth,billing,cron,legal,notifications,stripe,webhooks}`).

- **Shared zod:** contract request + response schemas (reuse/extend `apps/web/types/scorecard-input.ts`), one source for handlers and the OpenAPI generator.
- **Routes (day-1 surface):**
  - `POST /v1/rounds` — externalId idempotency (replay-by-lookup), synchronous **201** with provisional index + `handicapRevision:"pending"`, server-derived `hcpStrokes`/`approvalStatus`, strict validation, machine-readable **422**s. Calls the 002 service with `overLimitPolicy:"quarantine"`. **No business logic in the handler.** Over-limit → 201 with `quarantined` status (not 403).
  - `GET /v1/courses` + `GET /v1/tees` (or a search-resolve endpoint) — required so catalog-referencing writes can obtain a `teeId`. In scope regardless of catalog-miss handling.
  - `POST /v1/courses` (course-submission) — rate-limited, mirrors the web pending-course flow + moderation queue (DECISIONS #6 catalog-miss resolution). **Fix the name-only matching bug** (`round.ts:370` vs the `(name,country,city)` unique index) first.
  - `GET /v1/profile`, `GET /v1/rounds` — reads for the sync contract (006). `GET /v1/profile` must resolve the billing-column-exposure decision (006) — strip/segregate plan/rounds_used/subscription_status or explicitly accept.
  - `POST /v1/profile/provision` — auth-independent provisioning fallback (004); enforces the locked provisioning invariant (explicit, idempotent, `plan_selected='free'`, billing_version bump, PLAN_SELECTED event; never silent null→free).
  - `GET /v1/health` — cheap liveness for the canary.
- **Error mapper:** one central `domain-error / TRPCError → RFC 9457 problem+json` mapper, closed append-only code set; internal errors cannot leak into the public taxonomy. Billing codes: `plan_required` (not provisioned) is a real error; the over-limit outcome is **not** an error (201 + quarantined status).
- **OpenAPI 3.1:** generate from the shared zod schemas via zod 4's native `z.toJSONSchema`. **Verify what refinements emit** — cross-field rules (`putts+penalties ≤ strokes-1`) do **not** serialize; document those rules explicitly in the spec prose.
- **CI parity gate:** regenerate the spec from schemas in CI, fail on diff (add a `pnpm` script + workflow).
- **Rate limiting:** extend `apps/web/lib/rate-limit.ts` with per-**principal** windows (`client_id` as the key), one per route, fail-closed on the public path (from 001). One Vercel WAF rate-rule as a 429 backstop (OWNER, 001).
- **Auth gate:** accept `client_id` tokens only here; reject in tRPC (004).
- **API-side invariant enforcement:** `strokes >= 1`, `putts+penalties <= strokes-1`, teeTime sanity window — enforced **for API submissions only**. Do **not** promote into the shared zod schema (scorecard Q3 is split out).

## Step-by-step

1. Phase 0: run the contract-design gate; commit the frozen contract doc under `docs/`.
2. Scaffold `app/api/v1/`; add the shared zod request/response schemas (reuse `scorecard-input.ts`).
3. Build the central RFC 9457 error mapper with the closed code set; unit-test it.
4. `GET /v1/health` first (canary target). Then `GET /v1/courses`/`GET /v1/tees`, `GET /v1/profile`, `GET /v1/rounds`.
5. Fix the `round.ts:370` name-only matching bug, then build `POST /v1/courses` mirroring the pending-course + moderation flow.
6. Build `POST /v1/rounds` against the 002 service with `overLimitPolicy:"quarantine"`; externalId replay-by-lookup; 201 provisional-index contract; over-limit → 201 + quarantined status.
7. Build `POST /v1/profile/provision` enforcing the provisioning invariant.
8. Wire per-principal Upstash rate limiting into each route's PR; confirm fail-closed on the public path.
9. Add the OpenAPI generator (`z.toJSONSchema`) + CI parity job; document non-serializing refinements in prose.
10. Extend the canary to cover `/v1/health` + a Bearer `POST /rounds` smoke.
11. Add the ESLint check that handlers don't import `server/api/routers/**` (from 002's boundary rule).

## Binding conditions (verbatim)

From **public-contract-shape** conditions:

> 7. **Idempotency on POST /rounds from day one** (Idempotency-Key with response replay, or client round UUID + unique constraint, designed into the service seam). Mobile retries that double-create rounds corrupt the handicap — the product's core artifact — and retrofitting idempotency onto a published contract is itself a breaking change.
> 8. **Upstash rate limiting on every `/api/v1/*` route**, wired in the same PR that creates the route. The challenge bypass removes the bot shield from exactly the endpoints that mutate billing-gated state.
> 9. **One central error mapper** (TRPCError/service errors → RFC 9457 problem+json) with a small, closed, append-only code set, so internal errors cannot leak into the public taxonomy.
> 10. **CI spec parity gate:** the OpenAPI spec is regenerated from the handlers' zod schemas and CI fails on diff. Hand-assembled specs drift into lying docs. Also verify what zod 4 `z.toJSONSchema` actually emits for `scorecardSchema` — refinements (e.g. putts+penalties ≤ strokes−1) do not serialize, so document those rules explicitly rather than promising the spec captures them.
> 11. **Keep the structural parts:** `/v1` path versioning, problem+json envelope, stable append-only error codes, a changelog file, the CI-parity spec.
> 12. **Defer the ceremony:** the written 12-month deprecation policy and RFC 9745/8594 Deprecation/Sunset header machinery wait until a consumer the developer does not own exists.

From **scorecard-write-semantics §1 and §2 sub-decisions:**

> ### (b) Sync vs async — DECIDED, unanimous
> Synchronous **201** from `POST /v1/rounds`. No 202/polling resource. ... return the provisional index and `handicapRevision: "pending"`, and the docs must state the returned index is provisional.

> **Sub-decision riding on Q1:** the public **course/tee search-resolve read endpoint** must be in v1 scope regardless of the answer — catalog-referencing writes are unusable without a way to obtain a `teeId`.

> - **No auto-create of pending courses/tees from the API path.** The amplification cost (N pending tees + 18 holes + admin email per bad submission) and the name-only matching bug (round.ts:370 vs the (name,country,city) unique index) make this unanimous.
> - **Server-derived `hcpStrokes` and `approvalStatus`** at the API boundary.
> - **Machine-readable 422 error codes**, teeTime sanity window, `strokes >= 1` and `putts+penalties <= strokes-1` enforced server-side *for API submissions*.

From **DECISIONS #6** (catalog miss + idempotency) and **§Billing gate — CLOSED**:

> **Catalog miss: course-submission endpoint ships in v1** (rate-limited, mirrors the web pending-course flow + moderation queue). Not catalog-only 422; not manual-round quarantine.
> **Idempotency: externalId-primary** — `UNIQUE(userId, externalId)`, replay-by-lookup; `Idempotency-Key` header addable later non-breaking.
> The RFC 9457 billing error contract and provisioning flow ... must reflect quarantine semantics (a quarantined round is a 201 with a distinguishable status, not an error).

From **billing-and-metering** conditions #1, #6, #7 (error contract + provisioning + instrumentation):

> 1. **RLS insert side door is a shipping gate, not a follow-up.** ... Close it (or consciously accept it in writing) **before any token-bearing second app goes live.** Green's framing: a DB-level check (BEFORE INSERT trigger or security-definer path) closes the side door AND can replace the manual race-rollback with one enforcement mechanism.
> 6. **Provisioning must ship in the same milestone as the endpoint**, keyed to the auth-topic decision, with an auth-decision-independent fallback pinned now (e.g. an explicit `POST /v1/profile/provision`).
> 7. **Server-side warning channel + day-one instrumentation.** ... Instrument `plan_required` / `round_limit_reached` error rates from day one.

From **hosting-stack-decision §C.9**:

> 9. **State eventual consistency explicitly in the API contract**: POST returns 200 while the handicap is stale until pg_cron fires. Add queue-lag/failure alerting.

**Correction note:** the "POST returns 200" wording above is the research quote, not the contract. The LOCKED contract (DECISIONS #6 + billing-gate closure, 2026-07-27) is a synchronous **201** from `POST /rounds` — with a **distinguishable status** for the over-limit quarantine outcome (201 + quarantined status, never a 403). Only the eventual-consistency point (provisional index, queue-lag/failure alerting) carries over from this quote.

## Non-goals

- Deprecation/Sunset header machinery, a developer portal, self-serve keys, public docs — deferred until a non-owned consumer exists.
- Promoting invariants into the shared zod schema / flipping web to server-derived `hcpStrokes` (scorecard Q3 web-hardening cutover — separate gate).
- A 202/polling submission resource — the write is synchronous 201.
- Auto-creating pending courses/tees from the round path — course submission is its own endpoint.
- A 403 over-limit response — over-limit is a 201 with quarantined status (closed gate).
- The webhook / queue-kick (006), fitbull notes (007), governance/demand instrumentation (008).

## Definition of done

- Phase 0 frozen contract doc committed under `docs/`.
- Day-1 routes live behind `api.handicappin.com`, each with rate limit + error mapping + spec entry + canary.
- OpenAPI 3.1 generated from schemas via `z.toJSONSchema`; CI diff gate green; non-serializing refinements documented in prose.
- `POST /rounds` idempotent (replay returns the same round); 201 provisional-index contract honored; over-limit → 201 + quarantined status (never 403).
- `POST /v1/courses` name-matching bug fixed; provisioning endpoint enforces the invariant.
- Surface marked internal/unstable (docs + response header).

## Verification commands

```bash
pnpm test:integration   # per route: idempotency replay, 422 taxonomy, RLS scoping, over-limit → 201 quarantined
pnpm test:unit          # error mapper closed code set
pnpm lint               # import boundary: handlers don't import server/api/routers/**
# plus the new CI spec-parity job: regenerate OpenAPI from schemas → diff → fail on drift
```

Canary covers `/v1/health` + a Bearer `POST /rounds` smoke.
