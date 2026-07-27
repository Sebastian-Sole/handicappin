# API Platform — Master Implementation Plan

**Date:** 2026-07-22 · **Status:** Draft for splitting into subplans · **Owner:** team-lead
**Inputs:** `DECISIONS.md` (locked ADR — binding), `SYNTHESIS.md` (global), 8 topic syntheses under `topics/*/synthesis.md`.
**Repo conventions:** `.claude/rules/coding-conventions.md`, `.claude/rules/web-native-parity.md`.

> This plan translates the locked decisions into **workstreams** with explicit dependency
> edges. Each workstream is designed to be lifted into a self-contained subplan (one per
> workstream, or per phase within a workstream). Nothing here re-litigates a locked decision;
> where the ADR left a gate open (billing), the blocked work is marked and routed around.

First consumer is **fitbull** (owner's separate Convex fitness app; holds tokens server-side;
base URL is `api.handicappin.com` from its first commit). The v1 surface is Next.js route
handlers under `apps/web/app/api/v1/` — tRPC stays the app's CRUD transport; route handlers
carry only what tRPC can't serve (the external contract), per `coding-conventions.md`.

---

## 0. How the pieces lock together (read before splitting)

Three cross-cutting checkpoints govern ordering. They are not workstreams; they are gates that
several workstreams pass through.

