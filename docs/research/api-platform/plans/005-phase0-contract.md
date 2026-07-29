# 005 Phase 0 — Frozen `/v1` Contract (Checkpoint A)

**Date:** 2026-07-29 (rev. 3 — second adversarial-review pass) · **Status:** FROZEN pending the four owner sign-off items at the end · **Workstream:** W4 Phase 0 (`plans/005-w4-v1-contract-and-handlers.md` §Phase 0; Checkpoint A per `plans/000-INDEX.md`).

This document is the contract-design gate output. It freezes the six least-reversible decisions of the `/v1` surface **before any handler is written**. Every decision below is grounded in a locked ADR entry, a synthesis condition, or shipped/in-review code; where the corpus is silent, that is said explicitly rather than papered over.

**Sources of authority** (this doc records and reconciles; it does not relitigate):

- `docs/research/api-platform/DECISIONS.md` (locked ADR; incl. the three 2026-07-29 sign-off sections on branch `docs/api-platform-signoffs-and-009`: updateUser residual accepted + detect-and-revoke, overlap-audience-only v1, `api.handicappin.com` LIVE).
- `docs/research/api-platform/plans/005-w4-v1-contract-and-handlers.md` (Phase 0 mandate — referenced, not edited; PR #172 touches it).
- `docs/research/api-platform/plans/000-INDEX.md` §Conflicts (quarantine semantics resolutions 1–3).
- `docs/research/api-platform/topics/public-contract-shape/synthesis.md` (binding conditions 7–12).
- `docs/research/api-platform/topics/scorecard-write-semantics/synthesis.md` (§1 decided items; conditions **C1–C6 live in §3**).
- `docs/research/api-platform/topics/golf-api-landscape/synthesis.md` condition **9** — the "internal/unstable (docs + **response header**)" mandate (§4; this is landscape 9, *not* DECISIONS #5, which mandates the internal/unstable posture but names no header).
- `apps/web/server/services/scorecard/errors.ts` (the domain error set the mapper must cover) and, on branch `api-platform/003-bundled-migration`, its `DuplicateRoundError` / `mapRoundInsertError` additions.
- Branch `api-platform/003-bundled-migration` (in review — treated as the intended shape): `docs/research/api-platform/plans/003-notes.md` (duplicate semantics) and `supabase/migrations/20260729100000_round_natural_key_and_api_columns.sql` (the two unique keys + `quarantined`).
- Shipped PR #167 code: `apps/web/server/api/trpc.ts`, `supabase/migrations/20260728090000_oauth_client_id_claims.sql`, `supabase/migrations/20260728091000_oauth_client_rls_deny.sql`, `apps/web/lib/oauth/consent-flow.ts`; spike record `plans/004-spike-results.md`.
- `apps/web/lib/rate-limit.ts` (fail-closed public-API limiter, shipped in 001).

**What this doc does NOT decide:** route-by-route request/response schemas (built in 005 Phases 1+ from `apps/web/types/scorecard-input.ts`), poll cadences and the queue-kick (006), the *storage mechanism* for the recalc-failed marker (006 — this doc only reserves the contract value, §5), the governance gate (008), numeric rate budgets and the `teeTime` sanity-window bounds (owner, below).

**Correction to an earlier draft of this list:** `GET /v1/profile`'s OAuth-visible shape is **not** an open 006 question — it is already closed by shipped code. `20260728091000_oauth_client_rls_deny.sql` denies `client_id` principals all direct `profile` access and provides `get_connected_profile()`, which returns exactly five non-billing columns (`id`, `name`, `handicap_index`, `verified`, `created_at`); its own comment states "the 005 /api/v1 read surface consumes the same accessor". What remains open in 006 is only the *first-party* view's billing-column exposure.

**New build dependencies this gate creates** (not previously in 005's scope — see §1/§5):
- `public.get_connected_entitlement()` — a SECURITY DEFINER entitlement accessor, **required** before any `/v1` route can evaluate `plan_required` (§1; without it every OAuth request false-positives) — **plus** the `/v1` adapter that injects it as `getUserAccess` into the 002 service, without which the false positive simply moves inside the service (§1).
- 002 **Part B** (accept-and-quarantine) must land **before** any `/v1` write route ships, or §5's quarantine prose documents fiction (§5).
- A **server-side `hcpStrokes` derivation step** for the `/v1` write path, which neither 002 nor this contract specifies (§2).

---

## 1. Error envelope — RFC 9457 problem+json

**Decision (LOCKED).**

- Every **application-emitted** non-2xx response from `/api/v1/*` — i.e. one produced by a `/v1` route handler or its shared middleware — has media type **`application/problem+json`** (RFC 9457) and a body with members:
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
| `forbidden` | 403 | Valid token, but a `scope` the token carries does not permit the operation, a resource the principal may not touch, **or an operation RLS denies to this principal class** (SQLSTATE **42501** `insufficient_privilege` — e.g. an OAuth principal attempting a `profile` write). |
| `plan_required` | 403 | The account has **not completed plan selection** — no plan selected, **or no profile row at all**. Determined via `get_connected_entitlement()` (below) — never by a failed `profile` read. Remedy differs by principal class (below). A real error (DECISIONS §Billing gate). |
| `not_found` | 404 | Resource absent — or present but invisible to this principal under RLS. The two are **deliberately indistinguishable** (an existence oracle would leak other users' data). |
| `idempotency_conflict` | 409 | An existing round matched `(userId, externalId)` **by lookup**, and the submitted body differs (§2 rule 3). |
| `duplicate_round` | 409 | Natural-key collision where the `(userId, externalId)` **lookup found nothing** — no externalId supplied, or the existing row carries a different/NULL `externalId` (§2 rules 4–5). Carries `existingRoundId`. |
| `validation_failed` | 422 | Schema or API-side invariant violation; carries `errors[]`. |
| `course_not_found` | 422 | Referenced `teeId`/`courseId` is not in the catalog. Remedy: the search-resolve reads or `POST /v1/courses` (DECISIONS #6 catalog-miss). |
| `rate_limited` | 429 | Per-principal budget exhausted (§3). |
| `internal_error` | 500 | Unexpected failure; no internal detail leaks. |
| `service_unavailable` | 503 | Dependency down — including the fail-closed rate limiter (§3). |

- **`round_limit_reached` is deliberately NOT in the registry.** Per the closed billing gate (DECISIONS 2026-07-27; `000-INDEX.md` §Conflicts 1–2), an over-limit round is **not an error**: `POST /v1/rounds` stores it and returns **201 with `status: "quarantined"`** (§5). There is no 403-for-over-limit anywhere in `/v1`. If a future non-write surface ever needs to *name* the limit state, it gets a new appended code at that time — nothing is reserved now.
**Domain error → code mapping** (the closed set the central mapper must cover; source `apps/web/server/services/scorecard/errors.ts`, plus `DuplicateRoundError` on branch `api-platform/003-bundled-migration`). Anything not in this table is `internal_error` + a Sentry alert:

| Domain error | `/v1` result |
|---|---|
| `SelfSubmissionError` | 403 `forbidden` |
| `PlanNotSelectedError` | 403 `plan_required` |
| `CourseResolutionError` | 422 `course_not_found` (the referenced tee did not resolve to an approved, non-archived row) — note this is **stricter than tRPC**, which maps it to `INTERNAL_SERVER_ERROR` |
| `DuplicateRoundError` | **not mapped directly** — §2's lookup decides between 200 replay / `idempotency_conflict` / `duplicate_round`. The error carries only `key: "natural-key" \| "external-id"` and **no round id**, so the handler must run its own lookup (§2). |
| `RoundLimitReachedError` | **500 `internal_error` + Sentry alert.** Under §5's contract this is unreachable: the service quarantines instead of raising. If it ever surfaces on `/v1`, the quarantine promise is broken and that is a defect, not a client-facing condition. |
| `RoundLimitRaceError` | **500 `internal_error` + Sentry alert.** 002 Part B deletes this path entirely (`000-INDEX.md` §Conflicts 1); same "should be impossible" marker. |
| SQLSTATE 42501 | 403 `forbidden` (see registry note). Every occurrence also raises a Sentry alert: on a designed path it means a principal class reached an operation RLS forbids, i.e. a routing defect. |

**Entitlement determination — a required new component, because the obvious path is broken.** `plan_required` must be computed from `get_connected_entitlement()`, specified here and built in 005:

- Today `getComprehensiveUserAccess` (`apps/web/utils/billing/access-control.ts:24-36`) reads `profile` through the **request-scoped RLS client** with `.single()`. For a `client_id`-bearing token the restrictive policy "OAuth client tokens cannot select profile" (`20260728091000_oauth_client_rls_deny.sql:50-55`) returns **zero rows** → `.single()` errors → `createNoAccessResponse()` → `PlanNotSelectedError` → **403 `plan_required` for a fully provisioned user, on every fitbull request**. The function's own comment (`:16-21`) predicts exactly this failure for bearer principals. `get_connected_profile()` returns no plan column, so there is currently **no RLS-legal way** for an OAuth request to determine entitlement at all.
- **The fix is not a service-role client.** Passing service-role here would move the authorization boundary into app code — the posture DECISIONS #3 explicitly rejects ("the tRPC allowlist is not a security boundary"; RLS is the control that holds).
- **Specified shape** — a SECURITY DEFINER accessor in the exact mould of `get_connected_profile()`, in `supabase/migrations/`, callable by **both** principal classes:

```sql
CREATE OR REPLACE FUNCTION public.get_connected_entitlement()
RETURNS TABLE (
  is_provisioned       boolean,  -- profile.plan_selected IS NOT NULL
  has_unlimited_rounds boolean,  -- derived from the plan; hides WHICH plan
  rounds_limit         integer,  -- NULL when unlimited; the free-tier lifetime cap otherwise
  rounds_used          integer   -- COUNT(public.round) for auth.uid() WHERE quarantined = false
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$ ... FROM public.profile p WHERE p.id = auth.uid() ... $$;  -- row filter hard-coded to auth.uid()
REVOKE EXECUTE ON FUNCTION public.get_connected_entitlement() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_connected_entitlement() TO authenticated;
```

  It returns **only** those four derived facts. It deliberately does **not** return `plan_selected`, `subscription_status`, `current_period_end`, `cancel_at_period_end`, `billing_version`, `billing_provider`, or any Stripe identifier — a connected app learns whether the user may write another round, never what they pay. The boundary stays in the database (SECURITY DEFINER + hard `auth.uid()` filter), not in app code. `rounds_used` counts **non-quarantined** rounds only, matching the free-tier counting site 003 updates (`utils/billing/access-control.ts`); a quarantined round is invisible to it by design, so `rounds_used` never inflates past `rounds_limit` because of quarantined rows.
  - **`search_path = ''` with fully-qualified references** (`public.profile`, `public.round`, `auth.uid()`), not `= public`. `get_connected_profile()` uses `= public`, but the repo's recent hardening migrations use `= ''` (`20260502095005_enqueue_trigger_security_definer.sql:16`; 003's `set_round_updated_at`), it is Supabase's documented recommendation, and it is the direction the repo is moving. No live shadowing surface exists today (neither `authenticated` nor `anon` holds CREATE on `public`), so this is hygiene rather than a live hole — but the migration is new, so it gets written the hardened way.
  - **Required migration comment:** `rounds_limit` is safe to expose only while every finite cap equals the single free-tier value. If a future plan ever carries a *different* finite cap, `rounds_limit` becomes a **plan fingerprint** and leaks the tier this function exists to hide — revisit it at that point (return only a boolean "may write another round" instead).
- **The `/v1` call path must INJECT an RPC-backed `getUserAccess` — the RPC alone does not fix anything.** `getUserAccess` is an injected dependency (`SubmitScorecardDeps.getUserAccess`, `submit-scorecard.ts:117`), and the tRPC adapter injects the RLS-backed `getComprehensiveUserAccess(userId, ctx.supabase)` (`round.ts:172-173`). A `/v1` handler that reuses that implementation re-introduces the false positive **inside the service**: `deps.getUserAccess(userId)` at `:298` → `!access.hasAccess` at `:300` → `PlanNotSelectedError` at `:302` → the same 403 this whole component exists to prevent. So the requirement is explicit: **the `/v1` adapter injects an entitlement adapter backed by `get_connected_entitlement()`, never `getComprehensiveUserAccess`.**
- **The adapter's `FeatureAccess` mapping, spelled out** — because `getUserAccess` must return `FeatureAccess` (`apps/web/types/billing.ts:14-24`), which requires `plan`, `status`, `currentPeriodEnd`, `isLifetime`, `hasPremiumAccess`, `hasUnlimitedRounds`, `remainingRounds`, `hasAccess` — and the deliberately plan-blind RPC supplies none of the billing-identity fields. The service reads exactly three of them (`hasAccess` at `:300`, `plan === "free"` and `remainingRounds` at `:306`), so the mapping is:

| `FeatureAccess` field | From the RPC | Note |
|---|---|---|
| `hasAccess` | `is_provisioned` | the only input to the `plan_required` decision |
| `hasUnlimitedRounds` | `has_unlimited_rounds` | passthrough |
| `plan` | `has_unlimited_rounds ? "lifetime" : "free"` | **synthesized, and this is the load-bearing line.** The service's free-tier branch keys on `access.plan === "free"` (`:306`), so a wrong value here silently skips or wrongly applies the round-limit branch. `"lifetime"` is chosen as the unlimited stand-in because it is the plan whose semantics are "unlimited, no period" — it must NOT be `"premium"`, which carries period/renewal semantics the RPC cannot supply. |
| `remainingRounds` | `has_unlimited_rounds ? Infinity : max(0, rounds_limit - rounds_used)` | drives the limit branch with `plan: "free"` |
| `isLifetime` | `has_unlimited_rounds` | consistent with the synthesized `plan` |
| `hasPremiumAccess` | `has_unlimited_rounds` | not read by `submitScorecard`; must not be `true` for a free account |
| `status` | `"active"` | synthesized. The RPC cannot distinguish a lapsed subscription, so **an entitlement question the RPC cannot answer must be answered by the RPC, not by the adapter**: if `/v1` ever needs subscription-status nuance, add the derived boolean to the RPC rather than guessing here. |
| `currentPeriodEnd` | `null` | synthesized; deliberately not exposed to a connected app |

  Because `plan` and `status` are synthesized, the adapter is **not** a general-purpose `FeatureAccess` source and must be named and commented as `/v1`-only, so nobody reuses it on a path that reads the fields it fakes.
- **Empty result — named explicitly.** The RPC returns **zero rows** (not `is_provisioned = false`) when the caller has no `profile` row at all. That is reachable: the provisioning invariant is literally "create the profile row if missing". Frozen mapping: **zero rows → `403 plan_required`**, the same as `is_provisioned = false`. Rationale: from a client's perspective both mean "this account cannot write rounds until it is set up", and the remedy is identical; a 500 would tell a truthful client to retry something no retry fixes. §1's registry wording is therefore "account has **not completed plan selection**", which covers both the missing-row and null-plan cases — not "account exists but…". The zero-row case additionally raises a **Sentry alert**, because a user holding a valid access token with no profile row indicates a provisioning defect worth seeing.
- **`POST /v1/profile/provision` is unreachable for OAuth principals as specified, and this gate does not pretend otherwise.** The provisioning insert as a `client_id` principal is blocked by "OAuth client tokens cannot insert profile" (42501), and UPDATE is blocked too — so the advertised remedy would 403. Frozen resolution: **the endpoint is first-party-only**, and for an OAuth principal the `plan_required` remedy is **user-side** — the user completes plan selection in the handicappin app; the connected app surfaces that instruction and retries. This is coherent with the overlap-audience-only sign-off (v1 serves users who already have a handicappin account). If the owner instead wants provisioning callable *by* a connected app, that requires a second SECURITY DEFINER RPC enforcing the locked provisioning invariant (explicit, idempotent, `plan_selected='free'`, `billing_version` bump, `PLAN_SELECTED` event) — **not** in this freeze; it would be new 005 scope. The 004 "auth-decision-independent fallback" role is unaffected: the endpoint still exists, just for first-party principals.
- **Host scoping.** `isPublicApiRequest` (`apps/web/lib/rate-limit.ts:275-286`) matches the `/api/v1` path **OR** the `api.handicappin.com` host, so `www.handicappin.com/api/v1` is reachable today and gets the fail-closed limiter. Contractually, **`api.handicappin.com` is the only supported base host**: `/api/v1` on any other host is unsupported, may be blocked without notice, and on the orange-clouded web zone remains subject to the Cloudflare challenge that started this whole workstream. Enforcing a host guard on `/v1` is 005 build scope (001 already ships host-guard negative tests).
- **Infrastructure caveat, documented honestly:** the Vercel WAF rate-rule backstop (DECISIONS #4; OWNER item in 001) emits platform-generated 429s that are **not** problem+json. Neither are the framework's own responses: Next.js App Router emits its **404** for an unmatched path and **405** for an un-exported HTTP method before any handler runs. The OpenAPI description states that clients must tolerate a non-problem 404/405/429/5xx from the framework and infrastructure layers; the *contractual* envelope covers application-emitted responses only.

**Rationale.** RFC 9457 + closed registry is locked (DECISIONS #5, conditions 9/11); the only degrees of freedom here were the `type` scheme, the member set, and the registry contents. A per-code `type` URI plus a required `code` member gives clients one canonical switch key while keeping the RFC-standard shape tools understand.

**Rejected alternatives.** `about:blank` + `code`-only (loses the RFC-native type identity for zero savings); tRPC-shaped error JSON (rejected in DECISIONS #5); per-route bespoke error bodies (the exact drift the central mapper exists to prevent); putting `round_limit_reached` in the registry as 403 (contradicts the closed billing gate).

---

## 2. Idempotency — `externalId`-primary, replay-by-lookup

**Decision (LOCKED — DECISIONS #6 owner-delegated 2026-07-22; duplicate semantics decided in `003-notes.md`).**

Keyed on the migration's `UNIQUE("userId", "externalId")` (NULLS DISTINCT; `20260729100000_round_natural_key_and_api_columns.sql`). `externalId` is an optional client-supplied opaque string on `POST /v1/rounds` (fitbull sends its own round UUID). Semantics:

1. **Key present, no existing row** → insert → **201** (§5 body contract).
2. **Key present, existing row, identical body** → **200** with the existing round, in the same response shape as the 201 — reflecting **current** server state (its `status` may be `quarantined`; its `handicapRevision` may have advanced from `"pending"` to `"current"` or `"failed"`, §5). Replay never re-runs limit checks and never mutates. A retrying background-sync client must converge, not error (Terra/Stripe-success style).
3. **Key present, existing row, different body** → **409 `idempotency_conflict`**. The client has a bug or reused a key; nothing is written.
4. **No key supplied** → the natural key is the only guard: `UNIQUE NULLS NOT DISTINCT ("userId", "teeId", "teeTime", nine_hole_section)`. A collision → **409 `duplicate_round`** with `existingRoundId` in the problem body. No body comparison and no 200-replay on this path — without a client-asserted key the server cannot distinguish "retry" from "second genuine round entered twice", so it reports the conflict and lets the client decide.
5. **Key present, and the `(userId, externalId)` lookup finds nothing, but the natural key collides** → **409 `duplicate_round`** with `existingRoundId`. This is `003-notes.md`'s "natural-key collision **without an externalId match**" — the date-only-backfill case it made non-destructive.
6. **Concurrency:** two same-key requests racing — the loser catches the unique violation, **re-runs the lookup below**, then applies rules 2/3/5 from the lookup result. No advisory locks, no key table (the long-transaction key-claim middle ground was explicitly rejected by the scorecard panel, Q2).

**Which rule fires is decided by a LOOKUP, never by the constraint name.** This is load-bearing, so it is spelled out:

- **Why the constraint name cannot be trusted.** When a submission violates **both** keys at once — same `(userId, externalId)` *and* same `(userId, teeId, teeTime, nine_hole_section)`, which is precisely the shape of an **ordinary duplicate submit** — Postgres reports **one** constraint, and which one depends on index OID order (the natural-key constraint is created first in `20260729100000_...sql`, so it wins today; reversing the two `ALTER TABLE` statements would flip it). `mapRoundInsertError` therefore returns `DuplicateRoundError("natural-key")` for the common case. Branching on that discriminator would make rule 2's legitimate identical retry return **409 `duplicate_round`** instead of the 200 replay, and would swap the two 409 codes for most same-key collisions. It would also make rule 6 impossible.
- **The decision procedure, in full** (`externalId` present). Two lookups exist and they run at different times — the **replay lookup** is PRE-insert, the **natural-key lookup** is POST-rollback:
  1. **Replay lookup (pre-insert):** `SELECT ... FROM round WHERE "userId" = $1 AND "externalId" = $2`.
  2. **Row found** → compare bodies → rule **2** (200 replay) or rule **3** (409 `idempotency_conflict`). Return without attempting an insert. The natural key is irrelevant here, whether or not it would also have collided — **a matched key wins over a simultaneous natural-key collision**, and that precedence is the whole point of the procedure.
  3. **No row** → **attempt the insert**, then branch on the outcome:
     - **Insert succeeds** → **201** (rule **1**). This is the ordinary first-time submission and the common path.
     - **Natural-key violation** → run the **natural-key lookup** (below, post-rollback) → **409 `duplicate_round`** with `existingRoundId` (rule **5**).
     - **`externalId` violation** → a concurrent request with the same key won the race; **re-run step 1** and apply rules 2/3 from what it finds (rule **6**).
     - **Any other error** → unmapped; `internal_error`.
  - When **no `externalId` is supplied**, steps 1–2 do not apply: attempt the insert, and on a natural-key violation run the natural-key lookup → **409 `duplicate_round`** (rule **4**).
- **The natural-key lookup that produces `existingRoundId`** (rules 4 and 5) — the handler must do this itself, because `DuplicateRoundError` carries only `key: "natural-key" | "external-id"` and **never a round id** (`errors.ts:74-84` on branch `api-platform/003-bundled-migration`): `SELECT id FROM round WHERE "userId" = $1 AND "teeId" = $2 AND "teeTime" = $3 AND "nine_hole_section" IS NOT DISTINCT FROM $4`. It reuses **N1**'s absent ≡ null rule for `nine_hole_section` (an 18-hole round submits it absent and stores NULL, and the constraint is `NULLS NOT DISTINCT`, so the predicate must match NULL to NULL — a plain `= $4` silently finds nothing and would degrade the 409 into a 500; `IS NOT DISTINCT FROM` is the one-clause idiom and still discriminates front from back) and **N3**'s UTC-instant canonicalization for `teeTime` (the same value the constraint compared). If the lookup finds no row, the violation was not one of these two keys and the error passes through unmapped.
- **Ordering:** the natural-key lookup runs **after** the failed insert has rolled back. Inside an aborted transaction every subsequent statement raises `25P02 in_failed_sql_transaction`, so it must be issued on a clean transaction — a fresh transaction/connection, or a `ROLLBACK TO SAVEPOINT` taken before the insert. The replay lookup in step 1 has no such constraint: it precedes the insert entirely.

**"Identical body", concretely** (the part that must not be hand-waved):

- Compared **after** zod parse of the `/v1` request schema — i.e. on the canonical parsed object: unknown keys stripped, schema defaults applied, and the three normalizations below applied to **both** sides.
- **Compared fields** — every client-controlled field that determines the stored round (from the v1 submission schema derived from `apps/web/types/scorecard-input.ts`): `teeId`, `teeTime`, `nineHoleSection` (absent ≡ 18-hole), `notes`, and the per-hole `scores` array: `strokes`, `putts`, `penaltyStrokes`, `fairwayHit`. Those last three **are** the shot-detail set (`submit-scorecard.ts:797-800`) — there is no further shot-detail tier to hedge about.
- **Excluded from comparison:** server-derived fields (`hcpStrokes`, `approvalStatus`, any handicap output), server metadata (`id`, `createdAt`, `updated_at`, `quarantined`, `submitted_via`), and `externalId` itself.
- **`hcpStrokes` — the actual current behavior, stated precisely.** Scorecard synthesis §1(c) *decides* that `hcpStrokes` is server-derived at the API boundary, but that is **not yet true in code**: `submit-scorecard.ts:795` persists the **client-supplied** `hcpStrokes: score.hcpStrokes` verbatim. The async recompute ignores it (`addHcpStrokesToScores` re-derives), but the **provisional index returned in the 201 does not** — it is computed in-transaction from what the client sent. So `/v1` needs a **server-side derivation step before the service call**, which neither 002 nor this contract specifies; it is named as a build dependency above. Excluding `hcpStrokes` from the replay comparison is correct either way: once derivation lands the field is server-owned, and until then two retries of the same body derive the same value anyway.
- **Mechanism:** deep-equality of the parsed submission against the stored round's re-derived projection (a field-by-field comparison, not a stored fingerprint). Any mismatch in any compared field → rule 3.

**The comparison is against MUTABLE state — decided: post-hoc divergence IS a genuine conflict.** Rounds are editable after creation (by the user in the web app, and by the OAuth token itself via PostgREST, where `round` UPDATE remains open for the non-protected columns), so this sequence is real: fitbull submits → the user corrects a score in the handicappin UI → fitbull's background sync retries the original body → bodies differ → **409 `idempotency_conflict`**. Frozen answer: that 409 is **correct and is not treated as a spurious failure**, because the alternative — identity-only replay, returning 200 for any key match regardless of body — would silently swallow a genuinely different round the client believed it stored, which is data loss on the product's core artifact. The failure modes are asymmetric: a 409 costs a log line, an identity-only 200 costs a round.

What makes this safe is that the 409 must be *documented as non-escalating*. The OpenAPI prose for `idempotency_conflict` says:

> `409 idempotency_conflict` means this idempotency key already identifies a stored round whose contents differ from what you sent. **The round exists** — do not retry with the same key, and do not treat this as a lost write. If you did not intend to submit different contents, the round was most likely edited in the handicappin app after you created it; treat the stored round as authoritative, stop retrying that key, and re-read the round if you need its current state.

This is a different class from N1/N2/N3 below: those are *representation* artifacts where server state never changed, and they are bugs. This one is real state divergence, where the honest answer is to report it. Note the conflict window only opens after an edit, and by then the retry's actual purpose — ensuring the round is stored — is already satisfied.

**Rejected alternative** (worth recording because it looks attractive): gate the comparison on "has this round been modified since creation" via 003's `updated_at`, replaying identity-only for edited rounds. Rejected on a concrete mechanism failure — `updated_at` is **timestamptz** while `createdAt` is **timestamp without time zone** (`20260729100000_...sql:73`; `db/schema.ts`), so `updated_at = "createdAt"` requires an implicit cast whose result depends on the session `TimeZone`, and a tolerance window instead ("modified if more than a second apart") is a heuristic standing between a client and its billing-relevant write. Not a discriminator to hang idempotency on.

**Three normalizations, pinned against the real write path** (`apps/web/server/services/scorecard/submit-scorecard.ts`). Each exists because naive deep-equality would emit a **spurious 409** on a legitimate retry — the exact failure replay-by-lookup exists to prevent:

- **(N1) Absent ≡ null ≡ "not tracked"** for every optional per-hole field. The write path persists `putts: score.putts ?? null`, `fairwayHit: score.fairwayHit ?? null`, `penaltyStrokes: score.penaltyStrokes ?? null` (`submit-scorecard.ts:798-800`), so a client that **omits** `putts` submits `undefined` while the stored row — and therefore the re-derived projection — yields `null`. Both sides are normalized to `null` before comparison, so `undefined`, `null`, and an omitted key are all the same value. This rule applies to **every** optional per-hole field, present and future: any nullish-coalesced column added to `scoreInserts` inherits it.
- **(N2) Hole identity is by submission position (0-indexed), not by course hole number.** The write path binds scores to holes by **array index** into a section-aware slice of the tee's 18 holes (`submit-scorecard.ts:776-793`): 18-hole → `dbHoles[0..17]`, 9-hole front → `dbHoles[0..8]`, 9-hole **back** → `dbHoles[9..17]`. The submitted `scores` array carries no hole-number field, so the canonical comparison key is **submission position** `i ∈ [0, len)`, and the projection maps each stored row back to a position via its hole's course `holeNumber`: `position = holeNumber - 1` for 18-hole and 9-hole front, and **`position = holeNumber - 10` for 9-hole back** (stored course hole numbers 10–18 → positions 0–8). Comparison is therefore **positional and order-sensitive** — the arrays are compared index-by-index, which supersedes the earlier "order-independently by hole number" wording; the submitted array's order *is* the hole assignment, so a reordered array is a different round, not a retry.
- **(N3) `teeTime` canonicalizes to the UTC instant, which is exactly what the DB stores.** `round.teeTime` is `timestamp` **without** time zone (`apps/web/db/schema.ts:269`) — unlike 003's `updated_at`. The write path does `teeTime: new Date(teeTime)` (`submit-scorecard.ts:733`), and Drizzle's non-`withTimezone` `PgTimestamp.mapToDriverValue` is `value.toISOString()`, whose trailing `Z` Postgres discards on insert into a naive column; reads reconstitute via `new Date(value + "+0000")`. Net effect: the column holds the **UTC rendering of the instant**, and the round-trip is instant-preserving. So the comparison canonicalizes `teeTime` to `new Date(submitted).toISOString()` and compares against the stored instant rendered the same way. Consequence, and the reason this matters: the **same** canonical value is what the natural-key unique constraint compares, so `2026-07-29T16:32:00+02:00` and `2026-07-29T14:32:00Z` are one round to both the constraint and the replay comparison — they cannot disagree about what a duplicate is. **No truncation is applied**: `003-notes.md`'s "minute-precision wall-clock" describes what web/native clients already emit (an observed property of prod data), *not* a server-side rounding step; truncating in the comparison but not in the constraint would make the comparison call distinct rows identical and replay the wrong round.

**Implementation note (005 build) — four merge-blocking test cases**, each of which returns the **200 replay**, not a 409:

- retry-without-putts (N1),
- retry-of-a-back-nine-round (N2),
- retry-of-the-same-instant-with-a-different-timezone-offset (N3),
- **retry that violates BOTH keys at once** — same `externalId` *and* same `(userId, teeId, teeTime, nine_hole_section)`, i.e. the ordinary duplicate submit. This is the case Postgres reports as the natural-key constraint; it must still take the lookup path to rule 2. Its mirror is also required: same `externalId`, both keys violated, **changed** `strokes` → 409 **`idempotency_conflict`** (not `duplicate_round`).

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
- **Breaking** (requires `/v2`, which does not exist and is not planned): removing or renaming an endpoint, response field, or error code; changing a field's type or semantics; adding a **required** request field; **narrowing validation on an existing field after ship** (the day-one API-side invariants — `strokes >= 1`, `putts+penalties <= strokes-1`, and the `teeTime` sanity window — are part of v1's initial contract, not a later tightening; **because that makes the window's bounds unfixable without `/v2`, sizing them is an owner sign-off item below**, not a value this gate sets by omission); changing the status code of an existing outcome (e.g. `POST /rounds` is 201 — moving it is breaking); repurposing an existing `code` or `type` URI; removing a documented enum value.
- **Non-breaking (additive):** new endpoints; new **optional** request fields; new response fields; new error codes (registry is append-only); new values in enums documented as **extensible** — the round `status` field (§5) is documented extensible, and clients must treat unknown values as "not active"; later support for an `Idempotency-Key` header (DECISIONS #6). The OpenAPI description states the **tolerant-reader requirement**: clients MUST ignore unknown response fields.
- **Stability marker:** the surface is **internal/unstable** until a second consumer exists (DECISIONS #5). Every `/v1` response carries **`X-API-Stability: internal`** (golf-api-landscape condition 9 mandates "docs + response header" but names no header; the name is fixed here), and the OpenAPI `info.description` carries the same banner. While internal, breaking changes are permitted **only** with same-owner coordination (fitbull) and a dated entry in the changelog file (`CHANGELOG` under the v1 tree — condition 11).
- **Deprecation posture:** **no** RFC 9745 `Deprecation` / RFC 8594 `Sunset` header machinery and **no** published 12-month deprecation policy until a consumer the developer does not own exists (condition 12 — explicit non-goal; the policy lives "in a drawer" and is published the week a real stranger integrates).

**Rationale.** All four elements are locked upstream; this section only pins the operational definitions (what counts as breaking; the header name; the canonical base URL) so handler PRs can't relitigate them one review at a time.

**Rejected alternatives.** Header/media-type versioning (rejected with DECISIONS #5 — `/v1` path is the convergent norm of the target domain: WHOOP/Oura/Strava); shipping Sunset/Deprecation headers now (condition 12 explicitly defers); a `/v1` → `/api/v1` host-level rewrite for prettier docs (the corpus is silent on it; not invented here — can be added later without breaking anything since the canonical path keeps working).

---

## 5. Eventual consistency + quarantine — the contractual statements

**Decision (LOCKED — DECISIONS #6 + closed billing gate; scorecard synthesis §1(b) unanimous; hosting C.9).**

`POST /v1/rounds` returns **201 Created, synchronously — never 202, never 200 on first write, never 403 for an over-limit round**. The 201 body is the round resource including at least: the stored round (id, echo of client fields), server-derived values, **`handicapIndex`** (provisional), **`handicapRevision`**, and **`status`**. The 200 replay (§2 rule 2) uses the identical shape.

**The two extensible enums, with their value domains pinned:**

- **`status`: `"active" | "quarantined"`** — extensible; unknown values are treated as **not active**.
- **`handicapRevision`: `"pending" | "current" | "failed"`** — extensible; unknown values are treated as **not current**. `pending` = the authoritative recomputation has not completed and `handicapIndex` is provisional; `current` = it has completed and the index reflects this round; `failed` = it was attempted and did not complete, so the index is stale and will not self-correct without operator action. **This field appears nowhere in the codebase today** — only `"pending"` existed in the corpus (DECISIONS #6). The three-value domain is fixed here because `MASTER_PLAN.md:354` requires that "consumer must distinguish recalc-pending from recalc-failed" and hosting C.9 requires queue-lag/failure alerting; a two-value domain would make the failed state unrepresentable, and adding a *third* value later is only non-breaking if clients were told the enum is extensible from day one. **What this gate does not decide:** how the failed state is detected and stored (a marker on the round, a submission-status resource, or queue introspection) — that is 006's, per the same MASTER_PLAN line. The contract reserves the value; 006 wires it.

**Exact OpenAPI prose — eventual consistency** (verbatim into the spec description; satisfies hosting-stack C.9's "state eventual consistency explicitly"):

> `POST /v1/rounds` returns `201 Created` synchronously. The `handicapIndex` in the response is **provisional**: the authoritative handicap recomputation runs **asynchronously**, after the write commits. Until it completes, the response carries `handicapRevision: "pending"`, and the handicap index returned by `GET /v1/profile` or `GET /v1/rounds` may not yet reflect the round you just submitted. Do not treat any index read within moments of a write as final. `handicapRevision` becomes `"current"` once the authoritative value reflects this round, or `"failed"` if the recomputation was attempted and did not complete (the index is then stale and will not self-correct on its own — surface it as stale rather than as up to date). **Treat this field as extensible: any value you do not recognize means "not current."** To converge, refetch the profile **and** the rounds list together after a submission and on app foreground; typical recomputation latency is documented separately and is not a contractual bound.

**Exact OpenAPI prose — quarantine** (verbatim into the spec description):

> A round submitted through `POST /v1/rounds` while the account is over its free-tier round limit is **accepted and stored**, and the request succeeds with `201 Created` and `"status": "quarantined"` in the response body. A quarantined round is excluded from the handicap computation and from the account's round count until the account upgrades, at which point it is unlocked automatically — no resubmission is needed. **Treat `status` as extensible: any value you do not recognize means "not active."** Quarantine is **not an error**: `POST /v1/rounds` never returns `403 Forbidden` because of the round limit, and no `round_limit_reached` error code exists on this endpoint. The only billing-related error on this surface is `plan_required` (`403`), returned when the account has not completed plan selection; the account holder resolves it in the handicappin app.

**This prose is contingent on 002 Part B, which is not built — and the ordering requirement is therefore hard.** `submit-scorecard.ts:281-285` currently **throws** for any `overLimitPolicy !== "reject"` ("not implemented yet … blocked on 003's round.quarantined column"), and the reject path raises `RoundLimitReachedError`, which §1 maps to a 500 + Sentry alert. So **no `/v1` write route may ship before 002 Part B lands**; shipping earlier would publish a spec that documents behavior the server does not have. Accordingly the earlier flat assertion is corrected: the handler **will pass** `overLimitPolicy: "quarantine"` to the 002 service once Part B exists — today no handler and no quarantine path exist. (The `quarantined` column and its exclusion from both counting sites ship in 003's bundled migration; the handler still contains no gating logic itself.)

**Scope of the guarantee — `/v1` only, and deliberately so.** The quarantine promise holds for rounds written **through `POST /v1/rounds`**. The same OAuth token can `INSERT` directly into `round` via PostgREST — `20260728091000_oauth_client_rls_deny.sql:31-36` leaves round/score `INSERT`/`UPDATE`/`SELECT` open by design (write-only-by-default posture) and denies only `DELETE` — and such a row lands **`quarantined = false`, i.e. active for counting purposes**, having never passed the limit check. This is the RLS insert side door recorded as a **shipping gate** (billing-and-metering condition 1). The contract therefore states the guarantee as a property of the `/v1` path, not as an absolute property of the account, and closing the door with a DB-level guard remains a precondition for the token-bearing consumer going live.

**How much of that door 003 has already closed** (described against the branch as it now stands — commits `3382da1`, `88e7ff7`, `3a7daa0` — because an earlier draft of this paragraph was stale in both directions):

- **The un-quarantine hole is CLOSED, not open.** An earlier draft cited `003-notes.md` for "the permissive round-UPDATE policy lets a user clear `quarantined`". That is 003-notes describing the **pre-existing** problem it then fixed: the migration now does `revoke update on public.round from authenticated, anon` followed by a column-level `grant update (...)` whose list **excludes** `quarantined`, `approvalStatus`, `externalId`, `submitted_via`, and `updated_at`. A PATCH of any of those returns **42501** (→ 403 `forbidden`, §1). Note the trap the migration documents: a column-level REVOKE is a no-op while the table-level grant is held, which is why it revokes at table level first.
- **A side-door INSERT cannot reach the handicap.** 003 adds restrictive policy 6c (`quarantined = false and "approvalStatus" <> 'approved'`), so an authenticated direct INSERT can only create a **non-quarantined, non-approved (pending)** round. The handicap processor filters on `approvalStatus = 'approved' AND quarantined = false`, so such a row is **excluded from the handicap computation**. It does still count toward the free-tier count (which filters only on `quarantined = false`), so the residual impact is inflated usage, not a corrupted index.
- **A side-door INSERT cannot squat idempotency keys.** The INSERT column grant excludes `externalId` and `submitted_via` (commit `3a7daa0`), so `authenticated` cannot set them at all — closing both the deterministic-key squat (which would have made a later legitimate `/v1` submission 409 forever on that key) and `submitted_via` attribution forgery. This directly protects §2's key space.
- **Net residual, unchanged in substance:** a direct PostgREST INSERT still creates a round that never passed the limit check and lands active-for-counting. That is the shipping-gate item. What it is *not* is a path to an approved round, a handicap change, a cleared quarantine flag, or a stolen idempotency key — 003 closed all four. 003 is under active hardening, so anyone acting on this paragraph should re-read the branch rather than trust this snapshot.

**Rationale.** Sync-201 was unanimous ("202 would be Strava cosplay for a millisecond transaction"); quarantine-as-201 is the closed billing gate, threaded through 000-INDEX conflicts 1–2. The `status` enum (rather than exposing the raw `quarantined` boolean) keeps the axis extensible without a breaking change and keeps the DB column name out of the contract.

**Rejected alternatives.** 202 + polling resource (rejected unanimously); 403 `round_limit_reached` for over-limit (contradicts the closed gate; explicitly superseded per 000-INDEX §Conflicts 2); a `quarantined: boolean` response field (freezes the axis; enum extension is non-breaking); omitting the staleness statement or promising a latency bound (006 measures real recalc latency first — a contractual bound now would be invented).

---

## 6. Auth statement

**Decision (LOCKED — DECISIONS #3 + spike results; matches the shipped PR #167 code, verified against the files below).**

**Exact OpenAPI prose** (verbatim into the spec's Authorization section):

> All `/api/v1` endpoints require `Authorization: Bearer <access token>`, where the token is a Supabase-issued access token obtained through the handicappin OAuth 2.1 authorization flow (authorization code + PKCE, consent at the app-hosted `/oauth/consent` page; refresh via `POST /auth/v1/oauth/token` with client authentication). Tokens issued to an OAuth client carry a `client_id` claim and a `scope` claim. `/api/v1` is the only application surface that accepts such tokens: the application's own first-party surfaces (for example its tRPC endpoint) reject them outright. Note that this is not a claim of total network isolation — the underlying Supabase database API remains reachable with the same token, constrained by row-level security policies rather than by this API. Requests without a valid token receive `401` (`unauthorized`) — including tokens that have been revoked, since validation is performed server-side against the authorization server on every request, and including an OAuth-client token that arrives without a `scope` claim. An operation a token's scope does not permit receives `403` (`forbidden`). Access tokens contain no billing information. Do not request the `openid` scope.

Grounding, so the statement matches what shipped rather than what was planned:

- **Rejection in tRPC context:** `apps/web/server/api/trpc.ts` — `isExternalOAuthClientToken()` (line 91) decodes the JWT payload (decode-only, not verification) and any `client_id`-bearing Bearer token is rejected in `createTRPCContext` (line 211) with the logged reason "client_id claim present; external tokens are /api/v1-only". First-party surfaces stay external-inaccessible by default.
- **Scope claim:** `supabase/migrations/20260728090000_oauth_client_id_claims.sql` — the `custom_access_token_hook` preserves `client_id`/`ref` and stamps `scope` with `rounds:write` appended **unconditionally** on OAuth-client tokens (Phase-1 fixed-capability model; Supabase per-client scopes are unshipped, discussion #38022). `/v1` enforcement points are therefore written against `scope` from day one and do not move when real scopes ship. First-party tokens get no `scope` claim and no `client_id`. OAuth tokens get **no billing claims** (mandatory-denied to `client_id` principals).
- **Validation path:** `getUserFromBearerToken` → `supabase.auth.getUser(token)` (network check). Spike criterion iii: revocation via `revokeGrant` takes effect in ~47 ms on this path; **local JWKS/`getClaims()` validation is prohibited for external tokens** because it would silently miss revocation.
- **RLS backstop:** `20260728091000_oauth_client_rls_deny.sql` — `client_id` deny-policies on billing/profile tables are the real security boundary (the tRPC allowlist and the `/v1` gate are placement, not authorization; the PostgREST side door is why deny-policies are mandatory, DECISIONS #3). The RLS `round`-insert side door remains a **shipping gate** for the token-bearing consumer (billing-and-metering condition 1), tracked in 005's build, not re-decided here.
- **Consumers:** v1 serves only users who already have a handicappin account (overlap-audience-only sign-off, 2026-07-29); fitbull holds tokens server-side in Convex.
- **Truthfulness of the rejection sentence.** An earlier draft said OAuth tokens "are rejected by every other authenticated surface of the application" — that is **false** and has been rewritten. PostgREST accepts them **by design**: the deny migration leaves round/score `INSERT`/`UPDATE`/`SELECT` open (`20260728091000_oauth_client_rls_deny.sql:31-36`), and spike criterion vi proved direct PostgREST reads *and* writes plus GoTrue `GET /auth/v1/user` all succeed with an OAuth token. The prose now scopes the claim to the app's own first-party surfaces and states plainly that the database API stays reachable under RLS.
- **One answer for a scope-less token — and principal class is NEVER inferred from claim absence.** Principal class is determined by **`client_id` presence**, matching how §3 keys the rate limiter and how `isExternalOAuthClientToken` already decides in tRPC. The three cases are therefore:
  - **No `client_id`** → first-party principal. No scope check applies; full-capability on its own user, exactly as on tRPC.
  - **`client_id` present, `scope` present** → OAuth principal. An operation the scope does not permit → **403 `forbidden`**.
  - **`client_id` present, `scope` ABSENT** → **rejected** (`401 unauthorized`), plus a Sentry alert. It is never treated as full-capability.

  That last case is the fix for a fail-open: an earlier draft said "a token with no `scope` claim IS a first-party token", which is only true while the hook stamps `scope` unconditionally. If the hook regresses, is bypassed, or a token predates it, that inference hands a `client_id`-bearing token full first-party capability — fail-open in the exact place this section establishes a capability boundary. Absence of a claim is not evidence of provenance; `client_id` is.
- **First-party tokens at `/v1`:** the corpus mandates the one-way restriction (external tokens `/v1`-only) but is **silent** on the converse. Default frozen here: `/v1` accepts any **valid** Supabase Bearer access token — first-party (no `client_id`, keyed `user:{sub}` in §3) or OAuth-client — since the native app shares the `api.handicappin.com` host (`apps/web/lib/rate-limit.ts:267` comment) and nothing in the corpus restricts `/v1` to external tokens.
- **Consequence, stated openly: `/v1` serves two principal classes with asymmetric RLS treatment.** The same route, same code path, same user can see different data depending on whether the token carries `client_id`. A first-party token reads the full `profile` row; an OAuth token gets **zero rows** from `profile` and must go through `get_connected_profile()` (five non-billing columns) and `get_connected_entitlement()` (§1). This is intentional — it is the deny-policy doing its job — but it means every `/v1` handler that touches profile/billing data must be written for the OAuth path first, and any handler tested only with a first-party token is untested on the path that matters. Two consequences for the build: **integration tests must cover both principal classes per route**, and response shapes must not promise fields the OAuth path cannot supply.

**Rationale.** Everything except the last bullet is locked or shipped; the statement is written to be checkable against the four files above. The last bullet is the only default this gate adds, and it is the least-commitment reading of the corpus (rejecting first-party tokens at `/v1` would be a *new* restriction with no upstream mandate).

**Rejected alternatives.** Documenting "send your raw Supabase session token" as *the* auth model (the second-migration trap public-contract-shape condition 3 warned about — the documented model is the OAuth flow; first-party acceptance is an implementation property, not the advertised contract); local JWKS validation (misses revocation — spike iii); requesting `openid` scope (500s under HS256 signing — spike finding); accepting external tokens on tRPC with an allowlist (rejected in DECISIONS #3: not a security boundary).

---

## OWNER SIGN-OFF REQUIRED

Only genuinely owner-level items — everything else above is frozen under this gate's delegated authority:

1. **Numeric rate budgets.** The principal, key shape, fail-closed behavior, and response contract are frozen in §3; the **numbers** per route family (rounds-write, course-submission, reads, provision) are prod-ops values set via the `RATE_LIMIT_*` env vars, and the Vercel WAF backstop rule threshold is already an OWNER item from 001. Owner sets/confirms the figures before launch.
2. **Rate-limit key wording delta.** §3 keys authenticated `/v1` traffic on the `(client_id, user)` pair; `005-w4-v1-contract-and-handlers.md` literally says "`client_id` as the key". The pair is the reading consistent with DECISIONS #4's "per-identity" and avoids a one-bucket-for-all-fitbull-users collapse, but it sharpens a plan sentence — one-line ack requested.
3. **`teeTime` sanity-window bounds.** §4 makes the window a day-one invariant **and** makes post-ship narrowing a breaking change — so its bounds are frozen at ship and unfixable without `/v2`. The corpus treats sizing as an open owner/product call three times (scorecard synthesis §1(c) "sized for historical backfill — see C6"; C6 "an over-tight window quietly kills it"; and 003 resolved only that **no** window applies to the unique *key*, deliberately leaving the *validation* window open). Historical backfill of old rounds is a headline v1 benefit, so an over-tight lower bound silently kills the launch use case; an absent upper bound lets a clock-skewed or malicious client park rounds in the future and distort the handicap timeline.
   **Proposed default, needs one word of confirmation:** lower bound **1990-01-01**, upper bound **now + 24 h** (clock skew tolerance), rejection as `422 validation_failed` with a field-level code. Owner may widen the lower bound freely (widening later is non-breaking) but should not want it tighter later, since tightening is not.
4. **`POST /v1/profile/provision` is first-party-only — a product-visible capability decision.** §1 freezes this because the OAuth insert path is blocked by RLS (42501), but the *consequence* is product-level, not mechanical: **an existing handicappin account that never completed plan selection cannot be provisioned through the connected app at all.** Such a user's fitbull sync fails with `403 plan_required` until they open the handicappin app themselves and pick a plan. Given the overlap-audience-only sign-off (v1 serves users who already have an account) this is likely a small population, but it is a real dead-end in the connected experience and it is the owner's call whether that is acceptable for v1. The alternative is a second SECURITY DEFINER RPC enforcing the locked provisioning invariant (explicit, idempotent, `plan_selected='free'`, `billing_version` bump, `PLAN_SELECTED` event), which would be new 005 scope. **No implementation should assume either answer** — the endpoint's principal scope is the one frozen decision in this doc that a single owner sentence can flip.

## Corpus-silent items resolved by default in this doc (ack-by-silence is fine)

This list is the document's honesty mechanism, so it is deliberately long: everything below was decided **by this gate**, not inherited from a locked decision. None of it is owner-level on its own, but all of it is now frozen.

**Error envelope (§1)** — the corpus mandated only "RFC 9457 problem+json with a small, closed, append-only code set":

- The `type` URI scheme `https://api.handicappin.com/problems/{code}`, non-dereferenceable for now, and the choice never to use `about:blank`.
- Making `code` a **required** extension member (the RFC requires none) and the `errors[]` / `existingRoundId` extension members.
- The registry contents and their status codes — specifically **`plan_required` as 403** and **`course_not_found` as 422** (the corpus names both codes but assigns neither a status; 404 for a missing catalog entry and 402 for an unprovisioned account were both plausible).
- **`not_found` conflating absent with RLS-invisible** — a deliberate refusal to build an existence oracle, but a contract commitment nobody upstream asked for.
- **Wrong content type → 400 `malformed_request`, not 415 `Unsupported Media Type`** — one fewer code, at the cost of being less HTTP-idiomatic.
- The domain-error → code mapping table, including sending `RoundLimitReachedError` / `RoundLimitRaceError` to **500 + Sentry** as "should be impossible", and **SQLSTATE 42501 → 403 `forbidden`** rather than a new registry code (justification: 42501 *is* "an operation this principal may not perform", and once the entitlement RPC exists a 42501 on a designed path is a routing defect, which the Sentry alert is for).
- Mapping `CourseResolutionError` to a client-facing 422, which is **stricter than tRPC's** current `INTERNAL_SERVER_ERROR`.
- `get_connected_entitlement()`'s existence, its exact four returned fields, its `search_path = ''` hardening, the requirement that the `/v1` adapter inject it as `getUserAccess`, the whole synthesized `FeatureAccess` mapping (notably `plan: has_unlimited_rounds ? "lifetime" : "free"`), and **zero rows → `plan_required` + Sentry** (§1) — the corpus requires that `plan_required` be determinable but specifies no mechanism, and the shipped code provides none.
- `rounds_used` counting **non-quarantined rounds only** (§1) — consistent with 003's counting site, but a contract-visible semantic nobody upstream stated.
- `POST /v1/profile/provision` being **first-party-only** (§1) — now **promoted to owner sign-off item 4**, since it removes a capability from the connected experience rather than merely picking a mechanism.
- The hard **ordering gate this doc creates**: no `/v1` write route may ship before 002 Part B (§5). The corpus sequences 002 before 005 but never makes Part B specifically blocking on the write routes; that requirement is this gate's, and it is the kind of constraint an implementer would otherwise discover by publishing a spec the server can't honor.
- That `idempotency_conflict` deliberately carries **no `existingRoundId`** (§1/§2) — only `duplicate_round` does. The rationale is that a key-match conflict means the client already knows which round it addressed, whereas a natural-key collision surprises the client with a round it did not name; but the corpus asked for the id on neither, so both the inclusion and the omission are this gate's.
- The precedence rule that a **matched `externalId` wins over a simultaneous natural-key collision** (§2) — the corpus specifies both keys and both 409s, but never which one governs when both fire, which is the single most common collision shape.
- That framework-emitted 404/405 and infrastructure-emitted 429/5xx are outside the envelope (§1).
- That **`api.handicappin.com` is the only supported base host** and `/api/v1` on other hosts is unsupported (§1) — reachable today, and the corpus never says it shouldn't be.

**Idempotency (§2)** — beyond the locked "externalId-primary, replay-by-lookup":

- The entire "identical body" definition: parse-then-compare, the compared/excluded field lists, and the N1/N2/N3 normalizations.
- That **post-hoc divergence is a genuine conflict** rather than identity-only replay, and the non-escalating client guidance attached to `idempotency_conflict` (§2).
- **Deciding rules by lookup rather than by constraint name**, the pre-insert/post-rollback split, and the ordering requirement.
- Excluding `hcpStrokes` from comparison while the server does not yet derive it (§2).

**Rate limiting (§3)** — the corpus locks "Upstash per-identity limits" and nothing else:

- The `(client_id, user)` pair key and its `client:{id}:user:{sub}` encoding (also owner item 2).
- **Per-route Redis prefixes** replacing today's single global `ratelimit:public-api` bucket.
- The response contract: **`Retry-After` plus the `X-RateLimit-Limit`/`-Remaining`/`-Reset` trio**, and fail-closed → **503** rather than 429.

**Versioning (§4)** — the corpus locks the `/v1` path and the deferral of Sunset/Deprecation machinery:

- The whole **breaking vs non-breaking taxonomy**, including "changing an existing outcome's status code is breaking" and "narrowing validation after ship is breaking".
- The **tolerant-reader requirement** (clients MUST ignore unknown response fields).
- The stability header's name **`X-API-Stability: internal`** (golf-api-landscape 9 mandates a header, names none).
- No `/v1` → `/api/v1` URL prettification; canonical base `https://api.handicappin.com/api/v1`.

**Response semantics (§5)** — the corpus mandates "a distinguishable status field" and `handicapRevision: "pending"`:

- The field name and enum **`status: "active" | "quarantined"`**, its extensibility, and the rule **"treat an unknown value as not active"**.
- **`handicapRevision`'s entire value domain `"pending" | "current" | "failed"`** and its extensibility — the field exists nowhere in the codebase and only `"pending"` was ever specified.

**Auth (§6):**

- That `/v1` also accepts **first-party** (non-`client_id`) Bearer tokens — the corpus mandates only the one-way restriction.
- That principal class keys on **`client_id` presence**, and that a `client_id` token arriving **without** a `scope` claim is **rejected** rather than treated as first-party.

**Two citation corrections applied in this revision:** the internal/unstable **response-header** mandate is **golf-api-landscape condition 9**, not DECISIONS #5 (which mandates the posture but names no header); and conditions **C1–C6 live in scorecard-write-semantics §3**, not §1.
