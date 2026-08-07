# 007 — W6: fitbull ↔ handicappin `/v1` integration notes

**Date:** 2026-08-07 · **Workstream:** W6 · **Status:** HANDOFF DOC — the consumer-facing contract fitbull builds against
**Audience:** the fitbull repo (a separate Convex application, same owner). Nothing in this document asks for work in *this* repo.

> **Supersession notice.** This file previously held the W6 *subplan* (a sketch of what the handoff doc should cover). That sketch is superseded: its day-one call list named `GET /v1/profile`, `POST /v1/courses` and `POST /v1/profile/provision`, all three of which were **deferred out of the day-one build** by owner decision **D9** (`DECISIONS.md:51-57`). The subplan's other content (base URL, tokens-in-Convex, quarantine-as-201, RFC 9457, poll-and-refetch) is carried forward below with sources attached.

---

## 0. Build status — read this first

**Nothing described here is live.** As of `main` @ `90429dd`, `apps/web/app/api/v1/` **does not exist and no route has been written** (`plans/010-v1-implementation.md:28`). The accept-and-quarantine write path still throws (`plans/010-v1-implementation.md:29`, `plans/005-phase0-contract.md:247`) and the entitlement RPC the routes depend on does not exist anywhere in the repo (`plans/010-v1-implementation.md:30`).

This document is therefore **the contract the endpoints will honour when they ship**, not a description of a running service. It is written from the frozen `/v1` contract (`plans/005-phase0-contract.md`) and the nine locked owner decisions (`DECISIONS.md` §"Sign-off: pre-implementation decision set"). Every statement below traces to one of those two files, `GOVERNANCE.md`, or `plans/010-v1-implementation.md`; where they are silent, §10 says so instead of guessing.

Two consequences for fitbull scheduling:

- Build against this document, but do not treat any endpoint as callable until the handicappin side announces it. `GET /v1/health` is the first route built and the canary target (`plans/010-v1-implementation.md:109`).
- The surface is marked **internal/unstable** until a second consumer exists. Every `/v1` response carries `X-API-Stability: internal`, and breaking changes are permitted **only** with same-owner coordination plus a dated changelog entry (`plans/005-phase0-contract.md:219`). fitbull is that coordination partner — a breaking change is a conversation, not a surprise, but it is also not forbidden.

---

## 1. Base URL and host scoping

**Canonical base URL: `https://api.handicappin.com/api/v1`** (`plans/005-phase0-contract.md:216`).

Note the path form. Throughout the handicappin planning corpus the endpoints are written in shorthand as `/v1/rounds`, `/v1/courses`, and so on; the **real** path carries the `/api` segment, because `api.handicappin.com` is the same Vercel project as the web app and no rewrite or URL prettification is introduced (`plans/005-phase0-contract.md:216`, and the same point restated at `:354`). So:

| Shorthand used in handicappin docs | The URL fitbull actually calls |
|---|---|
| `POST /v1/rounds` | `POST https://api.handicappin.com/api/v1/rounds` |
| `GET /v1/rounds` | `GET https://api.handicappin.com/api/v1/rounds` |
| `GET /v1/courses` | `GET https://api.handicappin.com/api/v1/courses` |
| `GET /v1/tees` | `GET https://api.handicappin.com/api/v1/tees` |
| `GET /v1/health` | `GET https://api.handicappin.com/api/v1/health` |

**`api.handicappin.com` is the only supported base host.** `/api/v1` on any other host — notably `www.handicappin.com/api/v1`, which is reachable today — is **unsupported, may be blocked without notice**, and on the orange-clouded web zone remains subject to the Cloudflare challenge that caused this whole workstream (`plans/005-phase0-contract.md:116`). Hardcode `api.handicappin.com` from fitbull's first commit; do not fall back to the apex or `www` host under any circumstance. The host is confirmed live and serving (`DECISIONS.md:63-65`), and the host-scoping requirement is carried forward as a build constraint on the handicappin side too (`plans/010-v1-implementation.md:125`).

Versioning is URL-path versioning; `/v2` does not exist and is not planned (`plans/005-phase0-contract.md:217`).

---

## 2. The five day-one endpoints

Owner decision **D9** cut the day-one surface to five endpoints (`DECISIONS.md:51-57`, restated at `plans/010-v1-implementation.md:34-38`):

| Endpoint | Purpose |
|---|---|
| `POST /v1/rounds` | Write a golf round into the connected user's handicappin account. This is the integration. |
| `GET /v1/rounds` | **Write reconciliation only** — see below. |
| `GET /v1/courses` | Catalog read, so a write can obtain a `teeId`. |
| `GET /v1/tees` | Catalog read, so a write can obtain a `teeId`. |
| `GET /v1/health` | Cheap liveness, primarily the canary's target. |

### What does not exist