### Checkpoint A — The contract-design gate (§C of the hosting synthesis)
Before **any** `/v1` handler is written, hold one design gate that freezes: URL-path
versioning, the RFC 9457 error envelope + closed append-only code set, idempotency semantics
(externalId-primary, per DECISIONS #6), per-**principal** (not per-IP) rate-limit keys, and the
explicit eventual-consistency statement (`handicapRevision:"pending"`). This is the
least-reversible decision in the whole plan — a consumer integrates against it. It gates W4 and
is informed by W2 (auth: `client_id` is the rate-limit principal) and W3 (migration shape).
Output: a short frozen contract doc committed under `docs/` (also satisfies golf-landscape C.15
"the internal contract doc must actually be written").

### Checkpoint B — One migration, three topics (SYNTHESIS §2.5)
A **single** migration carries four coupled changes and **cannot be written until the prod
duplicate scan runs** (against a dump, not migration history — Ballerud lesson):
1. natural-key unique index on `round` (incl. `nineHoleSection`; pinned `teeTime` semantics),
2. `externalId` with `UNIQUE(userId, externalId)` (idempotency, DECISIONS #6),
3. `submitted_via` (nullable; attribution, can never be backfilled),
4. `updated_at` on `round` (sync retrofit stays cheap).
This is workstream **W3**. It blocks the write path (W4's `POST /rounds`) and the sync
contract's convergence semantics (W5). It depends on W1 only for sequencing sanity (the
in-transaction limit check and the dedupe row must be designed as one change — scorecard C1).

### Checkpoint C — The billing gate (OPEN; owner-held)
Three coupled decisions are deliberately **not** locked (DECISIONS §Open gates): (a) over-limit
behavior (hard-reject 403 vs accept-and-quarantine), (b) free-tier shape under automatic
submissions, (c) cross-product pricing. **Do not invent any of these.** What they block and
what proceeds regardless is enumerated in §3 below.

---

## 1. Workstream catalogue

| ID | Workstream | Blocks | Depends on | Billing-gated? |
|----|------------|--------|------------|----------------|
| **W0** | Ingress incident completion + `api.handicappin.com` host | W4, W5 (need a reachable cookie-less host) | — (in flight now) | No |
| **W1** | `submitScorecard` extraction + in-transaction limit check | W4 (`POST /rounds` calls the service) | — | No (extraction/limit-check ship regardless) |
| **W2** | OAuth 2.1 spike → Connect-flow build | W4 (auth section of contract), W5 (Realtime rider) | W0 (cookie-less prod canary) | Partially (provisioning details) |
| **W3** | The bundled migration | W4 (write path), W5 (convergence) | prod duplicate scan; W1 (co-design of limit check + dedupe) | No |
| **W4** | `/v1` contract + route handlers | W6 (fitbull integrates), W7 (launch gates) | W0, W1, W2, W3, Checkpoint A | Partially (billing error-contract + over-limit route) |
| **W5** | Sync: polling contract + queue-kick + optional webhook | W6 | W3 (`updated_at`), W4 (read endpoints), W2 (Realtime rider only) | No (billing-column exposure decision only) |
| **W6** | fitbull-side integration notes | — | W2, W4, W5 (contract must exist) | No |
| **W7** | Launch gates (governance, demand instrumentation, contract doc) | prod launch | W4 | No (governance/demand independent of billing) |

---

## W0 — Ingress incident completion + `api.handicappin.com` host

**Goal.** Finish the ingress incident (DECISIONS #4) and stand up `api.handicappin.com` as a
grey-clouded (DNS-only) CNAME to the same Vercel project, so cookie-less Bearer requests reach
the origin without the Cloudflare/Vercel challenge. This is an **incident response**, executed
now, independent of the rest of the API project. Several steps are dashboard-side and
owner-executed.

**Scope.**
- Dashboard (owner): Vercel mitigation state check, plan-tier/rule-quota check, Cloudflare
  orange-cloud cause check (Step 0, three 5-min checks); remove/narrow the challenge on API
  paths with a host-scoped `handicappin.com` challenge rule prepped as instant rollback; add
  `api.handicappin.com` DNS-only CNAME.
- Repo: `apps/web/lib/rate-limit.ts` — make the public API path **fail-closed** (currently
  fails open at every level: unset `RATE_LIMIT_ENABLED`, missing KV creds, Redis init error all
  silently allow — confirmed at `rate-limit.ts:44,72,130`); fix `getIdentifier()` (`:188-207`
  prefers `x-real-ip` which is a Cloudflare edge IP behind orange-cloud). Assert rate-limit env
  at startup for the public path.
- Repo: `apps/web/proxy.ts` host guard — negative tests (absent/wrong/ported Host headers).
- Repo: an **external, non-Vercel** synthetic canary (cookie-less, asserts no
  `x-vercel-mitigated: challenge` / no HTML, pages on failure) — build once, treat as permanent
  infra (all 8 topics demand it). Document dashboard firewall state in `docs/` (firewall rules
  can't live in `vercel.json`).
- Owner: audit Stripe/RevenueCat webhook delivery logs for the whole challenge period (replay
  windows closing).

**Dependencies.** None — in flight now (coordinate with the `ingress-incident` agent).

**Definition of done.**
- Cookie-less `curl` with a valid Bearer token against `api.handicappin.com/api/trpc/*` (or a
  `/api/v1/ping` stub) returns JSON, not a 429 HTML challenge.
- Canary is live and paging; dashboard state documented in `docs/`.
- Webhook-delivery audit conclusion recorded (no silent Stripe/RevenueCat loss, or the losses
  enumerated).
- `rate-limit.ts` fails **closed** on the public path; `getIdentifier()` returns real client
  IPs post-grey-cloud.

**Verification.**
- The scheduled canary (green on cookie-less prod probe).
- `pnpm test:unit` covering the host-guard negative tests and the fail-closed rate-limit branch.
- Manual: verify the 2024 "Attack Mode overrides bypass rules" claim against current Vercel
  behavior before encoding it in the runbook (it's the runbook keystone).

---

## W1 — `submitScorecard` extraction + in-transaction limit check

**Goal.** Extract the ~700-line `submitScorecard` pipeline (`round.ts:303`) into a
framework-free service `submitScorecard(deps, input)`, with characterization tests written
**first**, an ESLint import boundary, and an **in-transaction** free-tier limit check replacing
the post-commit delete-on-race (`round.ts:949-992`). Merge-blocking precondition for all `/v1`
work (DECISIONS #2). Ships regardless of the billing gate.

**Scope (files/areas).**
- New: `apps/web/server/services/scorecard/` (`server/` currently holds only `api/` — this is a
  new sibling). `submitScorecard(deps, input)` with injected side-effects (`deps`: db handle,
  supabase client, admin-notify fn, handicap calc), typed domain errors, **zero** framework
  imports (no `next/*`, no `@/env`, no tRPC, no Sentry).
- Move logic out of `apps/web/server/api/routers/round.ts:303-~1010`; rewire the tRPC
  `submitScorecard` procedure to a thin adapter over the service **in the same PR**.
- Shared input schema already exists at `apps/web/types/scorecard-input.ts` (`scorecardSchema`,
  consumed by `round.ts` and `scorecard.ts`) — reuse it; do not fork.
- In-transaction limit check: the current plan-check at `round.ts:332-349` runs **before** the
  transaction and the re-check at `:949-992` runs **after commit** via Supabase REST with 5
  sequential non-transactional deletes. Replace with an advisory-lock or `SELECT ... FOR UPDATE`
  / serializable count **inside** `db.transaction`, so an over-limit round is never inserted
  rather than inserted-then-deleted. Co-design with W3's `externalId` dedupe row so a committed
  dedupe key can never outlive a rolled-back round (scorecard C1 — the single most-converged
  item across all topics).
- ESLint: import-boundary rule in `apps/web/eslint.config.mjs` (and/or root
  `eslint.config.mjs`) — `server/services/scorecard/**` may not import framework modules, and
  `app/api/v1/**` may not import `server/api/routers/**`.

**Dependencies.** None to start. **Co-design coupling with W3** (limit check ↔ dedupe row must
land as one design; the migration itself lands in W3).

**Definition of done.**
- Characterization tests: golden round fixtures → expected handicap index, green **before** the
  move and still green after (behavior-preserving extraction).
- tRPC `submitScorecard` is a thin adapter; no business logic remains in `round.ts`.
- Delete-on-race (`:949-992`) is gone; over-limit is rejected inside the transaction.
- ESLint import boundary is enforced (a violating import fails `pnpm lint`).

**Verification.**
- `pnpm test:unit` (characterization + limit-check race tests) and `pnpm test:integration`
  (cross-entry-point handicap-equivalence: web/native/service converge on one pipeline —
  golf-landscape A.4).
- `pnpm lint` fails on a deliberately-planted boundary-violating import.
- `pnpm test:coverage` on the new service.

> **Nuance to resolve in this workstream (see §4):** the in-transaction check closes the race
> for callers that go *through* the service. It does **not** close billing's RLS insert side
> door (a raw Bearer token can `INSERT` into `round` directly via PostgREST, never touching the
> service). Closing that requires either W2's `client_id` deny-policy (bites external tokens
> only) or a DB-level `BEFORE INSERT` trigger (bites everything). Decide the mechanism here,
> jointly with W2.

---

## W2 — OAuth 2.1 spike → Connect-flow build

**Goal.** Run the timeboxed ~2-day Supabase OAuth 2.1 (beta) spike with written pass/fail
criteria; on pass, build the Connect flow (separate identities + explicit "Connect handicappin"
moment), RLS `client_id` deny-policies, and the Custom Access Token Hook scope claim. Fallback
is Option A on the identical Bearer path — but the owner's separate-identity requirement makes B
strongly preferred; **if the spike fails, revisit rather than silently shipping A** (DECISIONS #3).

**Scope — Phase 2a, the spike (hard gate, ~2 days, staging + prod-origin probe).**
Written pass/fail criteria copied from `topics/external-auth-model/synthesis.md` §1:
- (i) `auth.getUser(<oauth access token>)` in `getUserFromBearerToken()` (`trpc.ts:63`) returns
  the user;
- (ii) `ctx.supabase` queries are RLS-scoped to that user;
- (iii) `revokeGrant` invalidates the token — measure revocation latency; verify JWKS-fallback
  silently drops revocation;
- (iv) `client_id` claim **present** on OAuth tokens **and absent** on first-party web/native
  session tokens (both hardenings depend on the second half — currently unverified);
- (v) OAuth tokens link cleanly to an **existing** `auth.users` account (A↔B path real both ways);
- (vi) adversarial: OAuth token directly against PostgREST (`<ref>.supabase.co/rest/v1` + anon
  key) and GoTrue (`/auth/v1/user`, incl. `auth.updateUser` account-takeover surface) — document
  exactly what it reaches outside tRPC;
- (vii) full mobile PKCE round-trip incl. forced concurrent refresh-rotation race;
- (viii) cookie-less prod-origin probe past the challenge → becomes the permanent canary (shared
  with W0).
Also: confirm the pinned `supabase-js` ships consent helpers (`auth.oauth.getAuthorizationDetails`
/ `approveAuthorization` / `denyAuthorization` / `revokeGrant`); verify the custom-domain
`/.well-known/oauth-authorization-server` issue for `api.handicappin.com`; sweep the Feb–Jul 2026
Supabase changelog for Phase-2 scope progress.

**Scope — Phase 2b, the build (on spike pass).**
- Fail-closed placement: external (`client_id`-bearing) tokens accepted **only** at `/api/v1`
  and **rejected in tRPC context**. Today `createTRPCContext` (`trpc.ts:141-184`) accepts any
  valid Supabase token with no `client_id` discrimination — add the rejection in the tRPC
  context, and the acceptance gate in the W4 route handlers.
- RLS `client_id` deny-policies on **billing/profile** tables (deny writes when
  `auth.jwt()->>'client_id' IS NOT NULL`) — **mandatory** (tRPC allowlist is not a security
  boundary; the token works directly against PostgREST/GoTrue). Migration under `supabase/`.
- Custom Access Token Hook: stamp a forward-compatible scope claim (e.g. `rounds:write`) from
  day one so enforcement points don't move when Supabase Phase-2 scopes ship.
- Connect flow UI (consent page). **Settle its parity status now** (`INTENTIONAL.webOnly` in
  `scripts/parity/routes.mjs` vs a native twin) or `pnpm parity:routes` blocks mid-build.
- Sign-up-inside-authorization for fitbull users with no handicappin account, **or** accept in
  writing that v1 serves only the overlap audience.

**Dependencies.** W0 (cookie-less prod canary for criterion viii).

**Definition of done.**
- Spike: a written pass/fail record committed under `topics/external-auth-model/` (or `docs/`),
  every criterion (i)–(viii) marked; beta exit criteria (pricing ceiling, breaking-change
  budget, GA-slip date) written down.
- On pass: external tokens accepted at `/api/v1`, rejected in tRPC; `client_id` deny-policies
  live on billing/profile; scope claim stamped; Connect flow reachable; parity gate green.

**Verification.**
- `pnpm test:integration` for the adversarial PostgREST/GoTrue probes (assert deny-policies bite).
- `pnpm parity:routes` green (consent page classified).
- Manual mobile PKCE round-trip from a real device build.
- Permanent canary (shared with W0) asserts cookie-less external token still reaches origin.

> **Billing coupling:** the *provisioning attachment point* (where explicit idempotent
> provisioning attaches — profile row + `plan_selected='free'` + billing_version bump +
> PLAN_SELECTED event, never a silent null→free) is decided here jointly with billing gate (c).
> The **auth-independent fallback is pinned now**: `POST /v1/profile/provision`. The provisioning
> *invariant* is locked; the *mechanism* rides the billing gate — see §3.

---

## W3 — The bundled migration

**Goal.** Write the single migration carrying natural-key unique index + `externalId` UNIQUE +
`submitted_via` + `updated_at` (DECISIONS #9, Checkpoint B). **Prod duplicate scan first.**

**Scope (files/areas).**
- Pre-work (blocking): scan a **prod dump** (session pooler per IPv6 gotcha; not migration
  history — Ballerud lesson) for existing natural-key collisions. The same query resolves
  `(userId, teeTime)` vs `(userId, teeId, teeTime, nineHoleSection)` with data.
- `apps/web/db/schema.ts` (`round` table, `:231-311`): the table currently has **zero unique
  constraints**, no `updatedAt`, no `externalId`, no `submitted_via`; `teeTime` is a bare
  `timestamp().notNull()` (no tz — **pin the semantics**: browser wall-clock rounded to minute
  on web vs date-only midnight from fitbull historical backfill → size the natural key/window so
  legitimate same-day rounds don't false-409).
  - Add natural-key unique index incl. `nineHoleSection` (scorecard C2).
  - Add `externalId` text + `UNIQUE(userId, externalId)` (DECISIONS #6; idempotency replay-by-lookup).
  - Add `submitted_via` text nullable (null = pre-column legacy only — safe backfill policy only
    once the side door is closed, W1/W2).
  - Add `updated_at` timestamp (two-way-sync #7).
- Drizzle migration under `supabase/migrations/` (follow migration-history discipline — no
  phantom "applied" rows; verify DDL actually ran against prod via dump, per the shot-level-stats
  lesson).
- Decide soft-delete vs append-only for `round` **on paper** now (sync convergence depends on
  it; `round` is currently hard-deleted).

**Dependencies.** Prod duplicate scan (owner/infra). Co-design with **W1** (dedupe row ↔
in-transaction limit check as one change — scorecard C1). Idempotency mechanism is **locked**
(externalId-primary, DECISIONS #6), so this is unblocked now.

**Definition of done.**
- Prod scan results recorded; natural key specified against real data.
- Migration adds all four changes; `pnpm check:schema-sync` clean; `pnpm gen:types` regenerated
  (`apps/web/types/supabase.ts`).
- Identical-body duplicate semantics decided (200-with-existing-round vs 409) and encoded.

**Verification.**
- `pnpm check:schema-sync` (schema/migration drift).
- `pnpm test:integration` against local Supabase: duplicate insert → unique violation → replay
  path returns existing round.
- Post-deploy: verify DDL ran via prod dump, not migration history.

---

## W4 — `/v1` contract + route handlers

**Goal.** Build the hand-written REST `/v1` surface: shared zod schemas, OpenAPI 3.1 generated
from them with a CI diff gate, RFC 9457 error mapper, Upstash per-principal rate limiting per
route (DECISIONS #5, #6). Each route ships **with** its rate limit, error mapping, spec parity,
and canary coverage.

**Scope (files/areas).** New tree `apps/web/app/api/v1/` (siblings of the existing `app/api/{ai,
auth,billing,cron,stripe,webhooks,...}`).
- **Shared zod:** contract schemas (reuse/extend `apps/web/types/scorecard-input.ts`), request +
  response, one source for handlers and the OpenAPI generator.
- **Routes (day-1 surface):**
  - `POST /v1/rounds` — externalId idempotency (replay-by-lookup), synchronous **201** with
    provisional index + `handicapRevision:"pending"`, server-derived `hcpStrokes`/`approvalStatus`,
    strict validation, machine-readable **422**s. Calls the W1 service; **no business logic in
    the handler**.
  - `GET /v1/courses` + `GET /v1/tees` (or search-resolve) — required so catalog-referencing
    writes can obtain a `teeId` (scorecard Q1 sub-decision; in scope regardless of catalog-miss
    handling).
  - `POST /v1/courses` (course-submission) — rate-limited, mirrors the web pending-course flow +
    moderation queue (DECISIONS #6 catalog-miss resolution; **fix the name-only matching bug**
    `round.ts:370` vs the `(name,country,city)` unique index first).
  - `GET /v1/profile`, `GET /v1/rounds` — reads for the sync contract (W5).
  - `POST /v1/profile/provision` — auth-independent provisioning fallback (W2).
  - `GET /v1/health` — cheap liveness for the canary.
- **Error mapper:** one central `service/TRPCError → RFC 9457 problem+json` mapper, closed
  append-only code set; internal errors cannot leak into the public taxonomy.
- **OpenAPI 3.1:** generate from the shared zod schemas. **Use zod 4's native `z.toJSONSchema`**
  (zod 4.3.6 is the pinned dep; no OpenAPI generator is installed and `@asteasolutions/zod-to-openapi`
  historically targets zod 3). **Verify what refinements emit** — `putts+penalties ≤ strokes-1`
  and similar do **not** serialize; document those rules explicitly in the spec text.
- **CI parity gate:** regenerate the spec from schemas in CI, fail on diff (add a `pnpm`
  script + workflow).
- **Rate limiting:** extend `apps/web/lib/rate-limit.ts` with per-**principal** windows
  (`client_id` from W2 as the key), one per route, fail-closed on the public path (W0). One
  Vercel WAF rate-rule as 429 backstop + spend alerts.
- **Auth gate:** accept `client_id` tokens only here; reject in tRPC (W2).

**Dependencies.** W0 (host), W1 (service), W2 (auth + principal key), W3 (schema for
externalId/natural-key), **Checkpoint A** (frozen contract). Surface marked **internal/unstable**
(docs + response header) until a second consumer exists.

**Definition of done.**
- Day-1 routes live behind `api.handicappin.com`, each with rate limit + error mapping + spec
  entry + canary.
- OpenAPI 3.1 spec generated from schemas; CI diff gate green; non-serializing refinements
  documented in prose.
- `POST /rounds` idempotent (replay returns the same round); 201 provisional-index contract
  honored.

**Verification.**
- `pnpm test:integration` per route (idempotency replay, 422 taxonomy, RLS scoping).
- CI spec-parity job (regenerate → diff → fail-on-drift).
- Canary covers `/v1/health` + a bearer `POST /rounds` smoke.
- `pnpm lint` (import boundary: handlers don't import routers), `pnpm test:unit` (error mapper).

> **Billing-gated within W4:** the `plan_required` / `round_limit_reached` **RFC 9457 error
> contract** and the **over-limit route behavior** wait on billing gate (a). The rest of W4
> (idempotency, reads, course-submission, health, error mapper for non-billing codes, spec, rate
> limiting) proceeds now. See §3.

---

## W5 — Sync: polling contract + queue-kick + optional webhook

**Goal.** Ship plain REST reads as the **contract** (polling + refetch-on-foreground/after-submit);
evaluate the ~10-line post-submit queue-kick; optionally add the first-party pg_net → Convex HTTP
webhook (shared secret, hardcoded, **non-contractual**) since fitbull has a backend (DECISIONS #7).

**Scope.**
- Polling contract documented against the W4 `GET /v1/profile` + `GET /v1/rounds` reads. No
  cursor endpoint. Enumerate the exact convergence refetch set (profile **and** rounds list,
  minimum) so a hard-deleted round can't sit next to a mismatched index.
- **Queue-kick evaluation:** post-submit fire-and-forget invoke of `process-handicap-queue`
  edge function (~10 lines) — likely collapses submit→index latency to ~1–2s; **measure real
  prod recalc latency first** (Sentry traces are 100%-sampled) before freezing any poll-cadence
  numbers or the `handicapRevision:"pending"` resolution wording.
- Failure semantics: consumer must distinguish recalc-pending from recalc-failed (marker on the
  round or a submission-status resource); add `handicap_calculation_queue` lag alerting.
- Optional webhook (evaluate, not mandatory): first-party pg_net → Convex HTTP action, shared
  hardcoded secret, Standard-Webhooks-style signing, **non-contractual forever** for external
  consumers. Realtime stays out of v1.
- Billing-column exposure decision: `profile` carries plan/rounds_used/subscription_status —
  strip, segregate, or explicitly accept in the `GET /v1/profile` read.

**Dependencies.** W3 (`updated_at`), W4 (read endpoints exist). Realtime rider only: W2
(shared-project JWTs) — but Realtime is out of v1, so this is not on the critical path.

**Definition of done.**
- Polling contract + convergence refetch set documented; honest freshness statement ("eventually
  consistent, typically <Ns, refetch on focus/after submit") backed by measured latency.
- Queue-kick decision recorded (built or explicitly deferred with the measured number).
- recalc-pending vs recalc-failed distinguishable; queue-lag alert live.
- Billing-column exposure in profile reads decided (not drifted).

**Verification.**
- `pnpm test:integration`: submit → poll → convergence (index matches after recalc).
- Measured prod recalc latency recorded (from Sentry) before doc numbers freeze.
- Canary/integration: profile read does not leak un-decided billing columns.

---

## W6 — fitbull-side integration notes

**Goal.** A brief handoff doc for the **separate** Convex repo (not this repo). Concrete but
short — it's another codebase.

**Scope.**
- Base URL = `api.handicappin.com` **from the first commit** (never `handicappin.com`, or API
  availability re-couples to the marketing-site edge posture — the exact thing W0 exists to
  prevent).
- Tokens held **server-side in Convex** (not on-device); OAuth Connect flow (W2) issues them.
- Day-1 call list: `POST /rounds` (with `externalId` per submission for idempotency),
  `GET /courses`/`GET /tees` (resolve `teeId` before writing), `GET /profile` + `GET /rounds`
  (polling), `POST /courses` (catalog miss), `POST /profile/provision`.
- Poll cadence + refetch-on-foreground per W5; treat the returned index as provisional until
  `handicapRevision` clears.
- 422 taxonomy + RFC 9457 handling; 409/200 duplicate semantics per W3.

**Dependencies.** W2, W4, W5 (the contract must exist to write against).

**Definition of done.** A committed integration note (in this repo's `docs/` or handed to the
fitbull repo) covering base URL, auth, day-1 calls, idempotency, polling, error handling.

**Verification.** N/A here (verified by fitbull's own integration tests); the canary proves the
surface is reachable.

---

## W7 — Launch gates

**Goal.** The pre-launch checks that are independent of engineering readiness (DECISIONS §Open
gates governance; golf-landscape C).

**Scope.**
- **Governance / USGA-NGF fact-pattern check** (pre-launch blocker): answer whether a public
  fitbull surfacing the WHS-method unofficial index changes the live USGA #151 / NGF #147 fact
  pattern; document the conclusion (and whether to proactively raise it in the threads —
  owner-level negotiation call).
- **Demand instrumentation** ships **with** v1 (golf-landscape C.12, most-unanimous item): an
  "API access" interest form + PostHog event — the only planned falsifier of the deferral.
- **Internal contract doc** actually written and maintained (golf-landscape C.15; overlaps
  Checkpoint A output).
- Dated ADR with trigger thresholds + ~2026-10 review + end-Q1-2027 re-decide (strategy tracker,
  issue #144).

**Dependencies.** W4 (surface must exist to instrument and to govern).

**Definition of done.**
- Governance conclusion documented before v1 ships.
- Demand form + PostHog event live at launch.
- Contract doc committed; dated ADR + review date recorded.

**Verification.** PostHog event fires in a smoke test; governance doc reviewed by owner; ADR
committed.

---

## 2. Dependency graph & critical path

```
W0 (ingress + host) ──┐
                      ├─► W2 (auth spike → build) ──┐
W1 (extraction) ──────┤                             │
                      ├─► W3 (migration) ───────────┼─► W4 (/v1 contract) ─► W5 (sync)
prod dup scan ────────┘                             │        │
                                                    │        ├─► W6 (fitbull notes)
                              Checkpoint A ──────────┘        └─► W7 (launch gates)
                              (contract-design gate)
```

**Critical path:**
`W0 (cookie-less host) → W2 (spike pass) → Checkpoint A → W4 (POST /rounds) → W7 (governance) → launch`

W1 and W3 run in parallel with W2 but both **also** feed W4, so the longest chain is whichever of
{W2, (W1+W3 co-design)} finishes last before Checkpoint A. W2's spike is the sharpest risk on the
path (2-day timebox that can degenerate into beta archaeology). W5/W6 trail W4; W7's governance
check is a hard pre-launch gate that can run in parallel with W4 and must not be discovered late.

**Milestone ordering:**
1. **M0 — Incident (now):** W0 Steps 0–3 + canary + webhook audit. Independent of everything.
2. **M1 — Foundations (parallel):** W1 extraction (+ characterization tests), W2 spike, prod
   duplicate scan. Gate: W2 spike pass/fail recorded.
3. **M2 — Contract-design gate (Checkpoint A):** one session; freezes error envelope,
   idempotency, rate-limit principal, versioning, eventual-consistency statement.
4. **M3 — Migration (W3):** after the scan; carries all four changes.
5. **M4 — /v1 build (W4):** route-by-route, each with rate limit + error mapping + spec parity +
   canary. Billing-gated routes held (§3).
6. **M5 — Sync + integration (W5, W6):** polling contract, queue-kick decision, fitbull notes.
7. **M6 — Launch gates (W7):** governance documented, demand instrumentation live, contract doc
   committed. Then prod launch.

---

## 3. The OPEN BILLING GATE — what it blocks, what proceeds

**Do not invent billing decisions.** Three coupled owner decisions are open (DECISIONS §Open
gates): (a) over-limit behavior (hard-reject 403 vs accept-and-quarantine), (b) free-tier shape
under automatic submissions, (c) cross-product pricing.

**Blocked until the gate closes:**
- The RFC 9457 **billing error-contract spec** (`plan_required` / `round_limit_reached`
  semantics + quota headers) — gate (a) changes what these *mean* (a 403 vs a "12 rounds
  waiting" quarantine response). W4 ships every other error code; the billing codes wait.
- **Over-limit route behavior** in `POST /v1/rounds` (reject vs quarantine-and-exclude).
- **Provisioning flow details** — the *invariant* is locked (explicit, idempotent,
  consent-anchored; never silent null→free); the *mechanism/attachment point* rides gate (c) +
  W2's auth outcome.
- Free-tier warning-header thresholds/design (gate b reshapes the counting UX, not the mechanics).

**Proceeds regardless of the gate:**
- **W1 in-transaction limit check** replacing the delete-on-race (ships regardless — most-converged
  engineering item across all topics).
- `submitted_via` attribution column (W3) — analytics-only, can never be backfilled.
- W1 extraction, W0 ingress, W2 auth spike, W3 migration (the non-billing columns), Checkpoint A
  contract skeleton, and all **non-billing** W4 routes (idempotent `POST /rounds` happy path,
  reads, course-submission, health, error mapper for non-billing codes, rate limiting).
- W5 sync, W6 fitbull notes, W7 governance + demand instrumentation.

**Inputs the owner is preparing:** prod round-count distribution; modeled cross-product pricing
options. Gate (a) (accept-and-quarantine yes/no) is upstream of the billing error contract **and**
the extraction spec shape — decide it before those freeze (SYNTHESIS §2.6).

---

## 4. Risk register (top 5, from the pre-mortems)

| # | Risk | Source | Mitigation in this plan |
|---|------|--------|-------------------------|
| 1 | **OAuth spike degenerates into beta archaeology** — `getUser()`-accepts-OAuth-tokens is inferred from docs, not verified; the 2-day box blows out and stalls the critical path. | external-auth §1, red-hat tripwire | Hard timebox with written pass/fail; **if it fails, revisit** (DECISIONS #3), don't silently ship A; W1/W3/W0 proceed in parallel so a slip doesn't idle the team. |
| 2 | **Catalog-miss starves the launch consumer** — 207-course catalog vs fitbull users playing everywhere; `422 course_not_found` could be the *modal* day-1 response. | scorecard Q1, pre-mortem | Resolved in DECISIONS #6: course-submission endpoint **ships in v1** (W4), name-matching bug fixed first; search-resolve reads in scope. |
| 3 | **RLS insert side door bypasses billing** — a raw Bearer token `INSERT`s rounds via PostgREST, skipping plan gating; the W1 service-layer check does **not** close it. | billing #1, SYNTHESIS §2.7 | W2 `client_id` deny-policies (external tokens) **and/or** a DB-level `BEFORE INSERT` trigger (all tokens); mechanism decided jointly in W1/W2 (see §4 nuance). Confirmed live at `schema.ts:292-297`. |
| 4 | **Ingress regresses silently** — the challenge bypass is unversioned dashboard state; a one-click panic toggle re-bricks the API and no one notices. | ingress Step 1, all topics | Permanent external cookie-less canary (W0) paging on 429/HTML; host-scoped rollback rule prepped; dashboard state documented in `docs/`. |
| 5 | **Idempotency/dedupe row outlives a rolled-back round** — a committed `externalId` key replays a 201 for a non-existent round (the exact failure that killed Upstash-based dedupe). | scorecard C1 | W1 in-transaction limit check + W3 dedupe row **co-designed as one change**; dedupe state atomic with the round row in Postgres. |

Runner-up risks to carry: OpenAPI refinements silently not serializing → lying docs (W4 mitigates
by documenting non-serializing rules in prose + CI parity gate); shared-project blast radius
(accepted cost of no-stack-change, mitigated by Supavisor connection alert + second-Vercel-project
rung); consent-page parity gate blocking mid-build (W2 settles `INTENTIONAL.webOnly` up front).

---

## 5. Contradictions / infeasibilities found while planning

1. **Service-layer check ≠ side-door fix (genuine gap, not in any single synthesis cleanly).**
   The team-lead brief frames W1 as "in-transaction free-tier limit check replacing the
   delete-on-race." That is correct **for callers that go through the service**, but a raw Bearer
   token inserting directly via PostgREST never touches the service, so the in-transaction check
   does **not** close billing's RLS side door (§2.7 routes the side door to ingress/auth but the
   two fixes are easy to conflate). **The plan splits them explicitly:** W1 replaces the race for
   the service path; W2 (`client_id` deny-policy) or a DB-level trigger closes the direct-insert
   door. Under auth fallback A (no `client_id`), only the DB-level trigger bites — so if the spike
   fails, a `BEFORE INSERT` trigger becomes load-bearing. Flagged for the W1/W2 subplans to
   resolve the mechanism jointly; the green-hat "one DB-level check closes both" framing is the
   preferred shape to evaluate.

2. **OpenAPI generator dependency doesn't exist and the obvious one targets the wrong zod.** No
   OpenAPI/zod-to-json dep is installed; zod is pinned at 4.3.6. `@asteasolutions/zod-to-openapi`
   historically targets zod 3. The plan therefore specifies zod 4's **native** `z.toJSONSchema`,
   and inherits the known caveat (refinements like `putts+penalties ≤ strokes-1` don't
   serialize) as an explicit W4 task (document in prose + CI parity gate). This is consistent
   with the contract synthesis but the tooling choice is left implicit there.

3. **`teeTime` has no timezone and no unique constraint today.** `round.teeTime` is a bare
   `timestamp().notNull()` and the table has **zero** unique constraints (confirmed
   `schema.ts:238,263-311`). The natural-key/backfill-window design (scorecard C2) is therefore
   real schema work, not a tweak — and the web-vs-backfill timestamp-granularity mismatch
   (minute-rounded wall-clock vs date-only midnight) must be pinned in W3 or legitimate same-day
   rounds false-409. No contradiction with the research, but the "in principle" natural key needs
   the prod scan before it can be written — W3 is correctly gated on that.

4. **Everything else reconciled cleanly.** The three-way platform-bet fork (SYNTHESIS §2.1/§2.2)
   is already **closed** by the owner (REST /v1 + OAuth B, separate identities) — the plan does
   not reopen it. The superseded-wording items (bypass-rule scoping → grey-cloud host;
   write-only-by-default → third-party-only) are already resolved in DECISIONS §Superseded and
   are followed here. The "one migration, three topics" coupling and the contract-design gate are
   carried as explicit Checkpoints A/B. No infeasible decision was found; the idempotency
   mechanism being locked (externalId-primary) is what unblocks W3 to proceed now.
