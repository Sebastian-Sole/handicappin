# 005 Phase 0 — Frozen `/v1` Contract (Checkpoint A)

**Date:** 2026-07-29 · **Status:** FROZEN pending the two owner sign-off items at the end · **Workstream:** W4 Phase 0 (`plans/005-w4-v1-contract-and-handlers.md` §Phase 0; Checkpoint A per `plans/000-INDEX.md`).

This document is the contract-design gate output. It freezes the six least-reversible decisions of the `/v1` surface **before any handler is written**. Every decision below is grounded in a locked ADR entry, a synthesis condition, or shipped/in-review code; where the corpus is silent, that is said explicitly rather than papered over.

**Sources of authority** (this doc records and reconciles; it does not relitigate):

- `docs/research/api-platform/DECISIONS.md` (locked ADR; incl. the three 2026-07-29 sign-off sections on branch `docs/api-platform-signoffs-and-009`: updateUser residual accepted + detect-and-revoke, overlap-audience-only v1, `api.handicappin.com` LIVE).
- `docs/research/api-platform/plans/005-w4-v1-contract-and-handlers.md` (Phase 0 mandate — referenced, not edited; PR #172 touches it).
- `docs/research/api-platform/plans/000-INDEX.md` §Conflicts (quarantine semantics resolutions 1–3).
- `docs/research/api-platform/topics/public-contract-shape/synthesis.md` (binding conditions 7–12).
- `docs/research/api-platform/topics/scorecard-write-semantics/synthesis.md` (§1 decided items, C1–C6).
- Branch `api-platform/003-bundled-migration` (in review — treated as the intended shape): `docs/research/api-platform/plans/003-notes.md` (duplicate semantics) and `supabase/migrations/20260729100000_round_natural_key_and_api_columns.sql` (the two unique keys + `quarantined`).
- Shipped PR #167 code: `apps/web/server/api/trpc.ts`, `supabase/migrations/20260728090000_oauth_client_id_claims.sql`, `supabase/migrations/20260728091000_oauth_client_rls_deny.sql`, `apps/web/lib/oauth/consent-flow.ts`; spike record `plans/004-spike-results.md`.
- `apps/web/lib/rate-limit.ts` (fail-closed public-API limiter, shipped in 001).

**What this doc does NOT decide:** route-by-route request/response schemas (built in 005 Phases 1+ from `apps/web/types/scorecard-input.ts`), poll cadences and the queue-kick (006), billing-column exposure on `GET /v1/profile` (006), the governance gate (008), numeric rate budgets (owner, below).

---

## 1. Error envelope — RFC 9457 problem+json

**Decision (LOCKED).**

- Every non-2xx response from `/api/v1/*` has media type **`application/problem+json`** (RFC 9457) and a body with members:
  - `type` (string, URI) — **`https://api.handicappin.com/problems/{code}`**. Stable identifier; **not required to dereference** until public docs exist (RFC 9457 §3.1.1 permits this; a developer portal is an explicit non-goal until a non-owned consumer exists, DECISIONS #5). `about:blank` is never used — every error carries a registry code.
  - `title` (string) — short, human-readable, fixed per code (changing it is non-breaking; keying on it is unsupported).
  - `status` (number) — mirrors the HTTP status.
  - `detail` (string, optional) — human-readable specifics; **never** contains internal identifiers, stack traces, or infrastructure reasons.
  - `instance` (string, optional) — request-scoped URI/id for support correlation.
  - `code` (string, **required extension member**) — the machine key clients switch on, from the closed registry below.
  - `errors` (array, extension, `validation_failed` only) — `[{ path, code, message }]` field-level items; field-level codes are append-only and documented in the OpenAPI prose (they carry the non-serializing zod refinements, e.g. `putts_penalties_exceed_strokes` — public-contract-shape condition 10).
  - `existingRoundId` (number, extension, `duplicate_round` only) — the id of the already-stored round (per `003-notes.md`: "a problem body that includes the existing round's id").
- **The code registry is closed and append-only** (public-contract-shape condition 9). Internal errors (TRPCError shapes, Postgres/Supabase errors, zod internals) must pass through the single central mapper and can only surface as a registry code:

| `code` | HTTP | Meaning |
|---|---|---|
| `malformed_request` | 400 | Body is not parseable JSON, or wrong content type. |
| `unauthorized` | 401 | Missing/invalid/expired/**revoked** Bearer token. |
| `forbidden` | 403 | Valid token, but insufficient `scope` or a resource the principal may not touch. |
| `plan_required` | 403 | Account exists but is **not provisioned** (no plan selected). Remedy: `POST /v1/profile/provision`. A real error (DECISIONS §Billing gate). |
| `not_found` | 404 | Resource absent — or invisible under RLS (indistinguishable by design). |
| `idempotency_conflict` | 409 | Same `(userId, externalId)`, different body (§2). |
| `duplicate_round` | 409 | Natural-key collision with a different/absent `externalId` (§2); carries `existingRoundId`. |
| `validation_failed` | 422 | Schema or API-side invariant violation; carries `errors[]`. |
| `course_not_found` | 422 | Referenced `teeId`/`courseId` is not in the catalog. Remedy: the search-resolve reads or `POST /v1/courses` (DECISIONS #6 catalog-miss). |
| `rate_limited` | 429 | Per-principal budget exhausted (§3). |
| `internal_error` | 500 | Unexpected failure; no internal detail leaks. |
| `service_unavailable` | 503 | Dependency down — including the fail-closed rate limiter (§3). |

- **`round_limit_reached` is deliberately NOT in the registry.** Per the closed billing gate (DECISIONS 2026-07-27; `000-INDEX.md` §Conflicts 1–2), an over-limit round is **not an error**: `POST /v1/rounds` stores it and returns **201 with `status: "quarantined"`** (§5). There is no 403-for-over-limit anywhere in `/v1`. If a future non-write surface ever needs to *name* the limit state, it gets a new appended code at that time — nothing is reserved now.
- **Infrastructure caveat, documented honestly:** the Vercel WAF rate-rule backstop (DECISIONS #4; OWNER item in 001) emits platform-generated 429s that are **not** problem+json. The OpenAPI description states that clients must tolerate a non-problem 429/5xx from the infrastructure layer; the *contractual* envelope applies to application-emitted responses.

**Rationale.** RFC 9457 + closed registry is locked (DECISIONS #5, conditions 9/11); the only degrees of freedom here were the `type` scheme, the member set, and the registry contents. A per-code `type` URI plus a required `code` member gives clients one canonical switch key while keeping the RFC-standard shape tools understand.

**Rejected alternatives.** `about:blank` + `code`-only (loses the RFC-native type identity for zero savings); tRPC-shaped error JSON (rejected in DECISIONS #5); per-route bespoke error bodies (the exact drift the central mapper exists to prevent); putting `round_limit_reached` in the registry as 403 (contradicts the closed billing gate).

---

## 2. Idempotency — `externalId`-primary, replay-by-lookup

**Decision (LOCKED — DECISIONS #6 owner-delegated 2026-07-22; duplicate semantics decided in `003-notes.md`).**

Keyed on the migration's `UNIQUE("userId", "externalId")` (NULLS DISTINCT; `20260729100000_round_natural_key_and_api_columns.sql`). `externalId` is an optional client-supplied opaque string on `POST /v1/rounds` (fitbull sends its own round UUID). Semantics:

1. **Key present, no existing row** → insert → **201** (§5 body contract).
2. **Key present, existing row, identical body** → **200** with the existing round, in the same response shape as the 201 — reflecting **current** server state (its `status` may be `quarantined`; its `handicapRevision` may have progressed). Replay never re-runs limit checks and never mutates. A retrying background-sync client must converge, not error (Terra/Stripe-success style).
3. **Key present, existing row, different body** → **409 `idempotency_conflict`**. The client has a bug or reused a key; nothing is written.
4. **No key supplied** → the natural key is the only guard: `UNIQUE NULLS NOT DISTINCT ("userId", "teeId", "teeTime", nine_hole_section)`. A collision → **409 `duplicate_round`** with `existingRoundId` in the problem body. No body comparison and no 200-replay on this path — without a client-asserted key the server cannot distinguish "retry" from "second genuine round entered twice", so it reports the conflict and lets the client decide.
5. **Key present, but the insert trips the *natural* key** (the existing row has a different or NULL `externalId`) → **409 `duplicate_round`** with `existingRoundId`. This is the date-only-backfill collision case `003-notes.md` explicitly made non-destructive.
6. **Concurrency:** two same-key requests racing — loser hits the unique violation, re-looks-up the winner's row, then applies rules 2/3. No advisory locks, no key table (the long-transaction key-claim middle ground was explicitly rejected by the scorecard panel, Q2).

**"Identical body", concretely** (the part that must not be hand-waved):

- Compared **after** zod parse of the `/v1` request schema — i.e. on the canonical parsed object: unknown keys stripped, schema defaults applied, `teeTime` normalized to the pinned minute-precision wall-clock form (`003-notes.md` C6 semantics).
- **Compared fields** — every client-controlled field that determines the stored round (from the v1 submission schema derived from `apps/web/types/scorecard-input.ts`): `teeId`, `teeTime` (minute precision), `nineHoleSection` (absent ≡ 18-hole), `notes`, and the per-hole `scores` array compared order-independently by hole number: `strokes`, `putts`, `penaltyStrokes`, `fairwayHit`, and shot-detail fields if the v1 schema admits them.
- **Excluded from comparison:** server-derived fields (`hcpStrokes`, `approvalStatus`, any handicap output — the API ignores client values for these per scorecard synthesis §1(c)), server metadata (`id`, `createdAt`, `updated_at`, `quarantined`, `submitted_via`), and `externalId` itself.
- **Mechanism:** deep-equality of the parsed submission against the stored round's re-derived projection (a field-by-field comparison, not a stored fingerprint). Any mismatch in any compared field → rule 3.

**Rationale.** externalId-primary replay-by-lookup is locked (DECISIONS #6). Parse-then-compare (vs raw-body hashing) follows from two facts: 003's migration deliberately has **no fingerprint column** — rounds are re-derivable by GET, the exact reason the panel preferred replay-by-lookup over Stripe response snapshots — and byte-level hashing turns semantically identical retries (key reordering, whitespace, an omitted-then-defaulted optional field) into spurious 409s on the product's core artifact.

**Rejected alternatives.** Brandur `Idempotency-Key` key-table + fingerprint + purge cron (rejected for v1, DECISIONS #6 — the header remains addable later, non-breaking); natural-key-only (rejected — date-only backfill makes it lossy); SHA-256 of the raw body as the identity test (needs a column 003 doesn't have; false-conflicts on equivalent encodings); 200-replay on key-less natural-key hits (server would be guessing client intent).

---

## 3. Rate-limit principal

**Decision (LOCKED — gate authority: 000-INDEX M2 delegates "rate-limit principal" to this checkpoint).**

- **Key for authenticated `/v1` requests: the `(client_id, user)` pair**, encoded `client:{client_id}:user:{sub}` in the existing `getIdentifier` scheme (`apps/web/lib/rate-limit.ts:423`). First-party Bearer tokens (no `client_id` claim — §6) key as `user:{sub}`, unchanged.
- **Pre-auth / invalid-token requests** (which still cost validation work and must be limited): keyed `ip:{ip}` via the existing `CLIENT_IP_HEADERS` trust order (`cf-connecting-ip` → `x-real-ip` → last-hop `x-forwarded-for`). Never per-IP for authenticated traffic (005 mandate: per-principal, not per-IP).
- **Composition with the existing limiter:** every `/v1` handler calls **`enforcePublicApiRateLimit()`** — the FAIL-CLOSED path in `apps/web/lib/rate-limit.ts` (denies on `RATE_LIMIT_ENABLED` ≠ "true", missing KV credentials, init error, or runtime throw; every denial Sentry-alerted). The fail-open first-party limiters in the same file (`checkoutRateLimit` etc.) are **forbidden** on `/v1` — the file already documents this split. 005's build extends the module with **per-route windows as per-route Redis prefixes on the same fail-closed core** (one `Ratelimit` per route family, e.g. `ratelimit:public-api:rounds-write`), replacing today's single global `ratelimit:public-api` bucket; the fail-closed semantics and Sentry alerting are reused, not reimplemented. Each route's limiter ships in the PR that creates the route (binding condition 8).
- **Response contract on limit:**
  - Budget exhausted → **429** + problem body `code: "rate_limited"`, headers **`Retry-After`** (seconds, derived from `reset`) and **`X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`** (unix seconds), populated from the limiter result.
  - Limiter infrastructure unavailable (`failedClosed: true`) → **503** + `code: "service_unavailable"` + `Retry-After: 60`. The internal reason (`disabled` / `missing-credentials` / `init-error` / `runtime-error`) goes to Sentry, **never** into the body — the registry stays closed.
  - The Vercel WAF rate rule remains the non-contractual flood backstop (§1 caveat).

**Rationale.** DECISIONS #4 locks "Upstash **per-identity** limits". With exactly one OAuth client (fitbull) for the foreseeable phase, keying on `client_id` **alone** would collapse every fitbull user into one shared bucket — the same class of bug the W0 runbook fixed at the IP layer (one hot user exhausts the budget for all). The pair key preserves per-client attribution in the key (ops can sum or cap per-client later — an added stricter ceiling is an ops change, not a contract change) while limiting per human identity.

**Reconciliation note:** `005-w4-v1-contract-and-handlers.md` §Scope says "`client_id` as the key". Read literally that is the shared-bucket collapse above; this gate — which 000-INDEX M2 charges with freezing the principal — resolves it to the pair, consistent with DECISIONS #4's "per-identity". Flagged for owner awareness in the sign-off section since it sharpens a plan sentence.

**Rejected alternatives.** `client_id` alone (shared bucket across all of a client's users); `user` alone (loses per-client attribution the moment a second client exists — a retrofit on live keys); per-IP for authenticated traffic (explicitly excluded by the 005 mandate; fitbull calls originate from Convex egress IPs, which would again be one shared bucket); IETF `RateLimit-*` draft header fields (still a draft; the `X-RateLimit-*` trio + `Retry-After` is the convention of the target fitness-API domain).

---

## 4. Versioning

**Decision (LOCKED — DECISIONS #5; conditions 11–12).**

- **URL-path versioning.** The version segment is `v1`; the canonical base URL is **`https://api.handicappin.com/api/v1`** (the grey-cloud host — LIVE 2026-07-29 per the sign-off branch — is the same Vercel project, so the app-route path `/api/v1` from `PUBLIC_API_PATH_PREFIX` in `apps/web/lib/rate-limit.ts:266` is the real path; no rewrite/prettification is introduced).
- **Breaking** (requires `/v2`, which does not exist and is not planned): removing or renaming an endpoint, response field, or error code; changing a field's type or semantics; adding a **required** request field; **narrowing validation on an existing field after ship** (the day-one API-side invariants — `strokes >= 1`, `putts+penalties <= strokes-1`, teeTime sanity window — are part of v1's initial contract, not a later tightening); changing the status code of an existing outcome (e.g. `POST /rounds` is 201 — moving it is breaking); repurposing an existing `code` or `type` URI; removing a documented enum value.
- **Non-breaking (additive):** new endpoints; new **optional** request fields; new response fields; new error codes (registry is append-only); new values in enums documented as **extensible** — the round `status` field (§5) is documented extensible, and clients must treat unknown values as "not active"; later support for an `Idempotency-Key` header (DECISIONS #6). The OpenAPI description states the **tolerant-reader requirement**: clients MUST ignore unknown response fields.
- **Stability marker:** the surface is **internal/unstable** until a second consumer exists (DECISIONS #5). Every `/v1` response carries **`X-API-Stability: internal`** (the corpus mandates "docs + response header" but names no header; the name is fixed here), and the OpenAPI `info.description` carries the same banner. While internal, breaking changes are permitted **only** with same-owner coordination (fitbull) and a dated entry in the changelog file (`CHANGELOG` under the v1 tree — condition 11).
- **Deprecation posture:** **no** RFC 9745 `Deprecation` / RFC 8594 `Sunset` header machinery and **no** published 12-month deprecation policy until a consumer the developer does not own exists (condition 12 — explicit non-goal; the policy lives "in a drawer" and is published the week a real stranger integrates).

**Rationale.** All four elements are locked upstream; this section only pins the operational definitions (what counts as breaking; the header name; the canonical base URL) so handler PRs can't relitigate them one review at a time.

**Rejected alternatives.** Header/media-type versioning (rejected with DECISIONS #5 — `/v1` path is the convergent norm of the target domain: WHOOP/Oura/Strava); shipping Sunset/Deprecation headers now (condition 12 explicitly defers); a `/v1` → `/api/v1` host-level rewrite for prettier docs (the corpus is silent on it; not invented here — can be added later without breaking anything since the canonical path keeps working).

---

## 5. Eventual consistency + quarantine — the contractual statements

**Decision (LOCKED — DECISIONS #6 + closed billing gate; scorecard synthesis §1(b) unanimous; hosting C.9).**

`POST /v1/rounds` returns **201 Created, synchronously — never 202, never 200 on first write, never 403 for an over-limit round**. The 201 body is the round resource including at least: the stored round (id, echo of client fields), server-derived values, **`handicapIndex`** (provisional), **`handicapRevision: "pending"`**, and **`status: "active" | "quarantined"`** (extensible enum, §4). The 200 replay (§2 rule 2) uses the identical shape.

**Exact OpenAPI prose — eventual consistency** (verbatim into the spec description; satisfies hosting-stack C.9's "state eventual consistency explicitly"):

> `POST /v1/rounds` returns `201 Created` synchronously. The `handicapIndex` in the response is **provisional**: the authoritative handicap recomputation runs asynchronously (queued via database trigger and processed by a scheduled pg_cron job) after the write commits. Until it completes, the response carries `handicapRevision: "pending"`, and the handicap index returned by `GET /v1/profile` or `GET /v1/rounds` may not yet reflect the round you just submitted. Do not treat any index read within moments of a write as final. To converge, refetch the profile **and** the rounds list together after a submission and on app foreground; typical recomputation latency is documented separately and is not a contractual bound.

**Exact OpenAPI prose — quarantine** (verbatim into the spec description):

> A round submitted while the account is over its free-tier round limit is **accepted and stored**, and the request succeeds with `201 Created` and `"status": "quarantined"` in the response body. A quarantined round is excluded from the handicap computation and from the account's round count until the account upgrades, at which point it is unlocked automatically — no resubmission is needed. Quarantine is **not an error**: `POST /v1/rounds` never returns `403 Forbidden` because of the round limit, and no `round_limit_reached` error code exists on this endpoint. The only billing-related error on this surface is `plan_required` (`403`), returned when the account has not completed plan selection; remedy via `POST /v1/profile/provision`.

Supporting facts the spec may reference: the `quarantined` column and its exclusion from both counting sites ship in 003's bundled migration; the handler passes `overLimitPolicy: "quarantine"` to the 002 service and contains no gating logic itself.

**Rationale.** Sync-201 was unanimous ("202 would be Strava cosplay for a millisecond transaction"); quarantine-as-201 is the closed billing gate, threaded through 000-INDEX conflicts 1–2. The `status` enum (rather than exposing the raw `quarantined` boolean) keeps the axis extensible without a breaking change and keeps the DB column name out of the contract.

**Rejected alternatives.** 202 + polling resource (rejected unanimously); 403 `round_limit_reached` for over-limit (contradicts the closed gate; explicitly superseded per 000-INDEX §Conflicts 2); a `quarantined: boolean` response field (freezes the axis; enum extension is non-breaking); omitting the staleness statement or promising a latency bound (006 measures real recalc latency first — a contractual bound now would be invented).

---

## 6. Auth statement

**Decision (LOCKED — DECISIONS #3 + spike results; matches the shipped PR #167 code, verified against the files below).**

**Exact OpenAPI prose** (verbatim into the spec's Authorization section):

> All `/api/v1` endpoints require `Authorization: Bearer <access token>`, where the token is a Supabase-issued access token obtained through the handicappin OAuth 2.1 authorization flow (authorization code + PKCE, consent at the app-hosted `/oauth/consent` page; refresh via `POST /auth/v1/oauth/token` with client authentication). Tokens issued to an OAuth client carry a `client_id` claim and a `scope` claim; such tokens are accepted **only** on `/api/v1` and are rejected by every other authenticated surface of the application. Requests without a valid token receive `401` (`unauthorized`) — including tokens that have been revoked, since validation is performed server-side against the authorization server on every request. Requests whose token lacks a required scope receive `403` (`forbidden`). Access tokens contain no billing information. Do not request the `openid` scope.

Grounding, so the statement matches what shipped rather than what was planned:

- **Rejection in tRPC context:** `apps/web/server/api/trpc.ts` — `isExternalOAuthClientToken()` (line 91) decodes the JWT payload (decode-only, not verification) and any `client_id`-bearing Bearer token is rejected in `createTRPCContext` (line 211) with the logged reason "client_id claim present; external tokens are /api/v1-only". First-party surfaces stay external-inaccessible by default.
- **Scope claim:** `supabase/migrations/20260728090000_oauth_client_id_claims.sql` — the `custom_access_token_hook` preserves `client_id`/`ref` and stamps `scope` with `rounds:write` appended **unconditionally** on OAuth-client tokens (Phase-1 fixed-capability model; Supabase per-client scopes are unshipped, discussion #38022). `/v1` enforcement points are therefore written against `scope` from day one and do not move when real scopes ship. First-party tokens get no `scope` claim and no `client_id`. OAuth tokens get **no billing claims** (mandatory-denied to `client_id` principals).
- **Validation path:** `getUserFromBearerToken` → `supabase.auth.getUser(token)` (network check). Spike criterion iii: revocation via `revokeGrant` takes effect in ~47 ms on this path; **local JWKS/`getClaims()` validation is prohibited for external tokens** because it would silently miss revocation.
- **RLS backstop:** `20260728091000_oauth_client_rls_deny.sql` — `client_id` deny-policies on billing/profile tables are the real security boundary (the tRPC allowlist and the `/v1` gate are placement, not authorization; the PostgREST side door is why deny-policies are mandatory, DECISIONS #3). The RLS `round`-insert side door remains a **shipping gate** for the token-bearing consumer (billing-and-metering condition 1), tracked in 005's build, not re-decided here.
- **Consumers:** v1 serves only users who already have a handicappin account (overlap-audience-only sign-off, 2026-07-29); fitbull holds tokens server-side in Convex.
- **First-party tokens at `/v1`:** the corpus mandates the one-way restriction (external tokens `/v1`-only) but is **silent** on the converse. Default frozen here: `/v1` accepts any **valid** Supabase Bearer access token — first-party (no `client_id`, keyed `user:{sub}` in §3) or OAuth-client — since the native app shares the `api.handicappin.com` host (`apps/web/lib/rate-limit.ts:267` comment) and nothing in the corpus restricts `/v1` to external tokens. Scope enforcement applies only where a token *carries* a scope claim; first-party tokens are full-capability on their own user, exactly as on tRPC.

**Rationale.** Everything except the last bullet is locked or shipped; the statement is written to be checkable against the four files above. The last bullet is the only default this gate adds, and it is the least-commitment reading of the corpus (rejecting first-party tokens at `/v1` would be a *new* restriction with no upstream mandate).

**Rejected alternatives.** Documenting "send your raw Supabase session token" as *the* auth model (the second-migration trap public-contract-shape condition 3 warned about — the documented model is the OAuth flow; first-party acceptance is an implementation property, not the advertised contract); local JWKS validation (misses revocation — spike iii); requesting `openid` scope (500s under HS256 signing — spike finding); accepting external tokens on tRPC with an allowlist (rejected in DECISIONS #3: not a security boundary).

---

## OWNER SIGN-OFF REQUIRED

Only genuinely owner-level items — everything else above is frozen under this gate's delegated authority:

1. **Numeric rate budgets.** The principal, key shape, fail-closed behavior, and response contract are frozen in §3; the **numbers** per route family (rounds-write, course-submission, reads, provision) are prod-ops values set via the `RATE_LIMIT_*` env vars, and the Vercel WAF backstop rule threshold is already an OWNER item from 001. Owner sets/confirms the figures before launch.
2. **Rate-limit key wording delta.** §3 keys authenticated `/v1` traffic on the `(client_id, user)` pair; `005-w4-v1-contract-and-handlers.md` literally says "`client_id` as the key". The pair is the reading consistent with DECISIONS #4's "per-identity" and avoids a one-bucket-for-all-fitbull-users collapse, but it sharpens a plan sentence — one-line ack requested.

## Corpus-silent items resolved by default in this doc (ack-by-silence is fine)

- `/v1` also accepts **first-party** (non-`client_id`) Bearer tokens (§6, last bullet) — the corpus mandates only the one-way restriction.
- The stability header is named **`X-API-Stability: internal`** (§4) — the corpus mandated a header but named none.
- The round-resource status field is the extensible enum **`status: "active" | "quarantined"`** (§5) — the corpus mandated "a distinguishable status field" without naming it.
- No `/v1` → `/api/v1` URL prettification; canonical base is `https://api.handicappin.com/api/v1` (§4).