**`GET /v1/profile` does not exist yet.** It is deferred, explicitly because nothing displays the index, so nothing needs to read it (`DECISIONS.md:54`). Also deferred out of the day-one build: **`POST /v1/courses`** (course submission on a catalog miss) and **`POST /v1/profile/provision`** (`DECISIONS.md:54`, `plans/010-v1-implementation.md:36`). `POST /v1/profile/provision` is in any case **first-party-only** — an OAuth principal cannot reach it, because the provisioning insert is blocked by RLS (`plans/005-phase0-contract.md:115`, `DECISIONS.md:30`).

Do not write fitbull code that calls any of those three. Adding an endpoint later is non-breaking (`plans/005-phase0-contract.md:218`), so if fitbull genuinely needs one, ask — do not stub it speculatively.

### `GET /v1/rounds` is for reconciliation, not display

fitbull **never renders a handicap number, in any market** (`DECISIONS.md:49`, `GOVERNANCE.md:86`, `GOVERNANCE.md:118`). `GET /v1/rounds` survives the D9 cut for one reason: *"a write-only integration is undebuggable when a round goes missing"* (`DECISIONS.md:55`, `plans/010-v1-implementation.md:38`). Use it to confirm that what fitbull believes it wrote is what handicappin stored. Do not use it to build a handicap display, a trend chart, or an index-derived stat.

The response bodies **will** carry `handicapIndex`: the API is deliberately market-blind and never withholds or conditionalizes the index (**D1**, `DECISIONS.md:26`) — handicappin structurally cannot identify a US-market user, because `profile` has no country/market/region column. The obligation not to display it is therefore entirely fitbull's, discharged at fitbull's display layer (`DECISIONS.md:26`). The wire field is named `handicapIndex` despite `Handicap Index®` being a claimed mark; that is a deliberate, recorded decision about a JSON key, and it does **not** license the term in fitbull's visible copy (**D2**, `DECISIONS.md:28`; see §9).

Quarantined rounds **are** returned by `GET /v1/rounds`, carrying `status: "quarantined"` (**D4**, `DECISIONS.md:32`).

---

## 3. Auth

The frozen Authorization prose, reproduced verbatim from `plans/005-phase0-contract.md:270`:

> All `/api/v1` endpoints require `Authorization: Bearer <access token>`, where the token is a Supabase-issued access token obtained through the handicappin OAuth 2.1 authorization flow (authorization code + PKCE, consent at the app-hosted `/oauth/consent` page; refresh via `POST /auth/v1/oauth/token` with client authentication). Tokens issued to an OAuth client carry a `client_id` claim and a `scope` claim. `/api/v1` is the only application surface that accepts such tokens: the application's own first-party surfaces (for example its tRPC endpoint) reject them outright. Note that this is not a claim of total network isolation — the underlying Supabase database API remains reachable with the same token, constrained by row-level security policies rather than by this API. Requests without a valid token receive `401` (`unauthorized`) — including tokens that have been revoked, since validation is performed server-side against the authorization server on every request, and including an OAuth-client token that arrives without a `scope` claim. An operation a token's scope does not permit receives `403` (`forbidden`). Access tokens contain no billing information. **Do not request the `openid` scope.**

(The bold is added here for emphasis only; the sentence is verbatim. `openid` is not a style preference — requesting it 500s under the project's HS256 signing, a spike finding recorded at `plans/005-phase0-contract.md:291` and `DECISIONS.md:78`.)

Operational notes that follow from the same section:

- **Tokens live server-side in Convex, never on-device** (`DECISIONS.md:82`, `GOVERNANCE.md:82`). fitbull is a confidential client; refresh goes through `POST /auth/v1/oauth/token` with client authentication (`DECISIONS.md:78`).
- **Revocation is immediate, by design.** Validation hits the authorization server on every request (`plans/005-phase0-contract.md:276`), so a revoked grant starts returning `401` within milliseconds. Treat `401` as "re-consent required", not as a transient error to retry.
- **A `client_id` token that arrives with no `scope` claim is rejected with `401`**, never treated as full-capability (`plans/005-phase0-contract.md:283`). fitbull should never see this; if it does, something upstream regressed and handicappin is being alerted.
- **v1 serves overlap audience only** — users who already have a handicappin account. The consent page shows sign-in, not inline sign-up; a fitbull user without a handicappin account must self-serve create one and return, and the pending authorization survives (`DECISIONS.md:18-20`, `plans/005-phase0-contract.md:278`).

---

## 4. `externalId` idempotency

`externalId` is an **optional client-supplied opaque string** on `POST /v1/rounds`; the expectation is that **fitbull sends its own round UUID** (`plans/005-phase0-contract.md:129`). It is keyed on a `UNIQUE("userId", "externalId")` index with `NULLS DISTINCT`. **Send it on every write.** The rules below explain why the no-key path is materially worse.

### The five client-visible outcomes

| Situation | Result | Source |
|---|---|---|
| Key present, no existing round | **201** — the round is created | `:131` |
| Key present, existing round, **identical body** | **200** replay, the existing round in **the same response shape as the 201**, reflecting current server state | `:132` |
| Key present, existing round, **different body** | **409 `idempotency_conflict`**. Nothing is written | `:133` |
| **No key supplied**, and the natural key collides | **409 `duplicate_round`** with `existingRoundId` in the problem body. No body comparison, no 200 replay | `:134` |
| Key present, key lookup finds nothing, but the natural key collides | **409 `duplicate_round`** with `existingRoundId` | `:135` |

(Line references are into `plans/005-phase0-contract.md` §2.)

Two properties fitbull can rely on:

- **A retry converges, it does not error.** Replay never re-runs limit checks and never mutates (`:132`). The 200 reflects **current** server state, so its `status` may be `quarantined` and its `handicapRevision` may have advanced since the original 201 (`:132`).
- **A matched `externalId` wins over a simultaneous natural-key collision** (`:143`). And a genuinely concurrent same-key submit — two requests in flight at once, the canonical background-sync shape — resolves to the **200 replay** for the loser, not a 409 (`:136`, `:149`). handicappin treats a forced-interleave test of this as merge-blocking (`:184`).

### What "identical body" means

The comparison runs **after** schema parse, on the canonical parsed object (`:156`). **Compared fields:** `teeId`, `teeTime`, `nineHoleSection` (absent ≡ 18-hole), `notes`, and the per-hole `scores` array — `strokes`, `putts`, `penaltyStrokes`, `fairwayHit` (`:157`). **Excluded:** all server-derived fields (`hcpStrokes`, `approvalStatus`, any handicap output), server metadata (`id`, `createdAt`, `updated_at`, `quarantined`, `submitted_via`), and `externalId` itself (`:158`).

Three normalizations exist so that a legitimate retry does not produce a spurious 409 (`:174-176`) — fitbull gets them for free, but knowing them prevents defensive over-engineering:

- **N1** — omitted, `null`, and `undefined` are the same value for every optional per-hole field. Retrying without `putts` is not a different body.
- **N2** — hole identity is by **submission position**, 0-indexed, and comparison is **order-sensitive**. A reordered `scores` array is a different round, not a retry. For a 9-hole back-nine round, positions 0–8 map to course holes 10–18.
- **N3** — `teeTime` canonicalizes to the UTC instant. `2026-07-29T16:32:00+02:00` and `2026-07-29T14:32:00Z` are one round to both the uniqueness constraint and the replay comparison. No truncation is applied.

### `409 idempotency_conflict` is non-escalating

Reproduced verbatim from `plans/005-phase0-contract.md:166` — this is the frozen OpenAPI prose, and it is the operative instruction for fitbull's retry logic:

> `409 idempotency_conflict` means this idempotency key already identifies a stored round whose contents differ from what you sent. **The round exists** — do not retry with the same key, and do not treat this as a lost write. If you did not intend to submit different contents, the round was most likely edited in the handicappin app after you created it; treat the stored round as authoritative, stop retrying that key, and if you need its current state, re-read it from `GET /v1/rounds`.

Concretely, in fitbull: on `409 idempotency_conflict`, mark the local round **synced**, stop the retry loop for that key, and log for inspection. Do **not** alert the user, do **not** regenerate a new `externalId` and resubmit (that creates a genuine duplicate round), and do **not** count it as a failed write. handicappin accepts this 409 deliberately, on the reasoning that *"a 409 costs a log line, an identity-only 200 costs a round"* (`:162`).

> **Caveat on the quoted prose, flagged rather than silently corrected.** The sentence "the round was most likely edited in the handicappin app after you created it" is broader than the contract's own analysis two paragraphs above it: `:162` states that **no round-edit flow exists in the web or native app**, and that the only client-writable column over PostgREST is `notes`. The realistic cause of an `idempotency_conflict` is therefore a `notes` change, or a bug in fitbull that reused a key with different contents. The remedy prose is unaffected — stop retrying either way — but do not build fitbull UX around a general "edited in handicappin" story. Raised to the handicappin side as a prose nit; see §11.

### No `externalId` ⇒ `409 duplicate_round`

If fitbull omits `externalId`, the **natural key** is the only guard: `UNIQUE NULLS NOT DISTINCT ("userId", "teeId", "teeTime", nine_hole_section)`. A collision returns **`409 duplicate_round`** with **`existingRoundId`** (the id of the already-stored round) in the problem body (`:134`, `:56`, `:45`). There is **no body comparison and no 200 replay on this path**: without a client-asserted key the server cannot distinguish "a retry" from "a second genuine round entered twice", so it reports the conflict and lets the client decide (`:134`).

That is the whole argument for always sending `externalId`. Without it, an ordinary network-timeout retry of a successful write surfaces to fitbull as a 409 that fitbull cannot safely interpret. With it, the same retry is a 200.

An `Idempotency-Key` **header** is not part of v1. It remains addable later without breaking anything (`DECISIONS.md:87`, `plans/005-phase0-contract.md:218`) — do not send one now and do not depend on one.

---

## 5. Quarantine and eventual consistency

### Quarantine — the frozen prose

Reproduced verbatim from `plans/005-phase0-contract.md:245`:

> A round submitted through `POST /v1/rounds` while the account is over its free-tier round limit is **accepted and stored**, and the request succeeds with `201 Created` and `"status": "quarantined"` in the response body. A quarantined round is excluded from the handicap computation and from the account's round count until the account upgrades, at which point it is unlocked automatically — no resubmission is needed. **Treat `status` as extensible: any value you do not recognize means "not active."** Quarantine is **not an error**: `POST /v1/rounds` never returns `403 Forbidden` because of the round limit, and no `round_limit_reached` error code exists on this endpoint. The only billing-related error on this surface is `plan_required` (`403`), returned when the account has not completed plan selection; the account holder resolves it in the handicappin app.

What this means in fitbull code:

- Over-limit is **`201` + `status: "quarantined"`** — a **success**. Do not branch it into an error path, do not retry it, do not surface it as a failed sync.
- **`round_limit_reached` does not exist** in the error registry, deliberately (`plans/005-phase0-contract.md:63`). If fitbull ever receives it, the contract has been violated — report it, do not handle it.
- There is **no 403-for-over-limit anywhere in `/v1`** (`:63`).
- Surfacing quarantine to the user is fitbull's call. handicappin's own apps badge such rounds visibly as "not counted — free-tier limit reached" with an upgrade path (**D4**, `DECISIONS.md:32`, `plans/010-v1-implementation.md:58`). The remedy is always in the handicappin app, never in fitbull.
- `plan_required` (403) is the one billing error on this surface. Its remedy is **user-side**: the user completes plan selection in the handicappin app; fitbull surfaces that instruction and retries (`plans/005-phase0-contract.md:115`). It should be close to unreachable in practice, since the OAuth consent page now gates on plan selection (**D3**, `DECISIONS.md:30`) — a plan-less account cannot obtain a token in the first place.

### Eventual consistency — the frozen prose

Reproduced verbatim from `plans/005-phase0-contract.md:241`:

> `POST /v1/rounds` returns `201 Created` synchronously. The `handicapIndex` in the response is **provisional**: the authoritative handicap recomputation runs **asynchronously**, after the write commits. Until it completes, the response carries `handicapRevision: "pending"`, and the handicap index returned by `GET /v1/profile` or `GET /v1/rounds` may not yet reflect the round you just submitted. Do not treat any index read within moments of a write as final. `handicapRevision` becomes `"current"` once the authoritative value reflects this round, or `"failed"` if the recomputation was attempted and did not complete (the index is then stale and will not self-correct on its own — surface it as stale rather than as up to date). **Treat this field as extensible: any value you do not recognize means "not current."** To converge, refetch the profile **and** the rounds list together after a submission and on app foreground; typical recomputation latency is documented separately and is not a contractual bound.

Two adjustments fitbull must apply when reading that paragraph:

1. **`GET /v1/profile` does not exist day one** (`DECISIONS.md:54`). The prose was frozen on 2026-07-29, before D9 cut the surface on 2026-08-05. The convergence instruction "refetch the profile **and** the rounds list" reduces to **refetch the rounds list** until a profile endpoint ships. This is a live discrepancy between the frozen contract and D9, flagged rather than silently reinterpreted — see §11.
2. **The `handicapRevision` machinery has no consumer at fitbull launch.** Because fitbull displays no index, there is no staleness problem to solve; the contract reserves the enum, and workstream 006 wires the pending/current/failed detection **if and when** something displays an index (`DECISIONS.md:56`). fitbull must still *tolerate* the field and its extensibility (§6), but it does not need to build a convergence loop around it.

**Never promise a latency.** Recomputation latency is explicitly **not a contractual bound** (`:241`), and no measured number exists yet — 006 was to measure real prod recalc latency before any cadence froze (`plans/006-w5-sync-contract.md` §Scope/§Step-by-step), and 006 left the critical path under D9. Any number fitbull hardcodes today is invented.

---

## 6. Both enums are extensible; be a tolerant reader

| Field | Documented values | Rule for an unrecognized value |
|---|---|---|
| `status` | `"active"` \| `"quarantined"` | treat as **not active** |
| `handicapRevision` | `"pending"` \| `"current"` \| `"failed"` | treat as **not current** |

Source: `plans/005-phase0-contract.md:236-237`, restated in both frozen prose blocks above and at `plans/010-v1-implementation.md:117`.

Implement these as **open unions with a default branch**, not as exhaustive switches that throw. A new enum value is explicitly **non-breaking** and may be added without a `/v2` (`plans/005-phase0-contract.md:218`); conversely, **removing** a documented enum value **is** breaking and requires `/v2` (`:217`). So new values can appear at any time; existing ones will not vanish.

**The tolerant-reader requirement is contractual: clients MUST ignore unknown response fields** (`plans/005-phase0-contract.md:218`, also listed as a frozen resolution at `:352`). New response fields are additive and non-breaking. If fitbull parses responses with a strict validator, configure it to strip-and-pass unknown keys rather than reject — a strict-mode parser will break fitbull on a routine additive change that the contract classifies as safe.

Also non-breaking, so plan for them: new endpoints, new **optional** request fields, and new error codes (the registry is append-only) (`:218`).

---

## 7. Rate limits — the reads budget is a ceiling on polling cadence

**The budgets** (owner decision **D6**, `DECISIONS.md:36-44`), per **`(client_id, user)` pair** — not per client, not per IP — sliding window, **fail-closed** (`plans/005-phase0-contract.md:196`, `:198`):

| Route family | Budget |
|---|---|
| rounds-write | **60 / minute** |
| reads | **120 / minute** |
| course-submission | 10 / hour *(endpoint deferred by D9 — not day-one)* |
| provision | 5 / hour *(endpoint deferred by D9 — not day-one)* |

The pair key means each fitbull **user** gets their own bucket; one heavy user cannot throttle every other fitbull user (`DECISIONS.md:36`, `plans/005-phase0-contract.md:204`).

### This is a stated ceiling, not a guideline

**D6 is explicit: "The reads budget is a stated ceiling on 006's polling cadence — record it in the 007 fitbull notes rather than letting fitbull discover it via 429s"** (`DECISIONS.md:45`). This section is that record.

fitbull's polling design must fit inside **120 reads/minute per connected user**, across the read family as a whole (the limiter uses per-route Redis prefixes with one limiter per **route family**, `plans/005-phase0-contract.md:198`). Practical consequences:

- A fixed-interval poll faster than roughly **once every 500 ms per user** exhausts the budget on its own, before any reconciliation read or catalog lookup.
- The sanctioned pattern is **refetch after submit and on app foreground** — not a tight timer (`plans/006-w5-sync-contract.md` §Goal; `plans/005-phase0-contract.md:241`). With fitbull displaying no index, there is no staleness to chase, so a post-write reconciliation read plus an on-foreground read is the whole requirement.
- Catalog reads (`GET /v1/courses`, `GET /v1/tees`) draw from this same budget. Cache resolved `teeId`s in Convex; do not re-resolve a course on every round write.
- No poll-cadence number is contractual, because 006 never measured one (§5). **The 120/min budget is the only stated bound**, which makes it the operative one.

### The 429 response contract

Budget exhausted → **429** with `code: "rate_limited"`, plus headers (`plans/005-phase0-contract.md:200`):

- **`Retry-After`** — seconds. Honour it; it is derived from the limiter's real reset.
- **`X-RateLimit-Limit`**, **`X-RateLimit-Remaining`**, **`X-RateLimit-Reset`** — the last in unix seconds.

fitbull should back off on `Retry-After` rather than on a local heuristic, and should treat a rising 429 rate as a design bug in its own cadence, not as a capacity request.

### The fail-closed 503

If the limiter's own infrastructure is unavailable, `/v1` **denies** rather than admits: **503** with `code: "service_unavailable"` and **`Retry-After: 60`** (`plans/005-phase0-contract.md:201`). The internal reason (`disabled` / `missing-credentials` / `init-error` / `runtime-error`) goes to handicappin's Sentry and is deliberately **never** in the response body — the registry stays closed. So:

- A `503` on `/v1` may mean "handicappin's rate-limiter dependency is down", not "handicappin is down". Both are retryable; neither is a data problem.
- Retry after 60 s with jitter. Do not tighten the retry on 503 — the fail-closed path exists precisely to shed load.

Separately, a **Vercel WAF rate rule** sits in front as a non-contractual flood backstop, and its 429s are **not** problem+json (`plans/005-phase0-contract.md:117`, `:202`). See §8.

---

## 8. Error handling

Every **application-emitted** non-2xx from `/api/v1/*` is **`application/problem+json`** (RFC 9457) with these members (`plans/005-phase0-contract.md:37-45`):

| Member | Notes |
|---|---|
| `type` | `https://api.handicappin.com/problems/{code}`. Stable identifier; **not guaranteed to dereference** until public docs exist. `about:blank` is never used. |
| `title` | Short, human-readable, fixed per code. **Changing it is non-breaking — do not key on it.** |
| `status` | Mirrors the HTTP status. |
| `detail` | Optional. Human-readable specifics; never internal identifiers, stack traces, or infrastructure reasons. |
| `instance` | Optional. Request-scoped id for support correlation — **log it**; it is what makes a bug report actionable. |
| `code` | **Required extension member. This is the machine key fitbull switches on.** |
| `errors[]` | Extension, `validation_failed` only. `[{ path, code, message }]`. Field-level codes are append-only. |
| `existingRoundId` | Extension, `duplicate_round` only. The id of the already-stored round. |

### The closed, append-only code registry

Switch on `code`. The registry is **closed** — internal errors (tRPC shapes, Postgres/Supabase errors, schema internals) can only surface as one of these (`plans/005-phase0-contract.md:46-61`):

| `code` | HTTP | Meaning | What fitbull should do |
|---|---|---|---|
| `malformed_request` | 400 | Body is not parseable JSON, or wrong content type. | fitbull bug. Do not retry. (Wrong content type is **400**, not 415.) |
| `unauthorized` | 401 | Missing/invalid/expired/**revoked** Bearer token. | Refresh; if refresh fails, the grant is gone — re-consent. Never retry blind. |
| `forbidden` | 403 | Valid token, but the scope does not permit the operation, a resource the principal may not touch, or an operation RLS denies to this principal class. | Do not retry. Report — on a designed path this is a routing defect and handicappin is alerted. |
| `plan_required` | 403 | The account has not completed plan selection (no plan, or no profile row at all). | Surface "finish setup in the handicappin app" and retry later. Not a fitbull bug. |
| `not_found` | 404 | Resource absent — **or present but invisible under RLS. The two are deliberately indistinguishable** (an existence oracle would leak other users' data). | Treat as absent. Do not infer existence from a 404. |
| `idempotency_conflict` | 409 | An existing round matched `(userId, externalId)` and the submitted body differs. | §4. Stop retrying that key; the round exists. Carries **no** `existingRoundId`. |
| `duplicate_round` | 409 | Natural-key collision where the `(userId, externalId)` lookup found nothing. | §4. Read `existingRoundId`, reconcile locally, stop retrying. |
| `validation_failed` | 422 | Schema or API-side invariant violation; carries `errors[]`. | fitbull bug or bad user data. Do not retry unchanged; inspect `errors[]`. |
| `course_not_found` | 422 | Referenced `teeId`/`courseId` is not in the catalog. | Re-resolve via `GET /v1/courses` / `GET /v1/tees`. See the day-one caveat below. |
| `rate_limited` | 429 | Per-principal budget exhausted (§7). | Back off on `Retry-After`. |
| `internal_error` | 500 | Unexpected failure; no internal detail leaks. | Retry with backoff. Report if persistent. |
| `service_unavailable` | 503 | Dependency down — **including the fail-closed rate limiter** (§7). | Retry after `Retry-After: 60` with jitter. |

**`round_limit_reached` is deliberately absent** (`plans/005-phase0-contract.md:63`) — see §5.

**Caveat on `course_not_found`'s remedy.** The registry names the remedy as "the search-resolve reads or `POST /v1/courses`" (`:58`) — but `POST /v1/courses` is **deferred by D9** (`DECISIONS.md:54`). On day one, fitbull's only in-band remedy is re-resolving against `GET /v1/courses` / `GET /v1/tees`; a genuine catalog miss (the course is simply not in handicappin's catalog) has **no day-one API remedy**, and what fitbull should do in that case is undecided — see §10.

### Day-one validation invariants

These are part of v1's initial contract, and **narrowing validation after ship is a breaking change requiring `/v2`** — so these bounds are fixed (`plans/005-phase0-contract.md:217`):

- `strokes >= 1`
- `putts + penalties <= strokes - 1`
- `teeTime` within **`1990-01-01` … `now + 24h`** — outside that window is **422** with a field-level code (**D5**, `DECISIONS.md:34`, `plans/010-v1-implementation.md:121`). The lower bound is sized generously because historical backfill is a headline v1 benefit; the upper bound is clock-skew tolerance. Note that the *web and native* apps do **not** enforce this window — it is a `/v1`-boundary refinement only.

Cross-field rules like `putts + penalties <= strokes - 1` do not serialize into JSON Schema, so they appear only in the OpenAPI prose and as `errors[]` items at runtime (`plans/005-phase0-contract.md:44`). fitbull should validate them client-side too, to avoid a round-trip on a preventable 422.

### Responses that are NOT problem+json

**The contractual envelope covers application-emitted responses only** (`plans/005-phase0-contract.md:117`). fitbull's HTTP layer **must tolerate** non-problem responses from the framework and infrastructure layers:

- **404** from Next.js App Router for an unmatched path — emitted before any handler runs.
- **405** from Next.js for an un-exported HTTP method — likewise.
- **429** from the Vercel WAF rate-rule backstop — platform-generated, not problem+json.
- **5xx** from the platform.

Practical rule: **never assume the body is JSON.** Parse defensively — check the content type, and treat a body that fails to parse as an opaque infrastructure error keyed on the status code alone. A JSON parser that throws on an HTML error page is the single most likely way fitbull breaks against a healthy API. (This is not hypothetical for this project: an HTML challenge page returned where JSON was expected is exactly the failure that produced the ingress workstream — `DECISIONS.md:101-103`.)

---

## 9. Governance: LB-1 and LB-2 are hard, release-blocking requirements on the fitbull repo

These are not editorial preferences. They are **launch-blocking gates**: `/v1` does not ship to a *publicly released* fitbull until they are closed (`GOVERNANCE.md:126`). Both are **fitbull-repo release-checklist items, owner-executed at fitbull's public release** (`DECISIONS.md:49`, `GOVERNANCE.md:130`, `GOVERNANCE.md:149`).

Why they bind: fitbull ships to the **US** market (**U2 = yes**, `GOVERNANCE.md:117`) while a USGA GPA application track is open, and the USGA has stated in writing that "the estimator needs to be removed from the US market" (`GOVERNANCE.md:60`). fitbull's decision not to display the index (**U3**, `GOVERNANCE.md:118`) closes the display exposure by construction — but it does not close the two clauses below.

### LB-1 — the advertise clause

**fitbull must not advertise handicap features to US-market users while the GPA track is open.** Verbatim scope from `GOVERNANCE.md:129`:

> This binds fitbull's App Store listing, screenshots, and marketing copy in US-available regions (U2 = yes, fitbull ships to the US). Silent round-syncing is fine; a store screenshot captioned "track your handicap" is not.

The display half of LB-1 is **closed by construction** — there is no index display in any market, so the originally-envisaged geo-gating work is **not required** (`GOVERNANCE.md:128`). What survives is entirely a **marketing-surface** obligation: the exposure moved from the product surface to the store listing and marketing copy (`GOVERNANCE.md:88`).

Shipping `/v1` into a **private fitbull dev/TestFlight build is not blocked** by LB-1 (`GOVERNANCE.md:130`).

### LB-2 — the marks audit

**Zero WHS marks in fitbull's UI, store listings, or marketing.** Verbatim from `GOVERNANCE.md:132`:

> **LB-2 — Trademark audit of fitbull surfaces.** Before fitbull's public release: zero WHS marks (list in §2.2) in fitbull UI, store listings, or marketing. Use descriptive language ("handicap estimate (unofficial), calculated by handicappin from your rounds"), mirroring handicappin's disclaimer posture. One-pass audit, checklist kept with fitbull's release notes.

The claimed marks to audit against (`GOVERNANCE.md:38`): **World Handicap System™, WHS™, Handicap Index®, Score Differential™, Low Handicap Index™, Course Handicap™, Playing Handicap™, Course Rating™, Course Rating System™, SLOPE®, Bogey Rating™, Slope Rating™.**

Two notes that matter for a code review of fitbull:

- The **JSON field name `handicapIndex` is fine** — D2 decided the exposure unit is public display, not a JSON key (`DECISIONS.md:28`). The mark must not reach fitbull's **visible copy**, and a field name that leaks into a UI label is exactly how that happens. Same for `Course Rating` / `Slope Rating` values, which handicappin's computation consumes and which "must not be used for any other purpose without authorization" (`GOVERNANCE.md:40`).
- fitbull has **less** claim to nominative use than handicappin does, because it doesn't compute anything — it would merely display a number from another product (`GOVERNANCE.md:97`). Keep the marks out entirely.

### LB-3 — gates fitbull's public release

**LB-3 is owner sign-off on `GOVERNANCE.md` itself** (`GOVERNANCE.md:133`), and it is **still open** — `GOVERNANCE.md` is `Status: DRAFT`, the §7 checklist items 1 and 5 are unticked, and it is listed as owner-owed work in both `DECISIONS.md:61` and `plans/010-v1-implementation.md:139`. The definition of done for the entire `/v1` implementation includes "the owner has closed LB-3 before fitbull is publicly released" (`plans/010-v1-implementation.md:173`).

**fitbull's public release is gated on LB-3.** Development, integration, and private builds are not.

### One standing trigger for fitbull

**AM-3 — scope creep to third parties.** The whole governance-neutrality argument for the API holds **only while every consumer is first-party** (`GOVERNANCE.md:139`, `DECISIONS.md:108`). If fitbull ever proxies, resells, or re-exposes handicappin data to a party the owner does not own, `GOVERNANCE.md` must be revised **before** credentials are issued. Do not build a fitbull feature that forwards handicappin round or index data to any external service without reopening that document.

---

## 10. Undecided — the contract is silent, so this document does not answer

Listed explicitly, because a fabricated answer here becomes a false promise. If fitbull needs any of these, ask the handicappin side; do not infer.

1. **Route-by-route request and response JSON schemas.** The frozen contract explicitly does **not** decide them — they are built in 005 Phases 1+ from `apps/web/types/scorecard-input.ts` (`plans/005-phase0-contract.md:22`). The only committed statement about the round resource is that the 201 body contains **at least** the stored round (id, echo of client fields), server-derived values, `handicapIndex`, `handicapRevision`, and `status` (`:232`). **This document therefore contains no example request or response JSON** — every field name it uses is one the contract names.
2. **`GET /v1/courses` / `GET /v1/tees` query parameters, search semantics, pagination and response shape.** The corpus names only "course/tee search-resolve read endpoint in v1" (`DECISIONS.md:85`, `plans/005-w4-v1-contract-and-handlers.md:38`). Undecided.
3. **`GET /v1/rounds` filtering, ordering and pagination.** Undecided. Nothing in the contract states how fitbull scopes a reconciliation read to a particular round or time range — including whether it can be queried by `externalId`, which is the query fitbull most obviously wants.
4. **`GET /v1/health`'s response body**, and which rate-limit family it draws from. Undecided; it is described only as "cheap liveness for the canary" (`plans/005-w4-v1-contract-and-handlers.md:42`).
5. **Which scopes authorize which operations.** The access-token hook stamps `scope` with `rounds:write` appended **unconditionally** on OAuth-client tokens (`plans/005-phase0-contract.md:275`), and an operation a token's scope does not permit gets 403 (`:282`) — but the contract never enumerates the mapping, so whether `rounds:write` alone authorizes the four `GET` endpoints is **not stated**. Assume it works, but treat a `403 forbidden` on a read as a question for handicappin rather than a fitbull bug.
6. **What `POST /v1/rounds` does with a client-supplied `hcpStrokes`.** The contract names a **server-side `hcpStrokes` derivation step** as a build dependency that "neither 002 nor this contract specifies" (`plans/005-phase0-contract.md:29`, `:159`). Whether the request schema accepts, ignores, or rejects the field is undecided. It is excluded from replay comparison either way (`:158`).
7. **The field-level `code` for a `teeTime`-window violation.** D5 fixes the window and the 422 but names no code (`DECISIONS.md:34`); field-level codes are append-only and documented in OpenAPI prose (`plans/005-phase0-contract.md:44`). Match on `path`, not on an assumed code string.
8. **`externalId` format and length constraints.** Described only as "an optional client-supplied opaque string" (`plans/005-phase0-contract.md:129`). A UUID is the stated expectation and is safe; nothing else is guaranteed.
9. **Any recomputation-latency or poll-cadence number.** Explicitly not a contractual bound (`:241`), and unmeasured — 006 was to measure it first and has left the critical path (`DECISIONS.md:56`). §7's 120/min budget is the only stated bound on polling.
10. **The day-one remedy for a genuine catalog miss.** `course_not_found`'s documented remedy names `POST /v1/courses` (`:58`), which D9 defers. Whether fitbull should queue the round locally, drop it, or route the user to the handicappin web app is undecided.
11. **Unlock-on-upgrade timing.** The prose promises quarantined rounds are "unlocked automatically — no resubmission is needed" (`:245`), but says nothing about when a `GET /v1/rounds` read will reflect the flip.
12. **Whether `/v1` will ever accept a first-party (non-`client_id`) token from fitbull.** It does accept first-party tokens (`:286`), but that is an implementation property, **not the advertised contract** — the documented auth model is the OAuth flow (`:291`). fitbull must use the OAuth flow.

---

## 11. Discrepancies between handicappin's own source documents

Recorded so the fitbull team is not the one to discover them, and so the handicappin side can reconcile them. None of these changes what fitbull should build — the resolution column says which side this document follows.

| # | Discrepancy | This document follows |
|---|---|---|
| 1 | `course_not_found`'s remedy names `POST /v1/courses` (`plans/005-phase0-contract.md:58`), and `DECISIONS.md:86` (2026-07-22) says "course-submission endpoint **ships in v1**" — but **D9** (2026-08-05) defers it (`DECISIONS.md:54`). | **D9** — it is the later, explicitly locked decision. Flagged in §8 and §10.10. |
| 2 | The frozen eventual-consistency prose instructs clients to refetch **`GET /v1/profile`** and the rounds list (`plans/005-phase0-contract.md:241`), but D9 defers `GET /v1/profile` (`DECISIONS.md:54`). | **D9** — the prose is reproduced verbatim with the adjustment stated beside it (§5). |
| 3 | The `idempotency_conflict` client prose attributes divergence to the round being "edited in the handicappin app" (`plans/005-phase0-contract.md:166`), while the same section's own analysis states **no round-edit flow exists in web or native** and only `notes` is client-writable (`:162`). | The prose verbatim, with the narrower true cause noted (§4). Remedy is identical either way. |
| 4 | `plans/010-v1-implementation.md:80-84` (T7) describes four statements in the contract as stale — but commit `fcd1267` already corrected them; §249/§253/§256/§162 on `main` all read the corrected way. | The **contract as it stands on `main`**. T7 appears already discharged; the plan text is now stale about its own task. |
| 5 | `plans/005-w4-v1-contract-and-handlers.md:46` says the rate-limit key is "`client_id` as the key"; §3 and D6 fix it as the **`(client_id, user)` pair** (`plans/005-phase0-contract.md:196`, `DECISIONS.md:36`). | **The pair.** Already formally reconciled by D6; noted only for completeness. |
| 6 | `GOVERNANCE.md` §4 and §7.1 still carry the working premise that fitbull will surface the index, with the correction living in an amendment note (`GOVERNANCE.md:86-91`) and in ledger rows U2/U3 (`:117-118`). §7.1 remains unticked. | **D8 / the amendment** — fitbull displays no index. This is LB-3's remaining sign-off work, not a live ambiguity. |

---

## Definition of done for W6

- [x] A committed integration note covering base URL, auth, day-one calls, idempotency, polling, error handling, and quarantine-status handling.
- [ ] Handed to the fitbull repo and mirrored there (fitbull-side action).
- [ ] LB-1 advertise-clause + LB-2 marks audit executed on the fitbull release checklist (owner, at fitbull's public release — `GOVERNANCE.md:149`).
- [ ] LB-3 owner sign-off on `GOVERNANCE.md` closed before fitbull's public release (`plans/010-v1-implementation.md:173`).

Verification of the API surface itself is fitbull's own integration tests plus handicappin's canary (`plans/010-v1-implementation.md:109`); there is nothing to run in this repo for this document.
